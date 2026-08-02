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
// Cada valor se descarga POR SEPARADO, con su propio calendario, y se
// alinea al calendario del índice buscando el cierre en cada fecha o
// el más próximo anterior — no se exige que TODOS los valores
// (típicamente 15-18 en estos índices) coincidan exactamente en las
// mismas fechas de cotización a la vez, porque eso resultó ser
// demasiado frágil (ver el mismo cambio ya hecho en
// pages/api/variacionIndices.js): basta un hueco de datos en un solo
// valor para que la intersección se quede corta o vacía. Si un valor
// concreto falla al descargar (símbolo puntual caído, etc.), se
// excluye de la búsqueda sin romper el resto — con que queden al
// menos 3 valores válidos, la herramienta sigue funcionando.
//
// La búsqueda de la mejor combinación es por fuerza bruta (prueba
// todas las combinaciones posibles de 3 a 6 valores), factible solo
// porque estos índices son pequeños. Por eso esta herramienta rechaza
// índices con más de MAX_TICKERS_FUERZA_BRUTA componentes.
//
// Parámetros de la query:
//   indice - id del índice a analizar.
//   dias   - ventana de sesiones a usar para ajustar los pesos (por
//            defecto, la ventana de backtest compartida de la app).
//   max    - tope de diversificación por valor.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerCierresConActual, PESO_MAXIMO, DIAS } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { calcularIncrementosSerie, buscarMejorReplica, MAX_TICKERS_TOTAL } from "../../lib/replicaComun";

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

// Último cierre disponible en la fecha exacta o antes (los cierres
// vienen ordenados cronológicamente ascendente). Null si no hay
// ninguno anterior a esa fecha.
function valorEnFechaOAntes(cierres, fechaObjetivoISO) {
  let elegido = null;
  for (const c of cierres) {
    if (c.fecha <= fechaObjetivoISO) elegido = c;
    else break;
  }
  return elegido;
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

    if (indice.tickers.length > MAX_TICKERS_TOTAL) {
      throw errorInsuficiente(
        indice.etfReferencia
          ? `Este índice tiene ${indice.tickers.length} componentes — demasiados incluso para la búsqueda por pasos. Para este índice existe además un ETF de verdad (${indice.etfReferencia}), que ya lo replica sin necesidad de aproximarlo con unos pocos valores: mira "Rentabilidad de los ETFs" en Análisis.`
          : `Este índice tiene ${indice.tickers.length} componentes — demasiados incluso para la búsqueda por pasos. Esta herramienta está pensada para índices más pequeños.`
      );
    }
    if (indice.tickers.length < 3) {
      throw errorInsuficiente(
        `Hacen falta al menos 3 componentes en el índice para poder construir una cartera de réplica, y este solo tiene ${indice.tickers.length}.`
      );
    }

    // Margen para poder alinear con holgura (algunos festivos propios
    // no coincidentes no deberían dejar la ventana corta).
    const sesionesDescarga = diasVentana + 15;

    // 1) El índice, con su propio calendario. Si esto falla, es un
    // fallo real (no hay nada que replicar sin el índice).
    const cierresIndice = await obtenerCierresConActual(yahooFinance, indice.simboloIndice, sesionesDescarga);
    const fechasIndice = cierresIndice.slice(-diasVentana).map((c) => c.fecha);

    // 2) Cada componente, por separado — si uno falla, se excluye sin
    // romper los demás.
    const excluidos = [];
    const cierresPorTicker = {};
    await Promise.all(
      indice.tickers.map(async (ticker) => {
        try {
          cierresPorTicker[ticker] = await obtenerCierresConActual(yahooFinance, ticker, sesionesDescarga);
        } catch {
          excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker], motivo: "sinPrecio" });
        }
      })
    );

    // 3) Alinear cada componente válido al calendario del índice
    // (cierre en cada fecha del índice, o el más próximo anterior).
    const tickersValidos = [];
    const cierresAlineados = {};
    for (const ticker of indice.tickers) {
      const cierres = cierresPorTicker[ticker];
      if (!cierres) continue; // ya excluido en el paso anterior

      const serie = fechasIndice.map((fecha) => {
        const ref = valorEnFechaOAntes(cierres, fecha);
        return ref ? ref.cierre : null;
      });
      // Si falta más de un 25% de las fechas para este valor, se
      // descarta — con demasiados huecos, sus incrementos dejarían de
      // ser representativos de la ventana real. (Antes el umbral era
      // del 10%, demasiado estricto para ADR poco líquidos: excluía
      // casi todo en varios índices pequeños de la serie.)
      const huecos = serie.filter((v) => v === null).length;
      if (huecos > diasVentana * 0.25) {
        excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker], motivo: "datosIncompletos" });
        continue;
      }
      tickersValidos.push(ticker);
      cierresAlineados[ticker] = serie;
    }

    if (tickersValidos.length < 3) {
      throw errorInsuficiente(
        `Hacen falta al menos 3 componentes con precio disponible y alineado al calendario del índice, y solo hay ${tickersValidos.length} en este momento (de ${indice.tickers.length} en total; ${excluidos.length} excluidos por falta de datos).`
      );
    }

    // 4) Incrementos diarios — para el cálculo, se rellena cualquier
    // hueco puntual que haya quedado repitiendo el último valor
    // disponible (equivale a un incremento de 0% ese día para ese
    // valor concreto, en vez de tirar la fila entera).
    const rellenarHuecos = (serie) => {
      const resultado = [...serie];
      for (let i = 1; i < resultado.length; i++) {
        if (resultado[i] === null) resultado[i] = resultado[i - 1];
      }
      return resultado;
    };

    const incrementosIndice = calcularIncrementosSerie(cierresIndice.slice(-diasVentana).map((c) => c.cierre)).slice(1);
    const retornosPorTicker = {};
    for (const ticker of tickersValidos) {
      retornosPorTicker[ticker] = calcularIncrementosSerie(rellenarHuecos(cierresAlineados[ticker])).slice(1);
    }

    const resultado = buscarMejorReplica(tickersValidos, retornosPorTicker, incrementosIndice, pesoMaximo);
    if (!resultado) {
      throw errorInsuficiente(
        `No se ha podido calcular ninguna combinación válida con los ${tickersValidos.length} componentes disponibles en esta ventana de ${diasVentana} sesiones — probablemente varios se mueven de forma casi idéntica entre sí. Prueba con una ventana más larga (más sesiones) desde "Parámetros técnicos".`
      );
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
      fechaInicio: fechasIndice[1], // fechasIndice[0] se pierde al calcular el primer incremento
      fechaFin: fechasIndice[fechasIndice.length - 1],
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
      excluidos,
    });
  } catch (error) {
    if (error.insuficiente) {
      res.status(200).json({ insuficiente: true, mensaje: error.message });
      return;
    }
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
