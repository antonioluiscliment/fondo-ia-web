// lib/motor.js
//
// Motor de cálculo del modelo: obtención de datos, cálculo de
// incrementos, selección de los 5 componentes y rebalanceo. Se separa
// en este módulo compartido para poder reutilizarlo tanto desde
// pages/api/seleccion.js (una ejecución con un factor de penalización
// dado) como desde pages/api/optimizar.js (muchas ejecuciones, una
// por cada factor candidato).

import * as YahooFinanceNS from "yahoo-finance2";

// Cuando los servidores de Yahoo Finance tienen una caída temporal,
// en vez de devolver JSON con las cotizaciones responden con su
// propia página HTML de mantenimiento ("Could Not Connect", status
// 502, "Will be right back..."). yahoo-finance2 no filtra eso, así
// que el error que llega hasta aquí incluye el HTML completo. Esta
// función lo detecta y lo sustituye por un mensaje claro para el
// usuario, en vez de volcar cientos de líneas de HTML en pantalla.
export function mensajeErrorAmigable(error) {
  const texto = String(error && error.message ? error.message : error);
  const pareceHtmlDeYahoo =
    texto.includes("<!DOCTYPE") ||
    texto.includes("<html") ||
    texto.includes("Could Not Connect") ||
    texto.includes("Will be right back");
  if (pareceHtmlDeYahoo) {
    return "Yahoo Finance no está respondiendo correctamente en este momento (parece una caída temporal de sus servidores, no un problema de la aplicación). Espera unos minutos y vuelve a intentarlo.";
  }
  return texto;
}

export function getYahooFinanceInstance() {
  const candidatos = [
    YahooFinanceNS.default,
    YahooFinanceNS.default && YahooFinanceNS.default.default,
    YahooFinanceNS,
  ];
  for (const Candidato of candidatos) {
    if (typeof Candidato === "function") {
      try {
        const instancia = new Candidato();
        if (instancia && typeof instancia.chart === "function") {
          return instancia;
        }
      } catch (e) {
        // probamos el siguiente candidato
      }
    }
  }
  throw new Error("No se ha podido inicializar yahoo-finance2 correctamente.");
}

export const DIAS = 20;
export const N_COMPONENTES = 5;
export const PESO_MAXIMO = 40;
export const PESO_MAXIMO_TOPE_BUSQUEDA = 70; // límite superior para la búsqueda del tope óptimo (primera prueba)
export const PESO_INICIAL = 20;
export const SESIONES_PUNTUACION = 3; // nº de últimas sesiones cuya suma de incrementos forma la puntuación
export const PESO_MINIMO_PROTEGIDO = 5; // suelo mínimo para un componente protegido
export const FACTOR_PENALIZACION_DEFECTO = 2; // valor original, sustituible por el optimizado
export const FRECUENCIA_REBALANCEO_DEFECTO = "diario"; // "diario" o un entero 0..(nComponentes-1): nº máximo de supervivientes que aún dispara el rebalanceo
export const SESIONES_VECES_DEFECTO = 10; // nº de sesiones del backtest previo usado para elegir cartera por "veces seleccionado"
export const SEMILLA_ALEATORIA_DEFECTO = 42; // semilla fija para la selección aleatoria (reproducible entre ejecuciones)

// El catálogo de tickers de cada índice vive en lib/indices.js: este
// módulo es genérico y recibe siempre los tickers (y, cuando aplica,
// el símbolo del índice de referencia) como parámetro, para poder
// analizar cualquier índice del catálogo sin tocar este fichero.

export async function obtenerCierres(yahooFinance, ticker, dias) {
  const hoy = new Date();
  const desde = new Date();
  desde.setDate(hoy.getDate() - Math.ceil(dias * 1.6) - 5);

  const resultado = await yahooFinance.chart(ticker, {
    period1: desde,
    period2: hoy,
    interval: "1d",
  });

  return resultado.quotes
    .filter((q) => q.close !== null && q.close !== undefined)
    .map((q) => ({
      fecha: q.date.toISOString().slice(0, 10),
      cierre: q.close,
      volumen: q.volume !== null && q.volume !== undefined ? q.volume : null,
    }));
}

// Combina el histórico de cierres diarios con la cotización ACTUAL
// (la que devuelva Yahoo Finance en el momento de la consulta, sea la
// sesión de hoy en curso o el último cierre ya disponible, sin
// aplicar ninguna lógica de horario de mercado por nuestra parte).
// Ese valor sustituye (no duplica) al de "hoy" en el histórico, para
// formar el punto más reciente de la ventana.
export async function obtenerCierresConActual(yahooFinance, ticker, dias) {
  const [historico, cotizacion] = await Promise.all([
    obtenerCierres(yahooFinance, ticker, dias),
    yahooFinance.quote(ticker),
  ]);

  const precioActual = cotizacion.regularMarketPrice;
  const volumenActual =
    cotizacion.regularMarketVolume !== null && cotizacion.regularMarketVolume !== undefined
      ? cotizacion.regularMarketVolume
      : null;
  const fechaActual =
    cotizacion.regularMarketTime instanceof Date
      ? cotizacion.regularMarketTime.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const sinFechaActual = historico.filter((c) => c.fecha !== fechaActual);
  const combinado = [...sinFechaActual, { fecha: fechaActual, cierre: precioActual, volumen: volumenActual }].sort(
    (a, b) => a.fecha.localeCompare(b.fecha)
  );

  return combinado.slice(-dias);
}

