// lib/algebraComun.js
//
// Operaciones matriciales mínimas, sin ninguna librería de álgebra
// lineal externa (no hay ninguna en el proyecto). Compartidas entre
// "Selección por modelo multifactor" (regresión ridge) y "Modelo de
// réplica de un índice" (mínimos cuadrados con restricción de que los
// pesos sumen 100%) — ambas necesitan lo mismo por debajo: resolver
// un sistema de ecuaciones lineales.
//
// Todas trabajan con matrices representadas como array de arrays
// (filas), y vectores como arrays planos.

export function transponer(m) {
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

export function multiplicar(a, b) {
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
export function multiplicarVector(m, v) {
  return m.map((fila) => fila.reduce((suma, valor, j) => suma + valor * v[j], 0));
}

// Inversión de matriz cuadrada por eliminación de Gauss-Jordan, con
// pivoteo parcial (elige en cada paso la fila con mayor valor
// absoluto en la columna del pivote, para estabilidad numérica).
// Lanza un error si la matriz es singular (no invertible).
export function invertir(m) {
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
