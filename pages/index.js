import { useState } from "react";

// Composición actual de los 30 componentes del Dow Jones.
const TICKERS = [
  "MMM", "AXP", "AMGN", "AAPL", "AMZN", "BA", "CAT", "CVX", "CSCO", "KO",
  "DIS", "GS", "HD", "HON", "IBM", "JPM", "JNJ", "MCD", "MRK", "MSFT",
  "NKE", "NVDA", "PG", "CRM", "SHW", "TRV", "UNH", "VZ", "V", "WMT",
];

// Nombre completo de cada empresa; en el selector solo se muestran los
// 25 primeros caracteres, para ayudar a identificar el ticker. Los
// nombres de empresa no se traducen (son nombres propios).
const NOMBRES = {
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
};

const FACTOR_PENALIZACION_DEFECTO_DISPLAY = 2;

// --- Diccionario de traducciones -----------------------------------
// Todas las cadenas de la interfaz, en español e inglés. Los
// documentos de especificaciones y observaciones (.docx) NO se
// traducen aquí: siguen mostrándose siempre en español, tal como
// están redactados en el repositorio.
const T = {
  es: {
    titulo: "Fondo IA — Dow Jones",
    idiomaEtiqueta: "Idioma:",

    especificacionesCargando: "Cargando...",
    especificacionesOcultar: "Ocultar especificaciones",
    especificacionesMostrar: "¿Qué hace esta aplicación?",
    observacionesOcultar: "Ocultar observaciones",
    observacionesMostrar: "Observaciones",
    historiaOcultar: "Ocultar historia",
    historiaMostrar: "Historia",
    error: "Error",

    comprobacionTitulo: "Comprobación de un valor",
    comprobacionDesc: "Elige un ticker y calcula la variación porcentual del valor entre sus últimos 20 cierres diarios.",
    consultando: "Consultando...",
    calcular: "Calcular",
    ultimosCierres: (ticker, n) => `${ticker} — últimos ${n} cierres`,
    colFecha: "Fecha",
    colIncremento: "Incremento",
    colVolumen: "Volumen",
    colVxP: "V x P",
    colVariacionVxP: "Variación",

    puntuacionesTitulo: "Puntuaciones de una sesión concreta",
    puntuacionesDesc: "Herramienta de auditoría: elige un número de sesión dentro de la ventana descargada y comprueba la puntuación (suma de los incrementos de esa sesión y las 2 anteriores) de los 30 componentes en esa fecha exacta, sin aplicar ninguna regla de cartera ni rebalanceo.",
    puntuacionesEtiquetaSesion: (min, max) => `Nº de sesión dentro de la ventana (entre ${min} y ${max} — hacen falta al menos 3 incrementos previos):`,
    puntuacionesBotonCargando: "Consultando...",
    puntuacionesBoton: "Consultar puntuaciones",
    puntuacionesResultadoTitulo: (fecha, sesion) => `Puntuaciones del ${fecha} (sesión nº ${sesion})`,

    cadenaTitulo: "Ejecutar cadena de selección",
    cadenaDesc: 'Hace todo el proceso de una vez, de forma automática: busca el mejor factor de corrección, el mejor número de componentes (entre 3 y 6), el mejor tope de diversificación (entre el mínimo y el 70%) y la mejor frecuencia de rebalanceo (diario, o el umbral de supervivientes que lo dispara), selecciona los valores con esos parámetros, y muestra solo el resultado final — la cartera de hoy y la expectativa de rentabilidad frente al índice. Los pasos intermedios quedan ocultos aquí, pero puedes verlos con los botones de más abajo si quieres seguir el proceso paso a paso.',
    cadenaBotonCargando: "Ejecutando cadena...",
    cadenaBoton: "Ejecutar cadena de selección",
    carteraSeleccionadaFecha: (fecha) => `Cartera seleccionada (${fecha})`,
    colTicker: "Ticker",
    colPeso: "Peso",
    colPuntuacion: "Puntos",
    colPrecio: "Precio",
    colVeces: "Veces",
    modelo: "Modelo:",
    indiceDowJones: "Índice Dow Jones:",
    superaIndice: (n) => `El modelo SUPERA al índice en ${n} puntos porcentuales.`,
    quedaPorDebajo: (n) => `El modelo QUEDA POR DEBAJO del índice en ${n} puntos porcentuales.`,
    cadenaPie: (factor, n, max, frecuencia) =>
      `(Factor de penalización usado: ${factor} — Nº de componentes: ${n} — Tope de diversificación: ${max}% — Frecuencia de rebalanceo: ${frecuencia} — todos calculados automáticamente)`,

    colFactor: "Factor",

    optFactorTitulo: "Optimizar factor de penalización",
    optFactorDesc: (def) => `Prueba todos los valores entre 0 y 3 (de 0,1 en 0,1) para el factor que multiplica la caída de un valor protegido, y se queda con el que hace mayor la suma del beneficio realmente alcanzable (el de las carteras del día anterior, no el de la recién seleccionada). El factor por defecto es ${def}.`,
    optFactorBotonCargando: "Probando factores...",
    optFactorBoton: "Optimizar factor de penalización",
    factorUsado: "Factor que se usará en la selección:",
    calculadoAuto: " (calculado automáticamente)",
    verFactoresProbados: "Ver los 31 factores probados",
    colSumaBeneficio: "Suma beneficio (carteras anteriores)",

    optNTitulo: "Optimizar número de componentes de la cartera",
    optNDesc: "El punto de partida son 5 valores en cartera, pero mantener siempre exactamente 5 obliga a hacer 5 compras y 5 ventas cada día para ajustar pesos, con sus costes de transacción. Este apartado prueba con 3, 4, 5 y 6 componentes (usando el factor de penalización de arriba) y se queda con el número que hace mayor la suma del beneficio realmente alcanzable.",
    optNBotonCargando: "Probando números...",
    optNBoton: "Optimizar número de componentes",
    nUsado: "Número de componentes que se usará en la selección:",
    verNumerosProbados: "Ver los 4 números probados (3 a 6)",
    colNComponentes: "Nº de componentes",

    optMaxTitulo: "Optimizar tope de diversificación",
    optMaxDesc: "El tope de peso máximo por componente se fijó inicialmente en 40%, para asegurar una diversificación mínima. Pero quizá compense asumir más riesgo (menos diversificación) a cambio de más rentabilidad. Este apartado prueba topes entre el mínimo posible (100% dividido entre el número de componentes de arriba) y un 70%, y se queda con el que hace mayor la suma del beneficio realmente alcanzable.",
    optMaxBotonCargando: "Probando topes...",
    optMaxBoton: "Optimizar tope de diversificación",
    maxUsado: "Tope de diversificación que se usará en la selección:",
    verTopesProbados: "Ver los topes probados",
    colTopePct: "Tope (%)",

    optFrecuenciaTitulo: "Optimizar frecuencia de rebalanceo",
    optFrecuenciaDesc: "El rebalanceo se hacía todos los días, lo que supone comisiones de compra y venta en cada sesión. Una alternativa es mantener la cartera actual sin tocarla (los pesos derivan solos con la cotización, sin coste) hasta que solo sobrevivan unos pocos de sus componentes en el nuevo ranking de los 30 valores. Este apartado prueba \"diario\" (el comportamiento original) y cada umbral entre 0 y el número de componentes menos 1, y se queda con el que hace mayor la suma del beneficio realmente alcanzable. También puedes elegir la frecuencia tú mismo con el selector de abajo, sin necesidad de optimizarla.",
    optFrecuenciaBotonCargando: "Probando frecuencias...",
    optFrecuenciaBoton: "Optimizar frecuencia de rebalanceo",
    frecuenciaUsada: "Frecuencia de rebalanceo que se usará en la selección:",
    frecuenciaDiaria: "diario",
    frecuenciaUmbral: (k) => `solo cuando sobreviven ≤ ${k}`,
    verFrecuenciasProbadas: "Ver las frecuencias probadas",
    colFrecuenciaProbada: "Frecuencia",

    optDiasTitulo: "Configurar ventana del backtest",
    optDiasDesc: "El número de sesiones que se recorren en cada selección y optimización estaba fijo en 20. Aquí puedes cambiarlo: una ventana más corta reacciona más rápido pero con menos datos para decidir; una más larga da más perspectiva pero descarga y procesa más información. No se optimiza automáticamente (cambiar el número de días implica descargar de nuevo los datos de Yahoo Finance cada vez, a diferencia de las demás variables), pero sí puedes fijarlo tú y volver a ejecutar cualquiera de los apartados anteriores o la selección con el nuevo valor.",
    diasUsado: "Nº de sesiones de la ventana:",

    seleccionTitulo: "Selección de los componentes de la cartera",
    seleccionDesc: (n, max) => `Recorre los últimos 20 días, calculando en cada uno el ranking de los 30 componentes y actualizando la cartera según las reglas de selección y rebalanceo (usando el factor, el número de componentes y el tope de diversificación de arriba: ${n} valores, tope ${max}%).`,
    seleccionBotonCargando: "Calculando...",
    seleccionBoton: "Realizar selección de la cartera",
    ocultarResumen: "Ocultar rentabilidad acumulada",
    mostrarResumen: "Mostrar rentabilidad acumulada y comparar con el índice",
    carteraAnterior: "Cartera anterior",
    beneficioSinCambio: "Beneficio sin cambio:",
    primeraSeleccion: "(primera selección, sin cartera previa)",
    carteraSeleccionada: "Cartera seleccionada",
    sinCambiosEtiqueta: " (sin cambios)",
    beneficio: "Beneficio:",
    djEtiqueta: "DJ:",
    mejoraResultado: "El cambio de cartera mejora el resultado frente a no haber cambiado nada.",
    empeoraResultado: "El cambio de cartera empeora el resultado frente a no haber cambiado nada.",

    resumenTitulo: "Rentabilidad total del periodo (parte realmente alcanzable)",
    resumenDesc: (n) => `Producto compuesto del "beneficio sin cambio" de las ${n} carteras anteriores — es decir, de la cartera que está viva en cada momento, manteniendo los pesos que le corresponden hasta que toca renovarla (la única decisión que se toma con información real disponible el día antes):`,
    carteraDelModelo: "Cartera del modelo:",
    indiceDowJonesFechas: (ini, fin) => `Índice Dow Jones (${ini} a ${fin}):`,
    coeficienteCorrelacion: "Coeficiente de correlación (beneficio cartera / incremento Dow Jones):",

    seleccionVecesTitulo: "Selección por \"veces seleccionado\"",
    seleccionVecesDescAnalisis: (sesiones) => `Hace dos backtests sucesivos y sin solape: primero, sobre las ${sesiones} sesiones inmediatamente ANTERIORES a la ventana principal, calcula cuántas veces ha estado en cartera cada uno de los 30 componentes (usando el factor, el número de componentes, el tope y la frecuencia de arriba). Elige los que más veces han estado en cartera en ese periodo, y con esa cartera fija — sin rebalancear nunca, solo dejando que los pesos deriven con la cotización — recorre la ventana principal completa. Las ${sesiones} sesiones del primer backtest quedan fuera de la ventana principal a propósito: si se solaparan, se estaría eligiendo la cartera sabiendo ya cómo le fue en el propio periodo que luego mide el resultado (sesgo de anticipación), igual que se evita en el resto de la aplicación.`,
    seleccionVecesDescReal: (sesiones) => `Pensado para componer una cartera para invertir de verdad hoy, no para validar una estrategia. Usa las ${sesiones} sesiones MÁS RECIENTES disponibles (terminando hoy) para contar las veces de cada componente, y devuelve directamente esa cartera (pesos iguales) como resultado. Al no quedar ningún periodo posterior conocido, no hay un segundo backtest ni rentabilidad que mostrar: aquí se asume el sesgo de anticipación a propósito, porque el objetivo es la cartera de hoy, no medir una estrategia contra el pasado.`,
    modoVecesEtiqueta: "Modo:",
    modoVecesAnalisis: "Dos backtests sin solape",
    modoVecesReal: "Solo un backtest con últimas sesiones",
    sesionesVecesEtiqueta: "Nº de sesiones para contar las veces:",
    seleccionVecesBotonCargando: "Calculando...",
    seleccionVecesBoton: "Realizar selección por veces",
    elegidosPorVecesTitulo: "Elegidos según el backtest previo",
    colVecesEnPeriodo: "Veces en el periodo",
    carteraFijaTitulo: (fecha) => `Cartera fija, con pesos ya derivados a ${fecha}`,
    carteraHoyTitulo: (fecha) => `Cartera para invertir hoy (datos hasta ${fecha})`,

    seleccionVolumenTitulo: "Selección por volumen",
    seleccionVolumenDesc: (n, max) => `Igual que la selección de componentes de más arriba, pero cambiando el criterio con el que se ordenan los 30 valores: en vez de por la suma de los incrementos de PRECIO de las últimas 3 sesiones, se ordenan por la suma de los incrementos de VOLUMEN de negociación de esas mismas 3 sesiones, y se seleccionan los ${n} con mayor puntuación de volumen. El resto de reglas no cambia (protección, tope ${max}%, reparto fijo, frecuencia de rebalanceo de arriba), y el peso y el beneficio de la cartera se siguen calculando siempre con el precio — el volumen solo decide QUIÉN entra y permanece, no cuánto vale la cartera.`,

    seleccionFlujoTitulo: "Selección por flujo de dinero",
    seleccionFlujoDesc: (n, max) => `Igual que las dos secciones anteriores, pero con un tercer criterio: el flujo de dinero, el producto precio × volumen de cada sesión (un indicador clásico tipo "money flow" — pondera el volumen por la dirección y magnitud del movimiento de precio, a diferencia del volumen puro, que no distingue si empujó el precio hacia arriba o hacia abajo). Se ordenan los 30 valores por la suma de los incrementos de ese producto en las últimas 3 sesiones, y se seleccionan los ${n} con mayor puntuación. El resto de reglas no cambia (protección, tope ${max}%, reparto fijo, frecuencia de rebalanceo de arriba), y el peso y el beneficio de la cartera se siguen calculando siempre con el precio.`,

    seleccionVecesVolumenTitulo: "Selección por \"veces seleccionado\" (volumen)",
    seleccionVecesVolumenDescAnalisis: (sesiones) => `Igual que la selección por "veces seleccionado" de más arriba, pero el backtest previo (las ${sesiones} sesiones anteriores a la ventana principal) rankea los 30 componentes por puntuación de VOLUMEN en vez de precio, para decidir quién entra y sale cada día de ese backtest y así contar sus "veces". Se eligen los que más veces han estado en cartera con ese criterio, y con esa cartera fija — sin rebalancear nunca — se recorre la ventana principal completa, igual que en la versión por precio.`,
    seleccionVecesVolumenDescReal: (sesiones) => `Igual que el modo "cartera real" de más arriba, pero usando la puntuación de VOLUMEN (no de precio) de las ${sesiones} sesiones más recientes para contar las veces de cada componente y elegir la cartera para invertir hoy.`,

    seleccionAleatoriaTitulo: "Selección aleatoria",
    seleccionAleatoriaDesc: (n, max) => `Igual que la selección de componentes de más arriba, pero sin atender a ninguna puntuación: los ${n} componentes se eligen cada día al azar entre los 30, a partir de una semilla fija (siempre da el mismo resultado con los mismos datos, no cambia cada vez que se recarga la página). El resto de reglas no cambia (protección, tope ${max}%, reparto fijo, frecuencia de rebalanceo de arriba), y el peso y el beneficio de la cartera se siguen calculando siempre con el precio. Sirve como referencia: si el modelo no supera de forma clara a una selección aleatoria, el criterio de puntuación no está aportando valor real. No tiene sentido replicar aquí la sección de "veces seleccionado": con componentes ya aleatorios, sería solo otra selección al azar más.`,
    colAleatorio: "Aleatorio",

    analisisCorrelacionTitulo: "Análisis de correlación con el índice",
    analisisCorrelacionDesc: "Compara precio, volumen y aleatorio a la vez, en varias duraciones de backtest (20, 30, 50, 80 y 120 sesiones), repitiendo cada una en 6 ventanas históricas distintas y sin solape entre sí (y, para \"aleatorio\", además con 10 semillas distintas por ventana, para tener una distribución de referencia y no un único punto). Con eso se calcula, para cada combinación de método y duración: la correlación media con el Dow Jones (con su rango), la rentabilidad media de la cartera (con su rango) y la rentabilidad media del propio índice en esos mismos periodos. Todo el histórico necesario se descarga una sola vez; los cálculos con las distintas ventanas y semillas se hacen en memoria, sin volver a llamar a Yahoo Finance por cada celda.",
    analisisCorrelacionBotonCargando: "Calculando (puede tardar bastante)...",
    analisisCorrelacionBoton: "Ejecutar análisis de correlación",
    colMetodo: "Método",
    colDuracion: "Duración",
    colRepeticiones: "Repeticiones",
    colCorrelacionMedia: "Correlación (media / rango)",
    colRentCarteraMedia: "Rentabilidad cartera (media / rango)",
    colRentIndiceMedia: "Rentabilidad DJ (media)",
    metodoPrecio: "Precio",
    metodoVolumen: "Volumen",
    metodoFlujo: "Flujo de dinero",
    metodoAleatorio: "Aleatorio",
    conclusionTitulo: "Conclusión",
  },

  en: {
    titulo: "AI Fund — Dow Jones",
    idiomaEtiqueta: "Language:",

    especificacionesCargando: "Loading...",
    especificacionesOcultar: "Hide specifications",
    especificacionesMostrar: "What does this app do?",
    observacionesOcultar: "Hide notes",
    observacionesMostrar: "Notes",
    historiaOcultar: "Hide history",
    historiaMostrar: "History",
    error: "Error",

    comprobacionTitulo: "Check a single stock",
    comprobacionDesc: "Pick a ticker and calculate its percentage change across its last 20 daily closes.",
    consultando: "Fetching...",
    calcular: "Calculate",
    ultimosCierres: (ticker, n) => `${ticker} — last ${n} closes`,
    colFecha: "Date",
    colIncremento: "Change",
    colVolumen: "Volume",
    colVxP: "V x P",
    colVariacionVxP: "Change",

    puntuacionesTitulo: "Scores for a specific session",
    puntuacionesDesc: "Audit tool: pick a session number within the downloaded window and check the score (sum of the changes of that session and the 2 previous ones) of the 30 components on that exact date, without applying any portfolio or rebalancing rule.",
    puntuacionesEtiquetaSesion: (min, max) => `Session number within the window (between ${min} and ${max} — at least 3 previous changes are needed):`,
    puntuacionesBotonCargando: "Fetching...",
    puntuacionesBoton: "Check scores",
    puntuacionesResultadoTitulo: (fecha, sesion) => `Scores for ${fecha} (session #${sesion})`,

    cadenaTitulo: "Run selection chain",
    cadenaDesc: 'Runs the whole process at once, automatically: finds the best penalty factor, the best number of components (between 3 and 6), the best diversification cap (between the minimum and 70%), and the best rebalancing frequency (daily, or the survivor threshold that triggers it), selects the portfolio using those parameters, and shows only the final result — today\'s portfolio and the expected return versus the index. Intermediate steps stay hidden here, but you can see them with the buttons further down if you want to follow the process step by step.',
    cadenaBotonCargando: "Running chain...",
    cadenaBoton: "Run selection chain",
    carteraSeleccionadaFecha: (fecha) => `Selected portfolio (${fecha})`,
    colTicker: "Ticker",
    colPeso: "Weight",
    colPuntuacion: "Score",
    colPrecio: "Price",
    colVeces: "Times",
    expectativaRentabilidad: "Expected return",
    modelo: "Model:",
    indiceDowJones: "Dow Jones index:",
    superaIndice: (n) => `The model BEATS the index by ${n} percentage points.`,
    quedaPorDebajo: (n) => `The model FALLS BEHIND the index by ${n} percentage points.`,
    cadenaPie: (factor, n, max, frecuencia) =>
      `(Penalty factor used: ${factor} — Number of components: ${n} — Diversification cap: ${max}% — Rebalancing frequency: ${frecuencia} — all calculated automatically)`,

    colFactor: "Factor",

    optFactorTitulo: "Optimize penalty factor",
    optFactorDesc: (def) => `Tries every value between 0 and 3 (in steps of 0.1) for the factor that multiplies the drop of a protected stock, and keeps the one that maximizes the sum of the truly achievable return (from the previous day's portfolios, not the newly selected one). The default factor is ${def}.`,
    optFactorBotonCargando: "Trying factors...",
    optFactorBoton: "Optimize penalty factor",
    factorUsado: "Factor to be used in the selection:",
    calculadoAuto: " (calculated automatically)",
    verFactoresProbados: "View the 31 factors tried",
    colSumaBeneficio: "Return sum (previous portfolios)",

    optNTitulo: "Optimize number of portfolio components",
    optNDesc: "The starting point is 5 stocks in the portfolio, but always keeping exactly 5 forces 5 buy and 5 sell operations every day to adjust weights, with the transaction costs that involves. This section tries 3, 4, 5 and 6 components (using the penalty factor above) and keeps the number that maximizes the sum of the truly achievable return.",
    optNBotonCargando: "Trying numbers...",
    optNBoton: "Optimize number of components",
    nUsado: "Number of components to be used in the selection:",
    verNumerosProbados: "View the 4 numbers tried (3 to 6)",
    colNComponentes: "# of components",

    optMaxTitulo: "Optimize diversification cap",
    optMaxDesc: "The maximum weight cap per component was initially set at 40%, to ensure a minimum level of diversification. But it might pay off to take on more risk (less diversification) in exchange for more return. This section tries caps between the lowest possible value (100% divided by the number of components above) and 70%, and keeps the one that maximizes the sum of the truly achievable return.",
    optMaxBotonCargando: "Trying caps...",
    optMaxBoton: "Optimize diversification cap",
    maxUsado: "Diversification cap to be used in the selection:",
    verTopesProbados: "View the caps tried",
    colTopePct: "Cap (%)",

    optFrecuenciaTitulo: "Optimize rebalancing frequency",
    optFrecuenciaDesc: "Rebalancing used to happen every day, which means buy and sell commissions every session. An alternative is to leave the current portfolio untouched (weights drift on their own with the price, at no cost) until only a few of its components survive in the new ranking of the 30 stocks. This section tries \"daily\" (the original behavior) and every threshold between 0 and the number of components minus 1, and keeps the one that maximizes the sum of the truly achievable return. You can also pick the frequency yourself with the selector below, without needing to optimize it.",
    optFrecuenciaBotonCargando: "Trying frequencies...",
    optFrecuenciaBoton: "Optimize rebalancing frequency",
    frecuenciaUsada: "Rebalancing frequency to be used in the selection:",
    frecuenciaDiaria: "daily",
    frecuenciaUmbral: (k) => `only when survivors ≤ ${k}`,
    verFrecuenciasProbadas: "View the frequencies tried",
    colFrecuenciaProbada: "Frequency",

    optDiasTitulo: "Configure backtest window",
    optDiasDesc: "The number of sessions used in each selection and optimization was fixed at 20. Here you can change it: a shorter window reacts faster but with less data to decide on; a longer one gives more perspective but downloads and processes more information. It isn't optimized automatically (changing the number of days means downloading the Yahoo Finance data again each time, unlike the other variables), but you can set it yourself and re-run any of the sections above or the selection with the new value.",
    diasUsado: "Number of sessions in the window:",

    seleccionTitulo: "Selection of portfolio components",
    seleccionDesc: (n, max) => `Goes through the last 20 days, calculating the ranking of the 30 components each day and updating the portfolio according to the selection and rebalancing rules (using the factor, number of components and diversification cap above: ${n} stocks, ${max}% cap).`,
    seleccionBotonCargando: "Calculating...",
    seleccionBoton: "Run portfolio selection",
    ocultarResumen: "Hide cumulative return",
    mostrarResumen: "Show cumulative return and compare with the index",
    carteraAnterior: "Previous portfolio",
    beneficioSinCambio: "Return with no change:",
    primeraSeleccion: "(first selection, no previous portfolio)",
    carteraSeleccionada: "Selected portfolio",
    sinCambiosEtiqueta: " (unchanged)",
    beneficio: "Return:",
    djEtiqueta: "DJ:",
    mejoraResultado: "Changing the portfolio improves the result compared with not changing anything.",
    empeoraResultado: "Changing the portfolio worsens the result compared with not changing anything.",

    resumenTitulo: "Total return for the period (the genuinely achievable part)",
    resumenDesc: (n) => `Compound product of the "return with no change" of the ${n} previous portfolios — that is, of the portfolio that is alive at each moment, keeping the weights it's entitled to until it's time to renew it (the only decision made with real information available the day before):`,
    carteraDelModelo: "Model portfolio:",
    indiceDowJonesFechas: (ini, fin) => `Dow Jones index (${ini} to ${fin}):`,
    coeficienteCorrelacion: "Correlation coefficient (portfolio return / Dow Jones change):",

    seleccionVecesTitulo: 'Selection by "times selected"',
    seleccionVecesDescAnalisis: (sesiones) => `Runs two successive, non-overlapping backtests: first, over the ${sesiones} sessions immediately BEFORE the main window, it counts how many times each of the 30 components has been in the portfolio (using the factor, number of components, cap and frequency above). It picks the ones that were in the portfolio most often in that period, and with that fixed portfolio — never rebalancing, just letting the weights drift with the price — it runs through the entire main window. The ${sesiones} sessions of the first backtest are deliberately outside the main window: if they overlapped, the portfolio would be chosen already knowing how it performed in the very period later used to measure the result (look-ahead bias), just as is avoided elsewhere in the application.`,
    seleccionVecesDescReal: (sesiones) => `Meant for putting together a portfolio to actually invest in today, not for validating a strategy. It uses the ${sesiones} MOST RECENT sessions available (ending today) to count each component's times, and returns that portfolio (equal weights) directly as the result. Since there's no later known period left, there's no second backtest or return to show: look-ahead bias is knowingly accepted here, because the goal is today's portfolio, not measuring a strategy against the past.`,
    modoVecesEtiqueta: "Mode:",
    modoVecesAnalisis: "Two non-overlapping backtests",
    modoVecesReal: "Just one backtest, most recent sessions",
    sesionesVecesEtiqueta: "Number of sessions to count times:",
    seleccionVecesBotonCargando: "Calculating...",
    seleccionVecesBoton: "Run selection by times",
    elegidosPorVecesTitulo: "Chosen from the previous backtest",
    colVecesEnPeriodo: "Times in the period",
    carteraFijaTitulo: (fecha) => `Fixed portfolio, weights already drifted to ${fecha}`,
    carteraHoyTitulo: (fecha) => `Portfolio to invest in today (data through ${fecha})`,

    seleccionVolumenTitulo: "Selection by volume",
    seleccionVolumenDesc: (n, max) => `Same as the component selection above, but changing the criterion used to rank the 30 stocks: instead of the sum of PRICE changes over the last 3 sessions, they're ranked by the sum of trading VOLUME changes over those same 3 sessions, and the ${n} with the highest volume score are selected. The other rules don't change (protection, ${max}% cap, fixed distribution, rebalancing frequency from above), and the portfolio's weight and return are still always calculated with price — volume only decides WHO enters and stays, not how much the portfolio is worth.`,

    seleccionFlujoTitulo: "Selection by money flow",
    seleccionFlujoDesc: (n, max) => `Same as the two sections above, but with a third criterion: money flow, the price × volume product for each session (a classic "money flow"-style indicator — it weights volume by the direction and size of the price move, unlike raw volume, which doesn't distinguish whether it pushed the price up or down). The 30 stocks are ranked by the sum of that product's changes over the last 3 sessions, and the ${n} with the highest score are selected. The other rules don't change (protection, ${max}% cap, fixed distribution, rebalancing frequency from above), and the portfolio's weight and return are still always calculated with price.`,

    seleccionVecesVolumenTitulo: 'Selection by "times selected" (volume)',
    seleccionVecesVolumenDescAnalisis: (sesiones) => `Same as the "times selected" selection above, but the previous backtest (the ${sesiones} sessions before the main window) ranks the 30 components by VOLUME score instead of price, to decide who enters and leaves each day of that backtest and so count their "times". The ones that were in the portfolio most often under that criterion are chosen, and with that fixed portfolio — never rebalancing — it runs through the entire main window, just like the price version.`,
    seleccionVecesVolumenDescReal: (sesiones) => `Same as the "real portfolio" mode above, but using the VOLUME score (not price) of the ${sesiones} most recent sessions to count each component's times and choose today's portfolio.`,

    seleccionAleatoriaTitulo: "Random selection",
    seleccionAleatoriaDesc: (n, max) => `Same as the component selection above, but without using any score at all: the ${n} components are picked at random from the 30 each day, from a fixed seed (always gives the same result with the same data, it doesn't change every time the page reloads). The other rules don't change (protection, ${max}% cap, fixed distribution, rebalancing frequency from above), and the portfolio's weight and return are still always calculated with price. It's meant as a baseline: if the model doesn't clearly beat a random selection, the scoring criterion isn't adding real value. Replicating the "times selected" section here wouldn't make sense: with components already random, it would just be another random pick.`,
    colAleatorio: "Random",

    analisisCorrelacionTitulo: "Correlation analysis vs. the index",
    analisisCorrelacionDesc: "Compares price, volume and random all at once, across several backtest durations (20, 30, 50, 80 and 120 sessions), repeating each one over 6 distinct, non-overlapping historical windows (and, for \"random\", also with 10 different seeds per window, to get a reference distribution instead of a single point). From that, for each method/duration combination it computes: the average correlation with the Dow Jones (with its range), the average portfolio return (with its range), and the average return of the index itself over those same periods. All the needed history is downloaded once; the calculations across the different windows and seeds are done in memory, without calling Yahoo Finance again for each cell.",
    analisisCorrelacionBotonCargando: "Calculating (this can take a while)...",
    analisisCorrelacionBoton: "Run correlation analysis",
    colMetodo: "Method",
    colDuracion: "Duration",
    colRepeticiones: "Repeats",
    colCorrelacionMedia: "Correlation (avg / range)",
    colRentCarteraMedia: "Portfolio return (avg / range)",
    colRentIndiceMedia: "DJ return (avg)",
    metodoPrecio: "Price",
    metodoVolumen: "Volume",
    metodoFlujo: "Money flow",
    metodoAleatorio: "Random",
    conclusionTitulo: "Conclusion",
  },
};

