import {
  getYahooFinanceInstance,
  obtenerDatosAlineados,
  obtenerIncrementosIndice,
  calcularReversionMedia,
  alinearCierresIndice,
  mensajeErrorAmigable,
  REVERSION_PROFUNDIDAD_DEFECTO,
} from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

export default async function handler(req, res) {
  try {
    const { indice: indiceId, ventanaFormacion, ventanaTest, solapado, nPeores, nExclusion } = req.query;

    const indice = obtenerIndice(indiceId);
    if (!indice) {
      return res.status(400).json({ error: "Índice no reconocido." });
    }

    const yahooFinance = getYahooFinanceInstance();
    const { fechas, datos, excluidos } = await obtenerDatosAlineados(
      yahooFinance,
      REVERSION_PROFUNDIDAD_DEFECTO,
      indice.tickers
    );

    // OJO: ajustar "indice.simboloIndice" al nombre real del campo en
    // lib/indices.js si es distinto (p.ej. indiceYahoo, tickerIndice...).
    const { cierres } = await obtenerIncrementosIndice(yahooFinance, fechas, indice.simboloIndice);
    const cierresIndiceAlineados = alinearCierresIndice(fechas, cierres);

    const resultado = calcularReversionMedia(fechas, datos, cierresIndiceAlineados, {
      ventanaFormacion: Number(ventanaFormacion),
      ventanaTest: ventanaTest ? Number(ventanaTest) : Number(ventanaFormacion),
      solapado: solapado === "true",
      nPeores: Number(nPeores) || 3,
      nExclusion: Number(nExclusion) || 0,
    });

    res.status(200).json({
      ...resultado,
      excluidos,
      nSesionesDisponibles: fechas.length,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
