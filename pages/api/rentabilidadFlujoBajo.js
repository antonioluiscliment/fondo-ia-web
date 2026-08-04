// pages/api/rentabilidadFlujoBajo.js
//
// Cuarta herramienta de "Anomalías en el flujo de dinero bajo":
// "Rentabilidad de la selección por flujo de dinero bajo". Directa a
// la variable que de verdad importa (rentabilidad), en vez de seguir
// mirando variables intermedias (precio, volumen) que ya empezaban a
// diluirse al suavizar la señal.
//
// Recorre, para cada índice marcado y cada combinación de factor de
// penalización / nº de componentes / tope de diversificación /
// frecuencia de rebalanceo marcados, todas las combinaciones de
// sesiones promediadas (2, 3) y duración de backtest (30, 40, 50,
// 60), siempre con el método "flujo bajo". Para cada combinación:
// rentabilidad media y rango de la cartera en las 6 repeticiones,
// rentabilidad media del propio índice, la distancia de cada extremo
// del rango a esa rentabilidad del índice, y los 3 valores más
// elegidos con su rentabilidad REAL (cotización de hoy frente a hace
// "duracion" sesiones).
//
// Los 4 parámetros de cartera (factor, nº de componentes, tope,
// frecuencia) son configurables aquí, cada uno con varios valores a
// la vez marcables por el usuario — a diferencia de la mayoría de
// herramientas de la app, que usan un único valor fijo del marco
// exterior. Esto multiplica MUCHO el número de combinaciones (índices
// × factores × n × tope × frecuencia × sesiones × duraciones puede
// llegar a varios miles), así que:
//   - Se calcula y se devuelve el nº total de ejecuciones antes de
//     empezar (el frontend ya lo enseña de antemano, antes incluso de
//     llamar aquí).
//   - Hay un límite duro (MAX_EJECUCIONES): por encima de eso, la
//     petición se rechaza con un mensaje claro en vez de arriesgarse
//     a colgar el servidor.
//   - Los datos de cada índice se descargan UNA sola vez y se
//     reutilizan para todas las combinaciones de parámetros de ese
//     índice — el coste que crece con las combinaciones es solo de
//     cálculo, no de descargas nuevas.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados, obtenerIncrementosIndice, calcularSeleccionCompleta, calcularRentabilidadTotalCarteraAnterior } from "../../lib/motor";
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
export const MAX_EJECUCIONES = 800; // tope duro de combinaciones (índice × factor × n × max × frecuencia × sesiones × duración)

// Solo los índices "tradicionales" (con ETF de referencia real, o el
// PSI 20, que no tiene ETF activo pero tampoco es un índice ADR).
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
// descargado) hasta hace "duracion" sesiones.
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

// Ejecuta UNA combinación completa de parámetros (factor, n, max,
// frecuencia) para todas las sesiones/duraciones, devolviendo una
// fila plana por cada (sesionesPromediadas, duracion) — más sencillo
// de recorrer en el frontend que anidar un nivel por parámetro.
function ejecutarCombinacion(fechas, datos, cierresIndice, nombresEmpresas, parametros) {
  const { factor, n, max, frecuencia } = parametros;
  const filas = [];

  for (const sesionesPromediadas of SESIONES_PROMEDIADAS) {
    for (const duracion of DURACIONES_REDUCIDAS) {
      const ventanas = calcularVentanas(fechas.length, duracion, sesionesPromediadas);
      if (ventanas.length === 0) {
        filas.push({ ...parametros, sesionesPromediadas, duracion, repeticiones: 0, rentCarteraMedia: null, rentCarteraMin: null, rentCarteraMax: null, rentIndiceMedia: null, distanciaInferior: null, distanciaSuperior: null, top3ConRentabilidad: [] });
        continue;
      }

      const rentabilidadesCartera = [];
      const rentabilidadesIndice = [];
      const contadorSeleccion = {};
      let totalSelecciones = 0;
      let ventanasImplausibles = 0;

      for (const ventana of ventanas) {
        const fechasV = fechas.slice(ventana.inicio, ventana.fin);
        const datosV = cortarDatos(datos, ventana.inicio, ventana.fin);
        const { historico } = calcularSeleccionCompleta(
          fechasV,
          datosV,
          factor,
          n,
          max,
          frecuencia,
          null,
          "flujo",
          undefined,
          sesionesPromediadas,
          true // invertido: flujo bajo
        );

        // Ver UMBRAL_RENTABILIDAD_IMPLAUSIBLE en lib/motor.js: una
        // caída así de extrema en tan pocas semanas, con una cartera
        // de varios valores grandes y líquidos, es prácticamente
        // descartable — más probable que sea un fallo interno no
        // resuelto que una pérdida real. Se excluye esa ventana
        // concreta del promedio/rango en vez de dejar que contamine
        // el resultado agregado, y se cuenta para poder avisar.
        const { rentabilidadPct, implausible } = calcularRentabilidadTotalCarteraAnterior(historico);
        if (implausible) {
          ventanasImplausibles++;
        } else if (rentabilidadPct !== null && rentabilidadPct !== undefined) {
          rentabilidadesCartera.push(rentabilidadPct);
        }

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

      // Si TODAS las ventanas de esta combinación resultaron
      // implausibles, no queda ningún dato fiable que agregar — se
      // marca aparte (huboSoloImplausibles) para poder avisar de
      // forma distinta a "no hay suficientes datos" sin más.
      const huboSoloImplausibles = ventanas.length > 0 && rentabilidadesCartera.length === 0 && ventanasImplausibles > 0;

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

      filas.push({
        ...parametros,
        sesionesPromediadas,
        duracion,
        repeticiones: ventanas.length,
        ventanasImplausibles,
        huboSoloImplausibles,
        rentCarteraMedia: huboSoloImplausibles ? null : media(rentabilidadesCartera),
        rentCarteraMin: huboSoloImplausibles ? null : rentCarteraMinVal,
        rentCarteraMax: huboSoloImplausibles ? null : rentCarteraMaxVal,
        rentIndiceMedia: rentIndiceMediaVal,
        distanciaInferior,
        distanciaSuperior,
        top3ConRentabilidad: top3,
      });
    }
  }

  return filas;
}

async function procesarIndice(indice, combinacionesParametros) {
  const diasTotal = calcularDiasTotalReducido();
  const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasTotal, indice.tickers);
  const { cierres: cierresIndice } = await obtenerIncrementosIndice(yahooFinance, fechas, indice.simboloIndice);

  const ejecuciones = combinacionesParametros.flatMap((parametros) =>
    ejecutarCombinacion(fechas, datos, cierresIndice, indice.nombresEmpresas, parametros)
  );
  return ejecuciones;
}