// Descarga los cierres de los tickers dados (incluyendo la cotización
// actual como el punto más reciente) y se queda con las fechas
// comunes a todos ellos, tomando las últimas "diasVentana" fechas
// comunes (20 por defecto, configurable).
export async function obtenerDatosAlineados(yahooFinance, diasVentana = DIAS, tickers) {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    throw new Error("obtenerDatosAlineados necesita la lista de tickers del índice a analizar.");
  }
  const porTicker = {};
  for (const ticker of tickers) {
    porTicker[ticker] = await obtenerCierresConActual(yahooFinance, ticker, diasVentana + 5);
  }

  let fechasComunes = null;
  for (const ticker of tickers) {
    const fechas = new Set(porTicker[ticker].map((c) => c.fecha));
    fechasComunes = fechasComunes ? new Set([...fechasComunes].filter((f) => fechas.has(f))) : fechas;
  }
  const fechasOrdenadas = [...fechasComunes].sort().slice(-diasVentana);

  const datosAlineados = {};
  for (const ticker of tickers) {
    const mapaFecha = Object.fromEntries(porTicker[ticker].map((c) => [c.fecha, c]));
    datosAlineados[ticker] = fechasOrdenadas.map((f) => ({
      fecha: f,
      cierre: mapaFecha[f] ? mapaFecha[f].cierre : undefined,
      volumen: mapaFecha[f] ? mapaFecha[f].volumen : null,
    }));
  }

  return { fechas: fechasOrdenadas, datos: datosAlineados };
}

