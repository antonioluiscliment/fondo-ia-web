// pages/api/exploradorValor.js
//
// "Explorador de datos de un valor" (grupo Comprobaciones): consulta
// TODOS los módulos de datos que Yahoo Finance ofrece para un ticker
// y muestra lo que devuelve cada uno — no solo los campos que la
// aplicación usa hoy (PER, EPS, precio/valor contable, dividendo y
// consenso de analistas), sino todo lo que haya: balance, cuenta de
// resultados, flujos de caja, estadísticas clave, calendario de
// resultados, etc.
//
// Para qué sirve: explorar qué información hay realmente disponible
// antes de decidir si merece la pena construir algo con ella. Es una
// herramienta de reconocimiento, no de análisis.
//
// POR QUÉ SE CONSULTA MÓDULO A MÓDULO, Y NO TODOS DE GOLPE: la
// disponibilidad varía mucho según el valor y el mercado (un valor
// español no tiene los mismos módulos que uno estadounidense), y
// pedir un módulo inexistente hace fallar la petición ENTERA si se
// piden todos juntos. Consultándolos por separado, y capturando el
// error de cada uno, un módulo que falle solo se marca como no
// disponible y los demás siguen llegando — que es justo lo que
// interesa cuando el objetivo es descubrir qué hay.

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

// Todos los módulos que documenta yahoo-finance2 para quoteSummary.
// Se piden todos; los que no existan para ese valor se marcarán como
// no disponibles, sin romper el resto.
const MODULOS = [
  "assetProfile",
  "balanceSheetHistory",
  "balanceSheetHistoryQuarterly",
  "calendarEvents",
  "cashflowStatementHistory",
  "cashflowStatementHistoryQuarterly",
  "defaultKeyStatistics",
  "earnings",
  "earningsHistory",
  "earningsTrend",
  "financialData",
  "fundOwnership",
  "incomeStatementHistory",
  "incomeStatementHistoryQuarterly",
  "indexTrend",
  "industryTrend",
  "insiderHolders",
  "insiderTransactions",
  "institutionOwnership",
  "majorDirectHolders",
  "majorHoldersBreakdown",
  "netSharePurchaseActivity",
  "price",
  "quoteType",
  "recommendationTrend",
  "secFilings",
  "sectorTrend",
  "summaryDetail",
  "summaryProfile",
  "upgradeDowngradeHistory",
];

// Recorta estructuras muy grandes para que la respuesta no se
// dispare: de los históricos (arrays de trimestres o años) se
// conservan los primeros elementos, que son los más recientes.
const MAX_ELEMENTOS_ARRAY = 6;

function recortar(valor, profundidad = 0) {
  if (valor === null || valor === undefined) return valor;
  if (profundidad > 6) return "[...]";
  if (Array.isArray(valor)) {
    const recortado = valor.slice(0, MAX_ELEMENTOS_ARRAY).map((v) => recortar(v, profundidad + 1));
    if (valor.length > MAX_ELEMENTOS_ARRAY) recortado.push(`[... ${valor.length - MAX_ELEMENTOS_ARRAY} elementos más]`);
    return recortado;
  }
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    const salida = {};
    for (const [k, v] of Object.entries(valor)) salida[k] = recortar(v, profundidad + 1);
    return salida;
  }
  return valor;
}

// Cuenta cuántos campos con dato real trae un módulo — para poder
// ordenar de un vistazo cuáles vienen llenos y cuáles casi vacíos.
function contarCampos(valor) {
  if (valor === null || valor === undefined) return 0;
  if (Array.isArray(valor)) return valor.reduce((s, v) => s + contarCampos(v), 0);
  if (typeof valor === "object") return Object.values(valor).reduce((s, v) => s + contarCampos(v), 0);
  return 1;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const ticker = req.query.ticker;
    if (!ticker) throw new Error("Falta el parámetro 'ticker'.");

    // Se comprueba que el ticker pertenezca al índice elegido, para
    // evitar consultas a valores arbitrarios desde la interfaz.
    if (req.query.indice) {
      const indice = obtenerIndice(req.query.indice);
      if (!indice.tickers.includes(ticker)) {
        throw new Error(`${ticker} no pertenece a ${indice.nombre.es}.`);
      }
    }

    const resultados = [];
    for (const modulo of MODULOS) {
      try {
        const datos = await yahooFinance.quoteSummary(ticker, { modules: [modulo] });
        const contenido = datos && datos[modulo] !== undefined ? datos[modulo] : null;
        resultados.push({
          modulo,
          disponible: contenido !== null && contenido !== undefined,
          numCampos: contarCampos(contenido),
          datos: recortar(contenido),
        });
      } catch (e) {
        resultados.push({
          modulo,
          disponible: false,
          numCampos: 0,
          datos: null,
          error: e.message ? e.message.slice(0, 200) : "error desconocido",
        });
      }
    }

    // También los campos sueltos de quote(), que no vienen por
    // módulos y traen los datos de cotización del momento.
    let datosQuote = null;
    let errorQuote = null;
    try {
      datosQuote = recortar(await yahooFinance.quote(ticker));
    } catch (e) {
      errorQuote = e.message ? e.message.slice(0, 200) : "error desconocido";
    }

    res.status(200).json({
      ticker,
      quote: datosQuote,
      errorQuote,
      modulosDisponibles: resultados.filter((r) => r.disponible).length,
      modulosTotales: MODULOS.length,
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
