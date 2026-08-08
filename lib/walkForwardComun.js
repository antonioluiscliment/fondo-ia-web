// lib/walkForwardComun.js
//
// "Selección red VS ridge" (menú "Comparación con red neuronal"):
// calibra dos modelos —una regresión ridge y una red neuronal
// pequeña— mediante walk-forward (calibración progresiva: se
// entrena con lo que ya se sabe, se aplica al siguiente tramo, se
// compara con lo que de verdad pasó, se reajusta, y se desliza la
// ventana una sesión hacia delante), y aplica los parámetros ya
// calibrados a las últimas VENTANA_WF sesiones para dar una
// recomendación final de 4 valores por cada modelo.
//
// VARIABLES: a diferencia del modelo multifactor (que resume cada
// ventana en un solo número por variable — la suma de los
// incrementos), aquí cada sesión de la ventana es su PROPIA variable
// independiente: el incremento de precio de hoy, el de ayer, el de
// hace 2 días... hasta VENTANA_WF sesiones atrás, y lo mismo para
// volumen y para flujo de dinero (precio × volumen). Con
// VENTANA_WF=13, son 13×3 = 39 variables que cambian día a día, más
// las 4 fundamentales de siempre (PER, EPS/precio, precio/valor
// contable, consenso de analistas), que se mantienen constantes por
// la misma razón ya documentada en multifactorComun.js: no hay
// histórico diario de estos datos, así que se usan las de hoy en
// todos los pasos. Total: 3×VENTANA_WF+4 variables de entrada.
//
// Se usan INCREMENTOS (variación porcentual día a día), no niveles de
// precio o volumen en bruto — un nivel de precio no es comparable
// entre valores distintos (100€ no significa lo mismo para dos
// acciones diferentes) ni estable en el tiempo para el mismo valor si
// su cotización sube o baja de forma sostenida a lo largo de las 120
// sesiones recorridas; el incremento porcentual sí lo es, y es la
// misma convención que ya usa el resto de la aplicación (momentum,
// dispersión) en vez de niveles en bruto.
//
// Por qué tiene sentido tener MUCHAS variables individuales
// correlacionadas entre sí (el incremento de ayer y el de anteayer
// se parecen) en vez de un resumen: es precisamente el caso para el
// que la regularización de ridge está pensada — protege contra la
// inestabilidad que esa colinealidad causaría en una regresión sin
// penalizar. Para la red neuronal no hay esa misma garantía
// matemática, pero con una capa oculta pequeña (10 neuronas) su
// capacidad efectiva sigue siendo limitada, lo que actúa como una
// forma más suave de la misma protección.
//
// COSTE Y TAMAÑO DEL ÍNDICE: en vez de excluir los índices grandes
// (como si hace el modelo de réplica), se recorren menos sesiones
// totales para índices con muchos componentes — mismo mecanismo de
// ventana y de paso para cualquier índice, solo cambia cuántas veces
// se repite. Es una peor calibración (menos ejemplos acumulados,
// menos pasos de calibración), no una limitación oculta: se avisa
// explícitamente en el resultado cuando se aplica.
//
// MISMO PASO PARA LOS DOS MODELOS: ridge y la red se reajustan los
// dos cada sesión — así TODOS los pasos son comparables entre ambos
// modelos, no solo una muestra parcial. Se probó primero con la red
// reajustándose cada 3 sesiones (más barato, al necesitar iterar en
// vez de tener solución matemática directa como ridge), pero eso
// dejaba solo 1 de cada 3 pasos de ridge con un punto de comparación
// real, debilitando la fiabilidad de la correlación entre los dos
// modelos — que es precisamente la razón de ser de esta herramienta.
// Se optó por pagar el coste computacional más alto (la red tarda
// bastante más al reajustarse tantas veces) a cambio de esa
// fiabilidad, recortando en su lugar el nº de sesiones totales
// recorridas para mantener el tiempo total en un rango razonable.

import { ajustarRidge, predecir, calcularNormalizacion, normalizar, calcularIncrementosSerie, rentabilidadFutura, LAMBDA_RIDGE } from "./multifactorComun";
import { crearRed, entrenar, predecir as predecirRed } from "./redNeuronalComun";

