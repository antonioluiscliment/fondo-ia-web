// lib/fundamentalesComun.js
//
// "Clasificación por fundamentales" (menú "Comparación con red
// neuronal"): reconstruye, para cada sesión de un periodo pasado, qué
// dato fundamental estaba vigente en ese momento — a partir de una
// única consulta de HOY a Yahoo Finance, que trae varios registros
// pasados con su propia fecha (resultados trimestrales/anuales,
// evolución de estimaciones).
//
// EL MECANISMO CENTRAL, "VIGENTE HASTA QUE SE SUPERE": un dato
// publicado en la fecha F se considera válido desde F hasta que
// aparece un dato más reciente que lo sustituye — nunca antes de F
// (eso sería usar información del futuro). Es la misma idea de
// fondo, aplicada aquí a magnitudes económicas en vez de a precios.
//
// TRES FUENTES DISTINTAS DE "FECHA", UNIFICADAS EN UNA SOLA FUNCIÓN:
//   1. Resultados publicados (ingresos, EPS real): cada registro trae
//      su propio endDate/quarter real — cobertura amplia (varios
//      trimestres/años en una sola consulta).
//   2. epsTrend: los 5 puntos (hoy, hace 7, 30, 60, 90 días) no traen
//      fecha explícita, pero SÍ tienen una fecha implícita clara
//      (hoy menos ese desfase) — se les asigna esa fecha y se tratan
//      exactamente igual que los resultados publicados. Cobertura
//      corta: solo cubre los últimos 90 días desde la consulta, por
//      eso el periodo de esta herramienta se limita a un trimestre.
//   3. Reconstruidas con precio: PER, capitalización y rentabilidad
//      por dividendo históricos no vienen de Yahoo con fecha alguna —
//      se calculan combinando el precio real de cada sesión (que sí
//      tenemos completo) con el dato fundamental vigente en ese
//      momento (reconstruido con el mecanismo anterior).
//
// Todo lo que no encaja en ninguna de las tres — cortos, ratios de
// balance, recuento de recomendaciones, revisiones de analistas,
// reparto insider/institucional — se queda como constante de HOY,
// aplicada a todo el periodo, con el mismo sesgo de anticipación ya
// documentado para PER/EPS/PVC desde el principio del proyecto.

// ---------- El mecanismo central ----------

// observaciones: array de { fecha: "AAAA-MM-DD" (string, comparable
// lexicográficamente), valor: number }, en cualquier orden.
// fechasSesiones: array de fechas de sesión, mismo formato, en orden
// cronológico — normalmente el mismo array "fechas" que ya usan el
// resto de herramientas de la aplicación.
//
// Devuelve un array del mismo tamaño que fechasSesiones: para cada
// sesión, el valor de la observación más reciente cuya fecha sea
// MENOR O IGUAL que la de esa sesión — o null si ninguna observación
// es lo bastante antigua todavía (antes de la primera publicación
// conocida).
export function reconstruirSerieVigente(observaciones, fechasSesiones) {
  const validas = observaciones
    .filter((o) => o && o.fecha && o.valor !== null && o.valor !== undefined && !Number.isNaN(o.valor))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  const resultado = new Array(fechasSesiones.length).fill(null);
  let indiceObservacion = 0;
  let vigente = null;

  for (let i = 0; i < fechasSesiones.length; i++) {
    const fechaSesion = fechasSesiones[i];
    while (indiceObservacion < validas.length && validas[indiceObservacion].fecha <= fechaSesion) {
      vigente = validas[indiceObservacion].valor;
      indiceObservacion++;
    }
    resultado[i] = vigente;
  }
  return resultado;
}

