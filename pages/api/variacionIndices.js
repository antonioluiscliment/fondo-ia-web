// pages/api/variacionIndices.js
//
// Herramienta de comprobación (grupo "Comprobaciones"): descarga el
// histórico de cierres de TODOS los índices del catálogo (lib/indices.js,
// no solo el elegido en el marco exterior) y devuelve, para cada uno,
// sus propias últimas sesiones con su valor de cierre y su incremento
// porcentual diario — para poder comprobar a mano que los datos y los
// cálculos son correctos.
//
// Cada índice muestra SUS PROPIAS fechas, no una fecha común a todos:
// con 18 índices repartidos por mercados de todo el mundo (América,
// Europa, Asia, Latinoamérica, Oceanía...), exigir que coincida
// exactamente el mismo día de cierre en los 18 a la vez es
// demasiado frágil — basta con que uno solo tenga un festivo propio,
// un desfase horario de publicación distinto, o un hueco puntual de
// datos, para que la intersección se quede corta o incluso vacía (fue
// justo lo que pasó al llegar a 18 índices). Mostrando cada índice de
// forma independiente, ese problema desaparece por diseño: siempre se
// ven las últimas sesiones de cada uno, aunque no coincidan entre sí.
//
// Al añadir un índice nuevo al catálogo, esta tabla lo incluye
// automáticamente como una columna más; no hace falta tocar este
// fichero. Si un índice concreto falla al descargar (símbolo puntual
// caído, etc.), no tira abajo los demás: esa columna sale marcada con
// su propio error.
//
// Parámetros de la query:
//   dias - nº de sesiones a mostrar por índice (por defecto 20, igual
//          que el resto de la aplicación).

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

    const porIndice = {};
    await Promise.all(
      INDICES.map(async (indice) => {
        try {
          const cierres = await obtenerCierresConActual(yahooFinance, indice.simboloIndice, diasVentana);
          const ultimos = cierres.slice(-diasVentana);
          const filas = ultimos.map((c, i) => {
            const anterior = i > 0 ? ultimos[i - 1] : null;
            return {
              fecha: c.fecha,
              cierre: Number(c.cierre.toFixed(2)),
              incremento: anterior ? Number(((c.cierre / anterior.cierre - 1) * 100).toFixed(3)) : null,
            };
          });
          porIndice[indice.id] = { filas };
        } catch (errorIndice) {
          porIndice[indice.id] = { filas: [], error: mensajeErrorAmigable(errorIndice) };
        }
      })
    );

    res.status(200).json({
      indices: INDICES.map((i) => ({ id: i.id, abreviatura: i.abreviatura })),
      porIndice,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
