// lib/clasificacionIndiceComun.js
//
// "Clasificación de valores de un índice" (menú "Comparación con red
// neuronal"): una red neuronal clasifica cada valor del índice en dos
// grupos — los que estarán por encima o por debajo de la MEDIANA del
// índice en las próximas sesiones.
//
// POR QUÉ LA MEDIANA Y NO "SUPERAR AL ÍNDICE": si la etiqueta fuera
// "¿supera al índice ponderado?", habría ventanas en las que el 70%
// de los valores lo superan (típico cuando los pesos pesados caen) y
// otras en las que casi ninguno. Con grupos tan desbalanceados, un
// modelo que dijera SIEMPRE "mejor" acertaría el 70% sin haber
// aprendido nada. Con la mediana, por construcción, la mitad de los
// valores está a cada lado en todas las ventanas: la línea base es
// siempre 50%, y no hay forma de acertar por acumulación.
//
// EVALUACIÓN EN DATOS NUNCA VISTOS: el histórico se parte en dos
// tramos SEPARADOS EN EL TIEMPO (nunca al azar: mezclar días
// permitiría aprender de un martes para predecir el lunes anterior,
// imposible en la vida real). El modelo se entrena en el primero y se
// CONGELA; en el segundo solo se le enseñan las variables de entrada,
// clasifica, y solo después se compara con lo que de verdad pasó.
//
// EL HUECO ENTRE TRAMOS: la etiqueta de un ejemplo de la sesión t
// depende de lo que pase en las sesiones t+1..t+HORIZONTE. Si el
// entrenamiento llegara hasta el borde mismo del tramo de prueba, sus
// últimos ejemplos tendrían etiquetas que dependen de sesiones ya
// pertenecientes a la prueba — información del futuro filtrada. Por
// eso se deja un margen de HORIZONTE sesiones entre ambos tramos.

import { crearRed, entrenar, predecirProbabilidad } from "./redNeuronalComun";
import { calcularNormalizacion, normalizar } from "./multifactorComun";

export const VENTANA_ENTRADA = 8; // sesiones que ve el modelo de cada valor
export const HORIZONTE = 5; // sesiones hacia delante que se predicen
export const NUM_DESTACADOS = 4; // valores señalados por mayor confianza
export const NN_OCULTAS = 8;
export const NN_EPOCAS = 150;
export const NN_TASA_APRENDIZAJE = 0.15;
export const SEMILLA = 20260811;
export const MINIMO_EJEMPLOS = 200;

// Nº de variables de entrada: para cada una de las VENTANA_ENTRADA
// sesiones, el incremento de precio, el de volumen y el de flujo.
export function calcularNumVariables() {
  return 3 * VENTANA_ENTRADA;
}

function incrementosDe(serie) {
  const r = [null];
  for (let i = 1; i < serie.length; i++) {
    const a = serie[i - 1];
    const b = serie[i];
    r.push(a === null || a === undefined || a === 0 || b === null || b === undefined ? null : b / a - 1);
  }
  return r;
}

// Variables de un valor en la sesión t: las VENTANA_ENTRADA sesiones
// que terminan en t, cada una como variable propia. Null si falta
// cualquier dato del tramo.
function variablesEn(series, t) {
  const v = [];
  for (const serie of [series.precio, series.volumen, series.flujo]) {
    for (let k = 0; k < VENTANA_ENTRADA; k++) {
      const valor = serie[t - k];
      if (valor === null || valor === undefined) return null;
      v.push(valor);
    }
  }
  return v;
}

// Rentabilidad de cada valor entre t y t+HORIZONTE, y la mediana de
// todas ellas — la etiqueta es "¿está por encima de esa mediana?".
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

export function prepararSeries(tickers, datos) {
  const series = {};
  const precioPorTicker = {};
  for (const tk of tickers) {
    if (!datos[tk]) continue;
    const precio = datos[tk].map((d) => d.cierre);
    const volumen = datos[tk].map((d) => d.volumen);
    const flujo = precio.map((p, i) => (p !== null && p !== undefined && volumen[i] !== null && volumen[i] !== undefined ? p * volumen[i] : null));
    precioPorTicker[tk] = precio;
    series[tk] = { precio: incrementosDe(precio), volumen: incrementosDe(volumen), flujo: incrementosDe(flujo) };
  }
  return { series, precioPorTicker };
}