// Resta "dias" días naturales a una fecha "AAAA-MM-DD" y devuelve el
// resultado en el mismo formato — para construir la fecha implícita
// de los puntos de epsTrend (hoy, hace 7, hace 30...).
export function restarDias(fechaTexto, dias) {
  const fecha = new Date(fechaTexto + "T00:00:00Z");
  fecha.setUTCDate(fecha.getUTCDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

function aFechaTexto(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ---------- Extracción de observaciones desde los módulos de Yahoo ----------
//
// Cada función devuelve un array de { fecha, valor } listo para
// pasarle a reconstruirSerieVigente. Todas toleran que el módulo no
// exista o venga vacío (devuelven []), para no romper el resto del
// cálculo si a un valor concreto le falta algún módulo.

// incomeStatementHistory / incomeStatementHistoryQuarterly: ingresos
// totales e ingresos netos, con la fecha real de cada ejercicio.
export function extraerResultados(modulo) {
  const registros = (modulo && modulo.incomeStatementHistory) || [];
  const ingresos = [];
  const netos = [];
  for (const r of registros) {
    const fecha = aFechaTexto(r.endDate);
    if (!fecha) continue;
    if (typeof r.totalRevenue === "number") ingresos.push({ fecha, valor: r.totalRevenue });
    if (typeof r.netIncome === "number") netos.push({ fecha, valor: r.netIncome });
  }
  return { ingresos, netos };
}

// earningsHistory: EPS real, EPS estimado, diferencia y sorpresa en %,
// con la fecha de cada trimestre ya publicado.
export function extraerEarningsHistory(modulo) {
  const registros = (modulo && modulo.history) || [];
  const epsReal = [];
  const epsEstimado = [];
  const diferencia = [];
  const sorpresaPct = [];
  for (const r of registros) {
    const fecha = aFechaTexto(r.quarter);
    if (!fecha) continue;
    if (typeof r.epsActual === "number") epsReal.push({ fecha, valor: r.epsActual });
    if (typeof r.epsEstimate === "number") epsEstimado.push({ fecha, valor: r.epsEstimate });
    if (typeof r.epsDifference === "number") diferencia.push({ fecha, valor: r.epsDifference });
    if (typeof r.surprisePercent === "number") sorpresaPct.push({ fecha, valor: r.surprisePercent });
  }
  return { epsReal, epsEstimado, diferencia, sorpresaPct };
}

// earningsTrend: para cada uno de los 4 periodos (0q, +1q, 0y, +1y),
// los 5 puntos (hoy, hace 7/30/60/90 días) se convierten en
// observaciones con su fecha implícita — ver cabecera del fichero.
const DESFASES_EPS_TREND = [
  ["current", 0],
  ["7daysAgo", 7],
  ["30daysAgo", 30],
  ["60daysAgo", 60],
  ["90daysAgo", 90],
];
const PERIODOS_EPS_TREND = ["0q", "+1q", "0y", "+1y"];

export function extraerEpsTrend(modulo, fechaConsulta) {
  const registros = (modulo && modulo.trend) || [];
  const resultado = {};
  for (const periodo of PERIODOS_EPS_TREND) {
    const registro = registros.find((r) => r.period === periodo);
    const observaciones = [];
    if (registro && registro.epsTrend) {
      for (const [campo, dias] of DESFASES_EPS_TREND) {
        const valor = registro.epsTrend[campo];
        if (typeof valor === "number") observaciones.push({ fecha: restarDias(fechaConsulta, dias), valor });
      }
    }
    resultado[periodo] = observaciones;
  }
  return resultado;
}

// Constantes de "hoy" que no admiten reconstrucción histórica — un
// único número por valor, aplicado a todo el periodo del backtest.
export function extraerConstantes({ defaultKeyStatistics, financialData, summaryDetail, majorHoldersBreakdown, recommendationTrend, earningsTrend }) {
  const c = {};
  const dks = defaultKeyStatistics || {};
  const fd = financialData || {};
  const sd = summaryDetail || {};
  const mhb = majorHoldersBreakdown || {};

  c.enterpriseValue = numeroOnull(dks.enterpriseValue);
  c.shortRatio = numeroOnull(dks.shortRatio);
  c.heldPercentInsiders = numeroOnull(dks.heldPercentInsiders ?? mhb.insidersPercentHeld);
  c.heldPercentInstitutions = numeroOnull(dks.heldPercentInstitutions ?? mhb.institutionsPercentHeld);
  c.earningsQuarterlyGrowth = numeroOnull(dks.earningsQuarterlyGrowth);

  c.quickRatio = numeroOnull(fd.quickRatio);
  c.currentRatio = numeroOnull(fd.currentRatio);
  c.debtToEquity = numeroOnull(fd.debtToEquity);

  c.payoutRatio = numeroOnull(sd.payoutRatio);

  // Recuento de recomendaciones del periodo más reciente (0m).
  const rt = ((recommendationTrend || {}).trend || []).find((r) => r.period === "0m") || {};
  c.strongBuy = numeroOnull(rt.strongBuy);
  c.buy = numeroOnull(rt.buy);
  c.hold = numeroOnull(rt.hold);
  c.sell = numeroOnull(rt.sell);
  c.strongSell = numeroOnull(rt.strongSell);

  // Revisiones de analistas del trimestre actual (0q) — recuentos
  // acumulados hasta hoy, no una foto de un punto pasado.
  const trend0q = ((earningsTrend || {}).trend || []).find((r) => r.period === "0q") || {};
  const rev = trend0q.epsRevisions || {};
  c.epsRevisionsUp7d = numeroOnull(rev.upLast7days);
  c.epsRevisionsUp30d = numeroOnull(rev.upLast30days);
  c.epsRevisionsDown7d = numeroOnull(rev.downLast7Days ?? rev.downLast7days);
  c.epsRevisionsDown30d = numeroOnull(rev.downLast30days);

  return c;
}

function numeroOnull(v) {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

// ---------- Reconstruidas con precio histórico real ----------
//
// PER, capitalización y rentabilidad por dividendo históricos no
// vienen de Yahoo con fecha alguna: se calculan combinando el precio
// real de cada sesión con el dato fundamental vigente en ese momento
// (EPS real reconstruido con reconstruirSerieVigente) o con la
// constante de hoy que haga de aproximación razonable (acciones en
// circulación, dividendo anual).

// PER histórico = precio(t) / EPS vigente en t. Null si el EPS
// vigente en esa sesión es null (antes del primer resultado conocido)
// o no positivo (un PER sobre pérdidas no es comparable).
export function calcularPERHistorico(precios, epsVigentePorSesion) {
  return precios.map((p, i) => {
    const eps = epsVigentePorSesion[i];
    if (p === null || p === undefined || eps === null || eps === undefined || eps <= 0) return null;
    return p / eps;
  });
}

// Capitalización histórica = precio(t) × acciones en circulación de
// hoy — las acciones en circulación cambian poco entre trimestres
// (ampliaciones/recompras puntuales), así que usar la cifra de hoy en
// todo el periodo es una aproximación razonable, no exacta.
export function calcularCapitalizacionHistorica(precios, accionesHoy) {
  if (!accionesHoy || accionesHoy <= 0) return precios.map(() => null);
  return precios.map((p) => (p === null || p === undefined ? null : p * accionesHoy));
}

// Rentabilidad por dividendo histórica = dividendo anual de hoy /
// precio(t) — el dividendo por acción cambia pocas veces al año, así
// que la variación real de esta serie viene sobre todo del precio.
export function calcularRentabilidadDividendoHistorica(precios, dividendoAnualHoy) {
  if (!dividendoAnualHoy || dividendoAnualHoy <= 0) return precios.map(() => null);
  return precios.map((p) => (p === null || p === undefined || p <= 0 ? null : dividendoAnualHoy / p));
}

// ---------- Catálogo de variables y ensamblado ----------

// Fechadas de verdad: cada una es una serie que varía sesión a sesión
// según su propio mecanismo de vigencia.
export const VARIABLES_FECHADAS = [
  "ingresosAnual", "netosAnual", "ingresosTrimestral", "netosTrimestral",
  "epsReal", "epsEstimado", "epsDiferencia", "epsSorpresa",
  "epsTrend_0q", "epsTrend_+1q", "epsTrend_0y", "epsTrend_+1y",
];
// Reconstruidas con precio real — varían sesión a sesión porque el
// precio varía, aunque su numerador/denominador fundamental sea fijo.
export const VARIABLES_RECONSTRUIDAS = ["per", "capitalizacion", "rentabilidadDividendo", "beta"];
// Constantes de hoy, sin alternativa mejor — mismo valor en todo el periodo.
export const VARIABLES_CONSTANTES = [
  "enterpriseValue", "shortRatio", "heldPercentInsiders", "heldPercentInstitutions", "earningsQuarterlyGrowth",
  "quickRatio", "currentRatio", "debtToEquity", "payoutRatio",
  "strongBuy", "buy", "hold", "sell", "strongSell",
  "epsRevisionsUp7d", "epsRevisionsUp30d", "epsRevisionsDown7d", "epsRevisionsDown30d",
];
export const NOMBRES_VARIABLES_FUNDAMENTALES = [...VARIABLES_FECHADAS, ...VARIABLES_RECONSTRUIDAS, ...VARIABLES_CONSTANTES];

// Ensambla, para UN valor, el diccionario { nombreVariable: [serie
// alineada a "fechas"] } — combinando las tres categorías. betaSerie
// se calcula aparte (necesita también el precio del índice) y se
// pasa ya lista.
export function construirSeriesTicker(datosModulos, precios, fechas, fechaConsulta, betaSerie) {
  const { ingresos, netos } = extraerResultados(datosModulos.incomeStatementHistory);
  const { ingresos: ingresosQ, netos: netosQ } = extraerResultados(datosModulos.incomeStatementHistoryQuarterly);
  const eh = extraerEarningsHistory(datosModulos.earningsHistory);
  const epsTrendPorPeriodo = extraerEpsTrend(datosModulos.earningsTrend, fechaConsulta);
  const constantes = extraerConstantes(datosModulos);

  const series = {};
  series.ingresosAnual = reconstruirSerieVigente(ingresos, fechas);
  series.netosAnual = reconstruirSerieVigente(netos, fechas);
  series.ingresosTrimestral = reconstruirSerieVigente(ingresosQ, fechas);
  series.netosTrimestral = reconstruirSerieVigente(netosQ, fechas);
  series.epsReal = reconstruirSerieVigente(eh.epsReal, fechas);
  series.epsEstimado = reconstruirSerieVigente(eh.epsEstimado, fechas);
  series.epsDiferencia = reconstruirSerieVigente(eh.diferencia, fechas);
  series.epsSorpresa = reconstruirSerieVigente(eh.sorpresaPct, fechas);
  for (const periodo of ["0q", "+1q", "0y", "+1y"]) {
    series[`epsTrend_${periodo}`] = reconstruirSerieVigente(epsTrendPorPeriodo[periodo], fechas);
  }

  series.per = calcularPERHistorico(precios, series.epsReal);
  series.capitalizacion = calcularCapitalizacionHistorica(precios, datosModulos.sharesOutstanding);
  series.rentabilidadDividendo = calcularRentabilidadDividendoHistorica(precios, datosModulos.dividendRate);
  series.beta = betaSerie;

  for (const nombre of VARIABLES_CONSTANTES) {
    const valor = constantes[nombre];
    series[nombre] = fechas.map(() => valor);
  }

  return series;
}

// ---------- Imputación por media + indicador de disponibilidad ----------
//
// Cuando falta un dato, se sustituye por la media de esa MISMA
// variable entre los demás valores del índice ESE MISMO DÍA — no por
// cero, que introduciría una distorsión (un cero falso arrastraría al
// modelo hacia pensar que ese valor tiene, por ejemplo, ingresos
// nulos). Junto a cada variable se añade una segunda columna, 1 si el
// dato era real o 0 si es la media sustituta — así el modelo puede
// aprender si la propia disponibilidad del dato le importa, sin
// perder el ejemplo entero por un solo hueco.

function numeroValido(v) {
  return typeof v === "number" && !Number.isNaN(v);
}

// Precalcula, para cada variable y cada sesión, la media entre los
// valores disponibles de TODOS los valores del índice ese día — una
// sola vez, para no recalcularla en cada llamada a
// construirVectorCompleto (que se invoca muchas veces).
export function precalcularMedias(seriesPorTicker, tickers, numSesiones) {
  const medias = {};
  for (const nombre of NOMBRES_VARIABLES_FUNDAMENTALES) {
    const serieMedias = new Array(numSesiones);
    for (let t = 0; t < numSesiones; t++) {
      const valores = tickers.map((tk) => seriesPorTicker[tk][nombre][t]).filter(numeroValido);
      serieMedias[t] = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
    }
    medias[nombre] = serieMedias;
  }
  return medias;
}

// Vector de variables (ya con imputación) de un valor en la sesión t
// — 2 columnas por cada una de las NOMBRES_VARIABLES_FUNDAMENTALES:
// el valor (real o la media sustituta) y el indicador de
// disponibilidad (1/0).
export function construirVectorCompleto(seriesPorTicker, medias, ticker, t) {
  const vector = [];
  for (const nombre of NOMBRES_VARIABLES_FUNDAMENTALES) {
    const bruto = seriesPorTicker[ticker][nombre][t];
    const disponible = numeroValido(bruto);
    vector.push(disponible ? bruto : medias[nombre][t]);
    vector.push(disponible ? 1 : 0);
  }
  return vector;
}

export function calcularNumVariablesFundamentales() {
  return NOMBRES_VARIABLES_FUNDAMENTALES.length * 2;
}

