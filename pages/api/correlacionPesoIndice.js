// pages/api/correlacionPesoIndice.js
//
// "Correlación de los componentes con el peso en el índice" (menú
// Análisis): ¿los valores con más peso correlacionan más con el
// movimiento del índice? Ver lib/pesosIndiceComun.js para el detalle
// completo de cada cálculo y sus limitaciones.
//
// Ventana de análisis: elegible por el usuario (60, 120 o 180
// sesiones — 120 por defecto). Alargarla no encarece el cálculo del
// mismo modo que en el walk-forward: aquí no hay ningún ajuste
// iterativo que repetir, solo una descarga algo más larga y un
// cálculo aritmético directo sobre el array completo.
//
// Solo se dispone del peso REAL de los 10 componentes con más peso
// del índice (el top 10 de holdings del ETF de referencia — ver
// lib/holdingsEtfComun.js). El cruce peso↔correlación (el objetivo
// principal de esta herramienta) se limita a esos 10, con el
// "índice sin ese valor" calculado a partir de su peso real. Como
// vista complementaria, para los índices ponderados por capitalización
// (todos salvo el Dow Jones), se estima un peso aproximado del resto
// de componentes a partir de su capitalización de mercado relativa —
// siempre marcado como "estimado", nunca mezclado sin distinguir con
// los 10 de peso real.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados, obtenerIncrementosIndice } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { obtenerHoldingsEtf } from "../../lib/holdingsEtfComun";
import { calcularCorrelacionPearson, calcularBeta, calcularIndiceExcluyendo, calcularIncrementosDesfase, estimarPesosRestantes, PONDERADOS_POR_PRECIO } from "../../lib/pesosIndiceComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

// Ventanas de análisis permitidas, elegibles por el usuario — 120 por
// defecto. Ver la conversación que dio origen a esta opción: a
// diferencia del walk-forward (donde más sesiones significa repetir
// un ajuste de modelo muchas veces más), aquí no hay ningún ajuste
// iterativo — correlación y beta son cálculos directos sobre el
// array completo —, así que alargar la ventana no multiplica el
// trabajo, solo pide más días dentro de la misma descarga de siempre.
export const VENTANAS_PERMITIDAS = [60, 120, 180];
export const VENTANA_SESIONES_DEFECTO = 120;

function numeroValido(v) {
  return typeof v === "number" && !Number.isNaN(v);
}

// Calcula correlación, beta, y las mismas dos medidas "sin este valor",
// para un componente concreto con su peso (en fracción) ya conocido o
// estimado — en las tres "vistas" de la serie: día a día (E1, la de
// siempre), respecto a hace 2 sesiones (E2) y respecto a hace 3 (E3).
// E2/E3 se solapan entre sí (no son observaciones independientes),
// pero permiten distinguir dos explicaciones distintas de un mismo
// resultado extraño en E1: si es solo ruido de un día suelto que se
// diluye al promediar en E2/E3, o si el patrón se mantiene igual de
// fuerte también ahí (más compatible con una historia real de fondo
// del valor, no con ruido).
function analizarComponente(precioComponente, precioIndice, pesoFraccion) {
  const resultado = {};
  for (const [sufijo, desfase] of [["", 1], ["E2", 2], ["E3", 3]]) {
    const incrementosComponente = calcularIncrementosDesfase(precioComponente, desfase);
    const incrementosIndice = calcularIncrementosDesfase(precioIndice, desfase);

    const correlacionBruta = calcularCorrelacionPearson(incrementosComponente, incrementosIndice);
    const betaBruta = calcularBeta(incrementosComponente, incrementosIndice);

    const indiceSinEste = calcularIndiceExcluyendo(incrementosIndice, incrementosComponente, pesoFraccion);
    const correlacionExcluyendo = calcularCorrelacionPearson(incrementosComponente, indiceSinEste);
    const betaExcluyendo = calcularBeta(incrementosComponente, indiceSinEste);

    resultado[`correlacionBruta${sufijo}`] = correlacionBruta;
    resultado[`betaBruta${sufijo}`] = betaBruta;
    resultado[`correlacionExcluyendo${sufijo}`] = correlacionExcluyendo;
    resultado[`betaExcluyendo${sufijo}`] = betaExcluyendo;
    if (desfase === 1) {
      // Solo se guarda la serie de "índice sin este valor" del
      // desfase 1 (E1), la que usa la tabla de detalle día a día —
      // guardar las tres inflaría la respuesta sin necesidad.
      resultado.indiceSinEsteE1 = indiceSinEste;
      resultado.incrementosComponenteE1 = incrementosComponente;
      resultado.incrementosIndiceE1 = incrementosIndice;
    }
  }
  return resultado;
}

