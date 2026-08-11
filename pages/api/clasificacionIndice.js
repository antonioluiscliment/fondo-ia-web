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
// El coste del entrenamiento no depende del nº de valores por sí
// solo, sino de cuántos EJEMPLOS genera la combinación de valores ×
// sesiones — cada sesión aporta un ejemplo por valor. Medido: unos
// 12.000 ejemplos rondan los 8 segundos, y 17.500 se van a 12,
// demasiado para una sola petición. Con este tope, un índice grande
// sigue siendo utilizable eligiendo un periodo más corto, en vez de
// quedar excluido por completo (que es lo que hacía la versión
// anterior de esta comprobación, que miraba solo el nº de valores).
export const MAX_EJEMPLOS_ESTIMADOS = 13000;

// Ejemplos que generará aproximadamente esta combinación: el tramo de
// entrenamiento es alrededor del 70% de las sesiones utilizables.
function estimarEjemplos(numTickers, periodo) {
  const sesionesUtiles = Math.max(0, periodo - 8 - 5);
  return Math.round(sesionesUtiles * 0.7 * numTickers);
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);

    const periodo = req.query.periodo !== undefined ? Number(req.query.periodo) : PERIODO_DEFECTO;
    if (!PERIODOS_PERMITIDOS.includes(periodo)) {
      throw new Error(`El parámetro 'periodo' debe ser uno de: ${PERIODOS_PERMITIDOS.join(", ")}.`);
    }

    const ejemplosEstimados = estimarEjemplos(indice.tickers.length, periodo);
    if (ejemplosEstimados > MAX_EJEMPLOS_ESTIMADOS) {
      // Buscar el periodo más largo que sí cabría, para poder
      // sugerirlo en vez de dejar al usuario sin alternativa.
      const periodoViable = [...PERIODOS_PERMITIDOS]
        .sort((a, b) => b - a)
        .find((p) => estimarEjemplos(indice.tickers.length, p) <= MAX_EJEMPLOS_ESTIMADOS);
      const sugerencia = periodoViable
        ? ` Prueba con un periodo de ${periodoViable} sesiones.`
        : " Este índice tiene demasiados componentes para esta herramienta en cualquier periodo.";
      throw new Error(
        `${indice.nombre.es} con ${periodo} sesiones generaría unos ${ejemplosEstimados} ejemplos de entrenamiento, por encima del límite de ${MAX_EJEMPLOS_ESTIMADOS} — el entrenamiento tardaría demasiado.${sugerencia}`
      );
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
