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

// Correlación de Pearson entre dos series de incrementos ya
// emparejadas (mismo índice de posición = misma sesión). Null si
// alguna de las dos series no varía (desviación cero) o si no hay
// suficientes puntos.
export function calcularCorrelacionPearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const ma = media(a.slice(0, n));
  const mb = media(b.slice(0, n));
  let num = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
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
  const n = Math.min(componente.length, indice.length);
  if (n < 3) return null;
  const mc = media(componente.slice(0, n));
  const mi = media(indice.slice(0, n));
  let cov = 0;
  let varIndice = 0;
  for (let i = 0; i < n; i++) {
    const dc = componente[i] - mc;
    const di = indice[i] - mi;
    cov += dc * di;
    varIndice += di * di;
  }
  return varIndice > 1e-12 ? Number((cov / varIndice).toFixed(4)) : null;
}

// ---------- "Índice sin este valor" ----------
//
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
