// pages/api/redVsRidge.js
//
// "Selección red VS ridge" (menú "Comparación con red neuronal"): ver
// lib/walkForwardComun.js para el detalle completo del mecanismo de
// walk-forward, las variables usadas y la justificación de cada
// decisión de diseño (por qué variables individuales y no agregadas,
// por qué la ventana y el nº de sesiones tienen los valores que
// tienen, por qué se recortan las sesiones para índices grandes).
//
// Descarga los mismos datos que "Selección por modelo multifactor"
// (precio/volumen alineados, fundamentales por lotes, consenso de
// analistas por tandas) pero con el horizonte de sesiones que pide el
// walk-forward, y delega todo el cálculo en lib/walkForwardComun.js.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { MIN_ANALISTAS } from "../../lib/multifactorComun";
import {
  ejecutarWalkForwardRidge,
  ejecutarWalkForwardRed,
  calcularCorrelacionModelos,
  calcularDiasTotalWF,
  elegirTotalSesiones,
  VENTANA_WF,
  PASO_RIDGE,
  PASO_RED,
  UMBRAL_TICKERS_REDUCCION,
  TOTAL_SESIONES_WF_NORMAL,
  TOTAL_SESIONES_WF_REDUCIDO,
} from "../../lib/walkForwardComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const TAMANO_TANDA = 8;

function numeroValido(v) {
  return typeof v === "number" && !Number.isNaN(v);
}

async function consultarTandaAnalistas(tickers) {
  return Promise.all(
    tickers.map(async (ticker) => {
      try {
        const data = await yahooFinance.quoteSummary(ticker, { modules: ["financialData"] });
        return { ticker, financialData: data.financialData || null };
      } catch {
        return { ticker, financialData: null };
      }
    })
  );
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    const totalSesiones = elegirTotalSesiones(indice.tickers.length);
    const sesionesReducidas = totalSesiones < TOTAL_SESIONES_WF_NORMAL;

    const totalSesionesDescarga = calcularDiasTotalWF(totalSesiones);

    // 1) Precio y volumen de todos los componentes, alineados por fecha.
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, totalSesionesDescarga, indice.tickers);

    // 2) Fundamentales por lotes.
    const cotizaciones = await yahooFinance.quote(indice.tickers, {
      fields: ["symbol", "trailingPE", "epsTrailingTwelveMonths", "priceToBook", "regularMarketPrice"],
    });
    const fundamentalesPorTicker = Object.fromEntries(cotizaciones.map((c) => [c.symbol, c]));

    // 3) Consenso de analistas, por tandas.
    const consensoPorTicker = {};
    for (let i = 0; i < indice.tickers.length; i += TAMANO_TANDA) {
      const tanda = indice.tickers.slice(i, i + TAMANO_TANDA);
      const resultados = await consultarTandaAnalistas(tanda);
      for (const { ticker, financialData } of resultados) {
        consensoPorTicker[ticker] = financialData;
      }
    }

    // 4) Filtrar candidatos con todos los datos necesarios (mismo
    // criterio que "Selección por modelo multifactor").
    const candidatosPorTicker = {};
    const tickersValidos = [];
    const excluidos = [];
    for (const ticker of indice.tickers) {
      const fd = fundamentalesPorTicker[ticker];
      const per = fd ? fd.trailingPE : undefined;
      const precioActual = fd ? fd.regularMarketPrice : undefined;
      const epsBruto = fd ? fd.epsTrailingTwelveMonths : undefined;
      const pvc = fd ? fd.priceToBook : undefined;

      const consensoData = consensoPorTicker[ticker];
      const mean = consensoData ? consensoData.recommendationMean : undefined;
      const numAnalistas = consensoData ? consensoData.numberOfAnalystOpinions : undefined;

      const datosValidos =
        numeroValido(per) && per > 0 &&
        numeroValido(pvc) && pvc > 0 &&
        numeroValido(epsBruto) &&
        numeroValido(precioActual) && precioActual > 0 &&
        numeroValido(mean) && numeroValido(numAnalistas) && numAnalistas >= MIN_ANALISTAS &&
        datos[ticker] && datos[ticker].some((d) => d.cierre !== null && d.cierre !== undefined);

      if (!datosValidos) {
        excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker] });
        continue;
      }

      tickersValidos.push(ticker);
      candidatosPorTicker[ticker] = {
        serieCierre: datos[ticker].map((d) => d.cierre),
        serieVolumen: datos[ticker].map((d) => d.volumen),
        per,
        epsPrecio: Number(((epsBruto / precioActual) * 100).toFixed(3)),
        pvc,
        consenso: Number((5 - mean).toFixed(3)),
      };
    }

    if (tickersValidos.length < 8) {
      throw new Error(
        `Solo ${tickersValidos.length} valores de ${indice.nombre.es} tienen todos los datos necesarios (mínimo recomendado: 8). Prueba con otro índice.`
      );
    }

    // 5) Walk-forward de los dos modelos, y su correlación.
    const resultadoRidge = ejecutarWalkForwardRidge(tickersValidos, candidatosPorTicker, totalSesiones);
    const resultadoRed = ejecutarWalkForwardRed(tickersValidos, candidatosPorTicker, totalSesiones);
    const correlacion = calcularCorrelacionModelos(resultadoRidge.historicoPasos, resultadoRed.historicoPasos);

    const conNombre = (tickers) => (tickers || []).map((tk) => ({ ticker: tk, nombre: indice.nombresEmpresas[tk] }));

    res.status(200).json({
      indice: indice.id,
      nombreIndice: indice.nombre.es,
      parametros: {
        ventana: VENTANA_WF,
        totalSesiones,
        totalSesionesNormal: TOTAL_SESIONES_WF_NORMAL,
        pasoRidge: PASO_RIDGE,
        pasoRed: PASO_RED,
        sesionesReducidas,
        umbralTickers: UMBRAL_TICKERS_REDUCCION,
      },
      candidatosValidos: tickersValidos.length,
      excluidos: excluidos.length,
      ridge: {
        recomendacionFinal: conNombre(resultadoRidge.recomendacionFinal),
        pasosConRecomendacion: resultadoRidge.historicoPasos.length,
        filasEntrenamiento: resultadoRidge.totalFilasEntrenamiento,
      },
      red: {
        recomendacionFinal: conNombre(resultadoRed.recomendacionFinal),
        pasosConRecomendacion: resultadoRed.historicoPasos.length,
        filasEntrenamiento: resultadoRed.totalFilasEntrenamiento,
      },
      correlacion: {
        numPares: correlacion.numPares,
        solapeMedio: correlacion.solapeMedio,
        solapeMaximo: correlacion.solapeMaximo,
        spearmanMedio: correlacion.spearmanMedio,
      },
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