// Generador pseudoaleatorio determinista (mulberry32): a partir de un
// entero semilla produce siempre la misma secuencia de valores entre
// 0 y 1, para que la "selección aleatoria" sea reproducible entre
// ejecuciones con los mismos datos, en vez de cambiar cada vez que se
// recarga la página.
function crearGeneradorAleatorio(semilla) {
  let a = semilla >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Puntuación aleatoria determinista para un ticker en un día concreto:
// combina la semilla fija con el índice de día y el ticker en un
// único entero (una especie de hash simple), y con él se arranca un
// generador nuevo cuyo primer valor se usa como puntuación. Así cada
// (día, ticker) tiene siempre el mismo valor pseudoaleatorio, sin
// tener que arrastrar el estado de un único generador a lo largo de
// todo el recorrido.
function puntuacionAleatoria(semilla, t, ticker) {
  let hash = semilla;
  const cadena = `${t}-${ticker}`;
  for (let i = 0; i < cadena.length; i++) {
    hash = (hash * 31 + cadena.charCodeAt(i)) | 0;
  }
  return crearGeneradorAleatorio(hash >>> 0)();
}

// campo: "cierre" (por defecto) o "volumen". Si algún valor de la
// pareja no está disponible (por ejemplo, volumen null en algún
// ticker o sesión), el incremento de ese día se toma como 0 (neutro)
// en vez de propagar un NaN que rompería la ordenación.
function calcularIncrementos(serie, campo = "cierre") {
  const incrementos = [];
  for (let i = 1; i < serie.length; i++) {
    const anterior = serie[i - 1][campo];
    const actual = serie[i][campo];
    const valido =
      anterior !== null && anterior !== undefined && anterior !== 0 && actual !== null && actual !== undefined;
    incrementos.push(valido ? (actual - anterior) / anterior : 0);
  }
  return incrementos;
}

// Selección de los N componentes con mayor puntuación (suma de los
// incrementos de las últimas SESIONES_PUNTUACION sesiones). No hay
// tratamiento especial por signo: se ordenan los 30 componentes de
// mayor a menor puntuación (sea positiva o negativa) y se toman los
// N primeros. Esto evita el antiguo "problema de signos" (un
// producto de dos incrementos negativos daba un resultado positivo
// engañoso); al sumar en vez de multiplicar, ese problema no se
// produce y no hace falta ninguna regla adicional de comodines.
// Desempate en caso de puntuación igual: orden alfabético del ticker.
function seleccionarTop(scoresDelDia, nComponentes) {
  const ordenados = [...scoresDelDia].sort(
    (a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker)
  );
  return ordenados.slice(0, nComponentes).map((s) => s.ticker);
}

// Elige los nComponentes tickers con mayor contador acumulado de
// veces en cartera (ver contadorApariciones), de entre los del índice
// analizado. Un ticker que nunca apareció en el periodo cuenta como
// 0. Desempate: orden alfabético del ticker, igual que en seleccionarTop.
export function elegirTopPorVeces(contadorApariciones, nComponentes, tickers) {
  const todos = tickers.map((ticker) => ({ ticker, veces: contadorApariciones[ticker] || 0 }));
  todos.sort((a, b) => b.veces - a.veces || a.ticker.localeCompare(b.ticker));
  return todos.slice(0, nComponentes);
}

function aplicarProteccion(carteraAnterior, top5Inicial, pesoInicial) {
  const carteraMap = Object.fromEntries(carteraAnterior.map((c) => [c.ticker, c.peso]));

  const candidatosProtegidos = carteraAnterior
    .filter((c) => c.peso > pesoInicial && !top5Inicial.includes(c.ticker))
    .sort((a, b) => b.peso - a.peso);

  const top5Final = [...top5Inicial];
  const protegidosAplicados = [];

  for (const prot of candidatosProtegidos) {
    for (let i = top5Final.length - 1; i >= 0; i--) {
      const esNuevoEntrante = !carteraMap.hasOwnProperty(top5Final[i]);
      if (esNuevoEntrante) {
        top5Final[i] = prot.ticker;
        protegidosAplicados.push(prot.ticker);
        break;
      }
    }
  }

  return { top5Final, protegidosAplicados };
}

// Reparte un total (peso liberado) a partes iguales entre una lista
// de tickers. Es el único método de reparto vigente (se descartó
// comparar con "proporcional" y "libre" el 22 de julio: en todas las
// pruebas no aportaban mejora relevante frente al reparto fijo, y
// éste es mucho más fácil de auditar a mano).
function repartir(total, tickers) {
  return Object.fromEntries(tickers.map((t) => [t, tickers.length > 0 ? total / tickers.length : 0]));
}

// Cuenta cuántos de los tickers de la cartera actual siguen presentes
// en el nuevo top-N por puntuación (antes de aplicar la protección).
// Un componente protegido que ya no está en el top-N no cuenta como
// superviviente: la protección evita que salga de la cartera, pero no
// evita que se dispare el rebalanceo condicional.
function contarSupervivientes(carteraActual, topInicial) {
  const topSet = new Set(topInicial);
  return carteraActual.reduce((n, c) => n + (topSet.has(c.ticker) ? 1 : 0), 0);
}

// frecuenciaRebalanceo: "diario" (rebalancea siempre, comportamiento
// original), "nunca" (no rebalancea jamás — usado por la selección
// por "veces seleccionado", que mantiene fija la cartera elegida en
// el backtest previo) o un entero 0..(nComponentes-1) — el umbral
// máximo de supervivientes que aún dispara el rebalanceo. Por
// ejemplo, con umbral 2: mientras permanezcan 3, 4 o 5 de los
// componentes actuales en el nuevo top-N, no se rebalancea; en cuanto
// solo permanecen 2 (o menos), sí.
function tocaRebalancear(carteraActual, topInicial, frecuenciaRebalanceo) {
  if (frecuenciaRebalanceo === "diario") return true;
  if (frecuenciaRebalanceo === "nunca") return false;
  return contarSupervivientes(carteraActual, topInicial) <= frecuenciaRebalanceo;
}

// factorPenalizacion: multiplicador aplicado al incremento negativo
// del día para calcular la penalización de un componente protegido.
// Por defecto 2 (valor original), pero es configurable para poder
// probar otros valores en la búsqueda del óptimo.
// El reparto del peso liberado es siempre a partes iguales ("fijo");
// se descartó comparar con otros métodos el 22 de julio.
function rebalancear(
  carteraAnterior,
  top5Inicial,
  mapaScores,
  factorPenalizacion,
  pesoInicial,
  pesoMaximo
) {
  const carteraMap = Object.fromEntries(carteraAnterior.map((c) => [c.ticker, c.peso]));
  const { top5Final, protegidosAplicados } = aplicarProteccion(carteraAnterior, top5Inicial, pesoInicial);

  const permanecen = top5Final.filter(
    (t) => carteraMap.hasOwnProperty(t) && !protegidosAplicados.includes(t)
  );
  const entran = top5Final.filter((t) => !carteraMap.hasOwnProperty(t));
  const salen = carteraAnterior.filter((c) => !top5Final.includes(c.ticker));

  const pesosProtegidos = {};
  let pesoLiberadoPorProtegidos = 0;
  for (const t of protegidosAplicados) {
    const pesoAnterior = carteraMap[t];
    const incrHoy = mapaScores[t].incrActual;
    const penalizacionBruta = Math.abs(incrHoy) * factorPenalizacion * 100;
    const nuevoPeso = Math.max(pesoAnterior - penalizacionBruta, PESO_MINIMO_PROTEGIDO);
    pesosProtegidos[t] = nuevoPeso;
    pesoLiberadoPorProtegidos += pesoAnterior - nuevoPeso;
  }

  const pesoLiberadoSalidas = salen.reduce((s, c) => s + c.peso, 0);
  const pesoLiberadoTotal = pesoLiberadoSalidas + pesoLiberadoPorProtegidos;

  if (salen.length === 0 && protegidosAplicados.length === 0) {
    return carteraAnterior.map((c) => ({ ...c }));
  }

  // Reparto conjunto (vigente desde el 22 julio): el peso liberado
  // se reparte a partes iguales, en un único paso, entre TODOS los
  // no protegidos de la nueva cartera (los que permanecen + los que
  // entran), en vez de separar un "bonus" fijo para los que
  // permanecen y repartir el resto solo entre los entrantes. Es
  // decir: peso liberado / (permanecen + entran) para cada uno.
  const destinatarios = [...permanecen, ...entran];
  const repartoPorDestinatario = repartir(pesoLiberadoTotal, destinatarios);

  let nuevaCartera = [];

  for (const t of permanecen) {
    nuevaCartera.push({ ticker: t, peso: carteraMap[t] + repartoPorDestinatario[t] });
  }

  for (const t of protegidosAplicados) {
    nuevaCartera.push({ ticker: t, peso: pesosProtegidos[t] });
  }

  for (const t of entran) {
    nuevaCartera.push({ ticker: t, peso: repartoPorDestinatario[t] });
  }

  // Tope de peso para nuevos entrantes: no puede recibir más que el
  // componente con menor peso entre los que ya permanecían en
  // cartera (incluidos los protegidos). Con el reparto fijo esto ya
  // se cumple automáticamente (el entrante arranca exactamente en el
  // reparto, mientras que el que permanece suma ese mismo reparto a
  // un peso anterior >= 0); se mantiene igualmente esta comprobación
  // como salvaguarda.
  const yaEnCartera = nuevaCartera.filter(
    (c) => permanecen.includes(c.ticker) || protegidosAplicados.includes(c.ticker)
  );
  if (yaEnCartera.length > 0) {
    const techoEntrante = Math.min(...yaEnCartera.map((c) => c.peso));
    let excedente = 0;
    nuevaCartera = nuevaCartera.map((c) => {
      if (entran.includes(c.ticker) && c.peso > techoEntrante) {
        excedente += c.peso - techoEntrante;
        return { ...c, peso: techoEntrante };
      }
      return c;
    });
    if (excedente > 0) {
      const extraPorTodos = excedente / nuevaCartera.length;
      nuevaCartera = nuevaCartera.map((c) => ({ ...c, peso: c.peso + extraPorTodos }));
    }
  }

  let exceso = 0;
  nuevaCartera = nuevaCartera.map((c) => {
    if (c.peso > pesoMaximo) {
      exceso += c.peso - pesoMaximo;
      return { ...c, peso: pesoMaximo };
    }
    return c;
  });
  if (exceso > 0 && entran.length > 0) {
    const extra = exceso / entran.length;
    nuevaCartera = nuevaCartera.map((c) =>
      entran.includes(c.ticker) ? { ...c, peso: c.peso + extra } : c
    );
  }

  return nuevaCartera;
}


// Rentabilidad total compuesta de las carteras "anteriores" (la
// parte realmente alcanzable del modelo): producto de todos los
// beneficioSinCambio válidos, expresado en porcentaje.
export function calcularRentabilidadTotalCarteraAnterior(historico) {
  const valores = historico.map((d) => d.beneficioSinCambio).filter((v) => v !== null && v !== undefined);
  const producto = valores.reduce((p, v) => p * v, 1);
  return {
    rentabilidadPct: Number(((producto - 1) * 100).toFixed(4)),
    nDias: valores.length,
  };
}

// Rentabilidad del propio índice de referencia entre dos fechas, para
// poder comparar el modelo con "comprar y mantener el índice".
export async function obtenerRentabilidadIndice(yahooFinance, fechaInicioISO, fechaFinISO, simboloIndice) {
  if (!simboloIndice) {
    throw new Error("obtenerRentabilidadIndice necesita el símbolo del índice de referencia (p.ej. '^DJI').");
  }
  const desde = new Date(fechaInicioISO);
  desde.setDate(desde.getDate() - 5);
  const hasta = new Date(fechaFinISO);
  hasta.setDate(hasta.getDate() + 2);

  const resultado = await yahooFinance.chart(simboloIndice, {
    period1: desde,
    period2: hasta,
    interval: "1d",
  });

  const cierres = resultado.quotes
    .filter((q) => q.close !== null && q.close !== undefined)
    .map((q) => ({ fecha: q.date.toISOString().slice(0, 10), cierre: q.close }));

  const inicio = cierres.find((c) => c.fecha === fechaInicioISO) || cierres[0];
  const fin = [...cierres].reverse().find((c) => c.fecha === fechaFinISO) || cierres[cierres.length - 1];

  const ratio = fin.cierre / inicio.cierre;
  return {
    fechaInicio: inicio.fecha,
    fechaFin: fin.fecha,
    rentabilidadPct: Number(((ratio - 1) * 100).toFixed(4)),
  };
}

// Incremento porcentual diario del propio índice de referencia
// (dado por simboloIndice, p.ej. "^DJI" o "^IBEX") para cada fecha del
// array `fechas` (cierre de hoy / cierre de ayer − 1, en puntos
// porcentuales), para poder mostrarlo junto al beneficio de la
// cartera seleccionada cada día. Se descarga con margen de sobra por
// delante y por detrás para poder alinear por fecha exacta y disponer
// siempre de la sesión anterior a la primera fecha pedida. Devuelve
// también los cierres ya descargados (`cierres`) para que quien llame
// pueda calcular además la rentabilidad total del índice en el
// periodo sin tener que hacer una segunda descarga por separado
// (menos llamadas a Yahoo Finance, más margen frente a límites de
// tasa de la API).
export async function obtenerIncrementosIndice(yahooFinance, fechas, simboloIndice) {
  if (!simboloIndice) {
    throw new Error("obtenerIncrementosIndice necesita el símbolo del índice de referencia (p.ej. '^DJI').");
  }
  const desde = new Date(fechas[0]);
  desde.setDate(desde.getDate() - 10);
  const hasta = new Date(fechas[fechas.length - 1]);
  hasta.setDate(hasta.getDate() + 2);

  const resultado = await yahooFinance.chart(simboloIndice, {
    period1: desde,
    period2: hasta,
    interval: "1d",
  });

  const cierres = resultado.quotes
    .filter((q) => q.close !== null && q.close !== undefined)
    .map((q) => ({ fecha: q.date.toISOString().slice(0, 10), cierre: q.close }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const fechasIndice = cierres.map((c) => c.fecha);
  const mapaCierres = Object.fromEntries(cierres.map((c) => [c.fecha, c.cierre]));

  const incrementos = {};
  for (const fecha of fechas) {
    const idx = fechasIndice.indexOf(fecha);
    incrementos[fecha] =
      idx > 0
        ? Number(((mapaCierres[fechasIndice[idx]] / mapaCierres[fechasIndice[idx - 1]] - 1) * 100).toFixed(4))
        : null;
  }
  return { incrementos, cierres };
}

// Coeficiente de correlación de Pearson entre dos series numéricas ya
// emparejadas (un array de pares [x, y], sin null/undefined). Devuelve
// un valor entre -1 y 1, o null si hay menos de 2 pares válidos o si
// alguna de las dos series no tiene variación (varianza 0, división
// por cero).
export function calcularCorrelacion(pares) {
  const n = pares.length;
  if (n < 2) return null;

  const mediaX = pares.reduce((s, [x]) => s + x, 0) / n;
  const mediaY = pares.reduce((s, [, y]) => s + y, 0) / n;

  let numerador = 0;
  let sumaCuadradosX = 0;
  let sumaCuadradosY = 0;
  for (const [x, y] of pares) {
    const dx = x - mediaX;
    const dy = y - mediaY;
    numerador += dx * dy;
    sumaCuadradosX += dx * dx;
    sumaCuadradosY += dy * dy;
  }

  const denominador = Math.sqrt(sumaCuadradosX * sumaCuadradosY);
  return denominador > 0 ? numerador / denominador : null;
}

// --- Funciones puras de búsqueda del óptimo ---------------------------
// Operan directamente sobre (fechas, datos) ya descargados, sin volver
// a llamar a Yahoo Finance. Se usan tanto desde los endpoints
// individuales (optimizar.js, optimizarN.js, optimizarMax.js) como
// desde el test de optimización combinado (testOptimizacion.js), que
// necesita probar muchas combinaciones sin re-descargar los datos
// cada vez.

export function buscarMejorFactor(
  fechas,
  datos,
  { n = N_COMPONENTES, max = PESO_MAXIMO, frecuencia = FRECUENCIA_REBALANCEO_DEFECTO } = {}
) {
  let mejor = null;
  for (let i = 0; i <= 30; i++) {
    const factor = Number((i * 0.1).toFixed(2));
    const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia);
    if (!mejor || sumaBeneficioSinCambio > mejor.suma) mejor = { valor: factor, suma: sumaBeneficioSinCambio };
  }
  return mejor.valor;
}

export function buscarMejorN(
  fechas,
  datos,
  { factor = FACTOR_PENALIZACION_DEFECTO, max = PESO_MAXIMO, frecuencia = FRECUENCIA_REBALANCEO_DEFECTO } = {}
) {
  let mejor = null;
  for (let n = 3; n <= 6; n++) {
    const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia);
    if (!mejor || sumaBeneficioSinCambio > mejor.suma) mejor = { valor: n, suma: sumaBeneficioSinCambio };
  }
  return mejor.valor;
}

export function buscarMejorMax(
  fechas,
  datos,
  { factor = FACTOR_PENALIZACION_DEFECTO, n = N_COMPONENTES, frecuencia = FRECUENCIA_REBALANCEO_DEFECTO } = {}
) {
  const pesoMinimo = 100 / n;
  const candidatos = [];
  for (let m = Math.ceil(pesoMinimo); m < PESO_MAXIMO_TOPE_BUSQUEDA; m += 5) candidatos.push(m);
  candidatos.push(PESO_MAXIMO_TOPE_BUSQUEDA);
  if (!candidatos.includes(Math.round(pesoMinimo * 100) / 100)) candidatos.unshift(Number(pesoMinimo.toFixed(2)));

  let mejor = null;
  for (const max of candidatos) {
    const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia);
    if (!mejor || sumaBeneficioSinCambio > mejor.suma) mejor = { valor: max, suma: sumaBeneficioSinCambio };
  }
  return mejor.valor;
}

