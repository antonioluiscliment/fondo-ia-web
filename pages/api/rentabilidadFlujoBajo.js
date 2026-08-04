// pages/api/rentabilidadFlujoBajo.js
//
// Cuarta herramienta de "Anomalías en el flujo de dinero bajo":
// "Rentabilidad de la selección por flujo de dinero bajo". Directa a
// la variable que de verdad importa (rentabilidad), en vez de seguir
// mirando variables intermedias (precio, volumen) que ya empezaban a
// diluirse al suavizar la señal.
//
// Recorre, para cada índice marcado y cada factor de penalización
// marcado, todas las combinaciones de sesiones promediadas (2, 3) y
// duración de backtest (30, 40, 50, 60), siempre con el método "flujo
// bajo". Para cada combinación: rentabilidad media y rango de la
// cartera en las 6 repeticiones, rentabilidad media del propio
// índice, la distancia de cada extremo del rango a esa rentabilidad
// del índice, y los 3 valores más elegidos con su rentabilidad REAL
// (cotización de hoy frente a hace "duracion" sesiones) — para poder
// ver, además del agregado, qué valores concretos hay detrás de cada
// cifra y cómo les ha ido de verdad.
//
// El factor de penalización es configurable aquí (a diferencia de la
// mayoría de herramientas de la app, que usan el valor del marco
// exterior sin más) porque forma parte de lo que se está investigando:
// se detectó que el propio mecanismo de penalización (no solo el
// criterio de selección) influye mucho en el resultado — con factor 0
// el comportamiento es muy distinto que con factor > 0. Poder marcar
// varios valores a la vez (0, 1, 2, o el que esté configurado ahora
// mismo en la app) permite comparar directamente.
//
// El usuario elige qué índices incluir (checkboxes) — descargar y
// procesar varios índices con varios factores a la vez es la
// comprobación más pesada de toda esta sección.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados, obtenerIncrementosIndice, calcularSeleccionCompleta, calcularRentabilidadTotalCarteraAnterior, N_COMPONENTES, PESO_MAXIMO, FRECUENCIA_REBALANCEO_DEFECTO } from "../../lib/motor";
import { INDICES } from "../../lib/indices";
import { cortarDatos, calcularVentanas, MAX_REPETICIONES } from "../../lib/ventanasBacktestComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

export const SESIONES_PROMEDIADAS = [2, 3];
export const DURACIONES_REDUCIDAS = [30, 40, 50, 60];

// Solo los índices "tradicionales" (con ETF de referencia real, o el
// PSI 20, que no tiene ETF activo pero tampoco es un índice ADR) —
// los índices ADR no venían al caso de la observación original.
const INDICES_DISPONIBLES = INDICES.filter((i) => !!i.etfReferencia || i.id === "psi20");

function rentabilidadIndiceEnPeriodo(cierresIndice, fechaInicioObjetivo, fechaFinObjetivo) {
  if (cierresIndice.length === 0) return null;
  const inicio = cierresIndice.find((c) => c.fecha === fechaInicioObjetivo) || cierresIndice[0];
  const fin = [...cierresIndice].reverse().find((c) => c.fecha === fechaFinObjetivo) || cierresIndice[cierresIndice.length - 1];
  if (inicio.cierre === null || inicio.cierre === undefined || inicio.cierre === 0 || fin.cierre === null || fin.cierre === undefined) {
    return null;
  }
  return Number(((fin.cierre / inicio.cierre - 1) * 100).toFixed(4));
}

function calcularDiasTotalReducido() {
  return Math.max(...DURACIONES_REDUCIDAS) * MAX_REPETICIONES + Math.max(...SESIONES_PROMEDIADAS) + 20;
}

// Rentabilidad REAL de un ticker desde hoy (el último cierre
// descargado) hasta hace "duracion" sesiones — no la rentabilidad
// dentro de ninguna ventana del backtest, la cotización actual tal
// cual. Usa datos ya descargados, sin ninguna llamada nueva.
function rentabilidadRealTicker(datos, ticker, duracion) {
  const serie = datos[ticker];
  if (!serie || serie.length === 0) return null;
  const hoy = serie[serie.length - 1];
  const indiceHaceN = serie.length - 1 - duracion;
  if (indiceHaceN < 0) return null;
  const haceN = serie[indiceHaceN];
  if (
    !hoy || !haceN ||
    hoy.cierre === null || hoy.cierre === undefined ||
    haceN.cierre === null || haceN.cierre === undefined || haceN.cierre === 0
  ) {
    return null;
  }
  return Number(((hoy.cierre / haceN.cierre - 1) * 100).toFixed(2));
}

