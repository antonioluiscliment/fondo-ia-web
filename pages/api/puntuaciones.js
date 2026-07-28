// pages/api/puntuaciones.js
//
// Herramienta de auditoría: dado un número de sesión dentro de la
// ventana descargada, devuelve la tabla de los componentes del índice
// elegido con su puntuación (suma de los incrementos de esa sesión y
// las anteriores, hasta completar "sesiones") en esa fecha exacta,
// para poder comprobar el ranking a mano. No aplica ninguna regla de
// cartera ni rebalanceo — solo puntuaciones.
//
// Se puede auditar por precio (por defecto), por volumen o por flujo
// de dinero (?criterio=precio, volumen o flujo) — el mismo cálculo
// que usa la selección real para esos tres criterios y sus antítesis
// "bajo" (que son las mismas puntuaciones, solo leídas del final de
// la tabla en vez del principio). No aplica a "aleatorio" (no hay
// puntuación real que auditar, es pseudoaleatorio) ni a "Mejor
// fundamental" o "Selección de los analistas" (no tienen ninguna
// puntuación por sesión: son una foto del dato de hoy, sin histórico
// diario disponible por esa vía).
//
// Parámetros de la query:
//   dias     - nº de sesiones de la ventana descargada (por defecto 20)
//   sesion   - número de sesión dentro de esa ventana (1 = la más
//              antigua de las "dias" fechas). Obligatorio.
//   criterio - precio (por defecto), volumen o flujo.

import {
  getYahooFinanceInstance,
  mensajeErrorAmigable,
  obtenerDatosAlineados,
  calcularPuntuacionesSesion,
  SESIONES_PUNTUACION_DEFECTO,
  DIAS,
} from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

export default async function handler(req, res) {
  try {
    const diasVentana = req.query.dias ? Number(req.query.dias) : DIAS;
    const numeroSesion = req.query.sesion !== undefined ? Number(req.query.sesion) : NaN;
    const sesionesPuntuacion = req.query.sesiones !== undefined ? Number(req.query.sesiones) : SESIONES_PUNTUACION_DEFECTO;
    const criterioParam = req.query.criterio;
    const criterioPuntuacion = ["precio", "volumen", "flujo"].includes(criterioParam) ? criterioParam : "precio";

    if (!Number.isInteger(numeroSesion)) {
      res.status(400).json({ error: "Falta el parámetro 'sesion' (número de sesión dentro de la ventana)." });
      return;
    }
    if (![3, 5, 8, 13].includes(sesionesPuntuacion)) {
      res.status(400).json({ error: "El parámetro 'sesiones' debe ser 3, 5, 8 o 13." });
      return;
    }

    const yahooFinance = getYahooFinanceInstance();
    const indice = obtenerIndice(req.query.indice);
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana, indice.tickers);

    const resultado = calcularPuntuacionesSesion(fechas, datos, numeroSesion, sesionesPuntuacion, criterioPuntuacion);
    res.status(200).json(resultado);
  } catch (error) {
    res.status(400).json({ error: mensajeErrorAmigable(error) });
  }
}
