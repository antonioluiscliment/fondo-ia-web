// pages/api/correlacionAnalistasIndices.js
//
// Grupo "Análisis" > "Correlación de los índices con las
// recomendaciones de los analistas": lo mismo que
// correlacionAnalistas.js, pero para varios índices a la vez —
// una fila resumen por índice (las mismas 4 correlaciones de Pearson
// que la tabla "Correlación de Pearson por plazo" de la herramienta
// de un solo índice), para poder comparar el efecto entre índices.
//
// La lógica de cálculo por índice vive en
// lib/correlacionAnalistasComun.js — ver ese fichero para la
// explicación completa (puntuación invertida, plazos, correlación de
// Pearson).
//
// OJO con el tiempo de ejecución: el consenso de analistas solo se
// puede consultar valor por valor. Sumando los componentes de varios
// índices a la vez, esto puede tardar bastante — por eso el frontend
// deja elegir qué índices incluir (por defecto, todos menos el que
// tenga más componentes) en vez de forzar siempre los 8 a la vez. Los
// índices se procesan uno detrás de otro (no en paralelo), y si uno
// falla no tira abajo los demás: sale con su propio mensaje de error.
//
// Parámetros de la query:
//   indices - lista de ids de índice separados por comas (p.ej.
//             "dowjones,ibex35,cac40"). Si no se indica, se usan
//             todos los del catálogo.

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";
import { INDICES } from "../../lib/indices";
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

    const idsParam = req.query.indices;
    const idsElegidos = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : null;
    const indicesAProcesar = idsElegidos ? INDICES.filter((i) => idsElegidos.includes(i.id)) : INDICES;

    if (indicesAProcesar.length === 0) {
      throw new Error("No se ha elegido ningún índice válido.");
    }

    const resultados = [];
    for (const indice of indicesAProcesar) {
      try {
        const { correlaciones, excluidos } = await calcularCorrelacionAnalistasParaIndice(yahooFinance, indice);
        resultados.push({
          indice: indice.id,
          nombreIndice: indice.nombre.es,
          correlaciones,
          nExcluidos: excluidos.length,
          conclusion: generarConclusionAnalistas(correlaciones),
        });
      } catch (errorIndice) {
        resultados.push({
          indice: indice.id,
          nombreIndice: indice.nombre.es,
          error: mensajeErrorAmigable(errorIndice),
        });
      }
    }

    res.status(200).json({ resultados });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