export default function Home() {
  const [idioma, setIdioma] = useState("es");
  const t = T[idioma];

  const [ticker, setTicker] = useState("MMM");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const [seleccion, setSeleccion] = useState(null);
  const [cargandoSeleccion, setCargandoSeleccion] = useState(false);
  const [errorSeleccion, setErrorSeleccion] = useState(null);

  const [seleccionVeces, setSeleccionVeces] = useState(null);
  const [cargandoSeleccionVeces, setCargandoSeleccionVeces] = useState(false);
  const [errorSeleccionVeces, setErrorSeleccionVeces] = useState(null);
  const [modoVeces, setModoVeces] = useState("analisis");
  const [sesionesVeces, setSesionesVeces] = useState(10);

  const [seleccionVolumen, setSeleccionVolumen] = useState(null);
  const [cargandoSeleccionVolumen, setCargandoSeleccionVolumen] = useState(false);
  const [errorSeleccionVolumen, setErrorSeleccionVolumen] = useState(null);

  const [seleccionFlujo, setSeleccionFlujo] = useState(null);
  const [cargandoSeleccionFlujo, setCargandoSeleccionFlujo] = useState(false);
  const [errorSeleccionFlujo, setErrorSeleccionFlujo] = useState(null);

  const [seleccionVecesVolumen, setSeleccionVecesVolumen] = useState(null);
  const [cargandoSeleccionVecesVolumen, setCargandoSeleccionVecesVolumen] = useState(false);
  const [errorSeleccionVecesVolumen, setErrorSeleccionVecesVolumen] = useState(null);
  const [modoVecesVolumen, setModoVecesVolumen] = useState("analisis");
  const [sesionesVecesVolumen, setSesionesVecesVolumen] = useState(10);

  const [seleccionAleatoria, setSeleccionAleatoria] = useState(null);
  const [cargandoSeleccionAleatoria, setCargandoSeleccionAleatoria] = useState(false);
  const [errorSeleccionAleatoria, setErrorSeleccionAleatoria] = useState(null);

  const [analisisCorrelacion, setAnalisisCorrelacion] = useState(null);
  const [cargandoAnalisisCorrelacion, setCargandoAnalisisCorrelacion] = useState(false);
  const [errorAnalisisCorrelacion, setErrorAnalisisCorrelacion] = useState(null);

  const [especificaciones, setEspecificaciones] = useState(null);
  const [cargandoEspecificaciones, setCargandoEspecificaciones] = useState(false);
  const [errorEspecificaciones, setErrorEspecificaciones] = useState(null);
  const [mostrarEspecificaciones, setMostrarEspecificaciones] = useState(false);

  const [observaciones, setObservaciones] = useState(null);
  const [cargandoObservaciones, setCargandoObservaciones] = useState(false);
  const [errorObservaciones, setErrorObservaciones] = useState(null);
  const [mostrarObservaciones, setMostrarObservaciones] = useState(false);

  const [historia, setHistoria] = useState(null);
  const [cargandoHistoria, setCargandoHistoria] = useState(false);
  const [errorHistoria, setErrorHistoria] = useState(null);
  const [mostrarHistoria, setMostrarHistoria] = useState(false);

  const [factorPenalizacion, setFactorPenalizacion] = useState(2);
  const [resultadosOptimizacion, setResultadosOptimizacion] = useState(null);
  const [cargandoOptimizacion, setCargandoOptimizacion] = useState(false);
  const [errorOptimizacion, setErrorOptimizacion] = useState(null);

  const [nComponentes, setNComponentes] = useState(5);
  const [resultadosOptimizacionN, setResultadosOptimizacionN] = useState(null);
  const [cargandoOptimizacionN, setCargandoOptimizacionN] = useState(false);
  const [errorOptimizacionN, setErrorOptimizacionN] = useState(null);

  const [pesoMaximo, setPesoMaximo] = useState(40);
  const [resultadosOptimizacionMax, setResultadosOptimizacionMax] = useState(null);
  const [cargandoOptimizacionMax, setCargandoOptimizacionMax] = useState(false);
  const [errorOptimizacionMax, setErrorOptimizacionMax] = useState(null);

  const [frecuenciaRebalanceo, setFrecuenciaRebalanceo] = useState("diario");
  const [resultadosOptimizacionFrecuencia, setResultadosOptimizacionFrecuencia] = useState(null);
  const [cargandoOptimizacionFrecuencia, setCargandoOptimizacionFrecuencia] = useState(false);
  const [errorOptimizacionFrecuencia, setErrorOptimizacionFrecuencia] = useState(null);

  const [diasVentana, setDiasVentana] = useState(20); // valor de partida

  const [numeroSesionConsulta, setNumeroSesionConsulta] = useState(20);
  const [resultadoPuntuaciones, setResultadoPuntuaciones] = useState(null);
  const [cargandoPuntuaciones, setCargandoPuntuaciones] = useState(false);
  const [errorPuntuaciones, setErrorPuntuaciones] = useState(null);

  async function consultar() {
    setCargando(true);
    setError(null);
    setDatos(null);
    try {
      const resp = await fetch(`/api/ratios?ticker=${ticker}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setDatos(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  const [mostrarResumen, setMostrarResumen] = useState(false);

  const [cargandoCadena, setCargandoCadena] = useState(false);
  const [errorCadena, setErrorCadena] = useState(null);
  const [resultadoCadena, setResultadoCadena] = useState(null);

  async function realizarSeleccion() {
    setCargandoSeleccion(true);
    setErrorSeleccion(null);
    setSeleccion(null);
    setMostrarResumen(false);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccion(json);
      setMostrarResumen(true);
    } catch (e) {
      setErrorSeleccion(e.message);
    } finally {
      setCargandoSeleccion(false);
    }
  }

  async function realizarSeleccionVeces() {
    setCargandoSeleccionVeces(true);
    setErrorSeleccionVeces(null);
    setSeleccionVeces(null);
    try {
      const params = `factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&sesionesVeces=${sesionesVeces}&modo=${modoVeces}`;
      const url = modoVeces === "real" ? `/api/seleccionVeces?${params}` : `/api/seleccionVeces?${params}&dias=${diasVentana}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionVeces(json);
    } catch (e) {
      setErrorSeleccionVeces(e.message);
    } finally {
      setCargandoSeleccionVeces(false);
    }
  }

  async function realizarSeleccionVolumen() {
    setCargandoSeleccionVolumen(true);
    setErrorSeleccionVolumen(null);
    setSeleccionVolumen(null);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&criterio=volumen`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionVolumen(json);
    } catch (e) {
      setErrorSeleccionVolumen(e.message);
    } finally {
      setCargandoSeleccionVolumen(false);
    }
  }

  async function realizarSeleccionFlujo() {
    setCargandoSeleccionFlujo(true);
    setErrorSeleccionFlujo(null);
    setSeleccionFlujo(null);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&criterio=flujo`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionFlujo(json);
    } catch (e) {
      setErrorSeleccionFlujo(e.message);
    } finally {
      setCargandoSeleccionFlujo(false);
    }
  }

  async function realizarSeleccionVecesVolumen() {
    setCargandoSeleccionVecesVolumen(true);
    setErrorSeleccionVecesVolumen(null);
    setSeleccionVecesVolumen(null);
    try {
      const params = `factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&sesionesVeces=${sesionesVecesVolumen}&modo=${modoVecesVolumen}&criterio=volumen`;
      const url = modoVecesVolumen === "real" ? `/api/seleccionVeces?${params}` : `/api/seleccionVeces?${params}&dias=${diasVentana}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionVecesVolumen(json);
    } catch (e) {
      setErrorSeleccionVecesVolumen(e.message);
    } finally {
      setCargandoSeleccionVecesVolumen(false);
    }
  }

  async function realizarSeleccionAleatoria() {
    setCargandoSeleccionAleatoria(true);
    setErrorSeleccionAleatoria(null);
    setSeleccionAleatoria(null);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&criterio=aleatorio`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionAleatoria(json);
    } catch (e) {
      setErrorSeleccionAleatoria(e.message);
    } finally {
      setCargandoSeleccionAleatoria(false);
    }
  }

  async function realizarAnalisisCorrelacion() {
    setCargandoAnalisisCorrelacion(true);
    setErrorAnalisisCorrelacion(null);
    setAnalisisCorrelacion(null);
    try {
      const resp = await fetch(`/api/analisisCorrelacion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setAnalisisCorrelacion(json);
    } catch (e) {
      setErrorAnalisisCorrelacion(e.message);
    } finally {
      setCargandoAnalisisCorrelacion(false);
    }
  }

  async function consultarPuntuaciones() {
    setCargandoPuntuaciones(true);
    setErrorPuntuaciones(null);
    setResultadoPuntuaciones(null);
    try {
      const resp = await fetch(`/api/puntuaciones?dias=${diasVentana}&sesion=${numeroSesionConsulta}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadoPuntuaciones(json);
    } catch (e) {
      setErrorPuntuaciones(e.message);
    } finally {
      setCargandoPuntuaciones(false);
    }
  }

  async function optimizarFactor() {
    setCargandoOptimizacion(true);
    setErrorOptimizacion(null);
    setResultadosOptimizacion(null);
    try {
      const resp = await fetch(`/api/optimizar?dias=${diasVentana}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadosOptimizacion(json);
      setFactorPenalizacion(json.mejorFactor);
    } catch (e) {
      setErrorOptimizacion(e.message);
    } finally {
      setCargandoOptimizacion(false);
    }
  }

  async function optimizarNumeroComponentes() {
    setCargandoOptimizacionN(true);
    setErrorOptimizacionN(null);
    setResultadosOptimizacionN(null);
    try {
      const resp = await fetch(`/api/optimizarN?factor=${factorPenalizacion}&dias=${diasVentana}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadosOptimizacionN(json);
      setNComponentes(json.mejorNComponentes);
    } catch (e) {
      setErrorOptimizacionN(e.message);
    } finally {
      setCargandoOptimizacionN(false);
    }
  }

  async function optimizarTopeDiversificacion() {
    setCargandoOptimizacionMax(true);
    setErrorOptimizacionMax(null);
    setResultadosOptimizacionMax(null);
    try {
      const resp = await fetch(`/api/optimizarMax?factor=${factorPenalizacion}&n=${nComponentes}&dias=${diasVentana}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadosOptimizacionMax(json);
      setPesoMaximo(json.mejorPesoMaximo);
    } catch (e) {
      setErrorOptimizacionMax(e.message);
    } finally {
      setCargandoOptimizacionMax(false);
    }
  }

  async function optimizarFrecuenciaRebalanceo() {
    setCargandoOptimizacionFrecuencia(true);
    setErrorOptimizacionFrecuencia(null);
    setResultadosOptimizacionFrecuencia(null);
    try {
      const resp = await fetch(`/api/optimizarFrecuencia?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&dias=${diasVentana}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadosOptimizacionFrecuencia(json);
      setFrecuenciaRebalanceo(json.mejorFrecuenciaRebalanceo);
    } catch (e) {
      setErrorOptimizacionFrecuencia(e.message);
    } finally {
      setCargandoOptimizacionFrecuencia(false);
    }
  }

  async function ejecutarCadena() {
    setCargandoCadena(true);
    setErrorCadena(null);
    setResultadoCadena(null);
    try {
      const respOpt = await fetch(`/api/optimizar?dias=${diasVentana}`);
      const jsonOpt = await respOpt.json();
      if (!respOpt.ok) throw new Error(jsonOpt.error || "Error al optimizar el factor");

      const respOptN = await fetch(`/api/optimizarN?factor=${jsonOpt.mejorFactor}&dias=${diasVentana}`);
      const jsonOptN = await respOptN.json();
      if (!respOptN.ok) throw new Error(jsonOptN.error || "Error al optimizar el número de componentes");

      const respOptMax = await fetch(`/api/optimizarMax?factor=${jsonOpt.mejorFactor}&n=${jsonOptN.mejorNComponentes}&dias=${diasVentana}`);
      const jsonOptMax = await respOptMax.json();
      if (!respOptMax.ok) throw new Error(jsonOptMax.error || "Error al optimizar el tope de diversificación");

      const respOptFrec = await fetch(
        `/api/optimizarFrecuencia?factor=${jsonOpt.mejorFactor}&n=${jsonOptN.mejorNComponentes}&max=${jsonOptMax.mejorPesoMaximo}&dias=${diasVentana}`
      );
      const jsonOptFrec = await respOptFrec.json();
      if (!respOptFrec.ok) throw new Error(jsonOptFrec.error || "Error al optimizar la frecuencia de rebalanceo");

      const respSel = await fetch(
        `/api/seleccion?factor=${jsonOpt.mejorFactor}&n=${jsonOptN.mejorNComponentes}&max=${jsonOptMax.mejorPesoMaximo}&frecuencia=${jsonOptFrec.mejorFrecuenciaRebalanceo}&dias=${diasVentana}`
      );
      const jsonSel = await respSel.json();
      if (!respSel.ok) throw new Error(jsonSel.error || "Error al realizar la selección");

      setResultadoCadena({
        factor: jsonOpt.mejorFactor,
        n: jsonOptN.mejorNComponentes,
        max: jsonOptMax.mejorPesoMaximo,
        frecuencia: jsonOptFrec.mejorFrecuenciaRebalanceo,
        seleccion: jsonSel,
      });

      setFactorPenalizacion(jsonOpt.mejorFactor);
      setResultadosOptimizacion(jsonOpt);
      setNComponentes(jsonOptN.mejorNComponentes);
      setResultadosOptimizacionN(jsonOptN);
      setPesoMaximo(jsonOptMax.mejorPesoMaximo);
      setResultadosOptimizacionMax(jsonOptMax);
      setFrecuenciaRebalanceo(jsonOptFrec.mejorFrecuenciaRebalanceo);
      setResultadosOptimizacionFrecuencia(jsonOptFrec);
      setSeleccion(jsonSel);
    } catch (e) {
      setErrorCadena(e.message);
    } finally {
      setCargandoCadena(false);
    }
  }

  async function verEspecificaciones() {
    if (especificaciones) {
      setMostrarEspecificaciones((v) => !v);
      return;
    }
    setCargandoEspecificaciones(true);
    setErrorEspecificaciones(null);
    try {
      const resp = await fetch(`/api/especificaciones`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setEspecificaciones(json.html);
      setMostrarEspecificaciones(true);
    } catch (e) {
      setErrorEspecificaciones(e.message);
    } finally {
      setCargandoEspecificaciones(false);
    }
  }

  async function verObservaciones() {
    if (observaciones) {
      setMostrarObservaciones((v) => !v);
      return;
    }
    setCargandoObservaciones(true);
    setErrorObservaciones(null);
    try {
      const resp = await fetch(`/api/observaciones`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setObservaciones(json.html);
      setMostrarObservaciones(true);
    } catch (e) {
      setErrorObservaciones(e.message);
    } finally {
      setCargandoObservaciones(false);
    }
  }

  async function verHistoria() {
    if (historia) {
      setMostrarHistoria((v) => !v);
      return;
    }
    setCargandoHistoria(true);
    setErrorHistoria(null);
    try {
      const resp = await fetch(`/api/historia`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setHistoria(json.html);
      setMostrarHistoria(true);
    } catch (e) {
      setErrorHistoria(e.message);
    } finally {
      setCargandoHistoria(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif", padding: "16px", background: "#ffe4d6", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0 }}>{t.titulo}</h1>
        <div>
          {t.idiomaEtiqueta}{" "}
          <select value={idioma} onChange={(e) => setIdioma(e.target.value)}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={verEspecificaciones} disabled={cargandoEspecificaciones}>
          {cargandoEspecificaciones
            ? t.especificacionesCargando
            : mostrarEspecificaciones
            ? t.especificacionesOcultar
            : t.especificacionesMostrar}
        </button>{" "}
        <button onClick={verObservaciones} disabled={cargandoObservaciones}>
          {cargandoObservaciones
            ? t.especificacionesCargando
            : mostrarObservaciones
            ? t.observacionesOcultar
            : t.observacionesMostrar}
        </button>{" "}
        <button onClick={verHistoria} disabled={cargandoHistoria}>
          {cargandoHistoria
            ? t.especificacionesCargando
            : mostrarHistoria
            ? t.historiaOcultar
            : t.historiaMostrar}
        </button>
      </div>

      {errorEspecificaciones && <p style={{ color: "crimson" }}>{t.error}: {errorEspecificaciones}</p>}

      {mostrarEspecificaciones && especificaciones && (
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: 16,
            margin: "16px 0",
            maxHeight: 480,
            overflowY: "auto",
            background: "#fafafa",
          }}
          dangerouslySetInnerHTML={{ __html: especificaciones }}
        />
      )}

      {errorObservaciones && <p style={{ color: "crimson" }}>{t.error}: {errorObservaciones}</p>}

      {mostrarObservaciones && observaciones && (
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: 16,
            margin: "16px 0",
            maxHeight: 480,
            overflowY: "auto",
            background: "#fafafa",
          }}
          dangerouslySetInnerHTML={{ __html: observaciones }}
        />
      )}

      {errorHistoria && <p style={{ color: "crimson" }}>{t.error}: {errorHistoria}</p>}

      {mostrarHistoria && historia && (
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: 16,
            margin: "16px 0",
            maxHeight: 480,
            overflowY: "auto",
            background: "#fafafa",
          }}
          dangerouslySetInnerHTML={{ __html: historia }}
        />
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2>{t.comprobacionTitulo}</h2>
      <p>{t.comprobacionDesc}</p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "20px 0", flexWrap: "wrap" }}>
        <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
          {TICKERS.map((tk) => (
            <option key={tk} value={tk}>{tk} — {NOMBRES[tk].slice(0, 25)}</option>
          ))}
        </select>
        <button onClick={consultar} disabled={cargando}>
          {cargando ? t.consultando : t.calcular}
        </button>
      </div>

      {error && <p style={{ color: "crimson" }}>{t.error}: {error}</p>}

      {datos && (
        <>
          <h2>{t.ultimosCierres(datos.ticker, datos.cierres.length)}</h2>
          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>{t.colFecha}</th>
                <th>{t.colPrecio}</th>
                <th>{t.colIncremento}</th>
                <th>{t.colVolumen}</th>
                <th>{t.colVxP}</th>
                <th>{t.colVariacionVxP}</th>
              </tr>
            </thead>
            <tbody>
              {datos.cierres.map((c, i) => {
                const vxp = c.volumen !== undefined && c.volumen !== null ? (c.volumen * c.cierre) / 1000 : null;
                const anterior = i > 0 ? datos.cierres[i - 1] : null;
                const vxpAnterior =
                  anterior && anterior.volumen !== undefined && anterior.volumen !== null
                    ? (anterior.volumen * anterior.cierre) / 1000
                    : null;
                return (
                  <tr key={i}>
                    <td>{c.fecha.slice(0, 10)}</td>
                    <td>{c.cierre.toFixed(2)}</td>
                    <td>{i > 0 ? `${(datos.ratios[i - 1].incremento * 100).toFixed(3)}%` : ""}</td>
                    <td>{c.volumen !== undefined && c.volumen !== null ? c.volumen.toLocaleString() : "-"}</td>
                    <td>{vxp !== null ? vxp.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-"}</td>
                    <td>{vxp !== null && vxpAnterior !== null ? `${((vxp / vxpAnterior - 1) * 100).toFixed(3)}%` : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.puntuacionesTitulo}</h2>
      <p>{t.puntuacionesDesc}</p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
        <label>
          {t.puntuacionesEtiquetaSesion(4, diasVentana)}{" "}
          <input
            type="number"
            min={4}
            max={diasVentana}
            value={numeroSesionConsulta}
            onChange={(e) => setNumeroSesionConsulta(Number(e.target.value))}
            style={{ width: 70 }}
          />
        </label>
        <button onClick={consultarPuntuaciones} disabled={cargandoPuntuaciones}>
          {cargandoPuntuaciones ? t.puntuacionesBotonCargando : t.puntuacionesBoton}
        </button>
      </div>

      {errorPuntuaciones && <p style={{ color: "crimson" }}>{t.error}: {errorPuntuaciones}</p>}

      {resultadoPuntuaciones && (
        <>
          <h3>{t.puntuacionesResultadoTitulo(resultadoPuntuaciones.fecha, resultadoPuntuaciones.numeroSesion)}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {resultadoPuntuaciones.puntuaciones.map((p) => (
                <tr key={p.ticker}>
                  <td>{p.ticker} — {NOMBRES[p.ticker]}</td>
                  <td>{p.puntuacion}</td>
                  <td>{p.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <hr style={{ margin: "32px 0" }} />

      <div style={{ border: "3px solid #2d6a2d", borderRadius: 8, padding: 16, background: "#f3fff3" }}>
        <h2 style={{ marginTop: 0 }}>{t.cadenaTitulo}</h2>
        <p>{t.cadenaDesc}</p>
        <button onClick={ejecutarCadena} disabled={cargandoCadena}>
          {cargandoCadena ? t.cadenaBotonCargando : t.cadenaBoton}
        </button>

        {errorCadena && <p style={{ color: "crimson" }}>{t.error}: {errorCadena}</p>}

        {resultadoCadena && (
          <div style={{ marginTop: 16 }}>
            <h3>{t.carteraSeleccionadaFecha(resultadoCadena.seleccion.historico[resultadoCadena.seleccion.historico.length - 1].fecha)}</h3>
            <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
              </thead>
              <tbody>
                {resultadoCadena.seleccion.historico[resultadoCadena.seleccion.historico.length - 1].cartera.map((c) => (
                  <tr key={c.ticker}>
                    <td>{c.ticker} — {NOMBRES[c.ticker]}</td>
                    <td>{c.peso}%</td>
                    <td>{c.puntuacion}</td>
                    <td>{c.precio}</td>
                    <td>{c.vecesSeleccionado}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>{t.expectativaRentabilidad}</h3>
            <p style={{ fontSize: "1.2em" }}>
              {t.modelo}{" "}
              <b style={{ color: resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                {resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
              </b>
            </p>
            {resultadoCadena.seleccion.rentabilidadIndice && (
              <>
                <p style={{ fontSize: "1.2em" }}>
                  {t.indiceDowJones}{" "}
                  <b style={{ color: resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                    {resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                  </b>
                </p>
                <p style={{ fontWeight: "bold" }}>
                  {resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct >=
                  resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct
                    ? t.superaIndice((resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct - resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct).toFixed(3))
                    : t.quedaPorDebajo((resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct - resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
                </p>
              </>
            )}
            <p style={{ fontSize: "0.85em", color: "#666" }}>
              {t.cadenaPie(resultadoCadena.factor, resultadoCadena.n, resultadoCadena.max, resultadoCadena.frecuencia)}
            </p>
          </div>
        )}
      </div>

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optFactorTitulo}</h2>
      <p>{t.optFactorDesc(FACTOR_PENALIZACION_DEFECTO_DISPLAY)}</p>
      <button onClick={optimizarFactor} disabled={cargandoOptimizacion}>
        {cargandoOptimizacion ? t.optFactorBotonCargando : t.optFactorBoton}
      </button>

      {errorOptimizacion && <p style={{ color: "crimson" }}>{t.error}: {errorOptimizacion}</p>}

      <p style={{ marginTop: 8 }}>
        {t.factorUsado} <b>{factorPenalizacion}</b>
        {resultadosOptimizacion && t.calculadoAuto}
      </p>

      {resultadosOptimizacion && (
        <details style={{ marginTop: 8 }}>
          <summary>{t.verFactoresProbados}</summary>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", marginTop: 4 }}>
            <thead>
              <tr><th>{t.colFactor}</th><th>{t.colSumaBeneficio}</th></tr>
            </thead>
            <tbody>
              {resultadosOptimizacion.resultados.map((r) => (
                <tr key={r.factor} style={r.factor === resultadosOptimizacion.mejorFactor ? { fontWeight: "bold", background: "#e6ffe6" } : {}}>
                  <td>{r.factor}</td>
                  <td>{r.sumaBeneficioSinCambio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optNTitulo}</h2>
      <p>{t.optNDesc}</p>
      <button onClick={optimizarNumeroComponentes} disabled={cargandoOptimizacionN}>
        {cargandoOptimizacionN ? t.optNBotonCargando : t.optNBoton}
      </button>

      {errorOptimizacionN && <p style={{ color: "crimson" }}>{t.error}: {errorOptimizacionN}</p>}

      <p style={{ marginTop: 8 }}>
        {t.nUsado} <b>{nComponentes}</b>
        {resultadosOptimizacionN && t.calculadoAuto}
      </p>

      {resultadosOptimizacionN && (
        <details style={{ marginTop: 8 }}>
          <summary>{t.verNumerosProbados}</summary>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", marginTop: 4 }}>
            <thead>
              <tr><th>{t.colNComponentes}</th><th>{t.colSumaBeneficio}</th></tr>
            </thead>
            <tbody>
              {resultadosOptimizacionN.resultados.map((r) => (
                <tr key={r.nComponentes} style={r.nComponentes === resultadosOptimizacionN.mejorNComponentes ? { fontWeight: "bold", background: "#e6ffe6" } : {}}>
                  <td>{r.nComponentes}</td>
                  <td>{r.sumaBeneficioSinCambio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optMaxTitulo}</h2>
      <p>{t.optMaxDesc}</p>
      <button onClick={optimizarTopeDiversificacion} disabled={cargandoOptimizacionMax}>
        {cargandoOptimizacionMax ? t.optMaxBotonCargando : t.optMaxBoton}
      </button>

      {errorOptimizacionMax && <p style={{ color: "crimson" }}>{t.error}: {errorOptimizacionMax}</p>}

      <p style={{ marginTop: 8 }}>
        {t.maxUsado} <b>{pesoMaximo}%</b>
        {resultadosOptimizacionMax && t.calculadoAuto}
      </p>

      {resultadosOptimizacionMax && (
        <details style={{ marginTop: 8 }}>
          <summary>{t.verTopesProbados}</summary>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", marginTop: 4 }}>
            <thead>
              <tr><th>{t.colTopePct}</th><th>{t.colSumaBeneficio}</th></tr>
            </thead>
            <tbody>
              {resultadosOptimizacionMax.resultados.map((r) => (
                <tr key={r.pesoMaximo} style={r.pesoMaximo === resultadosOptimizacionMax.mejorPesoMaximo ? { fontWeight: "bold", background: "#e6ffe6" } : {}}>
                  <td>{r.pesoMaximo}</td>
                  <td>{r.sumaBeneficioSinCambio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optFrecuenciaTitulo}</h2>
      <p>{t.optFrecuenciaDesc}</p>
      <button onClick={optimizarFrecuenciaRebalanceo} disabled={cargandoOptimizacionFrecuencia}>
        {cargandoOptimizacionFrecuencia ? t.optFrecuenciaBotonCargando : t.optFrecuenciaBoton}
      </button>

      {errorOptimizacionFrecuencia && <p style={{ color: "crimson" }}>{t.error}: {errorOptimizacionFrecuencia}</p>}

      <p style={{ marginTop: 8 }}>
        {t.frecuenciaUsada}{" "}
        <select
          value={frecuenciaRebalanceo}
          onChange={(e) => {
            const v = e.target.value;
            setFrecuenciaRebalanceo(v === "diario" ? "diario" : Number(v));
            setResultadosOptimizacionFrecuencia(null);
          }}
        >
          <option value="diario">{t.frecuenciaDiaria}</option>
          {Array.from({ length: nComponentes }, (_, i) => nComponentes - 1 - i).map((k) => (
            <option key={k} value={k}>{t.frecuenciaUmbral(k)}</option>
          ))}
        </select>
        {resultadosOptimizacionFrecuencia && t.calculadoAuto}
      </p>

      {resultadosOptimizacionFrecuencia && (
        <details style={{ marginTop: 8 }}>
          <summary>{t.verFrecuenciasProbadas}</summary>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", marginTop: 4 }}>
            <thead>
              <tr><th>{t.colFrecuenciaProbada}</th><th>{t.colSumaBeneficio}</th></tr>
            </thead>
            <tbody>
              {resultadosOptimizacionFrecuencia.resultados.map((r) => (
                <tr key={r.frecuencia} style={r.frecuencia === resultadosOptimizacionFrecuencia.mejorFrecuenciaRebalanceo ? { fontWeight: "bold", background: "#e6ffe6" } : {}}>
                  <td>{r.frecuencia === "diario" ? t.frecuenciaDiaria : t.frecuenciaUmbral(r.frecuencia)}</td>
                  <td>{r.sumaBeneficioSinCambio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optDiasTitulo}</h2>
      <p>{t.optDiasDesc}</p>
      <p>
        {t.diasUsado}{" "}
        <select value={diasVentana} onChange={(e) => setDiasVentana(Number(e.target.value))}>
          {[20, 30, 50, 80, 120].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </p>

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionTitulo}</h2>
      <p>{t.seleccionDesc(nComponentes, pesoMaximo)}</p>
      <button onClick={realizarSeleccion} disabled={cargandoSeleccion}>
        {cargandoSeleccion ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>
      <br />
      <button
        onClick={() => setMostrarResumen((v) => !v)}
        disabled={!seleccion}
        style={{ marginTop: 8 }}
      >
        {mostrarResumen ? t.ocultarResumen : t.mostrarResumen}
      </button>

      {errorSeleccion && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccion}</p>}

      {seleccion && (
        <div style={{ marginTop: 20 }}>
          {seleccion.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.djEtiqueta}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{c.ticker} — {NOMBRES[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccion && mostrarResumen && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccion.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccion.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccion.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccion.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceDowJonesFechas(seleccion.rentabilidadIndice.fechaInicio, seleccion.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccion.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccion.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccion.rentabilidadCarteraAnterior.rentabilidadPct >= seleccion.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccion.rentabilidadCarteraAnterior.rentabilidadPct - seleccion.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccion.rentabilidadIndice.rentabilidadPct - seleccion.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccion.correlacionBeneficioIndice !== null && seleccion.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion}{" "}
              <b>{seleccion.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionVecesTitulo}</h2>
      <p>{modoVeces === "real" ? t.seleccionVecesDescReal(sesionesVeces) : t.seleccionVecesDescAnalisis(sesionesVeces)}</p>

      <p>
        {t.modoVecesEtiqueta}{" "}
        <select value={modoVeces} onChange={(e) => { setModoVeces(e.target.value); setSeleccionVeces(null); }}>
          <option value="analisis">{t.modoVecesAnalisis}</option>
          <option value="real">{t.modoVecesReal}</option>
        </select>
      </p>
      <p>
        {t.sesionesVecesEtiqueta}{" "}
        <select value={sesionesVeces} onChange={(e) => setSesionesVeces(Number(e.target.value))}>
          {[5, 10, 15, 20, 30].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </p>

      <button onClick={realizarSeleccionVeces} disabled={cargandoSeleccionVeces}>
        {cargandoSeleccionVeces ? t.seleccionVecesBotonCargando : t.seleccionVecesBoton}
      </button>

      {errorSeleccionVeces && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionVeces}</p>}

      {seleccionVeces && seleccionVeces.modo === "real" && (
        <div style={{ marginTop: 16 }}>
          <h3>{t.carteraHoyTitulo(seleccionVeces.fechaReferencia)}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colVecesEnPeriodo}</th><th>{t.colPeso}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {seleccionVeces.carteraHoy.map((c) => (
                <tr key={c.ticker}>
                  <td>{c.ticker} — {NOMBRES[c.ticker]}</td>
                  <td>{c.veces}</td>
                  <td>{c.peso}%</td>
                  <td>{c.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seleccionVeces && seleccionVeces.modo !== "real" && (
        <div style={{ marginTop: 16 }}>
          <h3>{t.elegidosPorVecesTitulo}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colVecesEnPeriodo}</th></tr>
            </thead>
            <tbody>
              {seleccionVeces.elegidosPorVeces.map((e) => (
                <tr key={e.ticker}>
                  <td>{e.ticker} — {NOMBRES[e.ticker]}</td>
                  <td>{e.veces}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>
            {t.carteraFijaTitulo(seleccionVeces.historico[seleccionVeces.historico.length - 1].fecha)}
          </h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {seleccionVeces.historico[seleccionVeces.historico.length - 1].cartera.map((c) => (
                <tr key={c.ticker}>
                  <td>{c.ticker} — {NOMBRES[c.ticker]}</td>
                  <td>{c.peso}%</td>
                  <td>{c.puntuacion}</td>
                  <td>{c.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>{t.expectativaRentabilidad}</h3>
          <p style={{ fontSize: "1.2em" }}>
            {t.modelo}{" "}
            <b style={{ color: seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionVeces.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceDowJonesFechas(seleccionVeces.rentabilidadIndice.fechaInicio, seleccionVeces.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionVeces.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionVeces.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionVeces.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct - seleccionVeces.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionVeces.rentabilidadIndice.rentabilidadPct - seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionVolumenTitulo}</h2>
      <p>{t.seleccionVolumenDesc(nComponentes, pesoMaximo)}</p>
      <button onClick={realizarSeleccionVolumen} disabled={cargandoSeleccionVolumen}>
        {cargandoSeleccionVolumen ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>

      {errorSeleccionVolumen && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionVolumen}</p>}

      {seleccionVolumen && (
        <div style={{ marginTop: 20 }}>
          {seleccionVolumen.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.djEtiqueta}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{c.ticker} — {NOMBRES[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccionVolumen && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccionVolumen.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionVolumen.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceDowJonesFechas(seleccionVolumen.rentabilidadIndice.fechaInicio, seleccionVolumen.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionVolumen.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionVolumen.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionVolumen.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct - seleccionVolumen.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionVolumen.rentabilidadIndice.rentabilidadPct - seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccionVolumen.correlacionBeneficioIndice !== null && seleccionVolumen.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion}{" "}
              <b>{seleccionVolumen.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionFlujoTitulo}</h2>
      <p>{t.seleccionFlujoDesc(nComponentes, pesoMaximo)}</p>
      <button onClick={realizarSeleccionFlujo} disabled={cargandoSeleccionFlujo}>
        {cargandoSeleccionFlujo ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>

      {errorSeleccionFlujo && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionFlujo}</p>}

      {seleccionFlujo && (
        <div style={{ marginTop: 20 }}>
          {seleccionFlujo.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.djEtiqueta}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{c.ticker} — {NOMBRES[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccionFlujo && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccionFlujo.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionFlujo.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceDowJonesFechas(seleccionFlujo.rentabilidadIndice.fechaInicio, seleccionFlujo.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionFlujo.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionFlujo.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionFlujo.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct - seleccionFlujo.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionFlujo.rentabilidadIndice.rentabilidadPct - seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccionFlujo.correlacionBeneficioIndice !== null && seleccionFlujo.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion}{" "}
              <b>{seleccionFlujo.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionVecesVolumenTitulo}</h2>
      <p>{modoVecesVolumen === "real" ? t.seleccionVecesVolumenDescReal(sesionesVecesVolumen) : t.seleccionVecesVolumenDescAnalisis(sesionesVecesVolumen)}</p>

      <p>
        {t.modoVecesEtiqueta}{" "}
        <select value={modoVecesVolumen} onChange={(e) => { setModoVecesVolumen(e.target.value); setSeleccionVecesVolumen(null); }}>
          <option value="analisis">{t.modoVecesAnalisis}</option>
          <option value="real">{t.modoVecesReal}</option>
        </select>
      </p>
      <p>
        {t.sesionesVecesEtiqueta}{" "}
        <select value={sesionesVecesVolumen} onChange={(e) => setSesionesVecesVolumen(Number(e.target.value))}>
          {[5, 10, 15, 20, 30].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </p>

      <button onClick={realizarSeleccionVecesVolumen} disabled={cargandoSeleccionVecesVolumen}>
        {cargandoSeleccionVecesVolumen ? t.seleccionVecesBotonCargando : t.seleccionVecesBoton}
      </button>

      {errorSeleccionVecesVolumen && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionVecesVolumen}</p>}

      {seleccionVecesVolumen && seleccionVecesVolumen.modo === "real" && (
        <div style={{ marginTop: 16 }}>
          <h3>{t.carteraHoyTitulo(seleccionVecesVolumen.fechaReferencia)}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colVecesEnPeriodo}</th><th>{t.colPeso}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {seleccionVecesVolumen.carteraHoy.map((c) => (
                <tr key={c.ticker}>
                  <td>{c.ticker} — {NOMBRES[c.ticker]}</td>
                  <td>{c.veces}</td>
                  <td>{c.peso}%</td>
                  <td>{c.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seleccionVecesVolumen && seleccionVecesVolumen.modo !== "real" && (
        <div style={{ marginTop: 16 }}>
          <h3>{t.elegidosPorVecesTitulo}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colVecesEnPeriodo}</th></tr>
            </thead>
            <tbody>
              {seleccionVecesVolumen.elegidosPorVeces.map((e) => (
                <tr key={e.ticker}>
                  <td>{e.ticker} — {NOMBRES[e.ticker]}</td>
                  <td>{e.veces}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>
            {t.carteraFijaTitulo(seleccionVecesVolumen.historico[seleccionVecesVolumen.historico.length - 1].fecha)}
          </h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {seleccionVecesVolumen.historico[seleccionVecesVolumen.historico.length - 1].cartera.map((c) => (
                <tr key={c.ticker}>
                  <td>{c.ticker} — {NOMBRES[c.ticker]}</td>
                  <td>{c.peso}%</td>
                  <td>{c.puntuacion}</td>
                  <td>{c.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>{t.expectativaRentabilidad}</h3>
          <p style={{ fontSize: "1.2em" }}>
            {t.modelo}{" "}
            <b style={{ color: seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionVecesVolumen.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceDowJonesFechas(seleccionVecesVolumen.rentabilidadIndice.fechaInicio, seleccionVecesVolumen.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct - seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct - seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionAleatoriaTitulo}</h2>
      <p>{t.seleccionAleatoriaDesc(nComponentes, pesoMaximo)}</p>
      <button onClick={realizarSeleccionAleatoria} disabled={cargandoSeleccionAleatoria}>
        {cargandoSeleccionAleatoria ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>

      {errorSeleccionAleatoria && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionAleatoria}</p>}

      {seleccionAleatoria && (
        <div style={{ marginTop: 20 }}>
          {seleccionAleatoria.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colAleatorio}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.djEtiqueta}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colAleatorio}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{c.ticker} — {NOMBRES[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccionAleatoria && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccionAleatoria.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionAleatoria.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceDowJonesFechas(seleccionAleatoria.rentabilidadIndice.fechaInicio, seleccionAleatoria.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionAleatoria.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionAleatoria.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionAleatoria.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct - seleccionAleatoria.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionAleatoria.rentabilidadIndice.rentabilidadPct - seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccionAleatoria.correlacionBeneficioIndice !== null && seleccionAleatoria.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion}{" "}
              <b>{seleccionAleatoria.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.analisisCorrelacionTitulo}</h2>
      <p>{t.analisisCorrelacionDesc}</p>
      <button onClick={realizarAnalisisCorrelacion} disabled={cargandoAnalisisCorrelacion}>
        {cargandoAnalisisCorrelacion ? t.analisisCorrelacionBotonCargando : t.analisisCorrelacionBoton}
      </button>

      {errorAnalisisCorrelacion && <p style={{ color: "crimson" }}>{t.error}: {errorAnalisisCorrelacion}</p>}

      {analisisCorrelacion && (
        <div style={{ marginTop: 16 }}>
          <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
            <h3 style={{ marginTop: 0 }}>{t.conclusionTitulo}</h3>
            <p>{analisisCorrelacion.conclusion}</p>
          </div>

          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.88em" }}>
            <thead>
              <tr>
                <th>{t.colMetodo}</th>
                <th>{t.colDuracion}</th>
                <th>{t.colRepeticiones}</th>
                <th>{t.colCorrelacionMedia}</th>
                <th>{t.colRentCarteraMedia}</th>
                <th>{t.colRentIndiceMedia}</th>
              </tr>
            </thead>
            <tbody>
              {[...analisisCorrelacion.filas]
                .sort((a, b) => a.duracion - b.duracion || ["precio", "volumen", "flujo", "aleatorio"].indexOf(a.metodo) - ["precio", "volumen", "flujo", "aleatorio"].indexOf(b.metodo))
                .map((fila, i) => (
                  <tr key={i}>
                    <td>{fila.metodo === "precio" ? t.metodoPrecio : fila.metodo === "volumen" ? t.metodoVolumen : fila.metodo === "flujo" ? t.metodoFlujo : t.metodoAleatorio}</td>
                    <td>{fila.duracion}</td>
                    <td>{fila.repeticiones}</td>
                    <td>
                      {fila.correlacionMedia !== null ? fila.correlacionMedia.toFixed(3) : "-"}
                      {fila.correlacionRango && (
                        <span style={{ color: "#666" }}> [{fila.correlacionRango.min.toFixed(3)}, {fila.correlacionRango.max.toFixed(3)}]</span>
                      )}
                    </td>
                    <td>
                      {fila.rentabilidadCarteraMedia !== null ? `${fila.rentabilidadCarteraMedia.toFixed(3)}%` : "-"}
                      {fila.rentabilidadCarteraRango && (
                        <span style={{ color: "#666" }}> [{fila.rentabilidadCarteraRango.min.toFixed(2)}%, {fila.rentabilidadCarteraRango.max.toFixed(2)}%]</span>
                      )}
                    </td>
                    <td>{fila.rentabilidadIndiceMedia !== null ? `${fila.rentabilidadIndiceMedia.toFixed(3)}%` : "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
