// pages/api/clasificacionFundamentales.js
//
// "Clasificación por fundamentales" (menú "Comparación con red
// neuronal"): ver lib/fundamentalesComun.js (reconstrucción histórica
// de cada variable, mecanismo de vigencia) y
// lib/clasificacionFundamentalesComun.js (entrenamiento en bloque
// único, modelo congelado en la fase de prueba) para el detalle
// completo del método.
//
// PERIODO: un trimestre (63 sesiones ≈ 90 días naturales) — el límite
// real de cobertura de la variable más rica (epsTrend), no una cifra
// arbitraria. Ver la conversación que dio origen a esta herramienta.
//
// LLAMADAS A YAHOO, OPTIMIZADAS: para cada valor hacen falta unos 10
// módulos de quoteSummary. Pedirlos uno a uno (como hace el
// explorador, a propósito, para aislar fallos) multiplicaría por 10
// las llamadas — con un índice de 40 valores, 400 llamadas en una
// sola ejecución. En su lugar, se piden TODOS los módulos de golpe en
// una única llamada por valor; solo si esa llamada conjunta fallara
// por completo, se cae a pedirlos uno a uno como reserva para ESE
// valor en concreto (más lento, pero no se pierde el valor entero).

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados, obtenerIncrementosIndice } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { calcularIncrementosSerie } from "../../lib/multifactorComun";
import { calcularBeta } from "../../lib/pesosIndiceComun";
import { construirSeriesTicker } from "../../lib/fundamentalesComun";
import { ejecutarClasificacionFundamental } from "../../lib/clasificacionFundamentalesComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

export const SESIONES_TRIMESTRE = 63;
export const MAX_TICKERS = 40;
const VENTANA_BETA = 20;

const MODULOS_NECESARIOS = [
  "incomeStatementHistory",
  "incomeStatementHistoryQuarterly",
  "earningsHistory",
  "earningsTrend",
  "defaultKeyStatistics",
  "financialData",
  "summaryDetail",
  "majorHoldersBreakdown",
  "recommendationTrend",
  "price",
];

// Beta con ventana móvil: para cada sesión, la beta calculada sobre
// las VENTANA_BETA sesiones anteriores — reutiliza calcularBeta, que
// ya está probada en "Correlación de los componentes con el peso en
// el índice". Null en las primeras sesiones, sin ventana suficiente
// todavía.
function calcularBetaSerie(incrementosComponente, incrementosIndice) {
  const n = Math.min(incrementosComponente.length, incrementosIndice.length);
  const serie = new Array(n).fill(null);
  for (let t = VENTANA_BETA; t < n; t++) {
    const tramoComp = incrementosComponente.slice(t - VENTANA_BETA, t);
    const tramoIdx = incrementosIndice.slice(t - VENTANA_BETA, t);
    serie[t] = calcularBeta(tramoComp, tramoIdx);
  }
  return serie;
}

// Intenta la consulta conjunta (rápida); si falla por completo, cae a
// pedir los módulos uno a uno (más lenta, pero tolera que a ese valor
// concreto le falte alguno sin perder el resto).
async function consultarModulos(ticker) {
  try {
    const datos = await yahooFinance.quoteSummary(ticker, { modules: MODULOS_NECESARIOS });
    return datos;
  } catch {
    const datos = {};
    for (const modulo of MODULOS_NECESARIOS) {
      try {
        const parcial = await yahooFinance.quoteSummary(ticker, { modules: [modulo] });
        if (parcial && parcial[modulo] !== undefined) datos[modulo] = parcial[modulo];
      } catch {
        // Ese módulo en concreto no está disponible para este valor
        // — se omite, el resto del cálculo tolera módulos ausentes.
      }
    }
    return datos;
  }
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    if (indice.tickers.length > MAX_TICKERS) {
      throw new Error(
        `${indice.nombre.es} tiene ${indice.tickers.length} valores — por encima del límite de ${MAX_TICKERS} de esta herramienta. Elige un índice más pequeño.`
      );
    }

    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, SESIONES_TRIMESTRE, indice.tickers);
    const { cierres: cierresIndice } = await obtenerIncrementosIndice(yahooFinance, fechas, indice.simboloIndice);
    const mapaCierresIndice = Object.fromEntries(cierresIndice.map((c) => [c.fecha, c.cierre]));
    const precioIndice = fechas.map((f) => (mapaCierresIndice[f] !== undefined ? mapaCierresIndice[f] : null));
    const incrementosIndice = calcularIncrementosSerie(precioIndice);

    const fechaConsulta = fechas[fechas.length - 1];

    const precioPorTicker = {};
    const seriesPorTicker = {};
    const tickersValidos = [];

    for (const ticker of indice.tickers) {
      if (!datos[ticker] || !datos[ticker].some((d) => d.cierre !== null && d.cierre !== undefined)) continue;

      const precios = datos[ticker].map((d) => d.cierre);
      const incrementosTicker = calcularIncrementosSerie(precios);
      const betaSerie = calcularBetaSerie(incrementosTicker, incrementosIndice);

      const modulos = await consultarModulos(ticker);
      modulos.sharesOutstanding = modulos.defaultKeyStatistics ? modulos.defaultKeyStatistics.sharesOutstanding : undefined;
      modulos.dividendRate = modulos.summaryDetail ? modulos.summaryDetail.dividendRate : undefined;

      precioPorTicker[ticker] = precios;
      seriesPorTicker[ticker] = construirSeriesTicker(modulos, precios, fechas, fechaConsulta, betaSerie);
      tickersValidos.push(ticker);
    }

    if (tickersValidos.length < 8) {
      throw new Error(`Solo ${tickersValidos.length} valores de ${indice.nombre.es} tienen datos suficientes (mínimo 8).`);
    }

    const resultado = ejecutarClasificacionFundamental(tickersValidos, precioPorTicker, seriesPorTicker, fechas.length);

    res.status(200).json({
      indice: indice.id,
      nombreIndice: indice.nombre.es,
      periodoSesiones: fechas.length,
      candidatosValidos: tickersValidos.length,
      ...resultado,
      clasificacionHoy: resultado.clasificacionHoy.map((c) => ({ ...c, nombre: indice.nombresEmpresas[c.ticker] })),
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
