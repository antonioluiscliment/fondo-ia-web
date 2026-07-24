// pages/api/testOptimizacion.js
//
// Ejecuta las 15 combinaciones de "óptimo de una o varias variables,
// resto por defecto" descritas por el usuario, reutilizando los datos
// descargados una sola vez (para no hacer 15 x varias llamadas a
// Yahoo Finance). Cada combinación se resuelve optimizando las
// variables indicadas EN ORDEN (factor → nº componentes → tope →
// frecuencia de rebalanceo), usando en cada paso el valor ya
// optimizado de los pasos anteriores dentro de esa misma combinación
// y el valor por defecto para las variables no incluidas en ella.

import {
  getYahooFinanceInstance,
  obtenerDatosAlineados,
  buscarMejorFactor,
  buscarMejorN,
  buscarMejorMax,
  buscarMejorFrecuencia,
  calcularBeneficioAcumulado,
  FACTOR_PENALIZACION_DEFECTO,
  N_COMPONENTES,
  PESO_MAXIMO,
  FRECUENCIA_REBALANCEO_DEFECTO,
  DIAS,
} from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const DEF = {
  factor: FACTOR_PENALIZACION_DEFECTO,
  n: N_COMPONENTES,
  max: PESO_MAXIMO,
  frecuencia: FRECUENCIA_REBALANCEO_DEFECTO,
};

// Cada combinación indica qué variables se optimizan, en ese orden.
const COMBINACIONES = [
  { num: 1, variables: ["factor"], descripcion: "Óptimo factor de penalización, resto por defecto" },
  { num: 2, variables: ["n"], descripcion: "Óptimo número de componentes, resto por defecto" },
  { num: 3, variables: ["max"], descripcion: "Óptimo tope de diversificación, resto por defecto" },
  { num: 4, variables: ["frecuencia"], descripcion: "Óptima frecuencia de rebalanceo, resto por defecto" },
  { num: 5, variables: ["factor", "n"], descripcion: "Óptimos factor de penalización y número de componentes, resto por defecto" },
  { num: 6, variables: ["factor", "max"], descripcion: "Óptimos factor de penalización y tope de diversificación, resto por defecto" },
  { num: 7, variables: ["factor", "frecuencia"], descripcion: "Óptimos factor de penalización y frecuencia de rebalanceo, resto por defecto" },
  { num: 8, variables: ["n", "max"], descripcion: "Óptimos número de componentes y tope de diversificación, resto por defecto" },
  { num: 9, variables: ["n", "frecuencia"], descripcion: "Óptimos número de componentes y frecuencia de rebalanceo, resto por defecto" },
  { num: 10, variables: ["max", "frecuencia"], descripcion: "Óptimos tope de diversificación y frecuencia de rebalanceo, resto por defecto" },
  { num: 11, variables: ["factor", "n", "max"], descripcion: "Óptimos factor, número de componentes y tope, frecuencia por defecto" },
  { num: 12, variables: ["factor", "n", "frecuencia"], descripcion: "Óptimos factor, número de componentes y frecuencia, tope por defecto" },
  { num: 13, variables: ["factor", "max", "frecuencia"], descripcion: "Óptimos factor, tope y frecuencia, número de componentes por defecto" },
  { num: 14, variables: ["n", "max", "frecuencia"], descripcion: "Óptimos número de componentes, tope y frecuencia, factor por defecto" },
  { num: 15, variables: ["factor", "n", "max", "frecuencia"], descripcion: "Óptimos factor, número de componentes, tope y frecuencia" },
];

function resolverCombinacion(fechas, datos, variables) {
  const valores = { ...DEF };
  for (const variable of variables) {
    if (variable === "factor") {
      valores.factor = buscarMejorFactor(fechas, datos, { n: valores.n, max: valores.max, frecuencia: valores.frecuencia });
    } else if (variable === "n") {
      valores.n = buscarMejorN(fechas, datos, { factor: valores.factor, max: valores.max, frecuencia: valores.frecuencia });
    } else if (variable === "max") {
      valores.max = buscarMejorMax(fechas, datos, { factor: valores.factor, n: valores.n, frecuencia: valores.frecuencia });
    } else if (variable === "frecuencia") {
      valores.frecuencia = buscarMejorFrecuencia(fechas, datos, { factor: valores.factor, n: valores.n, max: valores.max });
    }
  }
  return valores;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const diasParam = req.query.dias;
    const diasVentana = diasParam !== undefined ? Number(diasParam) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    const indice = obtenerIndice(req.query.indice);
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana, indice.tickers);

    const resultados = COMBINACIONES.map(({ num, variables, descripcion }) => {
      const valores = resolverCombinacion(fechas, datos, variables);
      const beneficioPct = calcularBeneficioAcumulado(fechas, datos, valores.factor, valores.n, valores.max, valores.frecuencia);
      return {
        num,
        descripcion,
        factor: valores.factor,
        n: valores.n,
        max: valores.max,
        frecuencia: valores.frecuencia,
        beneficioPct: Number(beneficioPct.toFixed(4)),
      };
    });

    res.status(200).json({
      fechaHoraUTC: new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, ""),
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