export const VENTANA_WF = 13;
export const TOTAL_SESIONES_WF_NORMAL = 60;
export const TOTAL_SESIONES_WF_REDUCIDO = 40;
// Por encima de este nº de componentes del índice, se recorren menos
// sesiones totales (ver cabecera del fichero) para mantener el coste
// de calibrar la red neuronal en un tiempo razonable.
export const UMBRAL_TICKERS_REDUCCION = 25;

export const PASO_RIDGE = 1;
export const PASO_RED = 1;
export const NUM_RECOMENDADOS = 4;
export const NN_OCULTAS = 10;
export const NN_EPOCAS = 70;
export const NN_TASA_APRENDIZAJE = 0.08;
export const SEMILLA_RED = 20260807;
// Mínimo de ejemplos acumulados antes del primer ajuste — con menos
// que esto, ajustar cualquiera de los dos modelos sería ruido puro
// (más aún ahora, con 3×VENTANA_WF+4 variables que ajustar), así que
// los primeros pasos del walk-forward no dan ninguna recomendación
// todavía (solo acumulan datos).
export const MINIMO_FILAS_PARA_AJUSTAR = 90;
// Tope de ejemplos de entrenamiento acumulados: por encima de esto,
// se descartan los más antiguos (ventana móvil, no acumulación sin
// límite). Dos motivos, no solo de coste: reajustar con un conjunto
// que no para de crecer hace que cada paso sea más lento que el
// anterior (con varias decenas de pasos de ridge, el coste total crecería de forma
// creciente en vez de mantenerse acotado); y, metodológicamente, en
// un walk-forward real no está claro que un dato de hace 100 sesiones
// deba pesar igual que uno de ayer — una ventana móvil de
// entrenamiento es la práctica habitual en calibración progresiva
// real, no solo un atajo de rendimiento.
export const MAX_FILAS_ENTRENAMIENTO = 1200;

// Nº de variables de entrada con la ventana configurada.
export function calcularNumVariables() {
  return 3 * VENTANA_WF + 4;
}

// Cuántas sesiones totales recorrer según el tamaño del índice — ver
// cabecera del fichero.
export function elegirTotalSesiones(numTickers) {
  return numTickers > UMBRAL_TICKERS_REDUCCION ? TOTAL_SESIONES_WF_REDUCIDO : TOTAL_SESIONES_WF_NORMAL;
}

// Cuánto histórico hay que descargar: el total de sesiones a
// recorrer, más margen para el desfase de VENTANA_WF sesiones al
// principio y para conocer el resultado del último paso (PASO_RED, el
// mayor de los dos pasos) al final.
export function calcularDiasTotalWF(totalSesiones) {
  return totalSesiones + VENTANA_WF + PASO_RED + 5;
}

function calcularSeriesIncrementos(candidato) {
  const incrementosPrecio = calcularIncrementosSerie(candidato.serieCierre);
  const incrementosVolumen = calcularIncrementosSerie(candidato.serieVolumen);
  const serieFlujo = candidato.serieCierre.map((cierre, i) => {
    const volumen = candidato.serieVolumen[i];
    return cierre !== null && cierre !== undefined && volumen !== null && volumen !== undefined ? cierre * volumen : null;
  });
  const incrementosFlujo = calcularIncrementosSerie(serieFlujo);
  return { incrementosPrecio, incrementosVolumen, incrementosFlujo };
}

// Vector de variables (sin normalizar) de un candidato en la sesión
// t: el incremento de precio de hoy, de ayer, de hace 2 días...
// hasta VENTANA_WF sesiones atrás, lo mismo para volumen y para
// flujo, y las 4 variables fundamentales constantes al final. Null si
// falta algún dato en ese tramo (candidato con historial incompleto
// para esta fecha concreta).
function variablesEnSesion(candidato, series, t) {
  const variables = [];
  for (const serie of [series.incrementosPrecio, series.incrementosVolumen, series.incrementosFlujo]) {
    for (let k = 0; k < VENTANA_WF; k++) {
      const valor = serie[t - k];
      if (valor === null || valor === undefined) return null;
      variables.push(valor);
    }
  }
  variables.push(candidato.per, candidato.epsPrecio, candidato.pvc, candidato.consenso);
  return variables;
}

// ---------- Ajuste y aplicación de cada modelo ----------
// Misma interfaz para los dos (ajustar(datosEntrenamiento) -> modelo;
// aplicar(modelo, x) -> puntuación), para poder compartir el mismo
// bucle de walk-forward con los dos modelos.

