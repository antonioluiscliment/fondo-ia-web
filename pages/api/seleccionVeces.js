// pages/api/seleccionVeces.js
//
// Selección alternativa por "veces seleccionado". Admite dos modos,
// vía ?modo=analisis (por defecto) o ?modo=real:
//
// MODO "analisis": dos backtests sucesivos y SIN SOLAPE.
//   1) Backtest previo, sobre las ?sesionesVeces (10 por defecto)
//      sesiones inmediatamente ANTERIORES a la ventana principal, con
//      los ajustes que el usuario tenga elegidos (factor, n, tope,
//      frecuencia): de él se obtiene el contador acumulado de veces
//      que cada uno de los 30 componentes ha estado en cartera.
//   2) Se eligen los N componentes con mayor contador (empate: orden
//      alfabético) y se arranca con ellos, a partes iguales, la
//      ventana principal (?dias=X) — SIN rebalancear nunca: los pesos
//      solo derivan con la cotización.
//   Que las sesiones del backtest previo sean estrictamente
//   anteriores a la ventana principal (sin solape) es intencional:
//   evita elegir la cartera sabiendo ya cómo le fue en el propio
//   periodo que luego se usa para medir el resultado.
//
// MODO "real": un único cálculo, pensado para componer una cartera
//   para invertir de verdad hoy, no para validar una estrategia. Usa
//   las ?sesionesVeces sesiones MÁS RECIENTES disponibles (terminando
//   hoy) para contar las veces de cada componente, y devuelve
//   directamente esa cartera (pesos iguales) como resultado. Al no
//   quedar ningún periodo posterior conocido, no hay backtest 2 ni
//   rentabilidad que mostrar: el sesgo de anticipación se asume a
//   propósito, porque aquí el objetivo es la cartera de hoy, no medir
//   una estrategia contra el pasado.
//
// ?criterio=precio (por defecto) o ?criterio=volumen: determina si el
// backtest que cuenta las "veces" (el que decide quién entra y quién
// sale cada día) rankea los 30 componentes por la puntuación de
// precio de siempre, o por la puntuación de volumen (suma de los
// incrementos de volumen de las últimas SESIONES_PUNTUACION
// sesiones). El peso y el beneficio de la cartera resultante siguen
// siendo siempre en función del precio.

import {
  getYahooFinanceInstance,
  obtenerDatosAlineados,
  calcularSeleccionCompleta,
  calcularRentabilidadTotalCarteraAnterior,
  obtenerRentabilidadIndice,
  elegirTopPorVeces,
  TICKERS,
  FACTOR_PENALIZACION_DEFECTO,
  N_COMPONENTES,
  PESO_MAXIMO,
  FRECUENCIA_REBALANCEO_DEFECTO,
  SESIONES_PUNTUACION,
  SESIONES_VECES_DEFECTO,
  DIAS,
} from "../../lib/motor";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

