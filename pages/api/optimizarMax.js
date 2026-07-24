// pages/api/optimizarMax.js
//
// Igual que pages/api/optimizar.js y optimizarN.js, pero para el tope
// máximo de diversificación por componente (fijo en 40% hasta ahora).
// Se descargan los datos UNA sola vez y se prueba cada tope candidato
// entre el mínimo posible (100% / número de componentes, que es lo
// que ya tiene cada uno de partida) y un máximo de 70% para esta
// primera prueba, en pasos de 5 puntos porcentuales.
//
// Acepta opcionalmente ?factor=X y ?n=Y para usar el factor de
// penalización y el número de componentes ya optimizados (o los
// valores por defecto si no se indican).

import {
  getYahooFinanceInstance,
  obtenerDatosAlineados,
  calcularSeleccionCompleta,
  FACTOR_PENALIZACION_DEFECTO,
  N_COMPONENTES,
  PESO_MAXIMO_TOPE_BUSQUEDA,
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

const PASO = 5; // puntos porcentuales

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const factorParam = req.query.factor;
    const factorPenalizacion = factorParam !== undefined ? Number(factorParam) : FACTOR_PENALIZACION_DEFECTO;
    if (Number.isNaN(factorPenalizacion)) {
      throw new Error("El parámetro 'factor' no es un número válido.");
    }

    const nParam = req.query.n;
    const nComponentes = nParam !== undefined ? Number(nParam) : N_COMPONENTES;
    if (Number.isNaN(nComponentes) || nComponentes < 3 || nComponentes > 6) {
      throw new Error("El parámetro 'n' debe ser un número entre 3 y 6.");
    }

    const pesoMinimo = 100 / nComponentes;

    const frecuenciaParam = req.query.frecuencia;
    let frecuenciaRebalanceo = FRECUENCIA_REBALANCEO_DEFECTO;
    if (frecuenciaParam !== undefined && frecuenciaParam !== "diario") {
      const umbral = Number(frecuenciaParam);
      if (!Number.isInteger(umbral) || umbral < 0 || umbral > nComponentes - 1) {
        throw new Error(`El parámetro 'frecuencia' debe ser 'diario' o un entero entre 0 y ${nComponentes - 1}.`);
      }
      frecuenciaRebalanceo = umbral;
    }

    const diasParam = req.query.dias;
    const diasVentana = diasParam !== undefined ? Number(diasParam) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    const indice = obtenerIndice(req.query.indice);
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana, indice.tickers);

    const candidatos = [];
    for (let m = Math.ceil(pesoMinimo); m < PESO_MAXIMO_TOPE_BUSQUEDA; m += PASO) {
      candidatos.push(m);
    }
    candidatos.push(PESO_MAXIMO_TOPE_BUSQUEDA); // aseguramos incluir el extremo superior (70%)
    // Y el propio mínimo exacto, por si no coincide con un múltiplo de PASO.
    if (!candidatos.includes(Math.round(pesoMinimo * 100) / 100)) {
      candidatos.unshift(Number(pesoMinimo.toFixed(2)));
    }

    const resultados = [];
    let mejor = null;

    for (const pesoMaximo of candidatos) {
      const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(
        fechas,
        datos,
        factorPenalizacion,
        nComponentes,
        pesoMaximo,
        frecuenciaRebalanceo
      );
      resultados.push({ pesoMaximo, sumaBeneficioSinCambio: Number(sumaBeneficioSinCambio.toFixed(6)) });
      if (!mejor || sumaBeneficioSinCambio > mejor.sumaBeneficioSinCambio) {
        mejor = { pesoMaximo, sumaBeneficioSinCambio };
      }
    }

    res.status(200).json({
      mejorPesoMaximo: mejor.pesoMaximo,
      mejorSuma: Number(mejor.sumaBeneficioSinCambio.toFixed(6)),
      pesoMinimo: Number(pesoMinimo.toFixed(2)),
      factorUsado: factorPenalizacion,
      nComponentesUsado: nComponentes,
      resultados,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
