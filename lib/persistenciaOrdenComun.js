// lib/persistenciaOrdenComun.js
//
// "Persistencia del orden de rentabilidad" (menú Análisis): pasado un
// tiempo, unos valores del índice lo han hecho mejor que otros, a
// veces con diferencias llamativas. ¿Los que van arriba en una
// ventana siguen arriba en la siguiente, o el orden se rebaraja cada
// vez?
//
// Es una pregunta deliberadamente más modesta que "¿quién va a subir
// más?" (que es donde han fallado todos los modelos probados en este
// proyecto): aquí no se predice ninguna rentabilidad concreta, solo
// se mide si el ORDEN RELATIVO entre valores tiene alguna inercia. No
// hay ningún modelo que ajustar, ni parámetros que calibrar — solo
// medir y comparar contra el azar —, así que tampoco hay riesgo de
// sobreajuste.
//
// VENTANAS SIN SOLAPE: [1-5] contra [6-10], [6-10] contra [11-15]...
// Si se solaparan ([1-5] contra [2-6]), compartirían 4 de 5 sesiones
// y la correlación saldría alta casi por construcción, sin que eso
// significara ninguna persistencia real.
//
// LÍNEA BASE ALEATORIA: un Spearman medio de, por ejemplo, 0,15 no
// significa nada por sí solo. Se compara con lo que da barajar los
// órdenes al azar muchas veces: si el valor real cae dentro del rango
// que produce el azar, no hay persistencia que reportar. Misma lógica
// de control que ya se usa en "Selección red VS ridge".

// Longitudes de ventana a probar, en la misma serie de Fibonacci que
// las "sesiones promediadas" del resto de la aplicación.
export const LONGITUDES_VENTANA = [1, 2, 3, 5, 8, 13];

// Cuántas repeticiones de barajado aleatorio para construir la línea
// base — suficientes para que el rango sea estable, sin encarecer el
// cálculo (es todo aritmética, no hay ajuste de ningún modelo).
export const REPETICIONES_AZAR = 200;

// Fracción de valores que se consideran "extremos" por cada lado
// (10% arriba, 10% abajo), con un mínimo de 2 para que la medida
// tenga sentido en índices pequeños.
export const FRACCION_EXTREMOS = 0.1;
export const MINIMO_EXTREMOS = 2;

// ---------- Utilidades ----------

function media(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function desviacionTipica(arr) {
  if (arr.length < 2) return null;
  const m = media(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length);
}

// Correlación de Spearman entre dos listas de posiciones (rangos) ya
// emparejadas — mide si el ORDEN coincide, sin que las magnitudes
// influyan. Se calcula como una correlación de Pearson sobre los
// rangos, que es exactamente la definición de Spearman.
export function calcularSpearman(rangosA, rangosB) {
  const n = Math.min(rangosA.length, rangosB.length);
  if (n < 3) return null;
  const ma = media(rangosA.slice(0, n));
  const mb = media(rangosB.slice(0, n));
  let num = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    const da = rangosA[i] - ma;
    const db = rangosB[i] - mb;
    num += da * db;
    sa += da * da;
    sb += db * db;
  }
  const den = Math.sqrt(sa * sb);
  return den > 1e-12 ? num / den : null;
}

// Rentabilidad de cada ticker en la ventana [inicio, fin) — el
// cambio porcentual entre el cierre ANTERIOR al primer día de la
// ventana y el cierre del último día. Se toma el cierre previo
// (inicio-1), no el del propio primer día, porque si no una ventana
// de 1 sesión compararía el precio consigo mismo y daría siempre
// cero: la rentabilidad "de un día" es su cambio respecto al día
// anterior, igual que en el resto de la aplicación.
//
// Null para los tickers sin datos válidos en ese tramo (incluida la
// sesión previa), que quedan excluidos de esa comparación concreta.
function rentabilidadesEnVentana(tickers, precioPorTicker, inicio, fin) {
  const resultado = {};
  if (inicio < 1) return resultado; // sin sesión previa no hay rentabilidad calculable
  for (const ticker of tickers) {
    const serie = precioPorTicker[ticker];
    if (!serie) continue;
    const previo = serie[inicio - 1];
    const ultimo = serie[fin - 1];
    if (previo === null || previo === undefined || previo === 0 || ultimo === null || ultimo === undefined) continue;
    resultado[ticker] = (ultimo / previo - 1) * 100;
  }
  return resultado;
}

// Convierte un objeto {ticker: rentabilidad} en {ticker: posición},
// donde 0 = el más rentable. Solo para los tickers indicados.
function calcularPosiciones(rentabilidades, tickersComunes) {
  const ordenados = [...tickersComunes].sort((a, b) => rentabilidades[b] - rentabilidades[a]);
  const posiciones = {};
  ordenados.forEach((tk, i) => {
    posiciones[tk] = i;
  });
  return { posiciones, ordenados };
}

