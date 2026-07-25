// pages/api/variacionIndices.js
//
// Herramienta de comprobación (grupo "Comprobaciones"): descarga el
// histórico de cierres de TODOS los índices del catálogo (lib/indices.js,
// no solo el elegido en "Características generales") y devuelve, para
// cada fecha común a todos ellos, el valor de cierre y el incremento
// porcentual diario de cada uno — para poder comprobar a mano que los
// datos y los cálculos son correctos.
//
// Al añadir un índice nuevo al catálogo, esta tabla lo incluye
// automáticamente como una columna más; no hace falta tocar este
// fichero.
//
// Parámetros de la query:
//   dias - nº de sesiones a mostrar (por defecto 20, igual que el
//          resto de la aplicación).

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerCierresConActual, DIAS } from "../../lib/motor";
import { INDICES } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const diasVentana = req.query.dias ? Number(req.query.dias) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    // Con más mercados (EE. UU., España, Francia, Portugal, ...) hay
    // más festivos distintos que se cruzan entre calendarios, así que
    // se descarga con algo más de margen que con solo dos índices para
    // no quedarse corto de fechas comunes a todos.
    const cierresPorIndice = {};
    await Promise.all(
      INDICES.map(async (indice) => {
        cierresPorIndice[indice.id] = await obtenerCierresConActual(yahooFinance, indice.simboloIndice, diasVentana + 10);
      })
    );

    let fechasComunes = null;
    for (const indice of INDICES) {
      const fechas = new Set(cierresPorIndice[indice.id].map((c) => c.fecha));
      fechasComunes = fechasComunes ? new Set([...fechasComunes].filter((f) => fechas.has(f))) : fechas;
    }
    const fechasOrdenadas = [...fechasComunes].sort().slice(-diasVentana);

    const mapaPorIndice = {};
    for (const indice of INDICES) {
      mapaPorIndice[indice.id] = Object.fromEntries(cierresPorIndice[indice.id].map((c) => [c.fecha, c.cierre]));
    }

    const filas = fechasOrdenadas.map((fecha, i) => {
      const fechaAnterior = i > 0 ? fechasOrdenadas[i - 1] : null;
      const valores = {};
      for (const indice of INDICES) {
        const hoy = mapaPorIndice[indice.id][fecha];
        const ayer = fechaAnterior ? mapaPorIndice[indice.id][fechaAnterior] : null;
        valores[indice.id] = {
          cierre: Number(hoy.toFixed(2)),
          incremento: ayer ? Number(((hoy / ayer - 1) * 100).toFixed(3)) : null,
        };
      }
      return { fecha, valores };
    });

    res.status(200).json({
      indices: INDICES.map((i) => ({ id: i.id, abreviatura: i.abreviatura })),
      filas,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