// Candidatos probados: "diario" (siempre rebalancea) y cada entero
// entre 0 y nComponentes-1 (el umbral de supervivientes que dispara
// el rebalanceo). Con nComponentes=5 por defecto, son los mismos 6
// candidatos que describiste: diario, ≤4, ≤3, ≤2, ≤1, ≤0.
export function buscarMejorFrecuencia(
  fechas,
  datos,
  { factor = FACTOR_PENALIZACION_DEFECTO, n = N_COMPONENTES, max = PESO_MAXIMO } = {}
) {
  const candidatos = ["diario", ...Array.from({ length: n }, (_, i) => n - 1 - i)];
  let mejor = null;
  for (const frecuencia of candidatos) {
    const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia);
    if (!mejor || sumaBeneficioSinCambio > mejor.suma) mejor = { valor: frecuencia, suma: sumaBeneficioSinCambio };
  }
  return mejor.valor;
}

// Ejecuta una configuración completa (factor, n, max)
// y devuelve el porcentaje de rentabilidad total acumulada (la
// función beneficio compuesta de las carteras anteriores), lista
// para mostrar.
// --- Herramienta de auditoría: puntuaciones de una sesión concreta ---
// Dado un número de sesión dentro de la ventana descargada (1 = la
// más antigua de las diasVentana fechas, diasVentana = la más
// reciente), calcula la puntuación de los 30 componentes en esa
// fecha exactamente igual que calcularSeleccionCompleta, pero sin
// recorrer toda la ventana ni aplicar reglas de cartera/rebalanceo:
// solo la tabla de puntuaciones, para poder comprobarla a mano.
//
// Como la puntuación necesita 3 incrementos previos, y cada
// incremento necesita 2 cierres consecutivos, la primera sesión con
// puntuación calculable es la nº 4 (1-based) dentro de la ventana; la
// última es la propia diasVentana. numeroSesion fuera de ese rango
// lanza un error con el rango válido para que el endpoint lo
// devuelva tal cual.
export function calcularPuntuacionesSesion(fechas, datosPorTicker, numeroSesion) {
  const minimo = SESIONES_PUNTUACION + 1;
  const maximo = fechas.length;
  if (
    !Number.isInteger(numeroSesion) ||
    numeroSesion < minimo ||
    numeroSesion > maximo
  ) {
    throw new Error(
      `El número de sesión debe ser un entero entre ${minimo} y ${maximo} para esta ventana de ${fechas.length} sesiones (hacen falta ${SESIONES_PUNTUACION} incrementos previos).`
    );
  }

  const t = numeroSesion - 1; // índice 0-based dentro de "fechas"

  const puntuaciones = Object.keys(datosPorTicker).map((ticker) => {
    const incrementos = calcularIncrementos(datosPorTicker[ticker]);
    let score = 0;
    for (let k = 1; k <= SESIONES_PUNTUACION; k++) {
      score += incrementos[t - k];
    }
    return {
      ticker,
      puntuacion: Number((score * 100).toFixed(2)),
      precio: Number(datosPorTicker[ticker][t].cierre.toFixed(2)),
    };
  }).sort((a, b) => b.puntuacion - a.puntuacion || a.ticker.localeCompare(b.ticker));

  return { fecha: fechas[t], numeroSesion, puntuaciones };
}

