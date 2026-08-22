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
    const { indice: indiceId, ventanaFormacion, ventanaTest, solapado, nPeores, nExclusion, profundidad } = req.query;

    const indice = obtenerIndice(indiceId);
    if (!indice) {
      return res.status(400).json({ error: "Índice no reconocido." });
    }

    const yahooFinance = getYahooFinanceInstance();

    // Profundidad del backtest: configurable por el usuario, con
    // REVERSION_PROFUNDIDAD_DEFECTO (240) como techo máximo validado.
    const profundidadPedida = Number(profundidad) || REVERSION_PROFUNDIDAD_DEFECTO;
    const profundidadFinal = Math.min(Math.max(profundidadPedida, 1), REVERSION_PROFUNDIDAD_DEFECTO);

    const { fechas, datos, excluidos } = await obtenerDatosAlineados(
      yahooFinance,
      profundidadFinal,
      indice.tickers
    );

    // OJO: ajustar "indice.simboloIndice" si el campo tuviera otro
    // nombre en lib/indices.js (ya confirmado que se llama así).
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