// Reúne los ejemplos (variables + etiqueta) de un rango de sesiones.
function reunirEjemplos(tickers, series, precioPorTicker, desde, hasta) {
  const ejemplos = [];
  for (let t = desde; t <= hasta; t++) {
    const etiquetas = etiquetasEn(tickers, precioPorTicker, t);
    if (etiquetas === null) continue;
    for (const tk of tickers) {
      if (!series[tk] || etiquetas.rentabilidades[tk] === undefined) continue;
      const x = variablesEn(series[tk], t);
      if (x === null) continue;
      ejemplos.push({ t, ticker: tk, x, y: etiquetas.rentabilidades[tk] > etiquetas.mediana ? 1 : 0 });
    }
  }
  return ejemplos;
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

// ---------- Ejecución completa ----------
export function ejecutarClasificacion(tickers, datos, numSesiones) {
  const numVariables = calcularNumVariables();
  const { series, precioPorTicker } = prepararSeries(tickers, datos);
  const tickersValidos = tickers.filter((tk) => series[tk]);

  // Reparto temporal: entrenamiento, hueco de HORIZONTE sesiones (para
  // que ninguna etiqueta de entrenamiento dependa de sesiones de
  // prueba), y tramo de prueba hasta donde haya resultado conocido.
  const primeraSesionUtil = VENTANA_ENTRADA;
  const ultimaConResultado = numSesiones - 1 - HORIZONTE;
  const sesionesUtiles = ultimaConResultado - primeraSesionUtil + 1;
  if (sesionesUtiles < 40) {
    throw new Error(`Hacen falta más sesiones: solo hay ${sesionesUtiles} utilizables tras reservar la ventana de entrada y el horizonte.`);
  }

  const tamanoTest = Math.max(10, Math.round(sesionesUtiles * 0.25));
  const finEntrenamiento = ultimaConResultado - tamanoTest - HORIZONTE;
  const inicioTest = finEntrenamiento + HORIZONTE + 1;

  const ejemplosEntrenamiento = reunirEjemplos(tickersValidos, series, precioPorTicker, primeraSesionUtil, finEntrenamiento);
  if (ejemplosEntrenamiento.length < MINIMO_EJEMPLOS) {
    throw new Error(`Solo ${ejemplosEntrenamiento.length} ejemplos de entrenamiento (mínimo ${MINIMO_EJEMPLOS}). Prueba con un periodo más largo.`);
  }

  const modelo = ajustar(ejemplosEntrenamiento, numVariables);

  // --- Evaluación, con el modelo CONGELADO ---
  const pasos = [];
  for (let t = inicioTest; t <= ultimaConResultado; t++) {
    const etiquetas = etiquetasEn(tickersValidos, precioPorTicker, t);
    if (etiquetas === null) continue;

    const predicciones = [];
    for (const tk of tickersValidos) {
      if (etiquetas.rentabilidades[tk] === undefined) continue;
      const x = variablesEn(series[tk], t);
      if (x === null) continue;
      predicciones.push({
        ticker: tk,
        probabilidad: aplicar(modelo, x),
        real: etiquetas.rentabilidades[tk] > etiquetas.mediana ? 1 : 0,
        rentabilidad: etiquetas.rentabilidades[tk],
      });
    }
    if (predicciones.length < 4) continue;

    const aciertos = predicciones.filter((p) => (p.probabilidad > 0.5 ? 1 : 0) === p.real).length;

    // Los NUM_DESTACADOS de mayor probabilidad, y su rentabilidad real
    // en las HORIZONTE sesiones siguientes, frente a la media de todos
    // los candidatos ese mismo día.
    const porConfianza = [...predicciones].sort((a, b) => b.probabilidad - a.probabilidad);
    const destacados = porConfianza.slice(0, NUM_DESTACADOS);
    const rentDestacados = destacados.reduce((s, p) => s + p.rentabilidad, 0) / destacados.length;
    const rentMedia = predicciones.reduce((s, p) => s + p.rentabilidad, 0) / predicciones.length;

    // Aciertos solo entre los más seguros: si el modelo tiene señal
    // real, debería acertar más donde está más confiado.
    const masSeguros = [...predicciones].sort((a, b) => Math.abs(b.probabilidad - 0.5) - Math.abs(a.probabilidad - 0.5)).slice(0, Math.max(4, Math.round(predicciones.length * 0.2)));
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

  // --- Clasificación de HOY: se reentrena con TODO el histórico
  // disponible (incluido el tramo de prueba). Hay solapamiento con lo
  // ya evaluado, pero no importa: esta clasificación no se usa para
  // medir nada, solo para mostrar la foto de hoy — la fiabilidad ya
  // quedó establecida antes y por separado, con el modelo congelado.
  const ejemplosTodos = reunirEjemplos(tickersValidos, series, precioPorTicker, primeraSesionUtil, ultimaConResultado);
  const modeloFinal = ajustar(ejemplosTodos, numVariables);

  const tHoy = numSesiones - 1;
  const clasificacionHoy = [];
  for (const tk of tickersValidos) {
    const x = variablesEn(series[tk], tHoy);
    if (x === null) continue;
    clasificacionHoy.push({ ticker: tk, probabilidad: Number(aplicar(modeloFinal, x).toFixed(4)) });
  }
  clasificacionHoy.sort((a, b) => b.probabilidad - a.probabilidad);
  const mitad = Math.floor(clasificacionHoy.length / 2);
  const destacadosHoy = new Set(clasificacionHoy.slice(0, NUM_DESTACADOS).map((c) => c.ticker));

  return {
    parametros: {
      ventanaEntrada: VENTANA_ENTRADA,
      horizonte: HORIZONTE,
      numVariables,
      numDestacados: NUM_DESTACADOS,
    },
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
