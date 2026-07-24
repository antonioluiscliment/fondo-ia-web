// pages/api/puntuaciones.js
//
// Herramienta de auditoría: dado un número de sesión dentro de la
// ventana descargada, devuelve la tabla de los 30 componentes con su
// puntuación (suma de los incrementos de esa sesión y las 2
// anteriores) en esa fecha exacta, para poder comprobar el ranking a
// mano. No aplica ninguna regla de cartera ni rebalanceo — solo
// puntuaciones.
//
// Parámetros de la query:
//   dias   - nº de sesiones de la ventana descargada (por defecto 20)
//   sesion - número de sesión dentro de esa ventana (1 = la más
//            antigua de las "dias" fechas). Obligatorio.

import {
  getYahooFinanceInstance,
  mensajeErrorAmigable,
  obtenerDatosAlineados,
  calcularPuntuacionesSesion,
  DIAS,
} from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

export default async function handler(req, res) {
  try {
    const diasVentana = req.query.dias ? Number(req.query.dias) : DIAS;
    const numeroSesion = req.query.sesion !== undefined ? Number(req.query.sesion) : NaN;

    if (!Number.isInteger(numeroSesion)) {
      res.status(400).json({ error: "Falta el parámetro 'sesion' (número de sesión dentro de la ventana)." });
      return;
    }

    const yahooFinance = getYahooFinanceInstance();
    const indice = obtenerIndice(req.query.indice);
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana, indice.tickers);

    const resultado = calcularPuntuacionesSesion(fechas, datos, numeroSesion);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(400).json({ error: mensajeErrorAmigable(error) });
  }
}
