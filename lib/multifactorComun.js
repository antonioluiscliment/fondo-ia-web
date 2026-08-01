// lib/multifactorComun.js
//
// Base matemática de "Selección por modelo multifactor": operaciones
// matriciales mínimas (no hay ninguna librería de álgebra lineal en
// el proyecto, así que se implementan aquí, sin dependencias externas)
// y la regresión ridge que ajusta los pesos de las variables.
//
// Por qué ridge y no una regresión normal (mínimos cuadrados sin más):
// varias de las variables están muy correlacionadas entre sí por
// construcción (el flujo de dinero es literalmente precio × volumen),
// y con relativamente pocos datos de entrenamiento eso hace que una
// regresión normal reparta el peso entre variables redundantes de
// forma inestable, cambiando mucho de una ejecución a otra. La
// regularización ridge (penalizar pesos muy grandes) corrige eso sin
// perder apenas capacidad explicativa, y sigue teniendo una solución
// matemática directa (no hace falta ningún proceso iterativo).

// ---------- Operaciones matriciales mínimas ----------
// Todas trabajan con matrices representadas como array de arrays
// (filas), y vectores como arrays planos.

function transponer(m) {
  const filas = m.length;
  const columnas = m[0].length;
  const t = Array.from({ length: columnas }, () => new Array(filas).fill(0));
  for (let i = 0; i < filas; i++) {
    for (let j = 0; j < columnas; j++) {
      t[j][i] = m[i][j];
    }
  }
  return t;
}

function multiplicar(a, b) {
  const filasA = a.length;
  const columnasA = a[0].length;
  const columnasB = b[0].length;
  const resultado = Array.from({ length: filasA }, () => new Array(columnasB).fill(0));
  for (let i = 0; i < filasA; i++) {
    for (let j = 0; j < columnasB; j++) {
      let suma = 0;
      for (let k = 0; k < columnasA; k++) {
        suma += a[i][k] * b[k][j];
      }
      resultado[i][j] = suma;
    }
  }
  return resultado;
}

// Multiplica una matriz por un vector columna (vector como array plano).
function multiplicarVector(m, v) {
  return m.map((fila) => fila.reduce((suma, valor, j) => suma + valor * v[j], 0));
}

