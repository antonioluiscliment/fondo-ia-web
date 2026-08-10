// lib/holdingsEtfComun.js
//
// Lógica compartida para leer el top 10 de holdings del ETF de
// referencia de un índice — extraída de pages/api/holdingsETF.js para
// poder reutilizarla también en "Correlación de los componentes con
// el peso en el índice" (pages/api/correlacionPesoIndice.js), sin
// duplicar el ajuste de bolsa entre mercados (ver más abajo).
//
// OJO: Yahoo Finance solo expone el top 10 de holdings de un ETF a
// través de este módulo, nunca la lista completa — cualquier
// herramienta que use esto tiene que asumirlo desde el diseño, no
// como una sorpresa a mitad de camino.
//
// Algunos valores cotizan en varias bolsas a la vez (p.ej. Ferrovial
// en Ámsterdam, España y Nasdaq), y el ETF puede reportar el holding
// con el sufijo de una bolsa distinta a la "propia" del índice
// (nuestra lista siempre usa la bolsa del índice: sin sufijo para el
// Dow Jones, ".MC" para el IBEX 35). Sin este ajuste, esos casos
// saldrían siempre como "no encontrado", aunque el valor sí esté en
// la lista con el ticker de la bolsa correcta.

const NOMBRES_BOLSA = {
  "": "EE. UU.",
  MC: "Madrid",
  AS: "Ámsterdam",
  L: "Londres",
  PA: "París",
  DE: "Alemania",
  MI: "Milán",
  SW: "Suiza",
  LS: "Lisboa",
};

function sufijoDe(ticker) {
  const i = ticker.lastIndexOf(".");
  return i > 0 ? ticker.slice(i + 1) : "";
}

function baseDe(ticker) {
  const i = ticker.lastIndexOf(".");
  return i > 0 ? ticker.slice(0, i) : ticker;
}

export function nombreBolsa(sufijo) {
  return NOMBRES_BOLSA[sufijo] || sufijo;
}

// Para un holding del ETF que cotiza en una bolsa distinta a la del
// índice, comprueba si ese mismo valor existe también en la bolsa del
// índice, y si es así, devuelve su ticker allí. Usa primero el alias
// manual del índice (si lo tiene para ese mnemónico); si no, prueba
// con la regla genérica de mismo mnemónico y sufijo de la bolsa del
// índice. Si ninguno existe (o la consulta falla), devuelve null.
async function buscarEnBolsaDelIndice(yahooFinance, tickerEtf, indice) {
  const base = baseDe(tickerEtf);
  const baseCandidata = (indice.aliasesTicker && indice.aliasesTicker[base]) || base;
  const candidato = baseCandidata + indice.sufijoMercado;
  try {
    await yahooFinance.quote(candidato);
    return candidato;
  } catch {
    return null;
  }
}

// Devuelve el top 10 de holdings del ETF de referencia del índice,
// con el ticker ya resuelto a la bolsa del índice cuando ha hecho
// falta (ver cabecera del fichero), listo para cruzar directamente
// con indice.tickers.
//
// Cada fila: { ticker, tickerOriginalEtf, nombre, porcentaje,
// enNuestraLista, notaBolsa }. "ticker" es el ya resuelto a la bolsa
// del índice si se pudo, o el original del ETF si no; "enNuestraLista"
// dice si ese ticker resuelto está en indice.tickers.
export async function obtenerHoldingsEtf(yahooFinance, indice) {
  if (!indice.etfReferencia) {
    throw new Error("Este índice no tiene un ETF de referencia con el que leer sus pesos.");
  }
  const resultado = await yahooFinance.quoteSummary(indice.etfReferencia, { modules: ["topHoldings"] });
  const holdingsBrutos = (resultado.topHoldings && resultado.topHoldings.holdings) || [];

  const holdings = [];
  for (const h of holdingsBrutos) {
    const fila = {
      ticker: h.symbol,
      tickerOriginalEtf: h.symbol,
      nombre: h.holdingName,
      porcentaje: Number((h.holdingPercent * 100).toFixed(2)),
      enNuestraLista: indice.tickers.includes(h.symbol),
      notaBolsa: null,
    };

    if (!fila.enNuestraLista && sufijoDe(h.symbol) !== indice.sufijoMercado.replace(".", "")) {
      const tickerEnBolsaIndice = await buscarEnBolsaDelIndice(yahooFinance, h.symbol, indice);
      if (tickerEnBolsaIndice) {
        fila.ticker = tickerEnBolsaIndice;
        fila.enNuestraLista = indice.tickers.includes(tickerEnBolsaIndice);
        fila.notaBolsa = `ETF incluye la de ${nombreBolsa(sufijoDe(h.symbol))}`;
      }
    }

    holdings.push(fila);
  }

  return holdings;
}
