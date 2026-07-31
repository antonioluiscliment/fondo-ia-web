// pages/api/correlacionAnalistas.js
//
// Grupo "Análisis" > "Correlación de un índice con recomendaciones de
// los analistas": para el índice elegido, comprueba si el consenso de
// analistas de HOY guarda relación con la rentabilidad que ha tenido
// después cada valor, en 1, 2, 3 y 6 meses.
//
// La lógica de cálculo (consulta del consenso, cálculo de la
// puntuación invertida 5 − recommendationMean, incrementos de precio
// por plazo y correlación de Pearson) vive en
// lib/correlacionAnalistasComun.js, compartida con
// correlacionAnalistasIndices.js (la versión que recorre varios
// índices a la vez) — ver ese fichero para la explicación completa
// del cálculo.
//
// Parámetros de la query:
//   indice - id del índice a analizar.

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { calcularCorrelacionAnalistasParaIndice, generarConclusionAnalistas } from "../../lib/correlacionAnalistasComun";

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
    const { filas, correlaciones, excluidos } = await calcularCorrelacionAnalistasParaIndice(yahooFinance, indice);
    const conclusion = generarConclusionAnalistas(correlaciones);

    res.status(200).json({ indice: indice.id, filas, correlaciones, excluidos, conclusion });
  } catch (error) {
    if (error.insuficiente) {
      res.status(200).json({ insuficiente: true, mensaje: error.message });
      return;
    }
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