// Procesa un índice para UN factor de penalización concreto — ya con
// los datos descargados de antemano (se comparten entre todos los
// factores probados, no hace falta descargar de nuevo por cada uno).
function procesarIndicePorFactor(fechas, datos, cierresIndice, nombresEmpresas, factor, params) {
  const porCombinacion = [];

  for (const sesionesPromediadas of SESIONES_PROMEDIADAS) {
    for (const duracion of DURACIONES_REDUCIDAS) {
      const ventanas = calcularVentanas(fechas.length, duracion, sesionesPromediadas);
      if (ventanas.length === 0) {
        porCombinacion.push({ sesionesPromediadas, duracion, repeticiones: 0, rentCarteraMedia: null, rentCarteraMin: null, rentCarteraMax: null, rentIndiceMedia: null, distanciaInferior: null, distanciaSuperior: null, top3ConRentabilidad: [] });
        continue;
      }

      const rentabilidadesCartera = [];
      const rentabilidadesIndice = [];
      const contadorSeleccion = {};
      let totalSelecciones = 0;

      for (const ventana of ventanas) {
        const fechasV = fechas.slice(ventana.inicio, ventana.fin);
        const datosV = cortarDatos(datos, ventana.inicio, ventana.fin);
        const { historico } = calcularSeleccionCompleta(
          fechasV,
          datosV,
          factor,
          params.n,
          params.max,
          params.frecuencia,
          null,
          "flujo",
          undefined,
          sesionesPromediadas,
          true // invertido: flujo bajo
        );

        const { rentabilidadPct } = calcularRentabilidadTotalCarteraAnterior(historico);
        if (rentabilidadPct !== null && rentabilidadPct !== undefined) rentabilidadesCartera.push(rentabilidadPct);

        if (historico.length > 1) {
          const rentIndice = rentabilidadIndiceEnPeriodo(cierresIndice, historico[0].fecha, historico[historico.length - 1].fecha);
          if (rentIndice !== null) rentabilidadesIndice.push(rentIndice);
        }

        for (const dia of historico) {
          for (const c of dia.cartera) {
            contadorSeleccion[c.ticker] = (contadorSeleccion[c.ticker] || 0) + 1;
            totalSelecciones++;
          }
        }
      }

      const media = (arr) => (arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)) : null);

      const rentCarteraMinVal = rentabilidadesCartera.length > 0 ? Number(Math.min(...rentabilidadesCartera).toFixed(3)) : null;
      const rentCarteraMaxVal = rentabilidadesCartera.length > 0 ? Number(Math.max(...rentabilidadesCartera).toFixed(3)) : null;
      const rentIndiceMediaVal = media(rentabilidadesIndice);

      const distanciaInferior =
        rentCarteraMinVal !== null && rentIndiceMediaVal !== null ? Number((rentIndiceMediaVal - rentCarteraMinVal).toFixed(3)) : null;
      const distanciaSuperior =
        rentCarteraMaxVal !== null && rentIndiceMediaVal !== null ? Number((rentCarteraMaxVal - rentIndiceMediaVal).toFixed(3)) : null;

      const top3 = Object.entries(contadorSeleccion)
        .map(([ticker, veces]) => ({ ticker, veces }))
        .sort((a, b) => b.veces - a.veces || a.ticker.localeCompare(b.ticker))
        .slice(0, 3)
        .map((t) => ({
          ticker: t.ticker,
          nombre: nombresEmpresas[t.ticker],
          veces: t.veces,
          rentabilidadPct: rentabilidadRealTicker(datos, t.ticker, duracion),
        }));

      porCombinacion.push({
        sesionesPromediadas,
        duracion,
        repeticiones: ventanas.length,
        rentCarteraMedia: media(rentabilidadesCartera),
        rentCarteraMin: rentCarteraMinVal,
        rentCarteraMax: rentCarteraMaxVal,
        rentIndiceMedia: rentIndiceMediaVal,
        distanciaInferior,
        distanciaSuperior,
        top3ConRentabilidad: top3,
      });
    }
  }

  return porCombinacion;
}

async function procesarIndice(indice, factores, params) {
  const diasTotal = calcularDiasTotalReducido();
  const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasTotal, indice.tickers);
  const { cierres: cierresIndice } = await obtenerIncrementosIndice(yahooFinance, fechas, indice.simboloIndice);

  return factores.map((factor) => ({
    factor,
    porCombinacion: procesarIndicePorFactor(fechas, datos, cierresIndice, indice.nombresEmpresas, factor, params),
  }));
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const idsParam = req.query.indices;
    if (!idsParam) {
      throw new Error("Hay que marcar al menos un índice.");
    }
    const idsElegidos = idsParam.split(",").filter(Boolean);
    const indicesElegidos = idsElegidos
      .map((id) => INDICES_DISPONIBLES.find((i) => i.id === id))
      .filter(Boolean);
    if (indicesElegidos.length === 0) {
      throw new Error("Hay que marcar al menos un índice válido.");
    }

    const factoresParam = req.query.factores;
    if (!factoresParam) {
      throw new Error("Hay que marcar al menos un factor de penalización.");
    }
    // Sin duplicados (p.ej. si "2" y "óptimo" coinciden en el mismo
    // valor, no tiene sentido calcularlo dos veces) y ordenados, para
    // que la tabla salga siempre en el mismo orden.
    const factores = [...new Set(factoresParam.split(",").map(Number).filter((f) => !Number.isNaN(f)))].sort((a, b) => a - b);
    if (factores.length === 0) {
      throw new Error("Hay que marcar al menos un factor de penalización válido.");
    }

    const n = req.query.n !== undefined ? Number(req.query.n) : N_COMPONENTES;
    const max = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;
    const frecuenciaParam = req.query.frecuencia;
    const frecuencia =
      frecuenciaParam === undefined || frecuenciaParam === "diario" ? FRECUENCIA_REBALANCEO_DEFECTO : Number(frecuenciaParam);
    const params = { n, max, frecuencia };

    const resultados = [];
    for (const indice of indicesElegidos) {
      try {
        const porFactor = await procesarIndice(indice, factores, params);
        resultados.push({ indice: indice.id, nombreIndice: indice.nombre.es, porFactor });
      } catch (errorIndice) {
        resultados.push({ indice: indice.id, nombreIndice: indice.nombre.es, error: mensajeErrorAmigable(errorIndice) });
      }
    }

    res.status(200).json({
      parametrosComunes: { n, max, frecuencia },
      factoresProbados: factores,
      sesionesPromediadas: SESIONES_PROMEDIADAS,
      duraciones: DURACIONES_REDUCIDAS,
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
