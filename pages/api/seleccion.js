// pages/api/seleccion.js
//
// Recorre la ventana de sesiones (20 por defecto, configurable con
// ?dias=X) y, para cada día a partir del tercero, calcula el ranking
// de los 30 componentes, selecciona los mejores (5 por defecto, o el
// número indicado en ?n=X, entre 3 y 6) y actualiza composición y
// pesos. Acepta también ?factor=X (el multiplicador de la penalización
// de protección), ?max=X (el tope de diversificación por componente,
// 40% por defecto), ?frecuencia=diario o ?frecuencia=K (K entero
// 0..n-1: el umbral de supervivientes que dispara el rebalanceo —
// "diario" por defecto) y ?criterio=precio (por defecto), ?criterio=
// volumen, ?criterio=flujo o ?criterio=aleatorio (con qué se ordenan
// los 30 componentes cada día: suma de incrementos de precio, de
// volumen, de flujo de dinero —precio × volumen—, o una puntuación
// pseudoaleatoria determinista con semilla fija — ver
// SEMILLA_ALEATORIA_DEFECTO en motor.js). Si no se indican, se usan
// los valores por defecto.
//
// Además, calcula la rentabilidad total compuesta de las carteras
// "anteriores" (la parte del modelo realmente alcanzable) y la
// compara con la rentabilidad del propio Dow Jones en ese periodo,
// además del coeficiente de correlación de Pearson entre el
// beneficio diario de la cartera seleccionada y el incremento diario
// del propio índice.

import {
  getYahooFinanceInstance,
  obtenerDatosAlineados,
  calcularSeleccionCompleta,
  calcularRentabilidadTotalCarteraAnterior,
  obtenerIncrementosIndice,
  calcularCorrelacion,
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

    const maxParam = req.query.max;
    const pesoMaximo = maxParam !== undefined ? Number(maxParam) : PESO_MAXIMO;
    const pesoMinimoPosible = 100 / nComponentes;
    if (Number.isNaN(pesoMaximo) || pesoMaximo < pesoMinimoPosible || pesoMaximo > 100) {
      throw new Error(
        `El parámetro 'max' debe ser un número entre ${pesoMinimoPosible.toFixed(2)} y 100.`
      );
    }

    const frecuenciaParam = req.query.frecuencia;
    let frecuenciaRebalanceo = FRECUENCIA_REBALANCEO_DEFECTO;
    if (frecuenciaParam !== undefined && frecuenciaParam !== "diario") {
      const umbral = Number(frecuenciaParam);
      if (!Number.isInteger(umbral) || umbral < 0 || umbral > nComponentes - 1) {
        throw new Error(`El parámetro 'frecuencia' debe ser 'diario' o un entero entre 0 y ${nComponentes - 1}.`);
      }
      frecuenciaRebalanceo = umbral;
    }

    const criterioParam = req.query.criterio;
    const criteriosValidos = ["precio", "volumen", "flujo", "aleatorio"];
    const criterioPuntuacion = criteriosValidos.includes(criterioParam) ? criterioParam : "precio";

    const diasParam = req.query.dias;
    const diasVentana = diasParam !== undefined ? Number(diasParam) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    const indice = obtenerIndice(req.query.indice);

    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana, indice.tickers);
    const { historico } = calcularSeleccionCompleta(
      fechas,
      datos,
      factorPenalizacion,
      nComponentes,
      pesoMaximo,
      frecuenciaRebalanceo,
      null,
      criterioPuntuacion
    );

    const rentabilidadCarteraAnterior = calcularRentabilidadTotalCarteraAnterior(historico);

    // Una sola descarga del índice de referencia sirve tanto para el
    // incremento diario (comparación día a día y correlación) como
    // para la rentabilidad total del periodo — antes eran dos
    // descargas separadas, lo que en la cadena automática (que ya
    // encadena varias llamadas) sumaba presión extra sobre la API de
    // Yahoo Finance y facilitaba errores de límite de peticiones.
    const { incrementos: incrementosIndice, cierres: cierresIndice } = await obtenerIncrementosIndice(
      yahooFinance,
      fechas,
      indice.simboloIndice
    );
    const historicoConIndice = historico.map((dia) => ({
      ...dia,
      incrementoIndice: incrementosIndice[dia.fecha] ?? null,
    }));

    // Correlación entre el beneficio (variación %) de la cartera
    // seleccionada y el incremento (%) del propio índice, día a día,
    // usando solo los días en los que ambos valores están disponibles.
    const paresCorrelacion = historicoConIndice
      .filter((dia) => dia.incrementoIndice !== null && dia.incrementoIndice !== undefined)
      .map((dia) => [(dia.beneficio - 1) * 100, dia.incrementoIndice]);
    const correlacionBeneficioIndice = calcularCorrelacion(paresCorrelacion);

    let rentabilidadIndice = null;
    if (historico.length > 1 && cierresIndice.length > 0) {
      const fechaInicioObjetivo = historico[0].fecha;
      const fechaFinObjetivo = historico[historico.length - 1].fecha;
      const inicio = cierresIndice.find((c) => c.fecha === fechaInicioObjetivo) || cierresIndice[0];
      const fin =
        [...cierresIndice].reverse().find((c) => c.fecha === fechaFinObjetivo) || cierresIndice[cierresIndice.length - 1];
      rentabilidadIndice = {
        fechaInicio: inicio.fecha,
        fechaFin: fin.fecha,
        rentabilidadPct: Number(((fin.cierre / inicio.cierre - 1) * 100).toFixed(4)),
      };
    }

    res.status(200).json({
      indice: indice.id,
      fechas,
      historico: historicoConIndice,
      factorPenalizacion,
      nComponentes,
      pesoMaximo,
      frecuenciaRebalanceo,
      criterioPuntuacion,
      diasVentana,
      rentabilidadCarteraAnterior,
      rentabilidadIndice,
      correlacionBeneficioIndice,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
