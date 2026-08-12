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

// Cuántos registros se muestran en la tabla de muestra de cada
// módulo. El volcado en bruto sigue estando disponible aparte; esta
// tabla existe para poder juzgar de un vistazo QUÉ contiene cada
// módulo, sin tener que leer un JSON de miles de líneas (por ejemplo,
// upgradeDowngradeHistory puede traer casi 3.000 campos: la tabla
// muestra que son recomendaciones de analistas con fecha, firma y
// calificación anterior y nueva).
const REGISTROS_MUESTRA = 8;

// Convierte un valor suelto en algo legible en una celda de tabla.
function aTexto(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") return Array.isArray(v) ? `[${v.length} elementos]` : "{...}";
  if (typeof v === "number") {
    // Las cifras muy grandes (ingresos, activos) se abrevian para que
    // la tabla siga siendo legible.
    if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + " mil M";
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + " M";
    return String(v);
  }
  return String(v);
}

// Busca dentro de un módulo la lista de registros que lo caracteriza
// y la convierte en una tabla (columnas + filas). Los módulos de
// Yahoo suelen ser un objeto con UNA propiedad que es un array de
// registros (p. ej. balanceSheetHistory.balanceSheetStatements), así
// que se localiza ese array; si el módulo es directamente un array,
// se usa tal cual; y si es un objeto de campos sueltos sin ningún
// array, se tabula como pares campo/valor.
function extraerMuestra(contenido) {
  if (contenido === null || contenido === undefined) return null;

  let registros = null;
  let nombreLista = null;

  if (Array.isArray(contenido)) {
    registros = contenido;
  } else if (typeof contenido === "object") {
    let mejor = null;
    for (const [clave, valor] of Object.entries(contenido)) {
      if (Array.isArray(valor) && valor.length > 0 && (mejor === null || valor.length > mejor.length)) {
        mejor = valor;
        nombreLista = clave;
      }
    }
    if (mejor) {
      registros = mejor;
    } else {
      // Sin ningún array dentro: tabla de campo / valor.
      const filas = Object.entries(contenido)
        .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
        .map(([k, v]) => [k, aTexto(v)]);
      if (filas.length === 0) return null;
      return { tipo: "campos", columnas: ["Campo", "Valor"], filas: filas.slice(0, 30), totalRegistros: filas.length };
    }
  } else {
    return null;
  }

  if (!registros || registros.length === 0) return null;

  // Registros que son objetos: una columna por cada campo que
  // aparezca en los primeros registros.
  const muestra = registros.slice(0, REGISTROS_MUESTRA);
  if (typeof muestra[0] !== "object" || muestra[0] === null) {
    return {
      tipo: "lista",
      nombreLista,
      columnas: ["Valor"],
      filas: muestra.map((v) => [aTexto(v)]),
      totalRegistros: registros.length,
    };
  }

  const columnas = [];
  for (const registro of muestra) {
    for (const clave of Object.keys(registro)) {
      if (!columnas.includes(clave)) columnas.push(clave);
    }
  }

  return {
    tipo: "registros",
    nombreLista,
    columnas,
    filas: muestra.map((registro) => columnas.map((c) => aTexto(registro[c]))),
    totalRegistros: registros.length,
  };
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
          muestra: extraerMuestra(contenido),
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
