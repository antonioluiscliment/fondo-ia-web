// pages/api/rentabilidadEtfsTodos.js
//
// Grupo "Análisis" > "Rentabilidad de todos los ETFs": lo mismo que
// "Rentabilidad de los ETFs" (pages/api/rentabilidadETFs.js), pero
// recorriendo TODOS los índices que tienen al menos un ETF de
// referencia, uno tras otro — para poder comparar de un vistazo entre
// índices, o descargar/compartir un único PDF con todo junto.
//
// Solo se recorren los índices con etfsRentabilidad no vacío: el PSI
// 20 (sin ningún ETF activo) y toda la serie de índices ADR (sin
// ningún ETF de referencia, por diseño — ver el aviso de cada uno)
// se excluyen desde el principio, no tendría sentido descargar nada
// para ellos.
//
// Los índices se procesan uno detrás de otro (no en paralelo, para no
// saturar a Yahoo Finance de golpe — cada índice ya descarga varias
// series de 800 sesiones cada una). Si uno falla, no tira abajo los
// demás: sale marcado con su propio error, y el resto se calcula
// igualmente.

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";
import { INDICES } from "../../lib/indices";
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

    const { anio: anioVolumen, esYTD } = calcularAnioVolumen();
    const indicesConEtf = INDICES.filter((i) => i.etfsRentabilidad.length > 0);

    const resultados = [];
    for (const indice of indicesConEtf) {
      try {
        const filas = await calcularRentabilidadEtfsParaIndice(yahooFinance, indice, anioVolumen);
        resultados.push({ indice: indice.id, nombreIndice: indice.nombre.es, filas });
      } catch (errorIndice) {
        resultados.push({ indice: indice.id, nombreIndice: indice.nombre.es, error: mensajeErrorAmigable(errorIndice) });
      }
    }

    res.status(200).json({ anioVolumen, esYTD, resultados });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
