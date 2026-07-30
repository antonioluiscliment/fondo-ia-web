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
  // ETF que replica el índice, usado solo en la comprobación de
  // componentes del grupo "Comprobaciones" (Yahoo Finance únicamente
  // expone el top 10 de holdings de un ETF, no la lista completa).
  etfReferencia: "DIA",
  // Sufijo de Yahoo Finance del mercado "propio" del índice. Los
  // tickers de EE. UU. no llevan sufijo. Se usa en la comprobación de
  // componentes vía ETF para distinguir un valor que de verdad no
  // está en la lista de otro que solo está listado por el ETF con el
  // sufijo de otra bolsa (p.ej. un valor triple-listado).
  sufijoMercado: "",
  // ETF(s) UCITS de distribución (no de acumulación) que replican el
  // índice, usados en "Análisis > Rentabilidad de los ETFs". Deben
  // ser de distribución porque el índice se calcula con las
  // cotizaciones ex-dividendo de sus componentes: un ETF de
  // distribución también cae en la fecha ex-dividendo (el dividendo
  // sale del fondo hacia el inversor), así que su cotización es
  // comparable a la del índice. Un ETF de acumulación reinvierte el
  // dividendo dentro del fondo y su cotización seguiría subiendo por
  // ello, dando una rentabilidad no comparable (artificialmente
  // mayor) frente al índice.
  etfsRentabilidad: [
    { ticker: "EXI3.DE", nombre: "iShares Dow Jones Industrial Average UCITS ETF (Dist)" },
    { ticker: "DJE.PA", nombre: "Amundi Dow Jones Industrial Average UCITS ETF Dist" },
  ],
  // ETFs del tipo "opuesto" (aquí, de acumulación): no son
  // directamente comparables con el índice por el motivo explicado
  // arriba, pero se muestran igualmente, distinguidos en la interfaz.
  etfsOpuestos: [{ ticker: "CIND.L", nombre: "iShares Dow Jones Industrial Average UCITS ETF (Acc)" }],
  tickers: [
    "MMM", "AXP", "AMGN", "AAPL", "AMZN", "BA", "CAT", "CVX", "CSCO", "KO",
    "DIS", "GS", "HD", "HON", "IBM", "JPM", "JNJ", "MCD", "MRK", "MSFT",
    "NKE", "NVDA", "PG", "CRM", "SHW", "TRV", "UNH", "GOOGL", "V", "WMT",
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
    HON: "Honeywell Technologies",
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
    GOOGL: "Alphabet (Google)",
    V: "Visa",
    WMT: "Walmart",
  },
};