export function calcularBeneficioAcumulado(fechas, datos, factor, n, max, frecuencia = FRECUENCIA_REBALANCEO_DEFECTO) {
  const { historico } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia);
  return calcularRentabilidadTotalCarteraAnterior(historico).rentabilidadPct;
}

// Ejecuta el recorrido completo de la ventana de 20 días con un
// factor de penalización dado, devolviendo el histórico día a día
// más la suma total del "beneficio sin cambio" (el único indicador
// realmente alcanzable, ya que se decide con la información
// disponible el día anterior).
export function calcularSeleccionCompleta(
  fechas,
  datosPorTicker,
  factorPenalizacion = FACTOR_PENALIZACION_DEFECTO,
  nComponentes = N_COMPONENTES,
  pesoMaximo = PESO_MAXIMO,
  frecuenciaRebalanceo = FRECUENCIA_REBALANCEO_DEFECTO,
  carteraInicial = null,
  criterioPuntuacion = "precio",
  semillaAleatoria = SEMILLA_ALEATORIA_DEFECTO
) {
  const pesoInicial = 100 / nComponentes;

  // Los incrementos de PRECIO se usan siempre para la penalización de
  // protección y para el beneficio/peso de la cartera (eso no cambia
  // nunca, siga el criterio que siga el ranking). Los incrementos de
  // VOLUMEN y de FLUJO DE DINERO (precio × volumen, un indicador
  // clásico tipo "money flow": pondera el volumen por la dirección y
  // magnitud del movimiento de precio, no solo la actividad) solo se
  // calculan y se usan para decidir el ranking cuando
  // criterioPuntuacion === "volumen" o "flujo" respectivamente. Con
  // criterioPuntuacion === "aleatorio" no se usa ningún incremento
  // para el ranking: cada componente recibe una puntuación
  // pseudoaleatoria determinista (ver puntuacionAleatoria), distinta
  // cada día pero reproducible.
  const incrementosPrecio = {};
  const incrementosVolumen = {};
  const incrementosFlujo = {};
  for (const ticker of Object.keys(datosPorTicker)) {
    incrementosPrecio[ticker] = calcularIncrementos(datosPorTicker[ticker], "cierre");
    if (criterioPuntuacion === "volumen") {
      incrementosVolumen[ticker] = calcularIncrementos(datosPorTicker[ticker], "volumen");
    }
    if (criterioPuntuacion === "flujo") {
      const serieFlujo = datosPorTicker[ticker].map((dia) => ({
        flujo:
          dia.volumen !== null && dia.volumen !== undefined && dia.cierre !== null && dia.cierre !== undefined
            ? dia.cierre * dia.volumen
            : null,
      }));
      incrementosFlujo[ticker] = calcularIncrementos(serieFlujo, "flujo");
    }
  }
  const incrementosRanking =
    criterioPuntuacion === "volumen"
      ? incrementosVolumen
      : criterioPuntuacion === "flujo"
      ? incrementosFlujo
      : incrementosPrecio;

  const historico = [];
  // Si se da una cartera inicial fija (selección por "veces
  // seleccionado"), se arranca ya con ella en vez de construirla a
  // partir del ranking del primer día; no se considera "primera
  // selección" (se usa beneficioPonderado desde el primer día, ya
  // que sí tiene pesos porcentuales reales asignados).
  let carteraActual = carteraInicial ? carteraInicial.map((c) => ({ ...c })) : null;
  let carteraActualEsPrimera = false;
  let sumaBeneficioSinCambio = 0;
  // Contador acumulado (no racha) de días que cada ticker ha estado
  // en cartera, entrando o permaneciendo. No se reinicia si el
  // ticker sale y luego vuelve a entrar: sigue sumando desde su
  // último valor conocido. Ejemplo: un valor está en la cartera 1
  // (contador 1), no aparece en la cartera 2 (el contador se queda
  // en 1, no se reinicia), y reaparece en la cartera 3 (contador 2).
  const contadorApariciones = {};

  function beneficioSinPonderar(cartera, dia) {
    const tickers = cartera.map((c) => c.ticker);
    const sumaHoy = tickers.reduce((s, tk) => s + datosPorTicker[tk][dia].cierre, 0);
    const sumaAyer = tickers.reduce((s, tk) => s + datosPorTicker[tk][dia - 1].cierre, 0);
    return sumaHoy / sumaAyer;
  }

  function beneficioPonderado(cartera, dia) {
    return cartera.reduce(
      (s, c) => s + (c.peso / 100) * (datosPorTicker[c.ticker][dia].cierre / datosPorTicker[c.ticker][dia - 1].cierre),
      0
    );
  }

  // Cuando no toca rebalancear, no se interviene en el mercado: los
  // mismos tickers se mantienen y cada peso deriva solo con el cambio
  // de cotización de ese día (peso_hoy = peso_ayer × cierre_hoy /
  // cierre_ayer), renormalizando para que la suma siga siendo 100 (la
  // suma matemáticamente ya debería quedar así — cambia proporcionalmente
  // al beneficio ponderado del día — pero se renormaliza para evitar
  // que el redondeo se vaya acumulando sesión tras sesión).
  function derivarPesos(cartera, dia) {
    const derivados = cartera.map((c) => ({
      ticker: c.ticker,
      pesoDerivado: c.peso * (datosPorTicker[c.ticker][dia].cierre / datosPorTicker[c.ticker][dia - 1].cierre),
    }));
    const suma = derivados.reduce((s, d) => s + d.pesoDerivado, 0);
    return derivados.map((d) => ({
      ticker: d.ticker,
      peso: suma > 0 ? (d.pesoDerivado / suma) * 100 : d.pesoDerivado,
    }));
  }

  for (let t = SESIONES_PUNTUACION; t < fechas.length; t++) {
    const scoresDelDia = Object.keys(datosPorTicker).map((ticker) => {
      // incrActual (el incremento de la sesión de hoy) se conserva
      // aparte porque la penalización de protección (sección 9 de
      // las especificaciones) se basa en la caída real de esa
      // sesión concreta, no en la puntuación agregada; siempre en
      // PRECIO, siga el criterio que siga el ranking.
      const incrActual = incrementosPrecio[ticker][t - 1];
      // Puntuación: si el criterio es "aleatorio", un valor
      // pseudoaleatorio determinista (mismo (día, ticker) → mismo
      // valor siempre, con la semilla dada (por defecto la fija
      // SEMILLA_ALEATORIA_DEFECTO, pero parametrizable para poder
      // ejecutar muchas semillas distintas y construir una
      // distribución de control — ver "Análisis de correlación").
      // Si no, la suma de los incrementos (de precio o de volumen,
      // según criterioPuntuacion) de las últimas SESIONES_PUNTUACION
      // sesiones (por defecto 3): incrementosRanking[t-1] es el
      // incremento que termina en el día t (hoy), incrementosRanking[t-2]
      // el que termina en t-1 (ayer), y así sucesivamente. Sumar en vez
      // de multiplicar evita el antiguo problema de signos (un
      // producto de dos incrementos negativos daba positivo).
      let score;
      if (criterioPuntuacion === "aleatorio") {
        score = puntuacionAleatoria(semillaAleatoria, t, ticker);
      } else {
        score = 0;
        for (let k = 1; k <= SESIONES_PUNTUACION; k++) {
          score += incrementosRanking[ticker][t - k];
        }
      }
      return { ticker, score, incrActual };
    });
    const mapaScores = Object.fromEntries(scoresDelDia.map((s) => [s.ticker, s]));

    const topInicial = seleccionarTop(scoresDelDia, nComponentes);

    const carteraAntes = carteraActual ? carteraActual.map((c) => ({ ...c })) : null;
    const carteraAntesEsPrimera = carteraActualEsPrimera;
    // Snapshot del contador tal y como estaba antes de la decisión de
    // hoy, para poder mostrar el valor correcto en "carteraAntes"
    // (que representa la cartera de ayer, ya cerrada).
    const contadorAntes = { ...contadorApariciones };
    let seRebalanceoHoy = null;

    if (carteraActual) {
      seRebalanceoHoy = tocaRebalancear(carteraActual, topInicial, frecuenciaRebalanceo);
      carteraActual = seRebalanceoHoy
        ? rebalancear(carteraActual, topInicial, mapaScores, factorPenalizacion, pesoInicial, pesoMaximo)
        : derivarPesos(carteraActual, t);
      carteraActualEsPrimera = false;
    } else {
      carteraActual = topInicial.map((ticker) => ({ ticker, peso: pesoInicial }));
      carteraActualEsPrimera = true;
    }

    // Se incrementa en 1 el contador de cada ticker presente hoy en
    // cartera (tanto si entra de nuevo como si simplemente
    // permanece), tras la decisión de hoy (rebalanceo, deriva de
    // precio o asignación inicial).
    for (const c of carteraActual) {
      contadorApariciones[c.ticker] = (contadorApariciones[c.ticker] || 0) + 1;
    }

    const beneficio = carteraActualEsPrimera
      ? beneficioSinPonderar(carteraActual, t)
      : beneficioPonderado(carteraActual, t);

    let beneficioSinCambio = null;
    if (carteraAntes) {
      beneficioSinCambio = carteraAntesEsPrimera
        ? beneficioSinPonderar(carteraAntes, t)
        : beneficioPonderado(carteraAntes, t);
      sumaBeneficioSinCambio += beneficioSinCambio;
    }

    historico.push({
      fecha: fechas[t],
      carteraAntes: carteraAntes
        ? carteraAntes.map((c) => ({
            ticker: c.ticker,
            peso: Number(c.peso.toFixed(2)),
            // Puntuación = suma de los incrementos de las últimas
            // SESIONES_PUNTUACION sesiones, expresada en puntos
            // porcentuales (p.ej. 2,35 significa +2,35%).
            puntuacion: Number((mapaScores[c.ticker].score * 100).toFixed(2)),
            // Cotización de cierre de ese ticker ese día, para poder
            // hacer comprobaciones manuales.
            precio: Number(datosPorTicker[c.ticker][t].cierre.toFixed(2)),
            // Contador acumulado de días en cartera hasta esa fecha,
            // inclusive (ver nota junto a contadorApariciones).
            vecesSeleccionado: contadorAntes[c.ticker],
          }))
        : null,
      cartera: carteraActual.map((c) => ({
        ticker: c.ticker,
        peso: Number(c.peso.toFixed(2)),
        puntuacion: Number((mapaScores[c.ticker].score * 100).toFixed(2)),
        precio: Number(datosPorTicker[c.ticker][t].cierre.toFixed(2)),
        vecesSeleccionado: contadorApariciones[c.ticker],
      })),
      beneficio: Number(beneficio.toFixed(6)),
      beneficioSinCambio: beneficioSinCambio !== null ? Number(beneficioSinCambio.toFixed(6)) : null,
      rebalanceado: seRebalanceoHoy,
    });
  }

  return { historico, sumaBeneficioSinCambio, contadorApariciones };
}
