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

import { calcularSeleccionCompleta } from "./motor";

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

// Recorre todas las ventanas dadas, ejecuta el backtest de "metodo" en
// cada una, y llama a "callback" por cada aparición de un ticker en
// cualquier cartera de cualquier rebalanceo — igual que hace
// concentracionSeleccion.js, pero dando además acceso al HISTÓRICO
// COMPLETO de precio/volumen de ese ticker (no solo al recorte de la
// ventana), y a la posición global de la fecha de selección dentro de
// ese histórico completo. Necesario para las comprobaciones que
// necesitan mirar hacia atrás más allá del principio de la ventana
// del backtest (p. ej. "¿hubo una caída de precio 60 sesiones antes
// de la selección?", cuando la selección puede caer cerca del
// principio de una ventana de solo 20 sesiones).
//
// callback recibe { ticker, fechaSeleccion, tGlobal, serieCompleta },
// donde tGlobal es el índice de fechaSeleccion dentro de "fechas" (el
// array completo, sin recortar) y serieCompleta es datos[ticker]
// (también completo, sin recortar).
export function recorrerSelecciones(fechas, datos, ventanas, metodo, params, callback) {
  const { criterioPuntuacion, invertido } = descomponerMetodo(metodo);

  for (const ventana of ventanas) {
    const fechasV = fechas.slice(ventana.inicio, ventana.fin);
    const datosV = cortarDatos(datos, ventana.inicio, ventana.fin);
    const { historico } = calcularSeleccionCompleta(
      fechasV,
      datosV,
      params.factor,
      params.n,
      params.max,
      params.frecuencia,
      null,
      criterioPuntuacion,
      undefined,
      params.sesionesPuntuacion,
      invertido
    );

    for (const dia of historico) {
      const tGlobal = fechas.indexOf(dia.fecha);
      if (tGlobal === -1) continue; // no debería pasar, pero por seguridad no rompemos el recorrido
      for (const c of dia.cartera) {
        callback({ ticker: c.ticker, fechaSeleccion: dia.fecha, tGlobal, serieCompleta: datos[c.ticker] });
      }
    }
  }
}
