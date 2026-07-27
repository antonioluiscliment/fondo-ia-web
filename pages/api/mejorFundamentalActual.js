// pages/api/mejorFundamentalActual.js
//
// "Mejor fundamental": elige los componentes mejor clasificados HOY
// según el criterio fundamental elegido (una sola consulta por lotes
// a Yahoo Finance, sin histórico — Yahoo no da un histórico diario de
// PER/EPS/etc. por esta vía), y después, sin rebalanceo ninguno,
// calcula qué combinación de Nº DE COMPONENTES (entre 3 y 6) y PESOS
// habría dado la mayor rentabilidad acumulada en la ventana de
// backtest — para poder comparar el resultado con los demás métodos
// de selección en igualdad de condiciones.
//
// Cómo se calculan los pesos óptimos: como la cartera no se
// rebalancea nunca, su rentabilidad total en el periodo es
// exactamente la media ponderada de la rentabilidad de cada
// componente por separado (no hay efecto de interacción entre ellos
// al no reajustarse). Maximizar esa media ponderada, sujeta al tope
// de diversificación por valor, tiene una solución exacta: darle el
// máximo peso permitido (el tope) al valor que más ha subido en el
// periodo, el máximo peso permitido con lo que quede al segundo que
// más ha subido, y así sucesivamente — sin necesidad de probar
// combinaciones. Esto se repite para cada nº de componentes de 3 a 6
// (con los top 3/4/5/6 según el criterio fundamental) y se elige el
// que dé mayor rentabilidad total.
//
// Reglas de clasificación (quién entra en la cartera, no los pesos):
//   - PER, PER futuro, precio/valor contable: de MENOR a MAYOR, y
//     solo se consideran valores positivos (un PER negativo, por
//     pérdidas, no es "mejor" que uno positivo bajo — se descarta).
//   - EPS, EPS futuro, rentabilidad por dividendo: de MAYOR a MENOR.
//
// Los valores sin dato para el criterio elegido, o que no pasan el
// filtro de positividad cuando aplica, quedan fuera de la
// clasificación (se informa cuántos y cuáles en "excluidos").
//
// Parámetros de la query:
//   indice   - id del índice a analizar.
//   criterio - uno de: per, perFuturo, eps, epsFuturo, pvc, dividendo.
//   max      - tope de diversificación por valor (por defecto, PESO_MAXIMO).
//   dias     - ventana de backtest (por defecto, DIAS).

import {
  getYahooFinanceInstance,
  mensajeErrorAmigable,
  obtenerDatosAlineados,
  obtenerRentabilidadIndice,
  PESO_MAXIMO,
  DIAS,
} from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const N_MIN = 3;
const N_MAX = 6;

// Campo de Yahoo y sentido de la clasificación para cada criterio.
const CRITERIOS = {
  per: { campo: "trailingPE", orden: "asc", soloPositivos: true },
  perFuturo: { campo: "forwardPE", orden: "asc", soloPositivos: true },
  pvc: { campo: "priceToBook", orden: "asc", soloPositivos: true },
  eps: { campo: "epsTrailingTwelveMonths", orden: "desc", soloPositivos: false },
  epsFuturo: { campo: "epsForward", orden: "desc", soloPositivos: false },
  dividendo: { campo: "dividendYield", orden: "desc", soloPositivos: false },
};

function numeroValido(valor) {
  return typeof valor === "number" && !Number.isNaN(valor);
}

// Rentabilidad total (fracción, no %) de un valor entre el primer y
// el último cierre de la serie ya descargada.
function retornoTotal(cierres) {
  const inicial = cierres[0].cierre;
  const final = cierres[cierres.length - 1].cierre;
  return final / inicial - 1;
}

