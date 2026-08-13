// lib/clasificacionFundamentalesComun.js
//
// "Clasificación por fundamentales" (menú "Comparación con red
// neuronal"): misma mecánica que "Clasificación de valores de un
// índice" (mediana del índice como frontera, modelo congelado en la
// fase de prueba, evaluación en datos nunca vistos), pero con las
// variables fundamentales de lib/fundamentalesComun.js en vez de
// precio/volumen/flujo — y con una diferencia de diseño importante:
// UN SOLO BLOQUE de entrenamiento + prueba, no walk-forward sesión a
// sesión.
//
// Por qué un solo bloque: la cobertura real de las variables más
// ricas (epsTrend) se limita a los últimos ~90 días desde el momento
// de la consulta — no hay forma de reconstruir walk-forward hacia
// atrás con reajustes periódicos sin salirse de esa ventana. El
// periodo entero de esta herramienta es, por diseño, un solo
// trimestre (60-63 sesiones): se entrena en la mayor parte, se deja
// el hueco de seguridad de siempre, y se prueba con el modelo
// congelado en el resto — sin repetir el ciclo.

import { crearRed, entrenar, predecirProbabilidad } from "./redNeuronalComun";
import {
  NOMBRES_VARIABLES_FUNDAMENTALES,
  precalcularMedias,
  construirVectorCompleto,
  calcularNumVariablesFundamentales,
} from "./fundamentalesComun";
import { calcularNormalizacion, normalizar } from "./multifactorComun";

export const HORIZONTE = 5;
export const NUM_DESTACADOS = 4;
export const NN_OCULTAS = 10;
export const NN_EPOCAS = 150;
export const NN_TASA_APRENDIZAJE = 0.12;
export const SEMILLA = 20260812;
export const MINIMO_EJEMPLOS = 100;

function etiquetasEn(tickers, precioPorTicker, t) {
  const rentabilidades = {};
  for (const tk of tickers) {
    const serie = precioPorTicker[tk];
    const ahora = serie[t];
    const despues = serie[t + HORIZONTE];
    if (ahora === null || ahora === undefined || ahora === 0 || despues === null || despues === undefined) continue;
    rentabilidades[tk] = (despues / ahora - 1) * 100;
  }
  const valores = Object.values(rentabilidades).sort((a, b) => a - b);
  if (valores.length < 4) return null;
  const mitad = Math.floor(valores.length / 2);
  const mediana = valores.length % 2 === 0 ? (valores[mitad - 1] + valores[mitad]) / 2 : valores[mitad];
  return { rentabilidades, mediana };
}

function ajustar(ejemplos, numVariables) {
  const normParams = Array.from({ length: numVariables }, (_, j) => calcularNormalizacion(ejemplos.map((e) => e.x[j])));
  const X = ejemplos.map((e) => e.x.map((v, j) => normalizar(v, normParams[j])));
  const y = ejemplos.map((e) => e.y);
  const red = crearRed(numVariables, NN_OCULTAS, SEMILLA);
  entrenar(red, X, y, { epocas: NN_EPOCAS, tasaAprendizaje: NN_TASA_APRENDIZAJE, clasificacion: true });
  return { red, normParams };
}

function aplicar(modelo, x) {
  return predecirProbabilidad(modelo.red, x.map((v, j) => normalizar(v, modelo.normParams[j])));
}

