// pages/api/caidasPrevias.js
//
// Segunda herramienta de "Anomalías en el flujo de dinero bajo":
// "Medición de caídas previas". Para cada valor seleccionado por
// "flujo bajo" (y por "flujo" normal, como referencia), ¿venía de una
// caída de precio reciente? Ver lib/caidasPreviasComun.js para la
// explicación completa de qué se mide y por qué.
//
// Misma batería de ventanas que "Análisis de correlación" y
// "Concentración de la selección" (lib/ventanasBacktestComun.js), y
// mismos parámetros de query.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados, FACTOR_PENALIZACION_DEFECTO, N_COMPONENTES, PESO_MAXIMO, FRECUENCIA_REBALANCEO_DEFECTO, SESIONES_PUNTUACION_DEFECTO } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { DURACIONES, calcularVentanas, calcularDiasTotal, recorrerSelecciones } from "../../lib/ventanasBacktestComun";
import { medirCaidaPrevia, agregarCaidasPrevias } from "../../lib/caidasPreviasComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const METODOS = ["flujoBajo", "flujo"];

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const factor = req.query.factor !== undefined ? Number(req.query.factor) : FACTOR_PENALIZACION_DEFECTO;
    const n = req.query.n !== undefined ? Number(req.query.n) : N_COMPONENTES;
    const max = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;
    const frecuenciaParam = req.query.frecuencia;
    const frecuencia =
      frecuenciaParam === undefined || frecuenciaParam === "diario" ? FRECUENCIA_REBALANCEO_DEFECTO : Number(frecuenciaParam);

    const sesionesParam = req.query.sesiones;
    const sesionesPuntuacion = sesionesParam !== undefined ? Number(sesionesParam) : SESIONES_PUNTUACION_DEFECTO;
    if (![3, 5, 8, 13].includes(sesionesPuntuacion)) {
      throw new Error("El parámetro 'sesiones' debe ser 3, 5, 8 o 13.");
    }
    const params = { factor, n, max, frecuencia, sesionesPuntuacion };

    const indice = obtenerIndice(req.query.indice);

    const diasTotal = calcularDiasTotal(sesionesPuntuacion);
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasTotal, indice.tickers);

    const resultados = {};
    for (const metodo of METODOS) {
      const individuales = [];
      recorrerSelecciones(fechas, datos, DURACIONES.flatMap((d) => calcularVentanas(fechas.length, d, sesionesPuntuacion)), metodo, params, ({ serieCompleta, tGlobal }) => {
        individuales.push(medirCaidaPrevia(serieCompleta, tGlobal));
      });
      resultados[metodo] = agregarCaidasPrevias(individuales);
    }

    res.status(200).json({
      indice: indice.id,
      nombreIndice: indice.nombre.es,
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
