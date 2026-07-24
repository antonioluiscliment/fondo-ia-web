// pages/api/optimizar.js
//
// Descarga los datos UNA sola vez y, sobre ellos, ejecuta el motor de
// cálculo para cada factor de penalización candidato entre 0 y 3 (en
// pasos de 0,1 — 31 valores en total). Es una búsqueda exhaustiva
// (fuerza bruta), no una red neuronal: para un único parámetro
// acotado con tan pocos candidatos, probarlos todos es más simple,
// más rápido y da el óptimo exacto entre los candidatos, sin las
// complicaciones ni el riesgo de un entrenamiento por gradiente.
//
// El objetivo que se maximiza es la SUMA del "beneficio sin cambio"
// de todos los días — es decir, el rendimiento de la cartera del día
// ANTERIOR, que es la única decisión realmente alcanzable (se toma
// con el cierre de ayer, no con el de hoy).

import { getYahooFinanceInstance, obtenerDatosAlineados, calcularSeleccionCompleta, DIAS } from "../../lib/motor";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const FACTOR_MIN = 0;
const FACTOR_MAX = 3;
const PASO = 0.1;

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const diasParam = req.query.dias;
    const diasVentana = diasParam !== undefined ? Number(diasParam) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana);

    const resultados = [];
    let mejor = null;

    // Recorremos en pasos de 1 (entero) sobre décimas para evitar
    // errores de redondeo binario típicos de sumar 0.1 repetidamente.
    const nPasos = Math.round((FACTOR_MAX - FACTOR_MIN) / PASO);
    for (let i = 0; i <= nPasos; i++) {
      const factor = Number((FACTOR_MIN + i * PASO).toFixed(2));
      const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor);
      resultados.push({ factor, sumaBeneficioSinCambio: Number(sumaBeneficioSinCambio.toFixed(6)) });
      if (!mejor || sumaBeneficioSinCambio > mejor.sumaBeneficioSinCambio) {
        mejor = { factor, sumaBeneficioSinCambio };
      }
    }

    res.status(200).json({
      mejorFactor: mejor.factor,
      mejorSuma: Number(mejor.sumaBeneficioSinCambio.toFixed(6)),
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
