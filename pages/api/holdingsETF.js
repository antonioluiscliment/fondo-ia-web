// pages/api/holdingsETF.js
//
// Herramienta de comprobación (grupo "Comprobaciones"): consulta en
// Yahoo Finance el top 10 de holdings del ETF que replica el índice
// elegido (por ejemplo DIA para el Dow Jones, o LYXIB.MC para el
// IBEX 35) y lo compara con la lista de componentes que tenemos en
// lib/indices.js — para poder detectar a simple vista si algún peso
// pesado se nos ha quedado desactualizado.
//
// OJO: Yahoo Finance solo expone el top 10 de holdings de un ETF a
// través de este módulo, nunca la lista completa. Esto sirve como
// comprobación parcial (los valores con más peso), no como sustituto
// de revisar la composición oficial completa del índice.
//
// Algunos valores cotizan en varias bolsas a la vez (p.ej. Ferrovial
// en Ámsterdam, España y Nasdaq), y el ETF puede reportar el holding
// con el sufijo de una bolsa distinta a la "propia" del índice (nuestra
// lista siempre usa la bolsa del índice: sin sufijo para el Dow Jones,
// ".MC" para el IBEX 35). Sin este ajuste, esos casos saldrían siempre
// como "falta", aunque el valor sí esté en la lista con el ticker de
// la bolsa correcta. Antes de dar el mensaje de "falta", se comprueba:
//   1. ¿El ticker que da el ETF tiene un sufijo de bolsa distinto al
//      del índice?
//   2. ¿El propio índice tiene un alias manual para ese mnemónico
//      concreto (indice.aliasesTicker)? Hace falta para casos como
//      Unilever (Londres: "ULVR", Ámsterdam: "UNA") o STMicroelectronics
//      (París: "STMPA", Milán: "STMMI"), donde no solo cambia el
//      sufijo de bolsa sino el propio mnemónico — la regla genérica
//      de "mismo ticker, sufijo distinto" no puede resolverlos sola.
//   3. Si no hay alias, se prueba con la regla genérica: mismo
//      mnemónico, sufijo de la bolsa del índice.
//   4. El candidato que salga de 2 o 3 se comprueba con una consulta
//      real a Yahoo Finance (no solo se supone), y si existe, se
//      busca ESE ticker en nuestro array, en vez del que dio el ETF.
// Solo si tras estos pasos sigue sin aparecer, se marca como falta de
// verdad.
//
// Parámetros de la query:
//   indice - id del índice a comprobar (dowjones, ibex35, ...).

import { getYahooFinanceInstance, mensajeErrorAmigable } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

// Nombres legibles de los sufijos de bolsa más habituales en Yahoo
// Finance, solo para el mensaje; si no está en esta lista se muestra
// el sufijo tal cual.
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

function nombreBolsa(sufijo) {
  return NOMBRES_BOLSA[sufijo] || sufijo;
}

// Para un holding del ETF que cotiza en una bolsa distinta a la del
// índice, comprueba si ese mismo valor existe también en la bolsa del
// índice, y si es así, devuelve su ticker allí. Usa primero el alias
// manual del índice (si lo tiene para ese mnemónico); si no, prueba
// con la regla genérica de mismo mnemónico y sufijo de la bolsa del
// índice. Si ninguno existe (o la consulta falla), devuelve null.
async function buscarEnBolsaDelIndice(tickerEtf, indice) {
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

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    if (!indice.etfReferencia) {
      throw new Error("No encontré ETFs con los requisitos UCITS de distribución.");
    }
    const resultado = await yahooFinance.quoteSummary(indice.etfReferencia, { modules: ["topHoldings"] });
    const holdingsBrutos = (resultado.topHoldings && resultado.topHoldings.holdings) || [];

    const holdings = [];
    for (const h of holdingsBrutos) {
      const fila = {
        ticker: h.symbol,
        nombre: h.holdingName,
        porcentaje: Number((h.holdingPercent * 100).toFixed(2)),
        enNuestraLista: indice.tickers.includes(h.symbol),
        notaBolsa: null,
      };

      if (!fila.enNuestraLista && sufijoDe(h.symbol) !== indice.sufijoMercado.replace(".", "")) {
        const tickerEnBolsaIndice = await buscarEnBolsaDelIndice(h.symbol, indice);
        if (tickerEnBolsaIndice) {
          fila.enNuestraLista = indice.tickers.includes(tickerEnBolsaIndice);
          fila.notaBolsa = `ETF incluye la de ${nombreBolsa(sufijoDe(h.symbol))}`;
        }
      }

      holdings.push(fila);
    }

    res.status(200).json({
      indice: indice.id,
      etfReferencia: indice.etfReferencia,
      holdings,
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
