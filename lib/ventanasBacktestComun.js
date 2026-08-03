// lib/ventanasBacktestComun.js
//
// Generación de ventanas históricas sin solape para repetir un
// backtest varias veces con datos independientes — extraído de
// pages/api/analisisCorrelacion.js para poder reutilizarlo también en
// las herramientas de "Anomalías en el flujo de dinero bajo"
// (pages/api/concentracionSeleccion.js y las que vengan después), sin
// duplicar la lógica. Usar la MISMA batería en ambos sitios es
// importante: así los resultados de una y otra herramienta son
// directamente comparables entre sí.

export const DURACIONES = [20, 30, 50, 80, 120];
export const MAX_REPETICIONES = 6; // ventanas históricas distintas, sin solape, por duración

export function cortarDatos(datos, desde, hasta) {
  return Object.fromEntries(Object.keys(datos).map((tk) => [tk, datos[tk].slice(desde, hasta)]));
}

// Devuelve las ventanas [inicio, fin) no solapadas de tamaño
// (duracion + sesionesPuntuacion), tantas como quepan hacia atrás
// desde el final del histórico descargado, hasta MAX_REPETICIONES.
export function calcularVentanas(totalDias, duracion, sesionesPuntuacion) {
  const tamano = duracion + sesionesPuntuacion;
  const ventanas = [];
  let fin = totalDias;
  while (ventanas.length < MAX_REPETICIONES && fin - tamano >= 0) {
    ventanas.push({ inicio: fin - tamano, fin });
    fin -= duracion;
  }
  return ventanas;
}

// Los métodos "Bajo" (precioBajo, volumenBajo, flujoBajo) son la
// antítesis de precio/volumen/flujo: mismo cálculo de puntuación,
// pero seleccionando los últimos de la clasificación en vez de los
// primeros.
export function descomponerMetodo(metodo) {
  const invertido = metodo.endsWith("Bajo");
  return { criterioPuntuacion: invertido ? metodo.slice(0, -"Bajo".length) : metodo, invertido };
}

// Cuánto histórico hay que descargar para poder construir
// MAX_REPETICIONES ventanas de la mayor duración probada.
export function calcularDiasTotal(sesionesPuntuacion) {
  return Math.max(...DURACIONES) * MAX_REPETICIONES + sesionesPuntuacion + 20;
}
