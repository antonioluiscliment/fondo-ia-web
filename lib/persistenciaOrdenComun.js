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
  const aciertosMejoresAzar = [];
  const aciertosPeoresAzar = [];
  // Recuento de cuántas veces aparece cada valor en la cabeza y en la
  // cola a lo largo de TODAS las comparaciones — permite distinguir
  // dos explicaciones muy distintas de una misma persistencia: que
  // "los buenos siguen siendo buenos" (nombres variados, cada uno
  // manteniéndose un tiempo), o que unos pocos valores muy volátiles
  // copen los extremos una y otra vez, arriba cuando su sector sube y
  // abajo cuando corrige (siempre los mismos nombres). La segunda no
  // es una ventaja explotable, aunque produzca el mismo número.
  const vecesEnCabeza = {};
  const vecesEnCola = {};
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
    // Se hace tanto para el Spearman como para las coincidencias en
    // los extremos: sin la DISPERSIÓN del azar (no solo su valor
    // medio), no hay forma de saber si una diferencia observada es
    // real o entra dentro de lo que el azar produce habitualmente.
    const n = Math.max(MINIMO_EXTREMOS, Math.round(comunes.length * FRACCION_EXTREMOS));
    numExtremos = n;
    const mejoresA = new Set(ordA.slice(0, n));
    const mejoresB = new Set(ordB.slice(0, n));
    const peoresA = new Set(ordA.slice(-n));
    const peoresB = new Set(ordB.slice(-n));

    aciertosMejores.push([...mejoresA].filter((tk) => mejoresB.has(tk)).length);
    aciertosPeores.push([...peoresA].filter((tk) => peoresB.has(tk)).length);

    // Registrar quién aparece en cada extremo (se cuenta la ventana
    // B, la "siguiente", para no contar dos veces la misma ventana al
    // ser A de una comparación y B de la anterior).
    for (const tk of mejoresB) vecesEnCabeza[tk] = (vecesEnCabeza[tk] || 0) + 1;
    for (const tk of peoresB) vecesEnCola[tk] = (vecesEnCola[tk] || 0) + 1;

    for (let r = 0; r < Math.max(1, Math.floor(REPETICIONES_AZAR / 20)); r++) {
      const rangosBAzar = barajar(rangosB, rng);
      const sAzar = calcularSpearman(rangosA, rangosBAzar);
      if (sAzar !== null) spearmansAzar.push(sAzar);

      // Mismo barajado aplicado a los extremos: se reordenan los
      // tickers al azar y se cuenta cuántos del top-n "aleatorio"
      // coinciden con el top-n real de la ventana anterior.
      const comunesBarajados = barajar(comunes, rng);
      const mejoresAzar = new Set(comunesBarajados.slice(0, n));
      const peoresAzar = new Set(comunesBarajados.slice(-n));
      aciertosMejoresAzar.push([...mejoresA].filter((tk) => mejoresAzar.has(tk)).length);
      aciertosPeoresAzar.push([...peoresA].filter((tk) => peoresAzar.has(tk)).length);
    }
  }

  const spearmanMedio = media(spearmans);
  const azarMedio = media(spearmansAzar);
  const azarDesviacion = desviacionTipica(spearmansAzar);

  const redondear = (v) => (v !== null && v !== undefined ? Number(v.toFixed(3)) : null);

  // Ranking de los valores que más veces aparecen en cada extremo, y
  // qué porcentaje del total de plazas de ese extremo acaparan los 5
  // más repetidos — si ese porcentaje es muy alto, la "persistencia"
  // se debe a que unos pocos valores copan los extremos, no a que el
  // orden general tenga inercia.
  const rankearApariciones = (recuento) => {
    const total = Object.values(recuento).reduce((a, b) => a + b, 0);
    const ordenados = Object.entries(recuento)
      .sort((a, b) => b[1] - a[1])
      .map(([ticker, veces]) => ({ ticker, veces, porcentaje: total > 0 ? Number(((veces / total) * 100).toFixed(1)) : null }));
    const top5 = ordenados.slice(0, 5);
    const concentracionTop5 = total > 0 ? Number(((top5.reduce((s, v) => s + v.veces, 0) / total) * 100).toFixed(1)) : null;
    // Cuánto acapararían los 5 primeros si todos los valores pasaran
    // por los extremos por igual — referencia para leer lo anterior.
    const numDistintos = ordenados.length;
    const concentracionUniforme = numDistintos > 0 ? Number(((Math.min(5, numDistintos) / numDistintos) * 100).toFixed(1)) : null;
    return { top: top5, numDistintos, concentracionTop5, concentracionUniforme };
  };

  return {
    longitud,
    numComparaciones: spearmans.length,
    spearmanMedio: spearmanMedio !== null ? Number(spearmanMedio.toFixed(4)) : null,
    azarMedio: azarMedio !== null ? Number(azarMedio.toFixed(4)) : null,
    azarDesviacion: azarDesviacion !== null ? Number(azarDesviacion.toFixed(4)) : null,
    numExtremos,
    aciertosMejoresMedio: redondear(media(aciertosMejores)),
    aciertosPeoresMedio: redondear(media(aciertosPeores)),
    // Media y dispersión de las coincidencias que produce el azar —
    // sin la dispersión, no hay forma de saber si una diferencia
    // observada en los extremos es real o entra dentro de lo normal.
    aciertosMejoresAzarMedio: redondear(media(aciertosMejoresAzar)),
    aciertosMejoresAzarDesviacion: redondear(desviacionTipica(aciertosMejoresAzar)),
    aciertosPeoresAzarMedio: redondear(media(aciertosPeoresAzar)),
    aciertosPeoresAzarDesviacion: redondear(desviacionTipica(aciertosPeoresAzar)),
    aparicionesCabeza: rankearApariciones(vecesEnCabeza),
    aparicionesCola: rankearApariciones(vecesEnCola),
  };
}