function ajustarModeloRidge(datosEntrenamiento, numVariables) {
  const normParams = Array.from({ length: numVariables }, (_, j) => calcularNormalizacion(datosEntrenamiento.map((f) => f.x[j])));
  const X = datosEntrenamiento.map((f) => [1, ...f.x.map((v, j) => normalizar(v, normParams[j]))]);
  const y = datosEntrenamiento.map((f) => f.y);
  const pesos = ajustarRidge(X, y, LAMBDA_RIDGE);
  return { pesos, normParams };
}

function aplicarModeloRidge(modelo, x) {
  const xNorm = [1, ...x.map((v, j) => normalizar(v, modelo.normParams[j]))];
  return predecir([xNorm], modelo.pesos)[0];
}

function ajustarModeloRed(datosEntrenamiento, numVariables) {
  const normParams = Array.from({ length: numVariables }, (_, j) => calcularNormalizacion(datosEntrenamiento.map((f) => f.x[j])));
  const X = datosEntrenamiento.map((f) => f.x.map((v, j) => normalizar(v, normParams[j])));
  const y = datosEntrenamiento.map((f) => f.y);
  const red = crearRed(numVariables, NN_OCULTAS, SEMILLA_RED);
  entrenar(red, X, y, { epocas: NN_EPOCAS, tasaAprendizaje: NN_TASA_APRENDIZAJE });
  return { red, normParams };
}

function aplicarModeloRed(modelo, x) {
  const xNorm = x.map((v, j) => normalizar(v, modelo.normParams[j]));
  return predecirRed(modelo.red, xNorm);
}

// ---------- Bucle de walk-forward, compartido por los dos modelos ----------
//
// tickers: lista de candidatos válidos del índice.
// candidatosPorTicker: { ticker: { serieCierre, serieVolumen, per, epsPrecio, pvc, consenso } }.
// totalSesiones: sesiones totales a recorrer (ver elegirTotalSesiones).
// paso: cada cuántas sesiones se reajusta el modelo y se desliza la evaluación.
//
// Devuelve el histórico de recomendaciones en cada paso (con el
// ranking completo, no solo el top 4, para poder calcular después la
// correlación de Spearman) y el modelo final ya calibrado.
function ejecutarWalkForward(tickers, candidatosPorTicker, totalSesiones, paso, ajustarModelo, aplicarModelo) {
  const numVariables = calcularNumVariables();
  const seriesPorTicker = Object.fromEntries(tickers.map((tk) => [tk, calcularSeriesIncrementos(candidatosPorTicker[tk])]));

  const datosEntrenamiento = [];
  const historicoPasos = [];
  let modeloActual = null;

  const finBucle = totalSesiones - 1 - paso;
  for (let t = VENTANA_WF; t <= finBucle; t += paso) {
    // 1) Puntuar HOY con el modelo actual (antes de reajustarlo con
    // el resultado de este mismo paso) — así la recomendación de este
    // paso usa solo información disponible ANTES de conocer su
    // resultado, nunca después.
    if (modeloActual !== null) {
      const ranking = [];
      for (const ticker of tickers) {
        const x = variablesEnSesion(candidatosPorTicker[ticker], seriesPorTicker[ticker], t);
        if (x === null) continue;
        ranking.push({ ticker, puntuacion: aplicarModelo(modeloActual, x) });
      }
      ranking.sort((a, b) => b.puntuacion - a.puntuacion);
      if (ranking.length > 0) {
        historicoPasos.push({ t, ranking, top: ranking.slice(0, NUM_RECOMENDADOS).map((r) => r.ticker) });
      }
    }

    // 2) Añadir al entrenamiento el resultado de este paso, ya
    // conocido (la rentabilidad real desde t hasta t+paso).
    for (const ticker of tickers) {
      const x = variablesEnSesion(candidatosPorTicker[ticker], seriesPorTicker[ticker], t);
      if (x === null) continue;
      const y = rentabilidadFutura(candidatosPorTicker[ticker].serieCierre, t, paso);
      if (y === null) continue;
      datosEntrenamiento.push({ x, y });
    }
    // Ventana móvil: si se ha superado el tope, se descartan los
    // ejemplos más antiguos (ver MAX_FILAS_ENTRENAMIENTO).
    if (datosEntrenamiento.length > MAX_FILAS_ENTRENAMIENTO) {
      datosEntrenamiento.splice(0, datosEntrenamiento.length - MAX_FILAS_ENTRENAMIENTO);
    }

    // 3) Reajustar el modelo con todo lo acumulado hasta ahora.
    if (datosEntrenamiento.length >= MINIMO_FILAS_PARA_AJUSTAR) {
      modeloActual = ajustarModelo(datosEntrenamiento, numVariables);
    }
  }

  // Recomendación final: variables de HOY (el último día disponible)
  // con el modelo ya calibrado con todo el histórico.
  let recomendacionFinal = null;
  if (modeloActual !== null) {
    const tHoy = totalSesiones - 1;
    const ranking = [];
    for (const ticker of tickers) {
      const x = variablesEnSesion(candidatosPorTicker[ticker], seriesPorTicker[ticker], tHoy);
      if (x === null) continue;
      ranking.push({ ticker, puntuacion: aplicarModelo(modeloActual, x) });
    }
    ranking.sort((a, b) => b.puntuacion - a.puntuacion);
    recomendacionFinal = ranking.slice(0, NUM_RECOMENDADOS).map((r) => r.ticker);
  }

  return { historicoPasos, recomendacionFinal, totalFilasEntrenamiento: datosEntrenamiento.length };
}

