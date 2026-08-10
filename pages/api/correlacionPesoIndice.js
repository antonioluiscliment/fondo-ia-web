// pages/api/correlacionPesoIndice.js
//
// "Correlación de los componentes con el peso en el índice" (menú
// Análisis): ¿los valores con más peso correlacionan más con el
// movimiento del índice? Ver lib/pesosIndiceComun.js para el detalle
// completo de cada cálculo y sus limitaciones.
//
// Ventana de análisis: 60 sesiones — la misma cifra "ya familiar" que
// se usa en otras herramientas de la aplicación, sin introducir un
// parámetro nuevo solo para esto.
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
import { calcularIncrementosSerie } from "../../lib/multifactorComun";
import { obtenerIndice } from "../../lib/indices";
import { obtenerHoldingsEtf } from "../../lib/holdingsEtfComun";
import { calcularCorrelacionPearson, calcularBeta, calcularIndiceExcluyendo, estimarPesosRestantes, PONDERADOS_POR_PRECIO } from "../../lib/pesosIndiceComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

export const VENTANA_SESIONES = 60;

function numeroValido(v) {
  return typeof v === "number" && !Number.isNaN(v);
}

// Calcula correlación, beta, y las mismas dos medidas "sin este valor",
// para un componente concreto con su peso (en fracción) ya conocido o
// estimado.
function analizarComponente(incrementosComponente, incrementosIndice, pesoFraccion) {
  const correlacionBruta = calcularCorrelacionPearson(incrementosComponente, incrementosIndice);
  const betaBruta = calcularBeta(incrementosComponente, incrementosIndice);

  const indiceSinEste = calcularIndiceExcluyendo(incrementosIndice, incrementosComponente, pesoFraccion);
  const correlacionExcluyendo = calcularCorrelacionPearson(incrementosComponente, indiceSinEste);
  const betaExcluyendo = calcularBeta(incrementosComponente, indiceSinEste);

  return { correlacionBruta, betaBruta, correlacionExcluyendo, betaExcluyendo, indiceSinEste };
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

    // 1) Precio de todos los componentes, alineado por fecha, y el
    // propio índice, en la misma ventana.
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, VENTANA_SESIONES, indice.tickers);
    const { incrementos: incrementosIndicePorFecha } = await obtenerIncrementosIndice(yahooFinance, fechas, indice.simboloIndice);

    const incrementosPorTicker = {};
    for (const ticker of indice.tickers) {
      if (!datos[ticker]) continue;
      incrementosPorTicker[ticker] = calcularIncrementosSerie(datos[ticker].map((d) => d.cierre));
    }
    // incrementosIndicePorFecha ya viene alineado a "fechas" (una
    // entrada por cada fecha, calculada contra la fecha de mercado
    // anterior real del propio índice) — se convierte a array en el
    // mismo orden que fechas, para poder emparejar posición a
    // posición con incrementosPorTicker[ticker], que sigue ese mismo
    // orden. OJO: no usar el "cierres" que devuelve la misma función,
    // que no está alineado a "fechas" (se descarga con 10 días de
    // margen antes/después para poder calcular su propio primer
    // incremento) — mezclarlo con los incrementos de los componentes
    // desalinea las fechas y invalida cualquier correlación o beta
    // calculada así.
    // obtenerIncrementosIndice devuelve el incremento en PORCENTAJE
    // (1.5 para un +1,5%), mientras que calcularIncrementosSerie (la
    // que usan los componentes, más abajo) devuelve la FRACCIÓN
    // (0.015) — sin esta división entre 100, la correlación no se ve
    // afectada (es invariante a la escala), pero la beta sale
    // sistemáticamente 100 veces más pequeña de lo que debería.
    const incrementosIndice = fechas.map((f) => {
      const v = incrementosIndicePorFecha[f];
      return v === null || v === undefined ? null : v / 100;
    });

    // 2) Top 10 de holdings del ETF, con peso real.
    const holdings = await obtenerHoldingsEtf(yahooFinance, indice);
    const holdingsValidos = holdings.filter((h) => h.enNuestraLista && incrementosPorTicker[h.ticker]);

    // 3) Análisis de los 10 de peso REAL conocido — el cruce
    // principal que responde a la pregunta de esta herramienta.
    const filasPesoReal = holdingsValidos.map((h) => {
      const pesoFraccion = h.porcentaje / 100;
      const analisis = analizarComponente(incrementosPorTicker[h.ticker], incrementosIndice, pesoFraccion);
      const detallePares = construirDetallePares(fechas, incrementosPorTicker[h.ticker], incrementosIndice, analisis.indiceSinEste);
      const { indiceSinEste, ...analisisSinSerie } = analisis;
      return { ticker: h.ticker, nombre: indice.nombresEmpresas[h.ticker] || h.nombre, pesoPorcentaje: h.porcentaje, ...analisisSinSerie, detallePares };
    });

    // 4) Correlación entre "peso" y cada medida, con y sin exclusión
    // — el resumen de un solo número que responde directamente a la
    // pregunta de partida.
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
      const tickersRestantes = indice.tickers.filter((tk) => !tickersConPesoReal.has(tk) && incrementosPorTicker[tk]);

      if (tickersRestantes.length > 0) {
        const cotizaciones = await yahooFinance.quote([...tickersConPesoReal, ...tickersRestantes], { fields: ["symbol", "marketCap"] });
        const capitalizacionPorTicker = Object.fromEntries(
          cotizaciones.filter((c) => numeroValido(c.marketCap)).map((c) => [c.symbol, c.marketCap])
        );

        const pesoRealTotalFraccion = holdingsValidos.reduce((s, h) => s + h.porcentaje / 100, 0);
        const pesoRestanteFraccion = Math.max(0, 1 - pesoRealTotalFraccion);
        const pesosEstimados = estimarPesosRestantes(tickersRestantes, capitalizacionPorTicker, pesoRestanteFraccion);

        filasPesoEstimado = Object.entries(pesosEstimados).map(([ticker, pesoFraccion]) => {
          const analisis = analizarComponente(incrementosPorTicker[ticker], incrementosIndice, pesoFraccion);
          return { ticker, nombre: indice.nombresEmpresas[ticker], pesoPorcentaje: Number((pesoFraccion * 100).toFixed(3)), ...analisis };
        });
      }
    }

    res.status(200).json({
      indice: indice.id,
      nombreIndice: indice.nombre.es,
      ventanaSesiones: VENTANA_SESIONES,
      ponderadoPorPrecio,
      filasPesoReal,
      resumenCruce,
      filasPesoEstimado,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