// Inversión de matriz cuadrada por eliminación de Gauss-Jordan, con
// pivoteo parcial (elige en cada paso la fila con mayor valor
// absoluto en la columna del pivote, para estabilidad numérica).
// Lanza un error si la matriz es singular (no invertible).
function invertir(m) {
  const n = m.length;
  // Matriz aumentada [m | I]
  const aum = m.map((fila, i) => [...fila, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let col = 0; col < n; col++) {
    // Pivoteo parcial
    let filaPivote = col;
    let maxAbs = Math.abs(aum[col][col]);
    for (let fila = col + 1; fila < n; fila++) {
      if (Math.abs(aum[fila][col]) > maxAbs) {
        maxAbs = Math.abs(aum[fila][col]);
        filaPivote = fila;
      }
    }
    if (maxAbs < 1e-12) {
      throw new Error("Matriz singular: no se puede invertir (datos insuficientes o demasiado correlacionados).");
    }
    if (filaPivote !== col) {
      [aum[col], aum[filaPivote]] = [aum[filaPivote], aum[col]];
    }

    const pivote = aum[col][col];
    for (let j = 0; j < 2 * n; j++) aum[col][j] /= pivote;

    for (let fila = 0; fila < n; fila++) {
      if (fila === col) continue;
      const factor = aum[fila][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) {
        aum[fila][j] -= factor * aum[col][j];
      }
    }
  }

  return aum.map((fila) => fila.slice(n));
}

// ---------- Regresión ridge ----------
//
// X: matriz de características ya normalizadas, con una columna de
//    "1" añadida al principio para el término independiente
//    (intercept) — filas = observaciones, columnas = variables + 1.
// y: vector objetivo (una rentabilidad futura por observación).
// lambda: fuerza de la regularización (mayor = pesos más
//    conservadores, más resistente a datos correlacionados).
//
// Fórmula cerrada: w = (XᵀX + λI)⁻¹ Xᵀy — con el intercept SIN
// penalizar (fila/columna 0 de la matriz de penalización a cero), que
// es la práctica estándar: no tiene sentido "encoger" el término
// independiente hacia cero como si fuera una variable más.
export function ajustarRidge(X, y, lambda) {
  const nFilas = X.length;
  const nColumnas = X[0].length;
  const Xt = transponer(X);
  const XtX = multiplicar(Xt, X);

  for (let i = 1; i < nColumnas; i++) {
    XtX[i][i] += lambda;
  }

  const XtXinv = invertir(XtX);
  const Xty = Xt.map((fila) => fila.reduce((suma, valor, j) => suma + valor * y[j], 0));
  const pesos = multiplicarVector(XtXinv, Xty);
  return pesos;
}

export function predecir(X, pesos) {
  return multiplicarVector(X, pesos);
}

// R² (coeficiente de determinación): 1 − (suma de residuos al
// cuadrado / suma de desviaciones a la media al cuadrado). Puede salir
// negativo si el modelo predice peor que la media — y hay que
// mostrarlo así, no ocultarlo.
export function calcularR2(yReal, yPredicho) {
  const n = yReal.length;
  const media = yReal.reduce((a, b) => a + b, 0) / n;
  let sumaResiduos = 0;
  let sumaTotal = 0;
  for (let i = 0; i < n; i++) {
    sumaResiduos += (yReal[i] - yPredicho[i]) ** 2;
    sumaTotal += (yReal[i] - media) ** 2;
  }
  if (sumaTotal === 0) return null;
  return 1 - sumaResiduos / sumaTotal;
}

// ---------- Normalización (z-score) ----------
//
// Imprescindible antes de ajustar: sin esto, los pesos resultantes no
// se pueden comparar entre sí (el PER se mueve en la escala 5-40, el
// consenso de analistas en la escala 1-5, los incrementos de precio
// en tanto por uno).
export function calcularNormalizacion(columnaValores) {
  const n = columnaValores.length;
  const media = columnaValores.reduce((a, b) => a + b, 0) / n;
  const varianza = columnaValores.reduce((suma, v) => suma + (v - media) ** 2, 0) / n;
  const desviacion = Math.sqrt(varianza);
  return { media, desviacion: desviacion > 1e-12 ? desviacion : 1 };
}

export function normalizar(valor, { media, desviacion }) {
  return (valor - media) / desviacion;
}

// ---------- Constantes del modelo ----------
//
// MARGEN: sesiones de sobra al principio de la ventana, para poder
// calcular momentum y dispersión ya desde el primer día de
// entrenamiento (si no, la primera fila de entrenamiento no tendría
// datos previos suficientes). Es VENTANA_DISPERSION + 1, no
// VENTANA_DISPERSION a secas: el primer incremento de cualquier serie
// es siempre null (no hay día anterior con el que compararlo), así
// que la desviación típica de las últimas VENTANA_DISPERSION sesiones
// necesita esa sesión extra para no toparse con ese null.
// ENTRENAMIENTO / VALIDACION: con el índice más pequeño de la
// aplicación (3 componentes), 50 sesiones de entrenamiento dan 150
// filas — unas 17 por variable, en el límite bajo pero aceptable con
// ridge; con cualquier otro índice, sobra de largo. No conviene
// alargar mucho más: cuanto más larga la ventana de entrenamiento,
// peor la aproximación de tratar el PER/EPS/consenso de HOY como si
// fueran los de hace semanas (no cambian a lo largo de la ventana,
// porque Yahoo no da histórico diario de esos datos).
// VENTANA_DISPERSION: fija en 20 sesiones, más larga que la ventana
// de momentum (sesionesPuntuacion, 3-13) porque una desviación típica
// necesita más puntos para ser mínimamente fiable.
export const MARGEN = 21;
export const SESIONES_ENTRENAMIENTO = 50;
export const SESIONES_VALIDACION = 20;
export const VENTANA_DISPERSION = 20;
export const MIN_FILAS_POR_VARIABLE_AVISO = 15; // por debajo de esto, se avisa de muestra pequeña
export const MIN_ANALISTAS = 3;
export const N_MIN = 3;
export const N_MAX = 6;
export const LAMBDA_RIDGE = 8; // regularización moderada, fija — ver cabecera del fichero

// ---------- Ingeniería de variables ----------

// Incrementos porcentuales día a día de una serie de valores
// (cierre, volumen o flujo). serie[i] puede ser null/undefined
// (hueco de datos); en ese caso el incremento correspondiente sale
// como null, y se propaga como null en las sumas que lo usen.
export function calcularIncrementosSerie(valores) {
  const incrementos = [null]; // el primer día no tiene incremento
  for (let i = 1; i < valores.length; i++) {
    const anterior = valores[i - 1];
    const actual = valores[i];
    if (anterior === null || anterior === undefined || anterior === 0 || actual === null || actual === undefined) {
      incrementos.push(null);
    } else {
      incrementos.push((actual - anterior) / anterior);
    }
  }
  return incrementos;
}

// Suma de los incrementos de las últimas `ventana` sesiones anteriores
// al índice t (sin incluir el propio t): incrementos[t-1] + ... +
// incrementos[t-ventana]. Devuelve null si falta algún dato en esa
// ventana (no se puede calcular un momentum parcial sin más).
export function sumaMomentum(incrementos, t, ventana) {
  let suma = 0;
  for (let k = 1; k <= ventana; k++) {
    const valor = incrementos[t - k];
    if (valor === null || valor === undefined) return null;
    suma += valor;
  }
  return suma;
}

// Desviación típica de los incrementos de precio de las últimas
// `ventana` sesiones anteriores al índice t. Mide la dispersión
// (volatilidad) del valor, no su nivel — a diferencia del momentum,
// que suma con signo, aquí importa cuánto varían los incrementos
// entre sí.
export function desviacionMomentum(incrementos, t, ventana) {
  const muestra = [];
  for (let k = 1; k <= ventana; k++) {
    const valor = incrementos[t - k];
    if (valor === null || valor === undefined) return null;
    muestra.push(valor);
  }
  const media = muestra.reduce((a, b) => a + b, 0) / muestra.length;
  const varianza = muestra.reduce((suma, v) => suma + (v - media) ** 2, 0) / muestra.length;
  return Math.sqrt(varianza);
}

// Rentabilidad acumulada desde el cierre en t hasta el cierre en
// t + ventana (el "objetivo" que el modelo intenta predecir). Null si
// falta algún dato.
export function rentabilidadFutura(cierres, t, ventana) {
  const inicial = cierres[t];
  const final = cierres[t + ventana];
  if (inicial === null || inicial === undefined || inicial === 0 || final === null || final === undefined) return null;
  return final / inicial - 1;
}
