// pages/api/replicaIndice.js
//
// "Modelo de réplica de un índice": busca, entre 3 y 6 componentes
// del índice elegido, la combinación y los pesos que hacen que la
// cartera se parezca lo más posible al propio índice — no que lo
// bata, que lo REPLIQUE, minimizando el error de seguimiento
// ("tracking error": la diferencia, sesión a sesión, entre el
// incremento de la cartera y el del índice). Toda la explicación del
// motor matemático y del porqué de este enfoque está en
// lib/replicaComun.js.
//
// Pensada sobre todo para los índices "parciales" de la aplicación
// (la serie de ADR: Argentina, Australia, India, Asia, China, Brasil,
// Corea, Latinoamérica, Grecia, México), que no tienen ningún ETF de
// referencia — para los índices que sí lo tienen, comprar el ETF
// sigue siendo la opción más sencilla y fiable de replicarlos.
//
// La búsqueda es por fuerza bruta (prueba todas las combinaciones
// posibles de 3 a 6 valores), factible solo porque estos índices son
// pequeños. Por eso esta herramienta rechaza índices con más de
// MAX_TICKERS_FUERZA_BRUTA componentes — no porque no se pueda
// calcular nada, sino porque el número de combinaciones se dispara
// y, además, esos índices grandes ya suelen tener ETF de verdad.
//
// Parámetros de la query:
//   indice - id del índice a analizar.
//   dias   - ventana de sesiones a usar para ajustar los pesos (por
//            defecto, la ventana de backtest compartida de la app).
//   max    - tope de diversificación por valor.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados, PESO_MAXIMO, DIAS } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { calcularIncrementosSerie, buscarMejorReplica, MAX_TICKERS_FUERZA_BRUTA } from "../../lib/replicaComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

function errorInsuficiente(mensaje) {
  const e = new Error(mensaje);
  e.insuficiente = true;
  return e;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    const diasVentana = req.query.dias !== undefined ? Number(req.query.dias) : DIAS;
    if (!Number.isInteger(diasVentana) || diasVentana < 10 || diasVentana > 90) {
      throw new Error("El parámetro 'dias' debe ser un número entero entre 10 y 90.");
    }
    const pesoMaximo = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;

    if (indice.tickers.length > MAX_TICKERS_FUERZA_BRUTA) {
      throw errorInsuficiente(
        indice.etfReferencia
          ? `Este índice tiene ${indice.tickers.length} componentes — demasiados para probar todas las combinaciones posibles. Para este índice existe además un ETF de verdad (${indice.etfReferencia}), que ya lo replica sin necesidad de aproximarlo con unos pocos valores: mira "Rentabilidad de los ETFs" en Análisis.`
          : `Este índice tiene ${indice.tickers.length} componentes — demasiados para probar todas las combinaciones posibles (el número de combinaciones se dispara). Esta herramienta está pensada para índices más pequeños.`
      );
    }
    if (indice.tickers.length < 3) {
      throw errorInsuficiente(
        `Hacen falta al menos 3 componentes en el índice para poder construir una cartera de réplica, y este solo tiene ${indice.tickers.length}.`
      );
    }

    // Se descargan a la vez los componentes y el propio índice (como
    // un ticker más), para que todas las series queden alineadas
    // exactamente a las mismas fechas.
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasVentana, [...indice.tickers, indice.simboloIndice]);

    const incrementosIndice = calcularIncrementosSerie(datos[indice.simboloIndice].map((d) => d.cierre)).slice(1);
    const retornosPorTicker = {};
    for (const ticker of indice.tickers) {
      retornosPorTicker[ticker] = calcularIncrementosSerie(datos[ticker].map((d) => d.cierre)).slice(1);
    }

    const resultado = buscarMejorReplica(indice.tickers, retornosPorTicker, incrementosIndice, pesoMaximo);
    if (!resultado) {
      throw errorInsuficiente("No se ha podido calcular ninguna combinación válida con los datos disponibles en este momento.");
    }

    // Rentabilidad acumulada de la cartera elegida y del índice en la
    // misma ventana, para poder comparar de un vistazo cuánto se
    // parecen en la práctica, no solo mirar el RMSE.
    const rentabilidadAcumulada = (incrementos) => incrementos.reduce((acc, r) => acc * (1 + r), 1) - 1;
    const rentabilidadIndicePct = Number((rentabilidadAcumulada(incrementosIndice) * 100).toFixed(3));
    const retornosCarteraDiarios = incrementosIndice.map((_, t) =>
      resultado.tickers.reduce((suma, ticker, i) => suma + (resultado.pesos[i] / 100) * retornosPorTicker[ticker][t], 0)
    );
    const rentabilidadCarteraPct = Number((rentabilidadAcumulada(retornosCarteraDiarios) * 100).toFixed(3));

    res.status(200).json({
      indice: indice.id,
      diasVentana,
      fechaInicio: fechas[1], // fechas[0] se pierde al calcular el primer incremento
      fechaFin: fechas[fechas.length - 1],
      nComponentes: resultado.n,
      cartera: resultado.tickers.map((ticker, i) => ({
        ticker,
        nombre: indice.nombresEmpresas[ticker],
        peso: resultado.pesos[i],
      })),
      rmse: Number((resultado.rmse * 100).toFixed(4)), // en puntos porcentuales, más legible
      correlacion: resultado.correlacion !== null ? Number(resultado.correlacion.toFixed(4)) : null,
      rentabilidadCarteraPct,
      rentabilidadIndicePct,
      tieneEtf: !!indice.etfReferencia,
    });
  } catch (error) {
    if (error.insuficiente) {
      res.status(200).json({ insuficiente: true, mensaje: error.message });
      return;
    }
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
