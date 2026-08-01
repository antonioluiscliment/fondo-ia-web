// pages/api/multifactor.js
//
// "Selección por modelo multifactor": recorre el backtest del índice
// elegido para ajustar, mediante una regresión ridge, el peso que
// mejor combina varias variables a la hora de predecir la
// rentabilidad futura de cada valor — y aplica esos pesos a los
// datos de HOY para elegir la cartera "ideal" actual.
//
// Variables usadas (ver lib/multifactorComun.js para el detalle
// matemático):
//   - Momentum de precio, de volumen y de flujo de dinero (precio ×
//     volumen), sumados en las últimas "sesionesPuntuacion" sesiones
//     — sí varían día a día, así que se recorren de verdad en el
//     backtest.
//   - Dispersión (desviación típica) de los incrementos de precio en
//     las últimas 20 sesiones — mide volatilidad, no nivel.
//   - PER, EPS/precio (rentabilidad por beneficio, normalizada igual
//     que en "Mejor fundamental"), precio/valor contable y consenso
//     de analistas (invertido, 5 − recommendationMean, igual que en
//     "Selección de los analistas") — estas NO varían a lo largo del
//     backtest, porque Yahoo no da histórico diario de estos datos;
//     se usan como si fueran las de hoy en todas las sesiones. Es una
//     aproximación razonable en una ventana de 50-70 sesiones (~2-3
//     meses), donde no cambian mucho, pero sigue siendo una
//     aproximación, no un dato histórico real.
//
// Entrenamiento y validación: 50 sesiones para ajustar los pesos y 20
// para comprobar, sin solape, cómo se comportan fuera de la muestra
// con la que se entrenaron — mismo principio de evitar el sesgo de
// anticipación que en "veces seleccionado" o el análisis de
// correlación. El R² de validación es la cifra honesta a mirar: si
// sale bajo (o negativo), quiere decir que el modelo no está
// explicando gran cosa, y así se muestra, sin maquillarlo.
//
// Una vez ajustados los pesos, se aplican a los valores de HOY de
// cada componente del índice para obtener una puntuación combinada,
// se eligen los mejor puntuados (entre 3 y 6, según lo que se pida) y
// se reparten a partes iguales — no se optimizan los pesos de la
// cartera con datos futuros, porque a diferencia de "Mejor
// fundamental" aquí no hay ningún periodo ya conocido con el que
// hacerlo sin caer en trampa.
//
// Parámetros de la query:
//   indice   - id del índice a analizar.
//   sesiones - sesiones promediadas para el momentum y el horizonte
//              de predicción (3, 5, 8 o 13; por defecto 3).
//   max      - tope de diversificación por valor.
//   n        - nº de componentes deseado (se ajusta entre 3 y 6).

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados, PESO_MAXIMO } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import {
  ajustarRidge,
  predecir,
  calcularR2,
  calcularNormalizacion,
  normalizar,
  calcularIncrementosSerie,
  sumaMomentum,
  desviacionMomentum,
  rentabilidadFutura,
  MARGEN,
  SESIONES_ENTRENAMIENTO,
  SESIONES_VALIDACION,
  VENTANA_DISPERSION,
  MIN_FILAS_POR_VARIABLE_AVISO,
  MIN_ANALISTAS,
  N_MIN,
  N_MAX,
  LAMBDA_RIDGE,
} from "../../lib/multifactorComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const TAMANO_TANDA = 8;
const NOMBRES_VARIABLES = ["momentumPrecio", "momentumVolumen", "momentumFlujo", "dispersion", "per", "epsPrecio", "pvc", "consenso"];

function numeroValido(v) {
  return typeof v === "number" && !Number.isNaN(v);
}

