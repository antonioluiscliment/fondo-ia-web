// pages/api/holdingsETF.js
//
// Herramienta de comprobación (grupo "Comprobaciones"): consulta en
// Yahoo Finance el top 10 de holdings del ETF que replica el índice
// elegido (por ejemplo DIA para el Dow Jones, o LYXIB.MC para el
// IBEX 35) y lo compara con la lista de componentes que tenemos en
// lib/indices.js — para poder detectar a simple vista si algún peso
// pesado se nos ha quedado desactualizado.
//
// La lectura de los holdings (incluido el ajuste de bolsa entre
// mercados) vive en lib/holdingsEtfComun.js, compartida con
// "Correlación de los componentes con el peso en el índice"
// (pages/api/correlacionPesoIndice.js) — ver ese fichero para el
// detalle completo del ajuste de bolsa.
//
// Parámetros de la query:
//   indice - id del índice a comprobar (dowjones, ibex35, ...).

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { obtenerHoldingsEtf } from "../../lib/holdingsEtfComun";

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
    const holdings = await obtenerHoldingsEtf(yahooFinance, indice);

    res.status(200).json({
      indice: indice.id,
      etfReferencia: indice.etfReferencia,
      holdings,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
