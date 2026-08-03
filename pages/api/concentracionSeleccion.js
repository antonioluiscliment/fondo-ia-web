// pages/api/concentracionSeleccion.js
//
// Primera herramienta de "Anomalías en el flujo de dinero bajo":
// ¿está "flujo bajo" seleccionando siempre un puñado pequeño y fijo
// de valores, o se reparte de forma amplia entre muchos valores
// distintos según la época? Si concentra mucho, lo que parece un
// patrón de mercado (ver la conversación que dio origen a esta
// sección) podría ser en realidad solo el perfil de rentabilidad de
// esos pocos valores concretos, no un efecto genuino y generalizable.
//
// Reutiliza EXACTAMENTE la misma batería de ventanas sin solape que
// "Análisis de correlación con el índice" (lib/ventanasBacktestComun.js)
// — importante para que los resultados de ambas herramientas sean
// directamente comparables.
//
// Qué se cuenta: dentro de cada ventana, el backtest se rebalancea
// varias veces; se cuenta CADA aparición de cada ticker en CUALQUIER
// cartera de CUALQUIER rebalanceo de CUALQUIER ventana — no solo la
// cartera final de cada ventana. Se calcula tanto para "flujo bajo"
// como para "flujo" normal, como referencia: lo interesante no es la
// concentración en términos absolutos (cualquier método con solo 3-6
// huecos y 30-40 candidatos concentra algo, por pura aritmética), sino
// si "flujo bajo" concentra MÁS que su opuesto normal.
//
// Parámetros de la query: los mismos que "Análisis de correlación"
// (indice, sesiones, factor, n, max, frecuencia), para poder comparar
// los resultados de ambas herramientas en igualdad de condiciones.

import {
  getYahooFinanceInstance,
  mensajeErrorAmigable,
  obtenerDatosAlineados,
  calcularSeleccionCompleta,
  FACTOR_PENALIZACION_DEFECTO,
  N_COMPONENTES,
  PESO_MAXIMO,
  FRECUENCIA_REBALANCEO_DEFECTO,
  SESIONES_PUNTUACION_DEFECTO,
} from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { DURACIONES, cortarDatos, calcularVentanas, descomponerMetodo, calcularDiasTotal } from "../../lib/ventanasBacktestComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const METODOS = ["flujoBajo", "flujo"];

// Cuenta, para un método concreto y una lista de ventanas ya
// recortadas, cuántas veces aparece cada ticker en cualquier cartera
// de cualquier rebalanceo de cualquier ventana.
function contarAparicionesMetodo(fechas, datos, ventanas, metodo, params) {
  const { criterioPuntuacion, invertido } = descomponerMetodo(metodo);
  const contador = {};
  let totalApariciones = 0;

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
      for (const c of dia.cartera) {
        contador[c.ticker] = (contador[c.ticker] || 0) + 1;
        totalApariciones++;
      }
    }
  }

  return { contador, totalApariciones };
}

// A partir del contador de apariciones, construye la lista de
// frecuencias ordenada de mayor a menor, y el % que acaparan los 3
// tickers más repetidos (el indicador de concentración "de un
// vistazo").
function construirFrecuencias(contador, totalApariciones, nombresEmpresas) {
  const frecuencias = Object.entries(contador)
    .map(([ticker, veces]) => ({
      ticker,
      nombre: nombresEmpresas[ticker],
      veces,
      pct: totalApariciones > 0 ? Number(((veces / totalApariciones) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.veces - a.veces || a.ticker.localeCompare(b.ticker));

  const top3Pct = totalApariciones > 0
    ? Number((frecuencias.slice(0, 3).reduce((s, f) => s + f.veces, 0) / totalApariciones * 100).toFixed(2))
    : null;

  return { frecuencias, top3Pct };
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const factor = req.query.factor !== undefined ? Number(req.query.factor) : FACTOR_PENALIZACION_DEFECTO;
    const n = req.query.n !== undefined ? Number(req.query.n) : N_COMPONENTES;
    const max = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;
    const frecuenciaParam = req.query.frecuencia;
    const frecuencia =
      frecuenciaParam === undefined || frecuenciaParam === "diario"
        ? FRECUENCIA_REBALANCEO_DEFECTO
        : Number(frecuenciaParam);

    const sesionesParam = req.query.sesiones;
    const sesionesPuntuacion = sesionesParam !== undefined ? Number(sesionesParam) : SESIONES_PUNTUACION_DEFECTO;
    if (![3, 5, 8, 13].includes(sesionesPuntuacion)) {
      throw new Error("El parámetro 'sesiones' debe ser 3, 5, 8 o 13.");
    }
    const params = { factor, n, max, frecuencia, sesionesPuntuacion };

    const indice = obtenerIndice(req.query.indice);

    const diasTotal = calcularDiasTotal(sesionesPuntuacion);
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasTotal, indice.tickers);

    const resultados = {};
    for (const metodo of METODOS) {
      const porDuracion = [];
      // Acumuladores globales (todas las duraciones juntas), para dar
      // también una cifra de conjunto además del desglose.
      const contadorGlobal = {};
      let totalGlobal = 0;

      for (const duracion of DURACIONES) {
        const ventanas = calcularVentanas(fechas.length, duracion, sesionesPuntuacion);
        if (ventanas.length === 0) continue;

        const { contador, totalApariciones } = contarAparicionesMetodo(fechas, datos, ventanas, metodo, params);
        const { frecuencias, top3Pct } = construirFrecuencias(contador, totalApariciones, indice.nombresEmpresas);
        porDuracion.push({ duracion, repeticiones: ventanas.length, totalApariciones, frecuencias, top3Pct });

        for (const [ticker, veces] of Object.entries(contador)) {
          contadorGlobal[ticker] = (contadorGlobal[ticker] || 0) + veces;
        }
        totalGlobal += totalApariciones;
      }

      const { frecuencias: frecuenciasGlobal, top3Pct: top3PctGlobal } = construirFrecuencias(
        contadorGlobal,
        totalGlobal,
        indice.nombresEmpresas
      );

      resultados[metodo] = {
        porDuracion,
        global: { totalApariciones: totalGlobal, frecuencias: frecuenciasGlobal, top3Pct: top3PctGlobal },
      };
    }

    res.status(200).json({
      indice: indice.id,
      nombreIndice: indice.nombre.es,
      duraciones: DURACIONES,
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
