// pages/api/rentabilidadETFs.js
//
// Grupo "Análisis" > "Rentabilidad de los ETFs": compara la
// rentabilidad del propio índice con la de sus ETFs UCITS de
// referencia, en 60 y 120 sesiones y en 1, 2 y 3 años.
//
// El cálculo en sí (por qué distinguir ETFs comparables de opuestos,
// cómo se calculan las rentabilidades y el volumen) vive en
// lib/rentabilidadEtfsComun.js, compartido con
// pages/api/rentabilidadEtfsTodos.js ("Rentabilidad de todos los
// ETFs" — la misma tabla, pero recorriendo todos los índices con ETF
// a la vez).
//
// Parámetros de la query:
//   indice - id del índice a comprobar (dowjones, ibex35, ...).

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { calcularRentabilidadEtfsParaIndice, calcularAnioVolumen } from "../../lib/rentabilidadEtfsComun";

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
    const { anio: anioVolumen, esYTD } = calcularAnioVolumen();

    const filas = await calcularRentabilidadEtfsParaIndice(yahooFinance, indice, anioVolumen);

    res.status(200).json({ indice: indice.id, anioVolumen, esYTD, filas });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
