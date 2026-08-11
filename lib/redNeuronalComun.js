// lib/redNeuronalComun.js
//
// Red neuronal pequeña y deliberadamente sencilla (una sola capa
// oculta, pocas neuronas), implementada desde cero sin ninguna
// librería de aprendizaje automático — no hay ninguna en el
// proyecto, todo el álgebra de esta aplicación (ridge, réplica de
// índice) está igualmente construida a mano.
//
// Por qué tan pequeña: se entrena muchas veces dentro de un
// walk-forward (ver walkForwardComun.js), así que cada entrenamiento
// tiene que ser barato — ni la arquitectura ni el nº de iteraciones
// pueden ser grandes sin arriesgar el tiempo de espera del servidor.
//
// Arquitectura: entrada (variable, según nº de variables de
// walkForwardComun.js) -> capa oculta (H, activación tanh) -> salida
// (1, lineal) — un perceptrón multicapa clásico, del tipo más simple
// que todavía merece llamarse "red neuronal" en vez de una regresión
// lineal disfrazada.

// ---------- Utilidades ----------

function tanh(x) {
  return Math.tanh(x);
}

// Derivada de tanh expresada en función de su propia salida (h),
// más barata que volver a calcular tanh: tanh'(z) = 1 - tanh(z)^2.
function derivadaTanhDesdeSalida(h) {
  return 1 - h * h;
}

function numeroAleatorio(rng) {
  // Generador determinista simple (congruencial), para que los
  // pesos iniciales sean reproducibles con la misma semilla — igual
  // que ya se hace en otras partes de la aplicación (selección
  // aleatoria, etc.).
  rng.estado = (rng.estado * 1103515245 + 12345) % 2147483648;
  return rng.estado / 2147483648;
}

// Inicialización de pesos pequeña y centrada en 0 (Xavier/Glorot
// simplificado), para que la red no empiece saturada.
function inicializarPesos(filas, columnas, rng) {
  const escala = Math.sqrt(2 / (filas + columnas));
  return Array.from({ length: filas }, () => Array.from({ length: columnas }, () => (numeroAleatorio(rng) * 2 - 1) * escala));
}

// ---------- Red neuronal ----------

// numEntradas: nº de variables de entrada.
// numOcultas: nº de neuronas de la capa oculta (10 por defecto).
// semilla: para que la inicialización de pesos sea reproducible.
export function crearRed(numEntradas, numOcultas = 10, semilla = 12345) {
  const rng = { estado: semilla };
  return {
    numEntradas,
    numOcultas,
    W1: inicializarPesos(numOcultas, numEntradas, rng), // (H, E)
    b1: new Array(numOcultas).fill(0),
    W2: inicializarPesos(1, numOcultas, rng)[0], // (H,) — una sola neurona de salida
    b2: 0,
  };
}

// Propagación hacia delante para UN ejemplo (x: array de numEntradas).
// Devuelve también los valores intermedios (z1, h) porque hacen
// falta para la retropropagación.
function propagarAdelante(red, x) {
  const z1 = red.W1.map((fila, i) => fila.reduce((suma, w, j) => suma + w * x[j], red.b1[i]));
  const h = z1.map(tanh);
  const yPred = red.W2.reduce((suma, w, i) => suma + w * h[i], red.b2);
  return { z1, h, yPred };
}

export function predecir(red, x) {
  return propagarAdelante(red, x).yPred;
}

// ---------- Modo clasificación ----------
//
// La red se creó para REGRESIÓN (predecir un número: la rentabilidad
// futura), con salida lineal y error cuadrático. Para CLASIFICACIÓN
// binaria ("¿estará este valor por encima de la mediana del índice?")
// hacen falta dos cambios, y solo dos:
//
//   1. La salida pasa por una sigmoide, que comprime cualquier número
//      al rango 0-1 y permite leerlo como una probabilidad.
//   2. El error deja de ser cuadrático y pasa a ser entropía cruzada,
//      la medida adecuada cuando lo que se predice es una
//      probabilidad y no una magnitud.
//
// Lo notable es que, con esta combinación concreta (sigmoide +
// entropía cruzada), la derivada del error respecto a la entrada de
// la sigmoide se simplifica hasta quedar EXACTAMENTE igual que en el
// caso lineal con error cuadrático: (predicción − real). Por eso
// pasoEntrenamiento sirve para los dos modos sin cambiar su
// aritmética interna — solo hay que aplicar la sigmoide antes de
// calcular ese error.

