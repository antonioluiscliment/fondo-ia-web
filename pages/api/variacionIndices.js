// pages/api/variacionIndices.js
//
// Herramienta de comprobación (grupo "Comprobaciones"): descarga el
// histórico de cierres de los índices Dow Jones e IBEX 35 (no de sus
// componentes, del propio índice) y devuelve, para cada fecha común a
// ambos, su valor de cierre y su incremento porcentual diario, para
// poder comprobar a mano que los datos y los cálculos son correctos.
//
// Parámetros de la query:
//   dias - nº de sesiones a mostrar (por defecto 20, igual que el
//          resto de la aplicación).

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerCierresConActual, DIAS } from "../../lib/motor";
import { DOW_JONES, IBEX35 } from "../../lib/indices";

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

    const [cierresDowJones, cierresIbex35] = await Promise.all([
      obtenerCierresConActual(yahooFinance, DOW_JONES.simboloIndice, diasVentana + 5),
      obtenerCierresConActual(yahooFinance, IBEX35.simboloIndice, diasVentana + 5),
    ]);

    const fechasDowJones = new Set(cierresDowJones.map((c) => c.fecha));
    const fechasIbex35 = new Set(cierresIbex35.map((c) => c.fecha));
    const fechasComunes = [...fechasDowJones]
      .filter((f) => fechasIbex35.has(f))
      .sort()
      .slice(-diasVentana);

    const mapaDowJones = Object.fromEntries(cierresDowJones.map((c) => [c.fecha, c.cierre]));
    const mapaIbex35 = Object.fromEntries(cierresIbex35.map((c) => [c.fecha, c.cierre]));

    const filas = fechasComunes.map((fecha, i) => {
      const fechaAnterior = i > 0 ? fechasComunes[i - 1] : null;
      const dowJonesHoy = mapaDowJones[fecha];
      const dowJonesAyer = fechaAnterior ? mapaDowJones[fechaAnterior] : null;
      const ibex35Hoy = mapaIbex35[fecha];
      const ibex35Ayer = fechaAnterior ? mapaIbex35[fechaAnterior] : null;
      return {
        fecha,
        dowJones: Number(dowJonesHoy.toFixed(2)),
        incrementoDowJones: dowJonesAyer ? Number(((dowJonesHoy / dowJonesAyer - 1) * 100).toFixed(3)) : null,
        ibex35: Number(ibex35Hoy.toFixed(2)),
        incrementoIbex35: ibex35Ayer ? Number(((ibex35Hoy / ibex35Ayer - 1) * 100).toFixed(3)) : null,
      };
    });

    res.status(200).json({ filas });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