export function ejecutarWalkForwardRidge(tickers, candidatosPorTicker, totalSesiones) {
  return ejecutarWalkForward(tickers, candidatosPorTicker, totalSesiones, PASO_RIDGE, ajustarModeloRidge, aplicarModeloRidge);
}

export function ejecutarWalkForwardRed(tickers, candidatosPorTicker, totalSesiones) {
  return ejecutarWalkForward(tickers, candidatosPorTicker, totalSesiones, PASO_RED, ajustarModeloRed, aplicarModeloRed);
}

// ---------- Correlación entre las dos series de recomendaciones ----------

function calcularSpearman(a, b) {
  const n = a.length;
  const media = (arr) => arr.reduce((s, v) => s + v, 0) / n;
  const ma = media(a);
  const mb = media(b);
  let numerador = 0;
  let sumaCuadA = 0;
  let sumaCuadB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    numerador += da * db;
    sumaCuadA += da * da;
    sumaCuadB += db * db;
  }
  const denominador = Math.sqrt(sumaCuadA * sumaCuadB);
  return denominador > 1e-12 ? numerador / denominador : null;
}

// Compara las dos series de pasos en los puntos donde ambas tienen
// recomendación en la MISMA sesión — con el mismo paso para los dos
// modelos, esto es ahora TODOS los pasos (antes, cuando la red se
// reajustaba con menos frecuencia que ridge, solo coincidían en una
// fracción de ellos). Se mantiene la búsqueda por fecha, no por
// posición, como salvaguarda ante cualquier hueco puntual en el
// histórico de alguno de los dos modelos.
export function calcularCorrelacionModelos(historicoRidge, historicoRed) {
  const mapaRidge = new Map(historicoRidge.map((p) => [p.t, p]));
  const pares = [];
  for (const pasoRed of historicoRed) {
    const pasoRidge = mapaRidge.get(pasoRed.t);
    if (pasoRidge) pares.push({ t: pasoRed.t, ridge: pasoRidge, red: pasoRed });
  }

  const detallePares = pares.map((p) => {
    const topRidge = new Set(p.ridge.top);
    const solape = p.red.top.filter((tk) => topRidge.has(tk)).length;

    const posRidge = new Map(p.ridge.ranking.map((r, i) => [r.ticker, i]));
    const posRed = new Map(p.red.ranking.map((r, i) => [r.ticker, i]));
    const comunes = [...posRidge.keys()].filter((tk) => posRed.has(tk));
    const spearman = comunes.length >= 3 ? calcularSpearman(comunes.map((tk) => posRidge.get(tk)), comunes.map((tk) => posRed.get(tk))) : null;

    return { t: p.t, topRidge: p.ridge.top, topRed: p.red.top, solape, spearman };
  });

  const solapes = detallePares.map((d) => d.solape);
  const spearmans = detallePares.map((d) => d.spearman).filter((s) => s !== null);
  const media = (arr) => (arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)) : null);

  return {
    numPares: pares.length,
    solapeMedio: media(solapes),
    solapeMaximo: NUM_RECOMENDADOS,
    spearmanMedio: media(spearmans),
    detallePares,
  };
}