function sigmoide(z) {
  // Formulación estable numéricamente: la versión directa
  // (1/(1+e^-z)) desborda con valores muy negativos.
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

// Probabilidad (0 a 1) de que el ejemplo pertenezca a la clase
// positiva. "Confianza" en el resultado = cuánto se aleja de 0,5.
export function predecirProbabilidad(red, x) {
  return sigmoide(propagarAdelante(red, x).yPred);
}

// Un paso de descenso de gradiente con TODO el lote (batch completo,
// no mini-lotes) — con los tamaños de datos que maneja esta
// herramienta, un lote completo es perfectamente asumible y evita la
// complejidad añadida de mini-lotes aleatorios.
//
// X: array de arrays (filas = ejemplos, columnas = numEntradas), ya
// normalizado. y: array de valores objetivo (mismo orden que X).
// tasaAprendizaje: cuánto se mueven los pesos en cada paso.
//
// Devuelve el error medio de ESTE lote, antes de actualizar los pesos
// (para poder seguir la curva de aprendizaje si hace falta depurar).
//
// clasificacion: si es true, la salida pasa por una sigmoide y el
// error es la entropía cruzada, en vez de salida lineal y error
// cuadrático (ver la nota de predecirProbabilidad más arriba: el
// gradiente resultante es idéntico en los dos casos, por eso el resto
// de la función no cambia).
function pasoEntrenamiento(red, X, y, tasaAprendizaje, clasificacion = false) {
  const n = X.length;
  const gradW1 = red.W1.map((fila) => fila.map(() => 0));
  const gradB1 = red.b1.map(() => 0);
  const gradW2 = red.W2.map(() => 0);
  let gradB2 = 0;
  let sumaError = 0;

  for (let k = 0; k < n; k++) {
    const x = X[k];
    const { h, yPred } = propagarAdelante(red, x);
    const salida = clasificacion ? sigmoide(yPred) : yPred;
    const error = salida - y[k];

    if (clasificacion) {
      // Entropía cruzada: −[y·log(p) + (1−y)·log(1−p)], acotada para
      // no dar infinito cuando la probabilidad se acerca a 0 o a 1.
      const p = Math.min(Math.max(salida, 1e-12), 1 - 1e-12);
      sumaError += -(y[k] * Math.log(p) + (1 - y[k]) * Math.log(1 - p));
    } else {
      sumaError += error * error;
    }

    // El gradiente respecto a la entrada de la última neurona es
    // (salida − real) en LOS DOS modos — ver la nota de más arriba.
    const dY = error;

    for (let i = 0; i < red.numOcultas; i++) {
      gradW2[i] += dY * h[i];
    }
    gradB2 += dY;

    for (let i = 0; i < red.numOcultas; i++) {
      const dZ1_i = dY * red.W2[i] * derivadaTanhDesdeSalida(h[i]);
      for (let j = 0; j < red.numEntradas; j++) {
        gradW1[i][j] += dZ1_i * x[j];
      }
      gradB1[i] += dZ1_i;
    }
  }

  const factor = (2 * tasaAprendizaje) / n;
  for (let i = 0; i < red.numOcultas; i++) {
    for (let j = 0; j < red.numEntradas; j++) {
      red.W1[i][j] -= factor * gradW1[i][j];
    }
    red.b1[i] -= factor * gradB1[i];
    red.W2[i] -= factor * gradW2[i];
  }
  red.b2 -= factor * gradB2;

  return sumaError / n;
}

// Entrena la red un nº fijo de épocas (pasadas completas por todos
// los datos) — nº fijo, no "hasta que converja", para que el coste
// de cada paso del walk-forward esté acotado de antemano.
export function entrenar(red, X, y, { epocas = 200, tasaAprendizaje = 0.05, clasificacion = false } = {}) {
  let errorFinal = null;
  for (let e = 0; e < epocas; e++) {
    errorFinal = pasoEntrenamiento(red, X, y, tasaAprendizaje, clasificacion);
  }
  return errorFinal;
}
