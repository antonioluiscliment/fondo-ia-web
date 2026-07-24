// pages/api/ratios.js
//
// Función de servidor (se ejecuta en Vercel, con acceso a internet).
// Obtiene los últimos 20 cierres diarios del ticker solicitado (junto
// con el volumen de negociación de cada sesión, si está disponible) y
// calcula el ratio/incremento entre cada par de cotizaciones
// consecutivas, empezando por el valor 20 (más antiguo de la ventana)
// frente al 19, y así sucesivamente hasta el más reciente.

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const DIAS = 20;

async function obtenerUltimosCierres(ticker, dias) {
  const hoy = new Date();
  const desde = new Date();
  desde.setDate(hoy.getDate() - Math.ceil(dias * 1.6) - 5);

  const resultado = await yahooFinance.chart(ticker, {
    period1: desde,
    period2: hoy,
    interval: "1d",
  });

  const cierres = resultado.quotes
    .filter((q) => q.close !== null && q.close !== undefined)
    .map((q) => ({
      fecha: q.date,
      cierre: q.close,
      // El volumen puede venir null o undefined según el ticker o la
      // sesión (por ejemplo, en un día festivo parcial); se conserva
      // tal cual y es la interfaz la que muestra "-" cuando falta.
      volumen: q.volume !== null && q.volume !== undefined ? q.volume : null,
    }));

  return cierres.slice(-dias);
}

function calcularRatios(cierres) {
  const ratios = [];
  for (let i = 1; i < cierres.length; i++) {
    const anterior = cierres[i - 1].cierre;
    const actual = cierres[i].cierre;
    const incremento = (actual - anterior) / anterior;
    ratios.push({
      desde: cierres[i - 1].fecha,
      hasta: cierres[i].fecha,
      cierreAnterior: anterior,
      cierreActual: actual,
      incremento,
    });
  }
  return ratios;
}

export default async function handler(req, res) {
  const ticker = (req.query.ticker || "MMM").toString().toUpperCase();

  try {
    if (errorInicializacion) throw errorInicializacion;
    const cierres = await obtenerUltimosCierres(ticker, DIAS);
    const ratios = calcularRatios(cierres);
    res.status(200).json({ ticker, cierres, ratios });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
