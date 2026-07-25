// pages/api/holdingsETF.js
//
// Herramienta de comprobación (grupo "Comprobaciones"): consulta en
// Yahoo Finance el top 10 de holdings del ETF que replica el índice
// elegido (por ejemplo DIA para el Dow Jones, o LYXIB.MC para el
// IBEX 35) y lo compara con la lista de componentes que tenemos en
// lib/indices.js — para poder detectar a simple vista si algún peso
// pesado se nos ha quedado desactualizado.
//
// OJO: Yahoo Finance solo expone el top 10 de holdings de un ETF a
// través de este módulo, nunca la lista completa. Esto sirve como
// comprobación parcial (los valores con más peso), no como sustituto
// de revisar la composición oficial completa del índice.
//
// Parámetros de la query:
//   indice - id del índice a comprobar (dowjones, ibex35, ...).

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    const resultado = await yahooFinance.quoteSummary(indice.etfReferencia, { modules: ["topHoldings"] });
    const holdingsBrutos = (resultado.topHoldings && resultado.topHoldings.holdings) || [];

    const holdings = holdingsBrutos.map((h) => ({
      ticker: h.symbol,
      nombre: h.holdingName,
      porcentaje: Number((h.holdingPercent * 100).toFixed(2)),
      enNuestraLista: indice.tickers.includes(h.symbol),
    }));

    res.status(200).json({
      indice: indice.id,
      etfReferencia: indice.etfReferencia,
      holdings,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
