// lib/pesosIndiceComun.js
//
// "Correlación de los componentes con el peso en el índice" (menú
// Análisis): ¿los valores con más peso en el índice correlacionan
// más con su movimiento? Es casi una pregunta mecánica —un valor con
// mucho peso ya "es" en parte el propio índice—, así que la
// comprobación de verdad no es solo mirar la correlación bruta, es
// compararla con la correlación frente a "el índice sin ese valor",
// para separar el efecto mecánico (por construcción) del genuino
// (comportamiento real del valor).
//
// LÍMITE DE DATOS: Yahoo Finance solo expone el top 10 de holdings de
// un ETF (ver lib/holdingsEtfComun.js) — el peso REAL solo se conoce
// para esos 10 valores. Para el resto de componentes del índice, se
// puede estimar un peso aproximado a partir de su capitalización de
// mercado relativa, pero SOLO en índices ponderados por capitalización
// (ver PONDERADOS_POR_PRECIO) — en un índice ponderado por precio,
// como el Dow Jones, la capitalización no es un buen indicador del
// peso real, así que ahí no se estima nada: la comprobación se limita
// a los 10 de peso real conocido.

// Índices de nuestro catálogo ponderados por precio (no por
// capitalización) — la capitalización de mercado no sirve de
// aproximación al peso real en estos casos.
export const PONDERADOS_POR_PRECIO = ["dowjones"];

// ---------- Estadística básica ----------

function media(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Empareja dos series por posición, descartando cualquier posición
// donde falte un valor en cualquiera de las dos — imprescindible
// antes de cualquier cálculo estadístico: en JavaScript, "null" en
// una resta se comporta como si fuera CERO (a diferencia de
// "undefined", que da NaN), así que sin este filtro explícito, un
// hueco de datos no rompería nada visiblemente, pero contaminaría el
// resultado en silencio con un "0% de cambio" ficticio ese día.
function emparejarValidos(a, b) {
  const n = Math.min(a.length, b.length);
  const pares = [];
  for (let i = 0; i < n; i++) {
    if (a[i] === null || a[i] === undefined || b[i] === null || b[i] === undefined) continue;
    pares.push([a[i], b[i]]);
  }
  return pares;
}

// Correlación de Pearson entre dos series de incrementos ya
// emparejadas (mismo índice de posición = misma sesión). Null si
// alguna de las dos series no varía (desviación cero) o si no hay
// suficientes puntos.
export function calcularCorrelacionPearson(a, b) {
  const pares = emparejarValidos(a, b);
  const n = pares.length;
  if (n < 3) return null;
  const ma = media(pares.map((p) => p[0]));
  const mb = media(pares.map((p) => p[1]));
  let num = 0;
  let sa = 0;
  let sb = 0;
  for (const [va, vb] of pares) {
    const da = va - ma;
    const db = vb - mb;
    num += da * db;
    sa += da * da;
    sb += db * db;
  }
  const den = Math.sqrt(sa * sb);
  return den > 1e-12 ? Number((num / den).toFixed(4)) : null;
}

// Beta: covarianza(componente, índice) / varianza(índice) — cuánto se
// mueve el componente por cada 1% que se mueve el índice.
export function calcularBeta(componente, indice) {
  const pares = emparejarValidos(componente, indice);
  const n = pares.length;
  if (n < 3) return null;
  const mc = media(pares.map((p) => p[0]));
  const mi = media(pares.map((p) => p[1]));
  let cov = 0;
  let varIndice = 0;
  for (const [vc, vi] of pares) {
    const dc = vc - mc;
    const di = vi - mi;
    cov += dc * di;
    varIndice += di * di;
  }
  return varIndice > 1e-12 ? Number((cov / varIndice).toFixed(4)) : null;
}

// ---------- "Índice sin este valor" ----------
//
// ---------- Incrementos con desfase (E2, E3...) ----------
//
// En vez de la variación de hoy respecto a ayer (desfase 1, la que ya
// usábamos), la variación de hoy respecto a hace "desfase" sesiones —
// precios[t] / precios[t-desfase] - 1. Se solapan entre sí (el tramo
// de hoy y el de ayer comparten casi todos los días de por medio), así
// que no son observaciones independientes entre sí — pero no se
// pierde ninguna información de la serie original al añadirlos como
// columnas extra, solo se gana una vista distinta de la misma serie,
// menos sensible al ruido de un solo día suelto.
//
// null en las primeras "desfase" posiciones (no hay bastante historia
// atrás todavía para calcularlo), y también si falta cualquiera de
// los dos precios que hacen falta.
export function calcularIncrementosDesfase(precios, desfase) {
  const resultado = new Array(precios.length).fill(null);
  for (let t = desfase; t < precios.length; t++) {
    const actual = precios[t];
    const anterior = precios[t - desfase];
    if (actual === null || actual === undefined || anterior === null || anterior === undefined || anterior === 0) continue;
    resultado[t] = actual / anterior - 1;
  }
  return resultado;
}

// Índice_sin_i = (Índice − peso_i × incremento_i) / (1 − peso_i)
//
// No hace falta conocer el peso de ningún otro componente: se resta
// la contribución conocida del valor que se examina, y se reescala lo
// que queda para que vuelva a sumar 100% — como si fuera un índice
// completo por derecho propio. peso_i en tanto por uno (0.08 = 8%),
// no en porcentaje.
export function calcularIndiceExcluyendo(incrementosIndice, incrementosComponente, pesoFraccion) {
  const n = Math.min(incrementosIndice.length, incrementosComponente.length);
  const resultado = new Array(n).fill(null);
  const denominador = 1 - pesoFraccion;
  if (denominador <= 1e-6) return resultado; // un peso del 100% no tiene sentido aquí
  for (let i = 0; i < n; i++) {
    const iIndice = incrementosIndice[i];
    const iComponente = incrementosComponente[i];
    if (iIndice === null || iIndice === undefined || iComponente === null || iComponente === undefined) continue;
    resultado[i] = (iIndice - pesoFraccion * iComponente) / denominador;
  }
  return resultado;
}

// ---------- Estimación de pesos fuera del top 10 ----------
//
// Reparte el peso restante (100% menos la suma de los pesos reales
// conocidos del top 10) entre el resto de componentes, en proporción
// a su capitalización de mercado relativa entre ELLOS — no a partes
// iguales, que introduciría una distorsión sistemática (ver la
// conversación que dio origen a esta herramienta: un reparto plano
// infravalora a los valores justo por debajo del top 10 y sobrevalora
// a los más pequeños del índice).
//
// tickersRestantes: array de tickers sin peso real conocido.
// capitalizacionPorTicker: { ticker: capitalización de mercado (número) }.
// pesoRestanteFraccion: cuánto peso queda por repartir, en tanto por uno.
//
// Devuelve { ticker: pesoEstimadoFraccion }. Un ticker sin
// capitalización válida se queda sin entrada (no se le puede estimar).
export function estimarPesosRestantes(tickersRestantes, capitalizacionPorTicker, pesoRestanteFraccion) {
  const validos = tickersRestantes.filter((tk) => {
    const cap = capitalizacionPorTicker[tk];
    return typeof cap === "number" && !Number.isNaN(cap) && cap > 0;
  });
  const capTotal = validos.reduce((s, tk) => s + capitalizacionPorTicker[tk], 0);
  const estimados = {};
  if (capTotal <= 0) return estimados;
  for (const tk of validos) {
    estimados[tk] = (capitalizacionPorTicker[tk] / capTotal) * pesoRestanteFraccion;
  }
  return estimados;
}
