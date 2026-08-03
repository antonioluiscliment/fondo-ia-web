// pages/api/perfilVolumenPrevio.js
//
// Tercera herramienta de "Anomalías en el flujo de dinero bajo":
// "Perfil de volumen previo", el complemento de "Medición de caídas
// previas" — la comprobación que de verdad separa las dos hipótesis
// que quedaban en pie. Ver lib/perfilVolumenComun.js para la
// explicación completa.
//
// Misma batería de ventanas que el resto de herramientas de esta
// sección, y mismos parámetros de query.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados, FACTOR_PENALIZACION_DEFECTO, N_COMPONENTES, PESO_MAXIMO, FRECUENCIA_REBALANCEO_DEFECTO, SESIONES_PUNTUACION_DEFECTO } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { DURACIONES, calcularVentanas, calcularDiasTotal, recorrerSelecciones } from "../../lib/ventanasBacktestComun";
import { medirPerfilVolumen, agregarPerfilVolumen } from "../../lib/perfilVolumenComun";

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
        individuales.push(medirPerfilVolumen(serieCompleta, tGlobal));
      });
      resultados[metodo] = agregarPerfilVolumen(individuales);
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
