// lib/indices.js
//
// Catálogo de índices que la aplicación puede analizar. Cada entrada
// define:
//  - id: identificador usado en la URL (?indice=...) y en el estado.
//  - nombre: nombre a mostrar, en es/en.
//  - abreviatura: forma corta para las tablas de resultados (p.ej. "DJ").
//  - simboloIndice: símbolo de Yahoo Finance del índice de referencia,
//    usado para comparar la rentabilidad del modelo con la de "comprar
//    y mantener el índice".
//  - tickers: símbolos de Yahoo Finance de los componentes (algunos
//    mercados los necesitan con sufijo, p.ej. ".MC" para la Bolsa de
//    Madrid; los tickers de EE. UU. no llevan sufijo).
//  - nombresEmpresas: nombre completo de cada componente, por ticker.
//    No se traduce (son nombres propios), igual que antes.
//
// Añadir un índice nuevo consiste en añadir aquí una entrada más a
// INDICES: el resto de la aplicación (backend y frontend) ya es
// genérico y no necesita más cambios.

export const DOW_JONES = {
  id: "dowjones",
  nombre: { es: "Dow Jones (EE. UU.)", en: "Dow Jones (US)" },
  abreviatura: "DJ",
  simboloIndice: "^DJI",
  tickers: [
    "MMM", "AXP", "AMGN", "AAPL", "AMZN", "BA", "CAT", "CVX", "CSCO", "KO",
    "DIS", "GS", "HD", "HON", "IBM", "JPM", "JNJ", "MCD", "MRK", "MSFT",
    "NKE", "NVDA", "PG", "CRM", "SHW", "TRV", "UNH", "VZ", "V", "WMT",
  ],
  nombresEmpresas: {
    MMM: "3M",
    AXP: "American Express",
    AMGN: "Amgen",
    AAPL: "Apple",
    AMZN: "Amazon",
    BA: "Boeing",
    CAT: "Caterpillar",
    CVX: "Chevron",
    CSCO: "Cisco",
    KO: "Coca-Cola",
    DIS: "Disney",
    GS: "Goldman Sachs",
    HD: "Home Depot",
    HON: "Honeywell",
    IBM: "IBM",
    JPM: "JPMorgan Chase",
    JNJ: "Johnson & Johnson",
    MCD: "McDonald's",
    MRK: "Merck",
    MSFT: "Microsoft",
    NKE: "Nike",
    NVDA: "Nvidia",
    PG: "Procter & Gamble",
    CRM: "Salesforce",
    SHW: "Sherwin-Williams",
    TRV: "Travelers",
    UNH: "UnitedHealth",
    VZ: "Verizon",
    V: "Visa",
    WMT: "Walmart",
  },
};

export const IBEX35 = {
  id: "ibex35",
  nombre: { es: "IBEX 35 (España)", en: "IBEX 35 (Spain)" },
  abreviatura: "IBEX",
  simboloIndice: "^IBEX",
  tickers: [
    "ANA.MC", "ANE.MC", "ACX.MC", "AENA.MC", "AMS.MC", "MTS.MC", "SAB.MC", "SAN.MC",
    "BKT.MC", "BBVA.MC", "CABK.MC", "CLNX.MC", "ENG.MC", "ELE.MC", "FCC.MC", "FER.MC",
    "FDR.MC", "GRF.MC", "IAG.MC", "IBE.MC", "ITX.MC", "IDR.MC", "COL.MC", "LOG.MC",
    "MAP.MC", "MEL.MC", "MRL.MC", "PUIG.MC", "RED.MC", "REP.MC", "ROVI.MC", "SCYR.MC",
    "SLR.MC", "TEF.MC", "UNI.MC",
  ],
  nombresEmpresas: {
    "ANA.MC": "Acciona",
    "ANE.MC": "Acciona Energía",
    "ACX.MC": "Acerinox",
    "AENA.MC": "Aena",
    "AMS.MC": "Amadeus IT Group",
    "MTS.MC": "ArcelorMittal",
    "SAB.MC": "Banco de Sabadell",
    "SAN.MC": "Banco Santander",
    "BKT.MC": "Bankinter",
    "BBVA.MC": "BBVA",
    "CABK.MC": "CaixaBank",
    "CLNX.MC": "Cellnex Telecom",
    "ENG.MC": "Enagás",
    "ELE.MC": "Endesa",
    "FCC.MC": "FCC",
    "FER.MC": "Ferrovial",
    "FDR.MC": "Fluidra",
    "GRF.MC": "Grifols",
    "IAG.MC": "IAG (International Airlines Group)",
    "IBE.MC": "Iberdrola",
    "ITX.MC": "Inditex",
    "IDR.MC": "Indra Sistemas",
    "COL.MC": "Inmobiliaria Colonial",
    "LOG.MC": "Logista",
    "MAP.MC": "Mapfre",
    "MEL.MC": "Meliá Hotels International",
    "MRL.MC": "Merlin Properties",
    "PUIG.MC": "Puig Brands",
    "RED.MC": "Redeia (Red Eléctrica)",
    "REP.MC": "Repsol",
    "ROVI.MC": "Laboratorios Rovi",
    "SCYR.MC": "Sacyr",
    "SLR.MC": "Solaria Energía",
    "TEF.MC": "Telefónica",
    "UNI.MC": "Unicaja Banco",
  },
};

export const INDICES = [DOW_JONES, IBEX35];
export const INDICE_DEFECTO = DOW_JONES.id;

export function obtenerIndice(id) {
  return INDICES.find((i) => i.id === id) || INDICES.find((i) => i.id === INDICE_DEFECTO);
}

// Quita el sufijo de mercado del ticker (p.ej. "ANA.MC" -> "ANA"), solo
// para mostrarlo en pantalla; el ticker completo (con sufijo si lo
// lleva) es siempre el que se usa para pedir datos a Yahoo Finance.
export function tickerVisible(ticker) {
  const i = ticker.lastIndexOf(".");
  return i > 0 ? ticker.slice(0, i) : ticker;
}