// Asigna el máximo peso permitido (pesoMaximo) al valor con mayor
// retorno, luego el máximo posible con lo que quede al siguiente, y
// así sucesivamente. Si al llegar al final aún queda peso por
// asignar (solo puede pasar si nº_componentes × pesoMaximo < 100),
// se reparte el resto a partes iguales entre todos, como única salida
// razonable ante un tope demasiado bajo para esa cantidad de valores.
function asignarPesosOptimos(candidatosConRetorno, pesoMaximo) {
  const ordenados = [...candidatosConRetorno].sort((a, b) => b.retorno - a.retorno);
  const pesos = {};
  let restante = 100;
  for (const c of ordenados) {
    const asignar = Math.min(pesoMaximo, restante);
    pesos[c.ticker] = asignar;
    restante -= asignar;
  }
  if (restante > 0.0001) {
    const extra = restante / ordenados.length;
    for (const c of ordenados) pesos[c.ticker] += extra;
  }
  return pesos;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);

    const criterioId = req.query.criterio;
    const criterio = CRITERIOS[criterioId];
    if (!criterio) {
      throw new Error(`El parámetro 'criterio' debe ser uno de: ${Object.keys(CRITERIOS).join(", ")}.`);
    }

    const pesoMaximo = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;
    const diasVentana = req.query.dias !== undefined ? Number(req.query.dias) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    // 1) Clasificar todos los componentes por el criterio fundamental de HOY.
    const cotizaciones = await yahooFinance.quote(indice.tickers, {
      fields: ["symbol", criterio.campo],
    });
    const porTicker = Object.fromEntries(cotizaciones.map((c) => [c.symbol, c]));

    const candidatos = [];
    const excluidos = [];
    for (const ticker of indice.tickers) {
      const c = porTicker[ticker];
      const valor = c ? c[criterio.campo] : undefined;
      if (!numeroValido(valor) || (criterio.soloPositivos && valor <= 0)) {
        excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker], valor: numeroValido(valor) ? valor : null });
        continue;
      }
      candidatos.push({ ticker, nombre: indice.nombresEmpresas[ticker], valor });
    }
    candidatos.sort((a, b) => (criterio.orden === "asc" ? a.valor - b.valor : b.valor - a.valor));

    if (candidatos.length < N_MIN) {
      throw new Error(
        `Hacen falta al menos ${N_MIN} componentes con valor válido para este criterio, y solo hay ${candidatos.length} en este momento.`
      );
    }

    // 2) Descargar los precios de los top N_MAX candidatos (los que
    // pueda necesitar cualquiera de los tamaños de cartera a probar).
    const nMaxReal = Math.min(N_MAX, candidatos.length);
    const topCandidatos = candidatos.slice(0, nMaxReal);
    const tickersPrecio = topCandidatos.map((c) => c.ticker);
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana, tickersPrecio);

    const retornoPorTicker = {};
    for (const ticker of tickersPrecio) {
      retornoPorTicker[ticker] = retornoTotal(datos[ticker]);
    }

    // 3) Probar cada nº de componentes de N_MIN a nMaxReal y quedarse
    // con el que dé mayor rentabilidad total.
    let mejor = null;
    for (let n = N_MIN; n <= nMaxReal; n++) {
      const topN = topCandidatos.slice(0, n);
      const conRetorno = topN.map((c) => ({ ...c, retorno: retornoPorTicker[c.ticker] }));
      const pesos = asignarPesosOptimos(conRetorno, pesoMaximo);
      const rentabilidadPct = Number(
        (conRetorno.reduce((acc, c) => acc + (pesos[c.ticker] / 100) * c.retorno, 0) * 100).toFixed(4)
      );
      const cartera = conRetorno
        .map((c) => ({ ticker: c.ticker, nombre: c.nombre, valor: c.valor, retornoPeriodoPct: Number((c.retorno * 100).toFixed(3)), peso: Number(pesos[c.ticker].toFixed(2)) }))
        .sort((a, b) => b.peso - a.peso);

      if (!mejor || rentabilidadPct > mejor.rentabilidadPct) {
        mejor = { n, cartera, rentabilidadPct };
      }
    }

    let rentabilidadIndice = null;
    if (fechas.length > 1) {
      rentabilidadIndice = await obtenerRentabilidadIndice(yahooFinance, fechas[0], fechas[fechas.length - 1], indice.simboloIndice);
    }

    res.status(200).json({
      indice: indice.id,
      criterio: criterioId,
      fechaHoraUTC: new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, ""),
      nComponentes: mejor.n,
      cartera: mejor.cartera,
      excluidos,
      diasVentana,
      fechaInicio: fechas[0],
      fechaFin: fechas[fechas.length - 1],
      rentabilidadCartera: { rentabilidadPct: mejor.rentabilidadPct, nDias: fechas.length },
      rentabilidadIndice,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