// tickers, precioPorTicker: igual que en la clasificación por precio.
// seriesPorTicker: { ticker: { nombreVariable: [serie por sesión] } },
// ya ensambladas con lib/fundamentalesComun.js.
export function ejecutarClasificacionFundamental(tickers, precioPorTicker, seriesPorTicker, numSesiones) {
  const numVariables = calcularNumVariablesFundamentales();
  const medias = precalcularMedias(seriesPorTicker, tickers, numSesiones);

  const primeraSesionUtil = 0;
  const ultimaConResultado = numSesiones - 1 - HORIZONTE;
  const sesionesUtiles = ultimaConResultado - primeraSesionUtil + 1;
  if (sesionesUtiles < 20) {
    throw new Error(`Hacen falta más sesiones: solo hay ${sesionesUtiles} utilizables en este periodo.`);
  }

  // Un único bloque: ~75% para entrenamiento, hueco de HORIZONTE
  // sesiones, y el resto para la prueba con el modelo congelado.
  const tamanoTest = Math.max(8, Math.round(sesionesUtiles * 0.25));
  const finEntrenamiento = ultimaConResultado - tamanoTest - HORIZONTE;
  const inicioTest = finEntrenamiento + HORIZONTE + 1;

  function reunirEjemplos(desde, hasta) {
    const ejemplos = [];
    for (let t = desde; t <= hasta; t++) {
      const etiquetas = etiquetasEn(tickers, precioPorTicker, t);
      if (etiquetas === null) continue;
      for (const tk of tickers) {
        if (etiquetas.rentabilidades[tk] === undefined) continue;
        const x = construirVectorCompleto(seriesPorTicker, medias, tk, t);
        ejemplos.push({ t, ticker: tk, x, y: etiquetas.rentabilidades[tk] > etiquetas.mediana ? 1 : 0 });
      }
    }
    return ejemplos;
  }

  const ejemplosEntrenamiento = reunirEjemplos(primeraSesionUtil, finEntrenamiento);
  if (ejemplosEntrenamiento.length < MINIMO_EJEMPLOS) {
    throw new Error(`Solo ${ejemplosEntrenamiento.length} ejemplos de entrenamiento (mínimo ${MINIMO_EJEMPLOS}).`);
  }

  const modelo = ajustar(ejemplosEntrenamiento, numVariables);

  // --- Evaluación, con el modelo CONGELADO ---
  const pasos = [];
  for (let t = inicioTest; t <= ultimaConResultado; t++) {
    const etiquetas = etiquetasEn(tickers, precioPorTicker, t);
    if (etiquetas === null) continue;

    const predicciones = [];
    for (const tk of tickers) {
      if (etiquetas.rentabilidades[tk] === undefined) continue;
      const x = construirVectorCompleto(seriesPorTicker, medias, tk, t);
      predicciones.push({
        ticker: tk,
        probabilidad: aplicar(modelo, x),
        real: etiquetas.rentabilidades[tk] > etiquetas.mediana ? 1 : 0,
        rentabilidad: etiquetas.rentabilidades[tk],
      });
    }
    if (predicciones.length < 4) continue;

    const aciertos = predicciones.filter((p) => (p.probabilidad > 0.5 ? 1 : 0) === p.real).length;
    const porConfianza = [...predicciones].sort((a, b) => b.probabilidad - a.probabilidad);
    const destacados = porConfianza.slice(0, NUM_DESTACADOS);
    const rentDestacados = destacados.reduce((s, p) => s + p.rentabilidad, 0) / destacados.length;
    const rentMedia = predicciones.reduce((s, p) => s + p.rentabilidad, 0) / predicciones.length;

    const masSeguros = [...predicciones]
      .sort((a, b) => Math.abs(b.probabilidad - 0.5) - Math.abs(a.probabilidad - 0.5))
      .slice(0, Math.max(4, Math.round(predicciones.length * 0.2)));
    const aciertosSeguros = masSeguros.filter((p) => (p.probabilidad > 0.5 ? 1 : 0) === p.real).length;

    pasos.push({
      t,
      total: predicciones.length,
      aciertos,
      porcentajeAciertos: (aciertos / predicciones.length) * 100,
      porcentajeAciertosSeguros: (aciertosSeguros / masSeguros.length) * 100,
      rentDestacados,
      rentMedia,
    });
  }

  const media = (arr) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
  const redondear = (v) => (v !== null && v !== undefined ? Number(v.toFixed(3)) : null);

  // --- Clasificación de HOY: reentrenada con todo el histórico
  // disponible (mismo criterio que la clasificación por precio).
  const ejemplosTodos = reunirEjemplos(primeraSesionUtil, ultimaConResultado);
  const modeloFinal = ajustar(ejemplosTodos, numVariables);

  const tHoy = numSesiones - 1;
  const clasificacionHoy = [];
  for (const tk of tickers) {
    const x = construirVectorCompleto(seriesPorTicker, medias, tk, tHoy);
    clasificacionHoy.push({ ticker: tk, probabilidad: Number(aplicar(modeloFinal, x).toFixed(4)) });
  }
  clasificacionHoy.sort((a, b) => b.probabilidad - a.probabilidad);
  const mitad = Math.floor(clasificacionHoy.length / 2);
  const destacadosHoy = new Set(clasificacionHoy.slice(0, NUM_DESTACADOS).map((c) => c.ticker));

  return {
    parametros: { horizonte: HORIZONTE, numVariables, numVariablesBase: NOMBRES_VARIABLES_FUNDAMENTALES.length, numDestacados: NUM_DESTACADOS },
    reparto: {
      sesionesEntrenamiento: finEntrenamiento - primeraSesionUtil + 1,
      sesionesPrueba: pasos.length,
      ejemplosEntrenamiento: ejemplosEntrenamiento.length,
      huecoSesiones: HORIZONTE,
    },
    evaluacion: {
      numPasos: pasos.length,
      porcentajeAciertos: redondear(media(pasos.map((p) => p.porcentajeAciertos))),
      porcentajeAciertosSeguros: redondear(media(pasos.map((p) => p.porcentajeAciertosSeguros))),
      rentDestacadosMedia: redondear(media(pasos.map((p) => p.rentDestacados))),
      rentMediaIndice: redondear(media(pasos.map((p) => p.rentMedia))),
      pasosSuperaMedia: pasos.filter((p) => p.rentDestacados > p.rentMedia).length,
    },
    clasificacionHoy: clasificacionHoy.map((c, i) => ({
      ...c,
      grupo: i < mitad ? "arriba" : "abajo",
      destacado: destacadosHoy.has(c.ticker),
    })),
  };
}
