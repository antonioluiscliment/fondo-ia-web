// pages/api/optimizarN.js
//
// Igual que pages/api/optimizar.js, pero para el número de
// componentes de la cartera (entre 3 y 6, en vez de 5 fijo). Se
// descargan los datos UNA sola vez y se ejecuta el motor de cálculo
// para cada número candidato, maximizando la misma función objetivo:
// la suma del "beneficio sin cambio" de las carteras anteriores.
//
// Acepta opcionalmente ?factor=X para usar un factor de penalización
// concreto (por ejemplo, el ya optimizado) en vez del valor por
// defecto.

import {
  getYahooFinanceInstance,
  obtenerDatosAlineados,
  calcularSeleccionCompleta,
  FACTOR_PENALIZACION_DEFECTO,
  DIAS,
} from "../../lib/motor";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const N_MIN = 3;
const N_MAX = 6;

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const factorParam = req.query.factor;
    const factorPenalizacion = factorParam !== undefined ? Number(factorParam) : FACTOR_PENALIZACION_DEFECTO;
    if (Number.isNaN(factorPenalizacion)) {
      throw new Error("El parámetro 'factor' no es un número válido.");
    }

    const diasParam = req.query.dias;
    const diasVentana = diasParam !== undefined ? Number(diasParam) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana);

    const resultados = [];
    let mejor = null;

    for (let n = N_MIN; n <= N_MAX; n++) {
      const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factorPenalizacion, n);
      resultados.push({ nComponentes: n, sumaBeneficioSinCambio: Number(sumaBeneficioSinCambio.toFixed(6)) });
      if (!mejor || sumaBeneficioSinCambio > mejor.sumaBeneficioSinCambio) {
        mejor = { nComponentes: n, sumaBeneficioSinCambio };
      }
    }

    res.status(200).json({
      mejorNComponentes: mejor.nComponentes,
      mejorSuma: Number(mejor.sumaBeneficioSinCambio.toFixed(6)),
      factorUsado: factorPenalizacion,
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
