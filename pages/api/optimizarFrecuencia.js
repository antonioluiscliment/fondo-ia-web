// pages/api/optimizarFrecuencia.js
//
// Busca la mejor frecuencia de rebalanceo ("diario" o el umbral de
// supervivientes 0..nComponentes-1 que lo dispara) para un factor de
// penalización, número de componentes y tope de diversificación
// dados, maximizando la suma del beneficio realmente alcanzable
// ("beneficio sin cambio") de las carteras anteriores en la ventana.

import {
  getYahooFinanceInstance,
  obtenerDatosAlineados,
  buscarMejorFrecuencia,
  calcularSeleccionCompleta,
  FACTOR_PENALIZACION_DEFECTO,
  N_COMPONENTES,
  PESO_MAXIMO,
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

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const factor = req.query.factor !== undefined ? Number(req.query.factor) : FACTOR_PENALIZACION_DEFECTO;
    const n = req.query.n !== undefined ? Number(req.query.n) : N_COMPONENTES;
    const max = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;

    const diasParam = req.query.dias;
    const diasVentana = diasParam !== undefined ? Number(diasParam) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    const indice = obtenerIndice(req.query.indice);
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana, indice.tickers);

    const mejorFrecuenciaRebalanceo = buscarMejorFrecuencia(fechas, datos, { factor, n, max });

    const candidatos = ["diario", ...Array.from({ length: n }, (_, i) => n - 1 - i)];
    const resultados = candidatos.map((frecuencia) => {
      const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia);
      return { frecuencia, sumaBeneficioSinCambio: Number(sumaBeneficioSinCambio.toFixed(6)) };
    });

    res.status(200).json({ mejorFrecuenciaRebalanceo, resultados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
