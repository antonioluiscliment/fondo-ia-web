// pages/api/clasificacionIndice.js
//
// "Clasificación de valores de un índice" (menú "Comparación con red
// neuronal"): una red neuronal clasifica cada valor en dos grupos —
// por encima o por debajo de la mediana del índice en las próximas
// sesiones. Ver lib/clasificacionIndiceComun.js para el detalle
// completo del método (por qué la mediana y no el índice, cómo se
// evalúa en datos nunca vistos, y por qué hace falta un hueco entre
// el tramo de entrenamiento y el de prueba).

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { ejecutarClasificacion } from "../../lib/clasificacionIndiceComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

export const PERIODOS_PERMITIDOS = [120, 180, 250];
export const PERIODO_DEFECTO = 180;
// Por encima de este nº de componentes, el nº de ejemplos de
// entrenamiento (sesiones × valores) crece hasta hacer el
// entrenamiento demasiado lento para una sola petición.
export const MAX_TICKERS = 60;

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    if (indice.tickers.length > MAX_TICKERS) {
      throw new Error(
        `${indice.nombre.es} tiene ${indice.tickers.length} valores — por encima del límite de ${MAX_TICKERS} de esta herramienta: con tantos componentes, el entrenamiento tardaría demasiado. Elige un índice más pequeño.`
      );
    }

    const periodo = req.query.periodo !== undefined ? Number(req.query.periodo) : PERIODO_DEFECTO;
    if (!PERIODOS_PERMITIDOS.includes(periodo)) {
      throw new Error(`El parámetro 'periodo' debe ser uno de: ${PERIODOS_PERMITIDOS.join(", ")}.`);
    }

    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, periodo, indice.tickers);

    const tickersValidos = indice.tickers.filter(
      (tk) => datos[tk] && datos[tk].some((d) => d.cierre !== null && d.cierre !== undefined)
    );
    if (tickersValidos.length < 8) {
      throw new Error(`Solo ${tickersValidos.length} valores de ${indice.nombre.es} tienen datos suficientes (mínimo 8).`);
    }

    const resultado = ejecutarClasificacion(tickersValidos, datos, fechas.length);

    res.status(200).json({
      indice: indice.id,
      nombreIndice: indice.nombre.es,
      periodoSesiones: fechas.length,
      candidatosValidos: tickersValidos.length,
      ...resultado,
      clasificacionHoy: resultado.clasificacionHoy.map((c) => ({ ...c, nombre: indice.nombresEmpresas[c.ticker] })),
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