// Cuántas coincidencias en el top-N cabría esperar por puro azar al
// elegir n de "total" valores: n*n/total. Sirve de referencia para
// leer aciertosMejoresMedio/aciertosPeoresMedio.
export function coincidenciasEsperadasPorAzar(n, total) {
  if (!n || !total || total <= 0) return null;
  return Number(((n * n) / total).toFixed(3));
}

// ---------- Foto de la situación actual ----------
//
// Horizontes (en sesiones hacia atrás desde HOY) para la tabla de
// mejores y peores del momento.
export const HORIZONTES_ACTUALES = [1, 2, 3, 5];

// Ordena los valores por su rentabilidad hasta HOY en cada uno de los
// horizontes, y devuelve el número de orden (1 = el más rentable) de
// cada uno en cada horizonte — para poder leer de un vistazo si los
// de cabeza lo son en todos los plazos o solo en uno, que es la
// versión "de hoy" de la misma pregunta que responde la tabla de
// persistencia.
//
// Devuelve { mejores, peores }, cada uno con los "cuantos" primeros
// (o últimos) según el orden del horizonte más corto, y la posición
// que ocupa ese valor en CADA horizonte.
export function calcularPosicionesActuales(tickers, precioPorTicker, numSesiones, cuantos) {
  const posicionesPorHorizonte = {};
  const rentabilidadesPorHorizonte = {};

  for (const h of HORIZONTES_ACTUALES) {
    const rentabilidades = {};
    for (const ticker of tickers) {
      const serie = precioPorTicker[ticker];
      if (!serie) continue;
      const hoy = serie[numSesiones - 1];
      const antes = serie[numSesiones - 1 - h];
      if (hoy === null || hoy === undefined || antes === null || antes === undefined || antes === 0) continue;
      rentabilidades[ticker] = (hoy / antes - 1) * 100;
    }
    const ordenados = Object.keys(rentabilidades).sort((a, b) => rentabilidades[b] - rentabilidades[a]);
    const posiciones = {};
    ordenados.forEach((tk, i) => {
      posiciones[tk] = i + 1; // 1 = el más rentable
    });
    posicionesPorHorizonte[h] = posiciones;
    rentabilidadesPorHorizonte[h] = rentabilidades;
  }

  // El orden de referencia (quién sale en la tabla) es el del
  // horizonte más corto — la sesión de hoy respecto a ayer.
  const referencia = HORIZONTES_ACTUALES[0];
  const ordenReferencia = Object.keys(posicionesPorHorizonte[referencia] || {}).sort(
    (a, b) => posicionesPorHorizonte[referencia][a] - posicionesPorHorizonte[referencia][b]
  );

  const construirFila = (ticker) => ({
    ticker,
    posiciones: Object.fromEntries(HORIZONTES_ACTUALES.map((h) => [h, posicionesPorHorizonte[h][ticker] ?? null])),
    rentabilidades: Object.fromEntries(
      HORIZONTES_ACTUALES.map((h) => [
        h,
        rentabilidadesPorHorizonte[h][ticker] !== undefined ? Number(rentabilidadesPorHorizonte[h][ticker].toFixed(3)) : null,
      ])
    ),
  });

  return {
    totalOrdenados: ordenReferencia.length,
    mejores: ordenReferencia.slice(0, cuantos).map(construirFila),
    peores: ordenReferencia.slice(-cuantos).reverse().map(construirFila),
  };
}