export const IBEX35 = {
  id: "ibex35",
  nombre: { es: "IBEX 35 (España)", en: "IBEX 35 (Spain)" },
  abreviatura: "IBEX",
  simboloIndice: "^IBEX",
  etfReferencia: "LYXIB.MC", // Amundi (antes Lyxor) IBEX 35 UCITS ETF
  sufijoMercado: ".MC",
  etfsRentabilidad: [
    { ticker: "LYXIB.MC", nombre: "Amundi (Lyxor) IBEX 35 UCITS ETF Dist" },
    { ticker: "BBVAI.MC", nombre: "BBVA Acción IBEX 35 ETF Cotizado Armonizado" },
  ],
  etfsOpuestos: [{ ticker: "AMES.DE", nombre: "Amundi IBEX 35 UCITS ETF Acc" }],
  tickers: [
    "ANA.MC", "ANE.MC", "ACX.MC", "AENA.MC", "AMS.MC", "MTS.MC", "SAB.MC", "SAN.MC",
    "BKT.MC", "BBVA.MC", "CABK.MC", "CLNX.MC", "ENG.MC", "ELE.MC", "ACS.MC", "FER.MC",
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
    "ACS.MC": "ACS, Actividades de Construcción y Servicios",
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

export const CAC40 = {
  id: "cac40",
  nombre: { es: "CAC 40 (Francia)", en: "CAC 40 (France)" },
  abreviatura: "CAC",
  simboloIndice: "^FCHI",
  etfReferencia: "CAC.PA", // Amundi (antes Lyxor) CAC 40 UCITS ETF Dist, el mayor y más líquido
  sufijoMercado: ".PA",
  etfsRentabilidad: [
    { ticker: "CAC.PA", nombre: "Amundi (Lyxor) CAC 40 UCITS ETF Dist" },
    { ticker: "DX2G.DE", nombre: "Xtrackers CAC 40 UCITS ETF 1D (Dist)" },
  ],
  etfsOpuestos: [{ ticker: "CACC.PA", nombre: "Amundi CAC 40 UCITS ETF Acc" }],
  // Nota sobre Stellantis: el ticker de la lista original era "STLAM",
  // pero ese es el de la bolsa de Milán. El que realmente forma parte
  // del CAC 40 (Euronext Paris) es "STLAP".
  tickers: [
    "AC.PA", "AIR.PA", "AI.PA", "MT.PA", "CS.PA", "BNP.PA", "EN.PA", "BVI.PA",
    "CAP.PA", "CA.PA", "ACA.PA", "BN.PA", "DSY.PA", "FGR.PA", "ENGI.PA", "EL.PA",
    "ERF.PA", "ENX.PA", "RMS.PA", "KER.PA", "LR.PA", "OR.PA", "MC.PA", "ML.PA",
    "ORA.PA", "RI.PA", "PUB.PA", "RNO.PA", "SAF.PA", "SGO.PA", "SAN.PA", "SU.PA",
    "GLE.PA", "STLAP.PA", "STMPA.PA", "HO.PA", "TTE.PA", "URW.PA", "VIE.PA", "DG.PA",
  ],
  nombresEmpresas: {
    "AC.PA": "Accor",
    "AIR.PA": "Airbus",
    "AI.PA": "Air Liquide",
    "MT.PA": "ArcelorMittal",
    "CS.PA": "AXA",
    "BNP.PA": "BNP Paribas",
    "EN.PA": "Bouygues",
    "BVI.PA": "Bureau Veritas",
    "CAP.PA": "Capgemini",
    "CA.PA": "Carrefour",
    "ACA.PA": "Crédit Agricole",
    "BN.PA": "Danone",
    "DSY.PA": "Dassault Systèmes",
    "FGR.PA": "Eiffage",
    "ENGI.PA": "Engie",
    "EL.PA": "EssilorLuxottica",
    "ERF.PA": "Eurofins Scientific",
    "ENX.PA": "Euronext",
    "RMS.PA": "Hermès International",
    "KER.PA": "Kering",
    "LR.PA": "Legrand",
    "OR.PA": "L'Oréal",
    "MC.PA": "LVMH",
    "ML.PA": "Michelin",
    "ORA.PA": "Orange",
    "RI.PA": "Pernod Ricard",
    "PUB.PA": "Publicis Groupe",
    "RNO.PA": "Renault",
    "SAF.PA": "Safran",
    "SGO.PA": "Saint-Gobain",
    "SAN.PA": "Sanofi",
    "SU.PA": "Schneider Electric",
    "GLE.PA": "Société Générale",
    "STLAP.PA": "Stellantis",
    "STMPA.PA": "STMicroelectronics",
    "HO.PA": "Thales",
    "TTE.PA": "TotalEnergies",
    "URW.PA": "Unibail-Rodamco-Westfield",
    "VIE.PA": "Veolia Environnement",
    "DG.PA": "Vinci",
  },
};

export const PSI20 = {
  id: "psi20",
  nombre: { es: "PSI 20 (Portugal)", en: "PSI 20 (Portugal)" },
  abreviatura: "PSI",
  simboloIndice: "PSI20.LS", // en Yahoo Finance no lleva "^" delante, a diferencia de los demás
  // No hay, a fecha de esta investigación, ningún ETF UCITS activo que
  // replique el PSI 20: el único que existió (Lyxor PSI 20 (DR) UCITS
  // ETF, PPP.LS) se liquidó en abril de 2021 y no se ha localizado
  // ningún sustituto. Por eso este índice no tiene "etfReferencia" ni
  // "etfsRentabilidad" — las herramientas que dependen de un ETF lo
  // detectan y avisan en vez de fallar.
  etfReferencia: null,
  sufijoMercado: ".LS",
  etfsRentabilidad: [],
  etfsOpuestos: [],
  // Dos correcciones respecto a la lista original: Corticeira Amorim
  // es "COR" (no "CORA") y Mota-Engil es "EGL" (no "MOTA") en Yahoo
  // Finance / Euronext Lisboa. Los alias "ALSS" (Altri), "YSO" (Sonae)
  // y "NVGR" (Navigator) son tickers antiguos, ya no vigentes.
  tickers: [
    "ALTR.LS", "BCP.LS", "COR.LS", "CTT.LS", "EDP.LS", "EDPR.LS", "GALP.LS", "IBS.LS",
    "JMT.LS", "EGL.LS", "NOS.LS", "RENE.LS", "SEM.LS", "SON.LS", "TDSA.LS", "NVG.LS",
  ],
  nombresEmpresas: {
    "ALTR.LS": "Altri SGPS",
    "BCP.LS": "Banco Comercial Português",
    "COR.LS": "Corticeira Amorim",
    "CTT.LS": "CTT Correios de Portugal",
    "EDP.LS": "EDP (Energias de Portugal)",
    "EDPR.LS": "EDP Renováveis",
    "GALP.LS": "Galp Energia",
    "IBS.LS": "Ibersol",
    "JMT.LS": "Jerónimo Martins",
    "EGL.LS": "Mota-Engil",
    "NOS.LS": "NOS SGPS",
    "RENE.LS": "REN (Redes Energéticas Nacionais)",
    "SEM.LS": "Semapa",
    "SON.LS": "Sonae",
    "TDSA.LS": "Teixeira Duarte",
    "NVG.LS": "The Navigator Company",
  },
};

export const DAX = {
  id: "dax",
  nombre: { es: "DAX (Alemania)", en: "DAX (Germany)" },
  abreviatura: "DAX",
  simboloIndice: "^GDAXI",
  sufijoMercado: ".DE",
  // OJO — el DAX es la excepción entre los índices de este catálogo:
  // a diferencia del Dow Jones, IBEX, CAC o PSI (todos índices "de
  // precio", donde los dividendos no se reinvierten en el nivel del
  // índice), el DAX se calcula oficialmente como índice de
  // RENTABILIDAD TOTAL: los dividendos de sus componentes se
  // reinvierten dentro del propio cálculo del índice. Por eso aquí se
  // necesita justo lo contrario que en los demás índices: un ETF de
  // ACUMULACIÓN (no de distribución), para que su cotización sea
  // comparable a la del índice. Con un ETF de distribución, el DAX
  // parecería sistemáticamente "mejor" que cualquier ETF solo por la
  // forma de calcularse, no por el criterio de selección.
  etfReferencia: "EXS1.DE", // iShares Core DAX UCITS ETF (DE) (Acc), el mayor y más líquido
  etfsRentabilidad: [
    { ticker: "EXS1.DE", nombre: "iShares Core DAX UCITS ETF (DE) (Acc)" },
    { ticker: "DBXD.DE", nombre: "Xtrackers DAX UCITS ETF 1C (Acc)" },
  ],
  etfsOpuestos: [{ ticker: "EL4F.DE", nombre: "Deka DAX (ausschüttend) UCITS ETF (Dist)" }],
  tickers: [
    "ADS.DE", "AIR.DE", "ALV.DE", "BAS.DE", "BAYN.DE", "BEI.DE", "BMW.DE", "BNR.DE",
    "CBK.DE", "CON.DE", "DTG.DE", "DBK.DE", "DB1.DE", "DHL.DE", "DTE.DE", "EOAN.DE",
    "FRE.DE", "FME.DE", "HNR1.DE", "HEI.DE", "HEN3.DE", "IFX.DE", "MBG.DE", "MRK.DE",
    "MTX.DE", "MUV2.DE", "P911.DE", "PAH3.DE", "QIA.DE", "RHM.DE", "RWE.DE", "SAP.DE",
    "SRT3.DE", "SIE.DE", "ENR.DE", "SHL.DE", "SY1.DE", "VOW3.DE", "VNA.DE", "ZAL.DE",
  ],
  nombresEmpresas: {
    "ADS.DE": "Adidas",
    "AIR.DE": "Airbus",
    "ALV.DE": "Allianz",
    "BAS.DE": "BASF",
    "BAYN.DE": "Bayer",
    "BEI.DE": "Beiersdorf",
    "BMW.DE": "BMW",
    "BNR.DE": "Brenntag",
    "CBK.DE": "Commerzbank",
    "CON.DE": "Continental",
    "DTG.DE": "Daimler Truck",
    "DBK.DE": "Deutsche Bank",
    "DB1.DE": "Deutsche Börse",
    "DHL.DE": "Deutsche Post (DHL Group)",
    "DTE.DE": "Deutsche Telekom",
    "EOAN.DE": "E.ON",
    "FRE.DE": "Fresenius",
    "FME.DE": "Fresenius Medical Care",
    "HNR1.DE": "Hannover Rück",
    "HEI.DE": "Heidelberg Materials",
    "HEN3.DE": "Henkel (acciones preferentes)",
    "IFX.DE": "Infineon Technologies",
    "MBG.DE": "Mercedes-Benz Group",
    "MRK.DE": "Merck",
    "MTX.DE": "MTU Aero Engines",
    "MUV2.DE": "Munich Re",
    "P911.DE": "Porsche AG",
    "PAH3.DE": "Porsche Automobil Holding",
    "QIA.DE": "Qiagen",
    "RHM.DE": "Rheinmetall",
    "RWE.DE": "RWE",
    "SAP.DE": "SAP",
    "SRT3.DE": "Sartorius (acciones preferentes)",
    "SIE.DE": "Siemens",
    "ENR.DE": "Siemens Energy",
    "SHL.DE": "Siemens Healthineers",
    "SY1.DE": "Symrise",
    "VOW3.DE": "Volkswagen (acciones preferentes)",
    "VNA.DE": "Vonovia",
    "ZAL.DE": "Zalando",
  },
};

export const AEX = {
  id: "aex",
  nombre: { es: "AEX (Países Bajos)", en: "AEX (Netherlands)" },
  abreviatura: "AEX",
  simboloIndice: "^AEX",
  sufijoMercado: ".AS",
  etfReferencia: "TDT.AS", // VanEck AEX UCITS ETF Dist, el mayor y más establecido
  etfsRentabilidad: [
    { ticker: "TDT.AS", nombre: "VanEck AEX UCITS ETF Dist" },
    { ticker: "IAEX.AS", nombre: "iShares AEX UCITS ETF (Dist)" },
  ],
  etfsOpuestos: [{ ticker: "IAEA.AS", nombre: "iShares AEX UCITS ETF EUR (Acc)" }],
  // Dos exclusiones respecto a la lista original: Stellantis y
  // STMicroelectronics están incorporadas en los Países Bajos, pero
  // NINGUNA de las dos cotiza en Euronext Ámsterdam — Stellantis
  // cotiza en NYSE, Milán y París; STMicroelectronics en París, NYSE
  // y Milán. Al no tener ticker en Ámsterdam, no pueden formar parte
  // del AEX (que por definición son valores negociados en esa bolsa),
  // así que no están en esta lista aunque aparecían en la tabla
  // original. Ambas ya están recogidas donde sí cotizan: Stellantis y
  // STMicroelectronics en CAC40 (París); STMicroelectronics también
  // en FTSE MIB (Milán).
  //
  // Dos añadidos detectados vía "Comprobación de componentes vía
  // ETF" (no estaban en la tabla original): ABN AMRO y Shell — Shell
  // sigue teniendo una segunda cotización en Ámsterdam pese a que su
  // cotización principal se trasladó a Londres en la unificación de
  // 2022, y sigue formando parte del AEX.
  //
  // Alias: algunos valores usan un mnemónico distinto en cada bolsa
  // (no solo cambia el sufijo). "Comprobación de componentes vía ETF"
  // no puede resolverlos con la regla genérica de "mismo ticker,
  // sufijo distinto", así que se listan aquí explícitamente:
  // mnemónico visto en otra bolsa -> mnemónico usado en Ámsterdam.
  aliasesTicker: {
    ULVR: "UNA", // Unilever: Londres usa "ULVR", Ámsterdam usa "UNA"
    SHEL: "SHELL", // Shell: NYSE/Londres usan "SHEL", Ámsterdam usa "SHELL"
  },
  tickers: [
    "AGN.AS", "AD.AS", "ADYEN.AS", "AKZA.AS", "MT.AS", "ASML.AS", "ASM.AS", "ASRNL.AS",
    "DSFIR.AS", "REL.AS", "EXO.AS", "HEIA.AS", "IMCD.AS", "INGA.AS", "KPN.AS", "NN.AS",
    "PRX.AS", "RAND.AS", "UMG.AS", "UNA.AS", "WKL.AS", "ABN.AS", "SHELL.AS",
  ],
  nombresEmpresas: {
    "AGN.AS": "Aegon",
    "AD.AS": "Ahold Delhaize",
    "ADYEN.AS": "Adyen",
    "AKZA.AS": "AkzoNobel",
    "MT.AS": "ArcelorMittal",
    "ASML.AS": "ASML Holding",
    "ASM.AS": "ASM International",
    "ASRNL.AS": "ASR Nederland",
    "DSFIR.AS": "DSM-Firmenich",
    "REL.AS": "Elsevier (RELX)",
    "EXO.AS": "Exor",
    "HEIA.AS": "Heineken",
    "IMCD.AS": "IMCD",
    "INGA.AS": "ING Group",
    "KPN.AS": "KPN",
    "NN.AS": "NN Group",
    "PRX.AS": "Prosus",
    "RAND.AS": "Randstad",
    "UMG.AS": "Universal Music Group",
    "UNA.AS": "Unilever",
    "WKL.AS": "Wolters Kluwer",
    "ABN.AS": "ABN AMRO",
    "SHELL.AS": "Shell",
  },
};

export const FTSE_MIB = {
  id: "ftsemib",
  nombre: { es: "FTSE MIB (Italia)", en: "FTSE MIB (Italy)" },
  abreviatura: "MIB",
  simboloIndice: "FTSEMIB.MI",
  sufijoMercado: ".MI",
  etfReferencia: "ETFMIB.MI", // Amundi (antes Lyxor) FTSE MIB UCITS ETF Dist, el mayor y más líquido
  etfsRentabilidad: [{ ticker: "ETFMIB.MI", nombre: "Amundi (Lyxor) FTSE MIB UCITS ETF Dist" }],
  etfsOpuestos: [{ ticker: "SXRY.DE", nombre: "iShares FTSE MIB UCITS ETF EUR (Acc)" }],
  // STMicroelectronics en Milán es "STMMI" (confirmado en Yahoo
  // Finance), no "STMPA" (esa es la de París, ya usada en CAC40).
  // Generali se añadió tras detectarse su ausencia (5.54% de peso)
  // en "Comprobación de componentes vía ETF"; no estaba en la tabla
  // original.
  //
  // Alias: STMicroelectronics usa un mnemónico distinto en cada
  // bolsa ("STMPA" en París, "STMMI" en Milán). La comprobación de
  // componentes vía ETF no puede resolverlo con la regla genérica de
  // "mismo ticker, sufijo distinto", así que se indica aquí de forma
  // explícita.
  aliasesTicker: {
    STMPA: "STMMI",
  },
  tickers: [
    "A2A.MI", "AMP.MI", "AZM.MI", "BMPS.MI", "BPSO.MI", "BAMI.MI", "BPE.MI", "BC.MI",
    "CPR.MI", "DIAS.MI", "ENEL.MI", "ENI.MI", "ERG.MI", "FBK.MI", "RACE.MI", "GVS.MI",
    "HER.MI", "IP.MI", "ISP.MI", "IG.MI", "LDO.MI", "MB.MI", "MONC.MI", "NEXI.MI",
    "PIRC.MI", "PST.MI", "PRY.MI", "REC.MI", "SPM.MI", "SRG.MI", "STLAM.MI", "STMMI.MI",
    "TIT.MI", "TEN.MI", "TRN.MI", "UCG.MI", "UNI.MI", "G.MI",
  ],
  nombresEmpresas: {
    "A2A.MI": "A2A",
    "AMP.MI": "Amplifon",
    "AZM.MI": "Azimut Holding",
    "BMPS.MI": "Banca Monte dei Paschi di Siena",
    "BPSO.MI": "Banca Popolare di Sondrio",
    "BAMI.MI": "Banco BPM",
    "BPE.MI": "BPER Banca",
    "BC.MI": "Brunello Cucinelli",
    "CPR.MI": "Campari",
    "DIAS.MI": "Diasorin",
    "ENEL.MI": "Enel",
    "ENI.MI": "Eni",
    "ERG.MI": "ERG",
    "FBK.MI": "FinecoBank",
    "RACE.MI": "Ferrari",
    "GVS.MI": "GVS",
    "HER.MI": "Hera",
    "IP.MI": "Interpump Group",
    "ISP.MI": "Intesa Sanpaolo",
    "IG.MI": "Italgas",
    "LDO.MI": "Leonardo",
    "MB.MI": "Mediobanca",
    "MONC.MI": "Moncler",
    "NEXI.MI": "Nexi",
    "PIRC.MI": "Pirelli & C.",
    "PST.MI": "Poste Italiane",
    "PRY.MI": "Prysmian",
    "REC.MI": "Recordati",
    "SPM.MI": "Saipem",
    "SRG.MI": "Snam",
    "STLAM.MI": "Stellantis",
    "STMMI.MI": "STMicroelectronics",
    "TIT.MI": "Telecom Italia (TIM)",
    "TEN.MI": "Tenaris",
    "TRN.MI": "Terna",
    "UCG.MI": "UniCredit",
    "UNI.MI": "Unipol",
    "G.MI": "Generali",
  },
};

export const NASDAQ100 = {
  id: "nasdaq100",
  nombre: { es: "Nasdaq 100 (EE. UU.)", en: "Nasdaq 100 (US)" },
  abreviatura: "NDX",
  simboloIndice: "^NDX",
  sufijoMercado: "", // mercado estadounidense, como el Dow Jones: sin sufijo
  etfReferencia: "EQQQ.L", // Invesco EQQQ NASDAQ-100 UCITS ETF Dist, el histórico y más conocido
  etfsRentabilidad: [{ ticker: "EQQQ.L", nombre: "Invesco EQQQ NASDAQ-100 UCITS ETF Dist" }],
  etfsOpuestos: [{ ticker: "CNDX.L", nombre: "iShares Nasdaq 100 UCITS ETF (Acc)" }],
  // La tabla original traía "INTC" repetido dos veces (probablemente
  // un desplazamiento de fila al copiar); se ha dejado una sola vez.
  // Ferrovial (FER) es real y está bien: se incorporó al Nasdaq-100 el
  // 22 de diciembre de 2025, la primera empresa del IBEX 35 en
  // cotizar ahí — comprobado, no es un error de la lista.
  tickers: [
    "AAPL", "ABNB", "ADBE", "ADI", "ADP", "ADSK", "AEP", "ALAB", "ALNY", "AMAT",
    "AMD", "AMGN", "AMZN", "APP", "ARM", "ASML", "AVGO", "AXON", "BKNG", "BKR",
    "CCEP", "CDNS", "CEG", "CMCSA", "COST", "CPRT", "CRWD", "CRWV", "CSCO", "CSGP",
    "CSX", "CTAS", "DASH", "DDOG", "DXCM", "EA", "EXC", "FANG", "FAST", "FER",
    "FTNT", "GEHC", "GILD", "GOOG", "GOOGL", "HON", "IDXX", "INTC", "INTU", "ISRG",
    "KDP", "KHC", "KLAC", "LIN", "LRCX", "MAR", "MCHP", "MDLZ", "MELI", "META",
    "MNST", "MPWR", "MRVL", "MSFT", "MSTR", "MU", "NBIS", "NFLX", "NVDA", "NXPI",
    "ODFL", "ORLY", "PANW", "PAYX", "PCAR", "PDD", "PEP", "PLTR", "PYPL", "QCOM",
    "REGN", "RKLB", "ROP", "ROST", "SBUX", "SHOP", "SNPS", "STX", "TEAM", "TER",
    "TMUS", "TRI", "TSLA", "TTWO", "TXN", "VRTX", "WBD", "WDAY", "WDC", "WMT", "XEL",
  ],
  nombresEmpresas: {
    AAPL: "Apple",
    ABNB: "Airbnb",
    ADBE: "Adobe",
    ADI: "Analog Devices",
    ADP: "Automatic Data Processing",
    ADSK: "Autodesk",
    AEP: "American Electric Power",
    ALAB: "Astera Labs",
    ALNY: "Alnylam Pharmaceuticals",
    AMAT: "Applied Materials",
    AMD: "Advanced Micro Devices",
    AMGN: "Amgen",
    AMZN: "Amazon",
    APP: "AppLovin",
    ARM: "Arm Holdings",
    ASML: "ASML Holding",
    AVGO: "Broadcom",
    AXON: "Axon Enterprise",
    BKNG: "Booking Holdings",
    BKR: "Baker Hughes",
    CCEP: "Coca-Cola Europacific Partners",
    CDNS: "Cadence Design Systems",
    CEG: "Constellation Energy",
    CMCSA: "Comcast",
    COST: "Costco Wholesale",
    CPRT: "Copart",
    CRWD: "CrowdStrike Holdings",
    CRWV: "CoreWeave",
    CSCO: "Cisco Systems",
    CSGP: "CoStar Group",
    CSX: "CSX",
    CTAS: "Cintas",
    DASH: "DoorDash",
    DDOG: "Datadog",
    DXCM: "DexCom",
    EA: "Electronic Arts",
    EXC: "Exelon",
    FANG: "Diamondback Energy",
    FAST: "Fastenal",
    FER: "Ferrovial",
    FTNT: "Fortinet",
    GEHC: "GE HealthCare Technologies",
    GILD: "Gilead Sciences",
    GOOG: "Alphabet (clase C)",
    GOOGL: "Alphabet (clase A)",
    HON: "Honeywell International",
    IDXX: "IDEXX Laboratories",
    INTC: "Intel",
    INTU: "Intuit",
    ISRG: "Intuitive Surgical",
    KDP: "Keurig Dr Pepper",
    KHC: "The Kraft Heinz Company",
    KLAC: "KLA",
    LIN: "Linde",
    LRCX: "Lam Research",
    MAR: "Marriott International",
    MCHP: "Microchip Technology",
    MDLZ: "Mondelez International",
    MELI: "MercadoLibre",
    META: "Meta Platforms",
    MNST: "Monster Beverage",
    MPWR: "Monolithic Power Systems",
    MRVL: "Marvell Technology",
    MSFT: "Microsoft",
    MSTR: "MicroStrategy (Strategy)",
    MU: "Micron Technology",
    NBIS: "Nebius Group",
    NFLX: "Netflix",
    NVDA: "NVIDIA",
    NXPI: "NXP Semiconductors",
    ODFL: "Old Dominion Freight Line",
    ORLY: "O'Reilly Automotive",
    PANW: "Palo Alto Networks",
    PAYX: "Paychex",
    PCAR: "PACCAR",
    PDD: "PDD Holdings",
    PEP: "PepsiCo",
    PLTR: "Palantir Technologies",
    PYPL: "PayPal Holdings",
    QCOM: "QUALCOMM",
    REGN: "Regeneron Pharmaceuticals",
    RKLB: "Rocket Lab",
    ROP: "Roper Technologies",
    ROST: "Ross Stores",
    SBUX: "Starbucks",
    SHOP: "Shopify",
    SNPS: "Synopsys",
    STX: "Seagate Technology",
    TEAM: "Atlassian",
    TER: "Teradyne",
    TMUS: "T-Mobile US",
    TRI: "Thomson Reuters",
    TSLA: "Tesla",
    TTWO: "Take-Two Interactive Software",
    TXN: "Texas Instruments",
    VRTX: "Vertex Pharmaceuticals",
    WBD: "Warner Bros. Discovery",
    WDAY: "Workday",
    WDC: "Western Digital",
    WMT: "Walmart",
    XEL: "Xcel Energy",
  },
};

export const ARGENTINA_ADR = {
  id: "argentinaadr",
  nombre: { es: "S&P Argentina ADR", en: "S&P Argentina ADR" },
  abreviatura: "ARG",
  simboloIndice: "^BKART", // S&P Argentina ADR Index (USD) — no el S&P MERVAL en pesos de Buenos Aires
  sufijoMercado: "", // ADRs cotizados en NYSE/Nasdaq, como el Dow Jones o el Nasdaq 100: sin sufijo
  // Primer índice de una serie "parcial": mercados donde un inversor
  // minorista de EE. UU./Europa solo puede acceder, en la práctica, a
  // un puñado de valores vía ADR (American Depositary Receipt),
  // cotizados en dólares en Nueva York — no al índice local completo.
  // Este aviso se muestra en el marco exterior mientras este índice
  // esté seleccionado, para que quede claro que no es una réplica
  // completa del S&P MERVAL de Buenos Aires (que cotiza en pesos
  // argentinos y tiene más componentes).
  advertencia: {
    es: "Este índice solo sigue una selección parcial de valores argentinos, los accesibles para un inversor de EE. UU./Europa a través de sus ADR (American Depositary Receipt) cotizados en dólares en Nueva York — no el S&P MERVAL completo de la bolsa de Buenos Aires, que cotiza en pesos argentinos y tiene más componentes.",
    en: "This index only tracks a partial selection of Argentine stocks — the ones a US/European retail investor can access via their ADR (American Depositary Receipt), traded in US dollars in New York — not the full S&P MERVAL from the Buenos Aires exchange, which trades in Argentine pesos and has more components.",
  },
  // No se ha encontrado ningún ETF UCITS que replique este universo
  // concreto de ADRs argentinos (es un caso muy de nicho); por eso,
  // igual que con el PSI 20, no hay ETF de referencia.
  etfReferencia: null,
  etfsRentabilidad: [],
  etfsOpuestos: [],
  tickers: [
    "YPF", "GGAL", "SUPV", "CRESY", "BBAR", "LOMA", "PAM", "CEPU",
    "TEO", "BMA", "TGS", "IRS", "BIOX", "EDN",
  ],
  nombresEmpresas: {
    YPF: "YPF",
    GGAL: "Grupo Financiero Galicia",
    SUPV: "Grupo Supervielle",
    CRESY: "Cresud",
    BBAR: "Banco BBVA Argentina",
    LOMA: "Loma Negra",
    PAM: "Pampa Energía",
    CEPU: "Central Puerto",
    TEO: "Telecom Argentina",
    BMA: "Banco Macro",
    TGS: "Transportadora de Gas del Sur",
    IRS: "IRSA Inversiones y Representaciones",
    BIOX: "Bioceres Crop Solutions",
    EDN: "Edenor (Empresa Distribuidora y Comercializadora Norte)",
  },
};

export const INDICES = [DOW_JONES, IBEX35, CAC40, PSI20, DAX, AEX, FTSE_MIB, NASDAQ100, ARGENTINA_ADR];
export const INDICE_DEFECTO = DOW_JONES.id;

// Comprueba que "tickers" y "nombresEmpresas" están sincronizados: un
// ticker sin nombre haría que la interfaz muestre "undefined" junto
// al ticker (mensaje confuso), y un nombre "huérfano" (de un ticker
// que ya no está en la lista, como pasó con FCC.MC al sustituirlo por
// ACS.MC) es una señal de que la lista se editó a medias. Se ejecuta
// una sola vez, al cargar este módulo, así que cualquier desajuste
// futuro se detecta enseguida (rompe el arranque en local; en
// Vercel, el build) en vez de descubrirse mirando la pantalla.
function validarIndice(indice) {
  const problemas = [];

  const tickersUnicos = new Set(indice.tickers);
  if (tickersUnicos.size !== indice.tickers.length) {
    problemas.push("hay tickers duplicados en 'tickers'");
  }

  const sinNombre = indice.tickers.filter((tk) => !(tk in indice.nombresEmpresas));
  if (sinNombre.length > 0) {
    problemas.push(`tickers sin nombre en 'nombresEmpresas': ${sinNombre.join(", ")}`);
  }

  const nombresTickers = Object.keys(indice.nombresEmpresas);
  const huerfanos = nombresTickers.filter((tk) => !tickersUnicos.has(tk));
  if (huerfanos.length > 0) {
    problemas.push(`nombres en 'nombresEmpresas' de tickers que ya no están en 'tickers': ${huerfanos.join(", ")}`);
  }

  if (problemas.length > 0) {
    throw new Error(
      `lib/indices.js: el índice '${indice.id}' tiene 'tickers' y 'nombresEmpresas' desincronizados — ${problemas.join("; ")}.`
    );
  }
}

for (const indice of INDICES) {
  validarIndice(indice);
}

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