// Baraja una copia del array (Fisher-Yates), con un generador
// determinista para que el resultado sea reproducible.
function barajar(arr, rng) {
  const copia = [...arr];
  for (let i = copia.length - 1; i > 0; i--) {
    rng.estado = (rng.estado * 1103515245 + 12345) % 2147483648;
    const j = Math.floor((rng.estado / 2147483648) * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ---------- Análisis de una longitud de ventana ----------
//
// Recorre toda la historia disponible en ventanas consecutivas SIN
// SOLAPE, y compara el orden de cada ventana con el de la siguiente.
//
// Devuelve, además del Spearman medio y su línea base aleatoria, la
// persistencia en los extremos: de los N mejores de una ventana,
// cuántos siguen entre los N mejores en la siguiente (y lo mismo con
// los N peores) — más directamente accionable que la correlación
// global, y a veces se comporta distinto.
export function analizarLongitud(tickers, precioPorTicker, numSesiones, longitud, semilla = 20260810) {
  const rng = { estado: semilla };
  const spearmans = [];
  const spearmansAzar = [];
  const aciertosMejores = [];
  const aciertosPeores = [];
  let numExtremos = null;

  // Ventanas consecutivas sin solape: [L,2L), [2L,3L), [3L,4L)...
  // Se empieza en la ventana 1, no en la 0: la ventana 0 arrancaría
  // en la sesión 0 y no tendría sesión previa con la que calcular su
  // rentabilidad (ver rentabilidadesEnVentana).
  const numVentanas = Math.floor(numSesiones / longitud);

  for (let v = 1; v + 1 < numVentanas; v++) {
    const inicioA = v * longitud;
    const inicioB = (v + 1) * longitud;

    const rentA = rentabilidadesEnVentana(tickers, precioPorTicker, inicioA, inicioA + longitud);
    const rentB = rentabilidadesEnVentana(tickers, precioPorTicker, inicioB, inicioB + longitud);

    // Solo los tickers con dato válido en LAS DOS ventanas.
    const comunes = tickers.filter((tk) => rentA[tk] !== undefined && rentB[tk] !== undefined);
    if (comunes.length < 5) continue;

    const { posiciones: posA, ordenados: ordA } = calcularPosiciones(rentA, comunes);
    const { posiciones: posB, ordenados: ordB } = calcularPosiciones(rentB, comunes);

    const rangosA = comunes.map((tk) => posA[tk]);
    const rangosB = comunes.map((tk) => posB[tk]);
    const s = calcularSpearman(rangosA, rangosB);
    if (s !== null) spearmans.push(s);

    // Línea base: mismo cálculo, pero barajando uno de los dos
    // órdenes al azar — cuánto "acuerdo" sale por pura casualidad.
    for (let r = 0; r < Math.max(1, Math.floor(REPETICIONES_AZAR / 20)); r++) {
      const rangosBAzar = barajar(rangosB, rng);
      const sAzar = calcularSpearman(rangosA, rangosBAzar);
      if (sAzar !== null) spearmansAzar.push(sAzar);
    }

    // Extremos: 10% por cada lado (mínimo MINIMO_EXTREMOS).
    const n = Math.max(MINIMO_EXTREMOS, Math.round(comunes.length * FRACCION_EXTREMOS));
    numExtremos = n;
    const mejoresA = new Set(ordA.slice(0, n));
    const mejoresB = new Set(ordB.slice(0, n));
    const peoresA = new Set(ordA.slice(-n));
    const peoresB = new Set(ordB.slice(-n));

    aciertosMejores.push([...mejoresA].filter((tk) => mejoresB.has(tk)).length);
    aciertosPeores.push([...peoresA].filter((tk) => peoresB.has(tk)).length);

    // Cuántos se esperarían por azar: al elegir n de "comunes" al
    // azar, la coincidencia media esperada es n*n/total.
    // (Se calcula fuera del bucle, con el último n conocido.)
  }

  const spearmanMedio = media(spearmans);
  const azarMedio = media(spearmansAzar);
  const azarDesviacion = desviacionTipica(spearmansAzar);

  return {
    longitud,
    numComparaciones: spearmans.length,
    spearmanMedio: spearmanMedio !== null ? Number(spearmanMedio.toFixed(4)) : null,
    azarMedio: azarMedio !== null ? Number(azarMedio.toFixed(4)) : null,
    azarDesviacion: azarDesviacion !== null ? Number(azarDesviacion.toFixed(4)) : null,
    numExtremos,
    aciertosMejoresMedio: media(aciertosMejores) !== null ? Number(media(aciertosMejores).toFixed(3)) : null,
    aciertosPeoresMedio: media(aciertosPeores) !== null ? Number(media(aciertosPeores).toFixed(3)) : null,
  };
}

// Cuántas coincidencias en el top-N cabría esperar por puro azar al
// elegir n de "total" valores: n*n/total. Sirve de referencia para
// leer aciertosMejoresMedio/aciertosPeoresMedio.
export function coincidenciasEsperadasPorAzar(n, total) {
  if (!n || !total || total <= 0) return null;
  return Number(((n * n) / total).toFixed(3));
}
