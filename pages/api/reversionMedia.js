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
    const { indice: indiceId, ventanaFormacion, ventanaTest, solapado, nPeores, nExclusion, profundidad, modo, criterio } = req.query;

    const indice = obtenerIndice(indiceId);
    if (!indice) {
      return res.status(400).json({ error: "Índice no reconocido." });
    }

    const yahooFinance = getYahooFinanceInstance();

    const profundidadPedida = Number(profundidad) || REVERSION_PROFUNDIDAD_DEFECTO;
    const profundidadFinal = Math.min(Math.max(profundidadPedida, 1), REVERSION_PROFUNDIDAD_DEFECTO);

    const { fechas, datos, excluidos } = await obtenerDatosAlineados(
      yahooFinance,
      profundidadFinal,
      indice.tickers
    );

    const criterioFinal = ["precio", "volumen", "flujo"].includes(criterio) ? criterio : "precio";

    // Para volumen y flujo, el "índice" de referencia se reconstruye
    // agregando los propios componentes (ver construirSerieIndiceAgregada
    // en motor.js) — no hace falta pedir nada externo a Yahoo. Solo el
    // criterio de precio necesita el índice de referencia real.
    let cierresIndiceAlineados = null;
    if (criterioFinal === "precio") {
      const { cierres } = await obtenerIncrementosIndice(yahooFinance, fechas, indice.simboloIndice);
      cierresIndiceAlineados = alinearCierresIndice(fechas, cierres);
    }

    const resultado = calcularReversionMedia(fechas, datos, cierresIndiceAlineados, {
      ventanaFormacion: Number(ventanaFormacion),
      ventanaTest: ventanaTest ? Number(ventanaTest) : Number(ventanaFormacion),
      solapado: solapado === "true",
      nPeores: Number(nPeores) || 3,
      nExclusion: Number(nExclusion) || 0,
      modo: modo === "mejores" ? "mejores" : "peores",
      criterio: criterioFinal,
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
