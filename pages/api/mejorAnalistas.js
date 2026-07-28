// pages/api/mejorAnalistas.js
//
// "Selección de los analistas": elige los componentes del índice
// elegido mejor valorados HOY por el consenso de analistas de Yahoo
// Finance (recommendationMean: 1 = compra fuerte, 5 = venta fuerte),
// y después, sin rebalanceo ninguno, calcula qué combinación de Nº DE
// COMPONENTES (entre 3 y 6) y PESOS habría dado la mayor rentabilidad
// acumulada en la ventana de backtest — mismas limitaciones que
// "Mejor fundamental": Yahoo no da un histórico diario de
// recomendaciones, así que la clasificación no varía a lo largo de la
// ventana (es la de HOY aplicada retroactivamente al precio).
//
// A diferencia de PER/EPS/etc. (que se consultan con una sola llamada
// por lotes para todo el índice), el consenso de analistas
// (recommendationMean, recommendationKey, numberOfAnalystOpinions)
// solo está disponible en el módulo "financialData" de Yahoo, que se
// consulta VALOR POR VALOR — no existe una versión ligera por lotes.
// Por eso aquí, a diferencia de "Mejor fundamental", hay que
// consultar TODOS los componentes del índice elegido uno a uno (en
// tandas de tamaño limitado, no todos a la vez, para no saturar a
// Yahoo Finance de golpe). En índices grandes (Nasdaq 100, 101
// valores) esto tarda notablemente más y hay algo más de riesgo de
// que algún valor puntual falle — si eso pasa, simplemente se excluye
// de la clasificación, no rompe el resto.
//
// Solo se consideran valores con al menos MIN_ANALISTAS analistas
// cubriéndolos, para que el consenso sea mínimamente fiable.
//
// Parámetros de la query:
//   indice - id del índice a analizar.
//   max    - tope de diversificación por valor (por defecto, PESO_MAXIMO).
//   dias   - ventana de backtest (por defecto, DIAS).

import {
  getYahooFinanceInstance,
  mensajeErrorAmigable,
  obtenerDatosAlineados,
  calcularSeleccionCompleta,
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
const MIN_ANALISTAS = 3; // mínimo de analistas cubriendo el valor para considerar el consenso fiable
const TAMANO_TANDA = 8; // consultas simultáneas por tanda, no todo el índice de golpe

function numeroValido(valor) {
  return typeof valor === "number" && !Number.isNaN(valor);
}

function retornoTotal(cierres) {
  const inicial = cierres[0].cierre;
  const final = cierres[cierres.length - 1].cierre;
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

// Consulta financialData de una tanda de tickers en paralelo; los que
// fallen (símbolo sin cobertura de analistas, error puntual de red...)
// se devuelven como null en vez de tirar abajo toda la tanda.
async function consultarTanda(tickers) {
  const resultados = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const data = await yahooFinance.quoteSummary(ticker, { modules: ["financialData"] });
        return { ticker, financialData: data.financialData || null };
      } catch {
        return { ticker, financialData: null };
      }
    })
  );
  return resultados;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    const pesoMaximo = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;
    const diasVentana = req.query.dias !== undefined ? Number(req.query.dias) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    // 1) Consultar el consenso de analistas de cada componente, en
    // tandas de TAMANO_TANDA en paralelo (no todos a la vez).
    const candidatos = [];
    const excluidos = [];
    for (let i = 0; i < indice.tickers.length; i += TAMANO_TANDA) {
      const tanda = indice.tickers.slice(i, i + TAMANO_TANDA);
      const resultados = await consultarTanda(tanda);
      for (const { ticker, financialData } of resultados) {
        const mean = financialData ? financialData.recommendationMean : undefined;
        const numOpiniones = financialData ? financialData.numberOfAnalystOpinions : undefined;
        if (!numeroValido(mean) || !numeroValido(numOpiniones) || numOpiniones < MIN_ANALISTAS) {
          excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker] });
          continue;
        }
        candidatos.push({
          ticker,
          nombre: indice.nombresEmpresas[ticker],
          recommendationMean: Number(mean.toFixed(2)),
          recommendationKey: financialData.recommendationKey || null,
          numeroAnalistas: numOpiniones,
        });
      }
    }

    // Menor recommendationMean = consenso más favorable (1 = compra
    // fuerte, 5 = venta fuerte); a igualdad, más analistas cubriendo
    // el valor da más peso al consenso.
    candidatos.sort((a, b) => a.recommendationMean - b.recommendationMean || b.numeroAnalistas - a.numeroAnalistas);

    if (candidatos.length < N_MIN) {
      throw new Error(
        `Hacen falta al menos ${N_MIN} componentes con consenso de analistas fiable (≥ ${MIN_ANALISTAS} analistas), y solo hay ${candidatos.length} en este momento.`
      );
    }

    // 2) Descargar los precios de los top N_MAX candidatos.
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
        .map((c) => ({
          ticker: c.ticker,
          nombre: c.nombre,
          recommendationMean: c.recommendationMean,
          recommendationKey: c.recommendationKey,
          numeroAnalistas: c.numeroAnalistas,
          retornoPeriodoPct: Number((c.retorno * 100).toFixed(3)),
          peso: Number(pesos[c.ticker].toFixed(2)),
        }))
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