function errorInsuficiente(mensaje) {
  const e = new Error(mensaje);
  e.insuficiente = true;
  return e;
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

// Series de incrementos (precio, volumen, flujo) de un candidato, a
// partir de su serie de cierres y volúmenes ya descargada.
function calcularSeriesIncrementos(c) {
  const incrementosPrecio = calcularIncrementosSerie(c.serieCierre);
  const incrementosVolumen = calcularIncrementosSerie(c.serieVolumen);
  const serieFlujo = c.serieCierre.map((cierre, i) => {
    const volumen = c.serieVolumen[i];
    return cierre !== null && cierre !== undefined && volumen !== null && volumen !== undefined ? cierre * volumen : null;
  });
  const incrementosFlujo = calcularIncrementosSerie(serieFlujo);
  return { incrementosPrecio, incrementosVolumen, incrementosFlujo };
}

// Vector de variables (sin normalizar) de un candidato en la sesión
// t, o null si falta algún dato de momentum/dispersión en esa fecha.
function variablesEnSesion(c, series, t, sesionesPuntuacion) {
  const momentumPrecio = sumaMomentum(series.incrementosPrecio, t, sesionesPuntuacion);
  const momentumVolumen = sumaMomentum(series.incrementosVolumen, t, sesionesPuntuacion);
  const momentumFlujo = sumaMomentum(series.incrementosFlujo, t, sesionesPuntuacion);
  const dispersion = desviacionMomentum(series.incrementosPrecio, t, VENTANA_DISPERSION);
  if (momentumPrecio === null || momentumVolumen === null || momentumFlujo === null || dispersion === null) return null;
  return [momentumPrecio, momentumVolumen, momentumFlujo, dispersion, c.per, c.epsPrecio, c.pvc, c.consenso];
}

function asignarPesosIguales(tickers, pesoMaximo) {
  const n = tickers.length;
  const igual = 100 / n;
  const pesos = {};
  if (igual <= pesoMaximo + 1e-9) {
    for (const t of tickers) pesos[t] = Number(igual.toFixed(2));
    return pesos;
  }
  let restante = 100;
  for (const t of tickers) {
    const asignar = Math.min(pesoMaximo, restante);
    pesos[t] = asignar;
    restante -= asignar;
  }
  if (restante > 0.0001) {
    const extra = restante / n;
    for (const t of tickers) pesos[t] += extra;
  }
  for (const t of tickers) pesos[t] = Number(pesos[t].toFixed(2));
  return pesos;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    const sesionesPuntuacion = req.query.sesiones !== undefined ? Number(req.query.sesiones) : 3;
    if (![3, 5, 8, 13].includes(sesionesPuntuacion)) {
      throw new Error("El parámetro 'sesiones' debe ser 3, 5, 8 o 13.");
    }
    const pesoMaximo = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;
    const nSolicitado = req.query.n !== undefined ? Number(req.query.n) : 5;

    const totalSesiones = MARGEN + SESIONES_ENTRENAMIENTO + SESIONES_VALIDACION + sesionesPuntuacion;

    // 1) Precio y volumen de todos los componentes, alineados por fecha.
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, totalSesiones, indice.tickers);

    // 2) Fundamentales (PER, EPS, precio actual, precio/valor contable), por lotes.
    const cotizaciones = await yahooFinance.quote(indice.tickers, {
      fields: ["symbol", "trailingPE", "epsTrailingTwelveMonths", "priceToBook", "regularMarketPrice"],
    });
    const fundamentalesPorTicker = Object.fromEntries(cotizaciones.map((c) => [c.symbol, c]));

    // 3) Consenso de analistas, valor por valor, por tandas.
    const consensoPorTicker = {};
    for (let i = 0; i < indice.tickers.length; i += TAMANO_TANDA) {
      const tanda = indice.tickers.slice(i, i + TAMANO_TANDA);
      const resultados = await consultarTandaAnalistas(tanda);
      for (const { ticker, financialData } of resultados) {
        consensoPorTicker[ticker] = financialData;
      }
    }

    // 4) Filtrar candidatos con todos los datos necesarios.
    const candidatos = [];
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
        numeroValido(mean) && numeroValido(numAnalistas) && numAnalistas >= MIN_ANALISTAS;

      if (!datosValidos) {
        excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker] });
        continue;
      }

      candidatos.push({
        ticker,
        nombre: indice.nombresEmpresas[ticker],
        serieCierre: datos[ticker].map((d) => d.cierre),
        serieVolumen: datos[ticker].map((d) => d.volumen),
        per,
        epsPrecio: Number(((epsBruto / precioActual) * 100).toFixed(3)),
        pvc,
        consenso: Number((5 - mean).toFixed(3)),
      });
    }

    if (candidatos.length < N_MIN) {
      throw errorInsuficiente(
        `Hacen falta al menos ${N_MIN} componentes con todos los datos necesarios (precio, fundamentales y consenso de analistas fiable), y solo hay ${candidatos.length} en este momento.`
      );
    }

    // 5) Construir filas de entrenamiento y validación, una por (sesión, valor).
    const finEntrenamiento = MARGEN + SESIONES_ENTRENAMIENTO;
    const finValidacion = finEntrenamiento + SESIONES_VALIDACION;

    const filasEntrenamiento = [];
    const filasValidacion = [];

    for (const c of candidatos) {
      const series = calcularSeriesIncrementos(c);
      for (let t = MARGEN; t < finValidacion; t++) {
        const x = variablesEnSesion(c, series, t, sesionesPuntuacion);
        const objetivo = rentabilidadFutura(c.serieCierre, t, sesionesPuntuacion);
        if (x === null || objetivo === null) continue;
        const fila = { ticker: c.ticker, x, y: objetivo };
        if (t < finEntrenamiento) filasEntrenamiento.push(fila);
        else filasValidacion.push(fila);
      }
    }

    if (filasEntrenamiento.length < N_MIN * NOMBRES_VARIABLES.length || filasValidacion.length < N_MIN) {
      throw errorInsuficiente(
        "No hay datos suficientes tras aplicar los criterios de calidad para entrenar el modelo con un mínimo de garantías."
      );
    }

    // 6) Normalizar (parámetros calculados solo con entrenamiento, aplicados también a validación).
    const parametrosNormalizacion = NOMBRES_VARIABLES.map((_, j) => calcularNormalizacion(filasEntrenamiento.map((f) => f.x[j])));
    const construirMatriz = (filas) => filas.map((f) => [1, ...f.x.map((valor, j) => normalizar(valor, parametrosNormalizacion[j]))]);

    const Xentrenamiento = construirMatriz(filasEntrenamiento);
    const yEntrenamiento = filasEntrenamiento.map((f) => f.y);
    const Xvalidacion = construirMatriz(filasValidacion);
    const yValidacion = filasValidacion.map((f) => f.y);

    // 7) Ajustar el modelo y medir su ajuste dentro y fuera de la muestra de entrenamiento.
    const pesos = ajustarRidge(Xentrenamiento, yEntrenamiento, LAMBDA_RIDGE);
    const r2Entrenamiento = calcularR2(yEntrenamiento, predecir(Xentrenamiento, pesos));
    const r2Validacion = calcularR2(yValidacion, predecir(Xvalidacion, pesos));

    // 8) Aplicar los pesos a los datos de HOY de cada candidato.
    const tHoy = fechas.length - 1;
    const puntuaciones = [];
    for (const c of candidatos) {
      const series = calcularSeriesIncrementos(c);
      const x = variablesEnSesion(c, series, tHoy, sesionesPuntuacion);
      if (x === null) continue;
      const xNormalizado = [1, ...x.map((valor, j) => normalizar(valor, parametrosNormalizacion[j]))];
      const puntuacionModelo = predecir([xNormalizado], pesos)[0];
      puntuaciones.push({
        ticker: c.ticker,
        nombre: c.nombre,
        puntuacionModelo: Number((puntuacionModelo * 100).toFixed(3)),
        precio: Number(c.serieCierre[tHoy].toFixed(2)),
      });
    }

    if (puntuaciones.length < N_MIN) {
      throw errorInsuficiente(
        `Hacen falta al menos ${N_MIN} componentes con datos de HOY completos para aplicar el modelo, y solo hay ${puntuaciones.length} en este momento.`
      );
    }

    puntuaciones.sort((a, b) => b.puntuacionModelo - a.puntuacionModelo);
    const n = Math.min(N_MAX, Math.max(N_MIN, nSolicitado), puntuaciones.length);
    const elegidos = puntuaciones.slice(0, n);
    const pesosCartera = asignarPesosIguales(elegidos.map((e) => e.ticker), pesoMaximo);
    const cartera = elegidos.map((e) => ({ ...e, peso: pesosCartera[e.ticker] }));

    const filasPorVariable = filasEntrenamiento.length / NOMBRES_VARIABLES.length;

    res.status(200).json({
      indice: indice.id,
      sesionesPuntuacion,
      nComponentes: n,
      nFilasEntrenamiento: filasEntrenamiento.length,
      nFilasValidacion: filasValidacion.length,
      avisoMuestraPequena: filasPorVariable < MIN_FILAS_POR_VARIABLE_AVISO,
      r2Entrenamiento: r2Entrenamiento !== null ? Number(r2Entrenamiento.toFixed(4)) : null,
      r2Validacion: r2Validacion !== null ? Number(r2Validacion.toFixed(4)) : null,
      pesos: {
        intercept: Number(pesos[0].toFixed(4)),
        ...Object.fromEntries(NOMBRES_VARIABLES.map((nombre, j) => [nombre, Number(pesos[j + 1].toFixed(4))])),
      },
      cartera,
      excluidos,
      fechaHoy: fechas[tHoy],
    });
  } catch (error) {
    if (error.insuficiente) {
      res.status(200).json({ insuficiente: true, mensaje: error.message });
      return;
    }
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
