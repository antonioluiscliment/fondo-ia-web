// pages/api/fundamentales.js
//
// Herramienta de comprobación (grupo "Comprobaciones"): consulta en
// Yahoo Finance datos fundamentales de TODOS los componentes del
// índice elegido, en una sola llamada por lotes (yahooFinance.quote
// acepta un array de tickers y hace una única petición HTTP), en vez
// de una llamada por cada valor. Por eso los datos que se muestran
// están limitados a los que Yahoo expone en este endpoint "ligero":
// PER, PER a futuro, EPS, EPS estimado, precio/valor contable,
// rentabilidad por dividendo, precio actual, variación del día y
// máximo/mínimo de 52 semanas. Ingresos, ventas y flujo de caja
// operativo NO están aquí (solo en el endpoint "pesado" de Yahoo,
// consultable únicamente valor por valor) y se han descartado a
// propósito para evitar hacer decenas o cientos de peticiones
// seguidas en índices grandes como el Nasdaq 100.
//
// OJO con dividendYield: se asume que este endpoint concreto lo
// devuelve ya en formato porcentaje (p.ej. 2.34 = 2,34%), a
// diferencia de quoteSummary/summaryDetail, donde sí es una fracción
// (0.0234). Conviene comprobarlo con un valor conocido al desplegar;
// si estuviera al revés, basta con quitar el "* 1" de más abajo.
//
// Parámetros de la query:
//   indice - id del índice a consultar (dowjones, ibex35, ...).

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

// Envuelve un valor numérico opcional; si no viene en la respuesta de
// Yahoo (undefined/null), se marca como "N/D" en vez de romper la fila.
function numeroOND(valor) {
  return typeof valor === "number" && !Number.isNaN(valor) ? valor : null;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    const cotizaciones = await yahooFinance.quote(indice.tickers, {
      fields: [
        "symbol",
        "trailingPE",
        "forwardPE",
        "epsTrailingTwelveMonths",
        "epsForward",
        "priceToBook",
        "dividendYield",
        "regularMarketPrice",
        "regularMarketChangePercent",
        "fiftyTwoWeekHigh",
        "fiftyTwoWeekLow",
      ],
    });

    // yahooFinance.quote(array) puede devolver menos resultados que
    // tickers pedidos si alguno no resuelve; se indexa por symbol para
    // no desalinear filas.
    const porTicker = Object.fromEntries(cotizaciones.map((c) => [c.symbol, c]));

    const filas = indice.tickers.map((ticker) => {
      const c = porTicker[ticker];
      return {
        ticker,
        nombre: indice.nombresEmpresas[ticker],
        trailingPE: c ? numeroOND(c.trailingPE) : null,
        forwardPE: c ? numeroOND(c.forwardPE) : null,
        epsTrailingTwelveMonths: c ? numeroOND(c.epsTrailingTwelveMonths) : null,
        epsForward: c ? numeroOND(c.epsForward) : null,
        priceToBook: c ? numeroOND(c.priceToBook) : null,
        dividendYield: c ? numeroOND(c.dividendYield) : null,
        regularMarketPrice: c ? numeroOND(c.regularMarketPrice) : null,
        regularMarketChangePercent: c ? numeroOND(c.regularMarketChangePercent) : null,
        fiftyTwoWeekHigh: c ? numeroOND(c.fiftyTwoWeekHigh) : null,
        fiftyTwoWeekLow: c ? numeroOND(c.fiftyTwoWeekLow) : null,
      };
    });

    res.status(200).json({ indice: indice.id, filas });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
