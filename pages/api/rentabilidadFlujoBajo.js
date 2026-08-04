// pages/api/rentabilidadFlujoBajo.js
//
// Cuarta herramienta de "Anomalías en el flujo de dinero bajo":
// "Rentabilidad de la selección por flujo de dinero bajo". Directa a
// la variable que de verdad importa (rentabilidad), en vez de seguir
// mirando variables intermedias (precio, volumen) que ya empezaban a
// diluirse al suavizar la señal (ver la conversación que dio origen a
// esta herramienta: el efecto de volumen crecía en sentido contrario
// a donde está la anomalía real, así que seguir por ahí no iba a
// confirmarla — la misma lógica que una media móvil: cuanto más larga
// la ventana, más se aplana cualquier señal corta).
//
// Recorre, para cada índice marcado, todas las combinaciones de
// sesiones promediadas (2, 3, 4 — deliberadamente reducido, sin el
// 1, ya cubierto por trabajo anterior) y duración de backtest (20,
// 50, 120 — reducido de las 5 duraciones habituales, para mantener el
// coste manejable con varios índices a la vez), siempre con el
// método "flujo bajo". Para cada combinación, la rentabilidad media y
// el rango (mínimo/máximo) de la cartera en las 6 repeticiones, y la
// rentabilidad media del propio índice en esos mismos periodos.
//
// El usuario elige qué índices incluir (checkboxes, igual que
// "Correlación de los índices con las recomendaciones de los
// analistas") — descargar y procesar 8 índices a la vez sería la
// comprobación más pesada de toda esta sección, con riesgo real de
// agotar el tiempo de espera del servidor; dejar elegir el alcance
// evita ese riesgo. Solo se ofrecen los índices SIN ADR (los que no
// tienen ETF de referencia real ya tienen su propio hueco en la app,
// y no venían al caso de la observación original, hecha sobre los
// índices tradicionales).

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados, obtenerIncrementosIndice, calcularSeleccionCompleta, calcularRentabilidadTotalCarteraAnterior, FACTOR_PENALIZACION_DEFECTO, N_COMPONENTES, PESO_MAXIMO, FRECUENCIA_REBALANCEO_DEFECTO } from "../../lib/motor";
import { INDICES } from "../../lib/indices";
import { cortarDatos, calcularVentanas, MAX_REPETICIONES } from "../../lib/ventanasBacktestComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

export const SESIONES_PROMEDIADAS = [2, 3, 4];
export const DURACIONES_REDUCIDAS = [20, 50, 120];

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

async function procesarIndice(indice, params) {
  const diasTotal = calcularDiasTotalReducido();
  const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasTotal, indice.tickers);
  const { cierres: cierresIndice } = await obtenerIncrementosIndice(yahooFinance, fechas, indice.simboloIndice);

  const porCombinacion = [];
  for (const sesionesPromediadas of SESIONES_PROMEDIADAS) {
    for (const duracion of DURACIONES_REDUCIDAS) {
      const ventanas = calcularVentanas(fechas.length, duracion, sesionesPromediadas);
      if (ventanas.length === 0) {
        porCombinacion.push({ sesionesPromediadas, duracion, repeticiones: 0, rentCarteraMedia: null, rentCarteraMin: null, rentCarteraMax: null, rentIndiceMedia: null });
        continue;
      }

      const rentabilidadesCartera = [];
      const rentabilidadesIndice = [];
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
      }

      const media = (arr) => (arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3)) : null);

      porCombinacion.push({
        sesionesPromediadas,
        duracion,
        repeticiones: ventanas.length,
        rentCarteraMedia: media(rentabilidadesCartera),
        rentCarteraMin: rentabilidadesCartera.length > 0 ? Number(Math.min(...rentabilidadesCartera).toFixed(3)) : null,
        rentCarteraMax: rentabilidadesCartera.length > 0 ? Number(Math.max(...rentabilidadesCartera).toFixed(3)) : null,
        rentIndiceMedia: media(rentabilidadesIndice),
      });
    }
  }

  return porCombinacion;
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

    const factor = req.query.factor !== undefined ? Number(req.query.factor) : FACTOR_PENALIZACION_DEFECTO;
    const n = req.query.n !== undefined ? Number(req.query.n) : N_COMPONENTES;
    const max = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;
    const frecuenciaParam = req.query.frecuencia;
    const frecuencia =
      frecuenciaParam === undefined || frecuenciaParam === "diario" ? FRECUENCIA_REBALANCEO_DEFECTO : Number(frecuenciaParam);
    const params = { factor, n, max, frecuencia };

    const resultados = [];
    for (const indice of indicesElegidos) {
      try {
        const porCombinacion = await procesarIndice(indice, params);
        resultados.push({ indice: indice.id, nombreIndice: indice.nombre.es, porCombinacion });
      } catch (errorIndice) {
        resultados.push({ indice: indice.id, nombreIndice: indice.nombre.es, error: mensajeErrorAmigable(errorIndice) });
      }
    }

    res.status(200).json({ sesionesPromediadas: SESIONES_PROMEDIADAS, duraciones: DURACIONES_REDUCIDAS, resultados });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
