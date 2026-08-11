// pages/api/volatilidadExtremos.js
//
// "Volatilidad de los valores de un índice" (menú Análisis): ordena
// los valores del índice por cuántas veces han estado entre los
// mejores o los peores de su propio índice — una medida práctica de
// volatilidad. Ver lib/volatilidadExtremosComun.js para el detalle
// completo del método y de por qué esto mide volatilidad y no
// calidad.
//
// Parámetros de la query:
//   indice   - id del índice.
//   periodo  - sesiones a explorar (60, 120, 180 o 250).
//   longitud - longitud de cada ventana (5 u 8 sesiones).
//   extremo  - porcentaje de cabeza y de cola (15 o 20).

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { analizarVolatilidad, LONGITUDES_VENTANA, PORCENTAJES_EXTREMO } from "../../lib/volatilidadExtremosComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

export const PERIODOS_PERMITIDOS = [60, 120, 180, 250];
export const PERIODO_DEFECTO = 180;
export const LONGITUD_DEFECTO = 5;
export const EXTREMO_DEFECTO = 15;

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);

    const periodo = req.query.periodo !== undefined ? Number(req.query.periodo) : PERIODO_DEFECTO;
    if (!PERIODOS_PERMITIDOS.includes(periodo)) {
      throw new Error(`El parámetro 'periodo' debe ser uno de: ${PERIODOS_PERMITIDOS.join(", ")}.`);
    }
    const longitud = req.query.longitud !== undefined ? Number(req.query.longitud) : LONGITUD_DEFECTO;
    if (!LONGITUDES_VENTANA.includes(longitud)) {
      throw new Error(`El parámetro 'longitud' debe ser uno de: ${LONGITUDES_VENTANA.join(", ")}.`);
    }
    const extremo = req.query.extremo !== undefined ? Number(req.query.extremo) : EXTREMO_DEFECTO;
    if (!PORCENTAJES_EXTREMO.includes(extremo)) {
      throw new Error(`El parámetro 'extremo' debe ser uno de: ${PORCENTAJES_EXTREMO.join(", ")}.`);
    }

    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, periodo, indice.tickers);

    const precioPorTicker = {};
    const tickersValidos = [];
    for (const ticker of indice.tickers) {
      if (!datos[ticker]) continue;
      const serie = datos[ticker].map((d) => d.cierre);
      if (!serie.some((c) => c !== null && c !== undefined)) continue;
      precioPorTicker[ticker] = serie;
      tickersValidos.push(ticker);
    }

    if (tickersValidos.length < 5) {
      throw new Error(`Solo ${tickersValidos.length} valores de ${indice.nombre.es} tienen datos suficientes (mínimo 5).`);
    }

    const resultado = analizarVolatilidad(tickersValidos, precioPorTicker, fechas.length, longitud, extremo);

    res.status(200).json({
      indice: indice.id,
      nombreIndice: indice.nombre.es,
      periodoSesiones: fechas.length,
      candidatosValidos: tickersValidos.length,
      ...resultado,
      filas: resultado.filas.map((f) => ({ ...f, nombre: indice.nombresEmpresas[f.ticker] })),
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