// Parsea una lista separada por comas de números y/o "nunca" (para
// frecuencia de rebalanceo, que admite ese valor especial además de
// enteros).
function parsearListaFrecuencia(param) {
  return [...new Set(param.split(",").map((v) => (v === "nunca" ? "nunca" : Number(v))).filter((v) => v === "nunca" || !Number.isNaN(v)))];
}

function parsearListaNumeros(param) {
  return [...new Set(param.split(",").map(Number).filter((v) => !Number.isNaN(v)))];
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const idsParam = req.query.indices;
    if (!idsParam) throw new Error("Hay que marcar al menos un índice.");
    const idsElegidos = idsParam.split(",").filter(Boolean);
    const indicesElegidos = idsElegidos.map((id) => INDICES_DISPONIBLES.find((i) => i.id === id)).filter(Boolean);
    if (indicesElegidos.length === 0) throw new Error("Hay que marcar al menos un índice válido.");

    const factoresParam = req.query.factores;
    if (!factoresParam) throw new Error("Hay que marcar al menos un factor de penalización.");
    const factores = parsearListaNumeros(factoresParam);
    if (factores.length === 0) throw new Error("Hay que marcar al menos un factor de penalización válido.");

    const nsParam = req.query.ns;
    if (!nsParam) throw new Error("Hay que marcar al menos un nº de componentes.");
    const ns = parsearListaNumeros(nsParam);
    if (ns.length === 0) throw new Error("Hay que marcar al menos un nº de componentes válido.");

    const maxsParam = req.query.maxs;
    if (!maxsParam) throw new Error("Hay que marcar al menos un tope de diversificación.");
    const maxs = parsearListaNumeros(maxsParam);
    if (maxs.length === 0) throw new Error("Hay que marcar al menos un tope de diversificación válido.");

    const frecuenciasParam = req.query.frecuencias;
    if (!frecuenciasParam) throw new Error("Hay que marcar al menos una frecuencia de rebalanceo.");
    const frecuencias = parsearListaFrecuencia(frecuenciasParam);
    if (frecuencias.length === 0) throw new Error("Hay que marcar al menos una frecuencia de rebalanceo válida.");

    const combinacionesParametros = [];
    for (const factor of factores) {
      for (const n of ns) {
        for (const max of maxs) {
          for (const frecuencia of frecuencias) {
            combinacionesParametros.push({ factor, n, max, frecuencia });
          }
        }
      }
    }

    const totalEjecuciones =
      indicesElegidos.length * combinacionesParametros.length * SESIONES_PROMEDIADAS.length * DURACIONES_REDUCIDAS.length;
    if (totalEjecuciones > MAX_EJECUCIONES) {
      throw new Error(
        `Esta selección lanzaría ${totalEjecuciones} ejecuciones (índices × combinaciones de parámetros × sesiones × duraciones) — por encima del límite de ${MAX_EJECUCIONES} para no arriesgar que el servidor se cuelgue. Marca menos índices o menos valores en los desplegables de parámetros.`
      );
    }

    const resultados = [];
    for (const indice of indicesElegidos) {
      try {
        const ejecuciones = await procesarIndice(indice, combinacionesParametros);
        resultados.push({ indice: indice.id, nombreIndice: indice.nombre.es, ejecuciones });
      } catch (errorIndice) {
        resultados.push({ indice: indice.id, nombreIndice: indice.nombre.es, error: mensajeErrorAmigable(errorIndice) });
      }
    }

    res.status(200).json({
      factoresProbados: factores,
      nsProbados: ns,
      maxsProbados: maxs,
      frecuenciasProbadas: frecuencias,
      sesionesPromediadas: SESIONES_PROMEDIADAS,
      duraciones: DURACIONES_REDUCIDAS,
      totalEjecuciones,
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
