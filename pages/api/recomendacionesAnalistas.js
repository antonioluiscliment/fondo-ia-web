// pages/api/recomendacionesAnalistas.js
//
// Herramienta de comprobación (grupo "Comprobaciones"): consulta el
// consenso de analistas (recommendationMean, recommendationKey,
// numberOfAnalystOpinions) de TODOS los componentes del índice
// elegido, para poder auditar a mano la clasificación que usa
// "Selección de los analistas" — cumple la misma función que "Datos
// fundamentales" cumple para "Mejor fundamental".
//
// Igual que en "Selección de los analistas": este dato solo está
// disponible valor por valor (módulo "financialData" de Yahoo, sin
// versión ligera por lotes), así que se consulta en tandas pequeñas
// en paralelo, no todo el índice de golpe. En índices grandes (Nasdaq
// 100, 101 valores) tarda notablemente más.
//
// A diferencia de "Selección de los analistas" (que descarta los
// valores sin consenso fiable), aquí se listan TODOS los componentes,
// incluidos los que no tengan datos válidos — para eso es una
// comprobación, no una selección: se marcan como "N/D" en vez de
// desaparecer de la tabla.
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

const TAMANO_TANDA = 8; // consultas simultáneas por tanda, no todo el índice de golpe

function numeroValido(valor) {
  return typeof valor === "number" && !Number.isNaN(valor);
}

async function consultarTanda(tickers) {
  return Promise.all(
    tickers.map(async (ticker) => {
      try {
        const data = await yahooFinance.quoteSummary(ticker, { modules: ["financialData"] });
        return { ticker, financialData: data.financialData || null };
      } catch {
        return { ticker, financialData: null };
      }
    })
  );
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);

    const filas = [];
    for (let i = 0; i < indice.tickers.length; i += TAMANO_TANDA) {
      const tanda = indice.tickers.slice(i, i + TAMANO_TANDA);
      const resultados = await consultarTanda(tanda);
      for (const { ticker, financialData } of resultados) {
        const mean = financialData ? financialData.recommendationMean : undefined;
        const numOpiniones = financialData ? financialData.numberOfAnalystOpinions : undefined;
        filas.push({
          ticker,
          nombre: indice.nombresEmpresas[ticker],
          recommendationMean: numeroValido(mean) ? Number(mean.toFixed(2)) : null,
          recommendationKey: (financialData && financialData.recommendationKey) || null,
          numeroAnalistas: numeroValido(numOpiniones) ? numOpiniones : null,
        });
      }
    }

    // Menor recommendationMean = consenso más favorable; los que no
    // tienen dato válido van al final. A igualdad, más analistas
    // primero.
    filas.sort((a, b) => {
      if (a.recommendationMean === null && b.recommendationMean === null) return 0;
      if (a.recommendationMean === null) return 1;
      if (b.recommendationMean === null) return -1;
      return a.recommendationMean - b.recommendationMean || (b.numeroAnalistas || 0) - (a.numeroAnalistas || 0);
    });

    res.status(200).json({ indice: indice.id, filas });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