// Tabla de pares fecha ↔ incremento, tal cual se usan en el cálculo
// — para poder comprobar a mano, contra el histórico real de Yahoo
// Finance, que cada fecha se está emparejando con el día que
// corresponde y no con uno desplazado. Se multiplica por 100 solo
// para esta tabla de VISUALIZACIÓN (el cálculo interno usa fracción,
// no porcentaje, en los cuatro valores).
function construirDetallePares(fechas, incrementosComponente, incrementosIndice, indiceSinEste) {
  const aPorcentaje = (v) => (v === null || v === undefined ? null : Number((v * 100).toFixed(4)));
  return fechas.map((fecha, i) => ({
    fecha,
    incrementoComponente: aPorcentaje(incrementosComponente[i]),
    incrementoIndice: aPorcentaje(incrementosIndice[i]),
    incrementoIndiceExcluyendo: aPorcentaje(indiceSinEste[i]),
  }));
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    const ponderadoPorPrecio = PONDERADOS_POR_PRECIO.includes(indice.id);

    const ventanaParam = req.query.ventana !== undefined ? Number(req.query.ventana) : VENTANA_SESIONES_DEFECTO;
    if (!VENTANAS_PERMITIDAS.includes(ventanaParam)) {
      throw new Error(`El parámetro 'ventana' debe ser uno de: ${VENTANAS_PERMITIDAS.join(", ")}.`);
    }
    const ventanaSesiones = ventanaParam;

    // 1) Precio de todos los componentes, alineado por fecha, y el
    // propio índice, en la misma ventana.
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, ventanaSesiones, indice.tickers);
    const { cierres: cierresIndice } = await obtenerIncrementosIndice(yahooFinance, fechas, indice.simboloIndice);

    const precioPorTicker = {};
    for (const ticker of indice.tickers) {
      if (!datos[ticker]) continue;
      precioPorTicker[ticker] = datos[ticker].map((d) => d.cierre);
    }
    // El precio del índice se alinea a "fechas" buscando cada fecha
    // por su valor exacto (no por posición) en el array que devuelve
    // obtenerIncrementosIndice — ese array trae más días de los que
    // hay en "fechas" (10 de margen antes y después, para poder
    // calcular su propio primer incremento) y no coincide con
    // "fechas" posición a posición; hay que buscarlo por fecha, igual
    // que ya hacen el resto de herramientas de la aplicación que usan
    // esta misma función (ver la nota de la conversación que dio
    // origen a este endpoint: usar el array sin alinear por posición
    // fue precisamente el primer fallo que se corrigió aquí).
    const mapaCierresIndice = Object.fromEntries(cierresIndice.map((c) => [c.fecha, c.cierre]));
    const precioIndice = fechas.map((f) => (mapaCierresIndice[f] !== undefined ? mapaCierresIndice[f] : null));

    // 2) Top 10 de holdings del ETF, con peso real.
    const holdings = await obtenerHoldingsEtf(yahooFinance, indice);
    const holdingsValidos = holdings.filter((h) => h.enNuestraLista && precioPorTicker[h.ticker]);

    // 3) Análisis de los 10 de peso REAL conocido — el cruce
    // principal que responde a la pregunta de esta herramienta.
    const filasPesoReal = holdingsValidos.map((h) => {
      const pesoFraccion = h.porcentaje / 100;
      const analisis = analizarComponente(precioPorTicker[h.ticker], precioIndice, pesoFraccion);
      const detallePares = construirDetallePares(fechas, analisis.incrementosComponenteE1, analisis.incrementosIndiceE1, analisis.indiceSinEsteE1);
      const { indiceSinEsteE1, incrementosComponenteE1, incrementosIndiceE1, ...analisisPublico } = analisis;
      return { ticker: h.ticker, nombre: indice.nombresEmpresas[h.ticker] || h.nombre, pesoPorcentaje: h.porcentaje, ...analisisPublico, detallePares };
    });

    // 4) Correlación entre "peso" y cada medida, con y sin exclusión
    // — el resumen de un solo número que responde directamente a la
    // pregunta de partida. Se queda en la vista día a día (E1): es la
    // que decide si de verdad hay relación entre peso y correlación,
    // no las vistas E2/E3, que están para diagnosticar casos
    // concretos, no para este resumen agregado.
    const pesos = filasPesoReal.map((f) => f.pesoPorcentaje);
    const resumenCruce = {
      pesoVsCorrelacionBruta: calcularCorrelacionPearson(pesos, filasPesoReal.map((f) => f.correlacionBruta)),
      pesoVsCorrelacionExcluyendo: calcularCorrelacionPearson(pesos, filasPesoReal.map((f) => f.correlacionExcluyendo)),
      pesoVsBetaBruta: calcularCorrelacionPearson(pesos, filasPesoReal.map((f) => f.betaBruta)),
      pesoVsBetaExcluyendo: calcularCorrelacionPearson(pesos, filasPesoReal.map((f) => f.betaExcluyendo)),
    };

    // 5) Vista complementaria: peso ESTIMADO por capitalización para
    // el resto de componentes — solo en índices ponderados por
    // capitalización, y siempre marcado como estimado.
    let filasPesoEstimado = [];
    if (!ponderadoPorPrecio) {
      const tickersConPesoReal = new Set(holdingsValidos.map((h) => h.ticker));
      const tickersRestantes = indice.tickers.filter((tk) => !tickersConPesoReal.has(tk) && precioPorTicker[tk]);

      if (tickersRestantes.length > 0) {
        const cotizaciones = await yahooFinance.quote([...tickersConPesoReal, ...tickersRestantes], { fields: ["symbol", "marketCap"] });
        const capitalizacionPorTicker = Object.fromEntries(
          cotizaciones.filter((c) => numeroValido(c.marketCap)).map((c) => [c.symbol, c.marketCap])
        );

        const pesoRealTotalFraccion = holdingsValidos.reduce((s, h) => s + h.porcentaje / 100, 0);
        const pesoRestanteFraccion = Math.max(0, 1 - pesoRealTotalFraccion);
        const pesosEstimados = estimarPesosRestantes(tickersRestantes, capitalizacionPorTicker, pesoRestanteFraccion);

        filasPesoEstimado = Object.entries(pesosEstimados).map(([ticker, pesoFraccion]) => {
          const analisis = analizarComponente(precioPorTicker[ticker], precioIndice, pesoFraccion);
          const { indiceSinEsteE1, incrementosComponenteE1, incrementosIndiceE1, ...analisisPublico } = analisis;
          return { ticker, nombre: indice.nombresEmpresas[ticker], pesoPorcentaje: Number((pesoFraccion * 100).toFixed(3)), ...analisisPublico };
        });
      }
    }

    res.status(200).json({
      indice: indice.id,
      nombreIndice: indice.nombre.es,
      ventanaSesiones,
      ponderadoPorPrecio,
      filasPesoReal,
      resumenCruce,
      filasPesoEstimado,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
