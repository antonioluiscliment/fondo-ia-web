// pages/api/mejorFundamentalActual.js
//
// "Selección por fundamental (todos los índices)": para CADA índice
// del catálogo (no solo el elegido en el marco exterior — así se
// pueden comparar entre sí), elige los componentes mejor clasificados
// HOY según el criterio fundamental elegido (una sola consulta por
// lotes a Yahoo Finance por índice, sin histórico — Yahoo no da un
// histórico diario de PER/EPS/etc. por esta vía), y después, sin
// rebalanceo ninguno, calcula qué combinación de Nº DE COMPONENTES
// (entre 3 y 6) y PESOS habría dado la mayor rentabilidad acumulada
// en la ventana de backtest de ESE índice.
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
// EPS y EPS futuro se normalizan dividiendo por el precio actual
// (EPS/Precio × 100, en porcentaje — el inverso del PER, también
// llamado "rentabilidad por beneficio" o "earnings yield"): comparar
// el EPS en bruto entre valores no tiene sentido, porque una acción
// con una cotización alta tiende a tener un EPS más alto solo por
// eso, sin que la empresa sea mejor — dos empresas solo son
// comparables por esta vía atendiendo al cociente con el precio, no
// al importe absoluto del beneficio por acción.
//
// Los índices se procesan uno detrás de otro (no en paralelo): con 8
// índices, cada uno necesitando una consulta por lotes más la
// descarga de precios de hasta 6 valores, hacerlo todo a la vez
// arriesgaría a topar con los límites de peticiones de Yahoo Finance.
// Si un índice concreto falla (p.ej. un fallo puntual de red), no
// tira abajo la respuesta entera: ese índice sale con su propio
// mensaje de error, y los demás se muestran igualmente.
//
// Parámetros de la query:
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
import { INDICES } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const N_MIN = 3;
const N_MAX = 6;

const CRITERIOS = {
  per: { campo: "trailingPE", orden: "asc", soloPositivos: true },
  perFuturo: { campo: "forwardPE", orden: "asc", soloPositivos: true },
  pvc: { campo: "priceToBook", orden: "asc", soloPositivos: true },
  eps: { campo: "epsTrailingTwelveMonths", orden: "desc", soloPositivos: false, normalizarPorPrecio: true },
  epsFuturo: { campo: "epsForward", orden: "desc", soloPositivos: false, normalizarPorPrecio: true },
  dividendo: { campo: "dividendYield", orden: "desc", soloPositivos: false },
};

function numeroValido(valor) {
  return typeof valor === "number" && !Number.isNaN(valor);
}

function retornoTotal(cierres) {
  const inicial = cierres[0].cierre;
  const final = cierres[cierres.length - 1].cierre;
  if (inicial === null || inicial === undefined || inicial === 0 || final === null || final === undefined) return null;
  return final / inicial - 1;
}

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

// Calcula el resultado de "mejor fundamental" para UN índice. Puede
// lanzar (el llamante decide cómo tratarlo por índice).
async function calcularParaIndice(indice, criterio, pesoMaximo, diasVentana) {
  const cotizaciones = await yahooFinance.quote(indice.tickers, {
    fields: ["symbol", criterio.campo, "regularMarketPrice"],
  });
  const porTicker = Object.fromEntries(cotizaciones.map((c) => [c.symbol, c]));

  const candidatos = [];
  const excluidos = [];
  for (const ticker of indice.tickers) {
    const c = porTicker[ticker];
    const bruto = c ? c[criterio.campo] : undefined;

    if (!numeroValido(bruto)) {
      excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker], valor: null });
      continue;
    }

    let valor = bruto;
    if (criterio.normalizarPorPrecio) {
      const precio = c ? c.regularMarketPrice : undefined;
      if (!numeroValido(precio) || precio <= 0) {
        excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker], valor: null });
        continue;
      }
      // EPS/Precio × 100: rentabilidad por beneficio (earnings yield),
      // el inverso del PER — así sí es comparable entre valores con
      // cotizaciones muy distintas.
      valor = Number(((bruto / precio) * 100).toFixed(3));
    }

    if (criterio.soloPositivos && valor <= 0) {
      excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker], valor });
      continue;
    }
    candidatos.push({ ticker, nombre: indice.nombresEmpresas[ticker], valor });
  }
  candidatos.sort((a, b) => (criterio.orden === "asc" ? a.valor - b.valor : b.valor - a.valor));

  if (candidatos.length < N_MIN) {
    const e = new Error(
      `Hacen falta al menos ${N_MIN} componentes con valor válido para este criterio, y solo hay ${candidatos.length}.`
    );
    e.insuficiente = true;
    throw e;
  }

  const nMaxReal = Math.min(N_MAX, candidatos.length);
  const topCandidatos = candidatos.slice(0, nMaxReal);
  const tickersPrecio = topCandidatos.map((c) => c.ticker);
  const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana, tickersPrecio);

  const retornoPorTicker = {};
  for (const ticker of tickersPrecio) {
    retornoPorTicker[ticker] = retornoTotal(datos[ticker]);
  }

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

  return {
    indice: indice.id,
    nombreIndice: indice.nombre.es,
    nComponentes: mejor.n,
    cartera: mejor.cartera,
    excluidos,
    fechaInicio: fechas[0],
    fechaFin: fechas[fechas.length - 1],
    rentabilidadCartera: { rentabilidadPct: mejor.rentabilidadPct, nDias: fechas.length },
    rentabilidadIndice,
  };
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

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

    const resultados = [];
    for (const indice of INDICES) {
      try {
        const resultado = await calcularParaIndice(indice, criterio, pesoMaximo, diasVentana);
        resultados.push(resultado);
      } catch (errorIndice) {
        if (errorIndice.insuficiente) {
          resultados.push({
            indice: indice.id,
            nombreIndice: indice.nombre.es,
            insuficiente: true,
            mensaje: errorIndice.message,
          });
          continue;
        }
        resultados.push({
          indice: indice.id,
          nombreIndice: indice.nombre.es,
          error: mensajeErrorAmigable(errorIndice),
        });
      }
    }

    res.status(200).json({
      criterio: criterioId,
      fechaHoraUTC: new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, ""),
      diasVentana,
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