function cortarDatos(datos, desde, hasta) {
  return Object.fromEntries(TICKERS.map((tk) => [tk, datos[tk].slice(desde, hasta)]));
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const modo = req.query.modo === "real" ? "real" : "analisis";

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

    const sesionesVecesParam = req.query.sesionesVeces;
    const sesionesVeces = sesionesVecesParam !== undefined ? Number(sesionesVecesParam) : SESIONES_VECES_DEFECTO;
    if (!Number.isInteger(sesionesVeces) || sesionesVeces < 5 || sesionesVeces > 60) {
      throw new Error("El parámetro 'sesionesVeces' debe ser un número entero entre 5 y 60.");
    }

    const criterioParam = req.query.criterio;
    const criterioPuntuacion = criterioParam === "volumen" ? "volumen" : "precio";

    if (modo === "real") {
      // Un único backtest, sobre las sesionesVeces sesiones MÁS
      // RECIENTES (terminando hoy): sirve para elegir la cartera a
      // invertir, no para medir una estrategia.
      const diasTotal = sesionesVeces + SESIONES_PUNTUACION;
      const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasTotal);

      const { contadorApariciones } = calcularSeleccionCompleta(
        fechas,
        datos,
        factorPenalizacion,
        nComponentes,
        pesoMaximo,
        frecuenciaRebalanceo,
        null,
        criterioPuntuacion
      );

      const elegidos = elegirTopPorVeces(contadorApariciones, nComponentes);
      const fechaReferencia = fechas[fechas.length - 1];
      const carteraHoy = elegidos.map(({ ticker, veces }) => ({
        ticker,
        veces,
        peso: Number((100 / nComponentes).toFixed(2)),
        precio: Number(datos[ticker][datos[ticker].length - 1].cierre.toFixed(2)),
      }));

      res.status(200).json({
        modo,
        criterioPuntuacion,
        sesionesVeces,
        fechaReferencia,
        carteraHoy,
        factorPenalizacion,
        nComponentes,
        pesoMaximo,
        frecuenciaRebalanceo,
      });
      return;
    }

    // Modo "analisis": ventana principal + sesionesVeces sesiones
    // previas sin solape.
    const diasParam = req.query.dias;
    const diasVentana = diasParam !== undefined ? Number(diasParam) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 5 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 5 y 90.");
    }

    const diasTotal = diasVentana + sesionesVeces;
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasTotal);

    // Backtest 1: primeras (sesionesVeces + SESIONES_PUNTUACION) sesiones.
    const finBacktest1 = sesionesVeces + SESIONES_PUNTUACION;
    const fechasVeces = fechas.slice(0, finBacktest1);
    const datosVeces = cortarDatos(datos, 0, finBacktest1);
    const { contadorApariciones, historico: historicoVeces } = calcularSeleccionCompleta(
      fechasVeces,
      datosVeces,
      factorPenalizacion,
      nComponentes,
      pesoMaximo,
      frecuenciaRebalanceo,
      null,
      criterioPuntuacion
    );

    const elegidos = elegirTopPorVeces(contadorApariciones, nComponentes);
    const carteraInicial = elegidos.map(({ ticker }) => ({ ticker, peso: 100 / nComponentes }));

    // Backtest 2: desde SESIONES_PUNTUACION sesiones antes del final
    // del backtest 1 (para que su primer día tenga puntuación que
    // mostrar) hasta el final — exactamente la ventana principal
    // solicitada, sin solape en los días de decisión con el backtest
    // 1. Se rebalancea "nunca": la cartera elegida arriba se mantiene
    // fija, los pesos solo derivan con el precio.
    const inicioBacktest2 = sesionesVeces - SESIONES_PUNTUACION;
    const fechasPrincipal = fechas.slice(inicioBacktest2);
    const datosPrincipal = cortarDatos(datos, inicioBacktest2, undefined);
    const { historico } = calcularSeleccionCompleta(
      fechasPrincipal,
      datosPrincipal,
      factorPenalizacion,
      nComponentes,
      pesoMaximo,
      "nunca",
      carteraInicial
    );

    const rentabilidadCarteraAnterior = calcularRentabilidadTotalCarteraAnterior(historico);

    let rentabilidadIndice = null;
    if (historico.length > 1) {
      const fechaInicio = historico[0].fecha;
      const fechaFin = historico[historico.length - 1].fecha;
      rentabilidadIndice = await obtenerRentabilidadIndice(yahooFinance, fechaInicio, fechaFin);
    }

    res.status(200).json({
      modo,
      criterioPuntuacion,
      fechas: fechasPrincipal,
      historico,
      elegidosPorVeces: elegidos,
      sesionesVeces,
      historicoVeces,
      factorPenalizacion,
      nComponentes,
      pesoMaximo,
      frecuenciaRebalanceo,
      diasVentana,
      rentabilidadCarteraAnterior,
      rentabilidadIndice,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
