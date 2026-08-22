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

// Yahoo Finance cambia de vez en cuando la forma exacta de sus
// respuestas (campos nuevos, nulos donde antes no los había...), y la
// librería que usamos valida estrictamente cada respuesta contra un
// esquema fijo: cuando la respuesta real no encaja del todo, lanza
// "FailedYahooValidationError" en vez de devolver los datos, aunque
// la información en sí sea perfectamente utilizable. Pasa más a
// menudo con mercados menos habituales para la librería (se ha visto
// con CAC 40, AEX y FTSE MIB, por ejemplo) que con los grandes índices
// estadounidenses.
//
// La propia documentación de la librería recomienda no dejar que esto
// rompa la aplicación: el error trae también un "resultado
// parcialmente validado" (error.result) que casi siempre es
// perfectamente utilizable. Se envuelven aquí, una sola vez, los tres
// métodos que usa toda la aplicación (chart, quote, quoteSummary)
// para recurrir a ese resultado parcial en vez de romper la petición
// — así no hace falta repetir este manejo en cada fichero que llama a
// Yahoo Finance.
function envolverConToleranciaDeValidacion(instancia) {
  for (const metodo of ["chart", "quote", "quoteSummary"]) {
    if (typeof instancia[metodo] !== "function") continue;
    const original = instancia[metodo].bind(instancia);
    instancia[metodo] = async (...args) => {
      try {
        return await original(...args);
      } catch (error) {
        if (error && error.name === "FailedYahooValidationError" && error.result) {
          return error.result;
        }
        throw error;
      }
    };
  }
  return instancia;
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
          return envolverConToleranciaDeValidacion(instancia);
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
export const SESIONES_PUNTUACION_DEFECTO = 3; // nº de últimas sesiones cuya suma de incrementos forma la puntuación (configurable: 3, 5, 8 o 13)
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
//
// Resiliente por ticker: si uno falla al descargar (símbolo puntual
// caído, "delisted", etc.), no rompe la llamada entera — se excluye
// del cálculo de fechas comunes (si no, un solo ticker sin ningún
// dato dejaría la intersección vacía para TODOS) y se le devuelve una
// serie de "sin dato" en cada fecha, exactamente igual que si tuviera
// huecos en todas las sesiones — el resto del código ya sabe manejar
// eso (los `.filter(v => v !== null && v !== undefined)` que hay por
// toda la aplicación). Antes, un solo ticker fallido (p. ej. un
// símbolo que cambió o dejó de cotizar) tiraba abajo la petición
// completa con un error genérico de Yahoo Finance — y como esta
// función la usan casi todas las herramientas de selección y
// análisis, un solo ticker problemático podía romper cualquiera de
// ellas para el índice entero.
export async function obtenerDatosAlineados(yahooFinance, diasVentana = DIAS, tickers) {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    throw new Error("obtenerDatosAlineados necesita la lista de tickers del índice a analizar.");
  }

  const porTicker = {};
  const excluidos = [];
  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        porTicker[ticker] = await obtenerCierresConActual(yahooFinance, ticker, diasVentana + 5);
      } catch (error) {
        porTicker[ticker] = [];
        excluidos.push({ ticker, motivo: mensajeErrorAmigable(error) });
      }
    })
  );

  const tickersConDatos = tickers.filter((t) => porTicker[t].length > 0);
  if (tickersConDatos.length === 0) {
    throw new Error("No se ha podido descargar ningún dato válido para ninguno de los tickers solicitados.");
  }

  // Un ticker con muy poco histórico (una salida a bolsa reciente, un
  // cambio de símbolo, un problema puntual de Yahoo con ese valor
  // concreto) no debe arrastrar la ventana de TODO el índice a su
  // propio tamaño — la intersección de fechas se queda tan corta como
  // el más corto de los tickers que entren en ella. Se excluye de la
  // intersección (igual que ya se excluye a los que fallan del todo)
  // a cualquiera con menos de la mitad de las sesiones pedidas, y se
  // usa solo el resto para fijar la ventana común. Si TODOS quedaran
  // por debajo del umbral (una ventana ya de por sí muy corta), se
  // recurre a todos los que sí tengan datos, para no romper una
  // petición legítima.
  const UMBRAL_COBERTURA_MINIMA = 0.5;
  const minimoSesiones = diasVentana * UMBRAL_COBERTURA_MINIMA;
  let tickersParaInterseccion = tickersConDatos.filter((t) => porTicker[t].length >= minimoSesiones);
  const tickersConPocaCobertura = tickersConDatos.filter((t) => porTicker[t].length < minimoSesiones);
  if (tickersParaInterseccion.length === 0) {
    tickersParaInterseccion = tickersConDatos;
  } else {
    for (const ticker of tickersConPocaCobertura) {
      excluidos.push({
        ticker,
        motivo: `Histórico insuficiente para la ventana pedida (${porTicker[ticker].length} de ${diasVentana} sesiones disponibles).`,
      });
    }
  }

  // Importante: las fechas comunes se calculan SOLO entre los tickers
  // con cobertura suficiente — si se incluyera aquí alguno con muy
  // pocos datos, la intersección se quedaría corta para todos, no
  // solo para él.
  let fechasComunes = null;
  for (const ticker of tickersParaInterseccion) {
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

  return { fechas: fechasOrdenadas, datos: datosAlineados, excluidos };
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
// Formatea un precio de forma segura: si falta (null/undefined, un
// hueco de datos puntual de un ticker que en general sí tiene
// histórico válido, o un ticker completamente excluido que se haya
// colado hasta aquí por algún camino no previsto), devuelve null en
// vez de reventar con ".toFixed de undefined" — mejor mostrar "sin
// dato" que tirar abajo toda la petición por un precio ausente.
function formatearPrecio(cierre) {
  return cierre !== null && cierre !== undefined ? Number(cierre.toFixed(2)) : null;
}

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
// incrementos de las últimas "sesionesPuntuacion" sesiones). No hay
// tratamiento especial por signo: se ordenan los 30 componentes de
// mayor a menor puntuación (sea positiva o negativa) y se toman los
// N primeros. Esto evita el antiguo "problema de signos" (un
// producto de dos incrementos negativos daba un resultado positivo
// engañoso); al sumar en vez de multiplicar, ese problema no se
// produce y no hace falta ninguna regla adicional de comodines.
// Desempate en caso de puntuación igual: orden alfabético del ticker.
function seleccionarTop(scoresDelDia, nComponentes, invertir = false) {
  const ordenados = [...scoresDelDia].sort(
    (a, b) => (invertir ? a.score - b.score : b.score - a.score) || a.ticker.localeCompare(b.ticker)
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
// Umbral de rentabilidad "implausible": por debajo de esto, un
// resultado no se muestra como un número normal, se marca como no
// fiable. No es una cifra sacada de una teoría exacta — es una
// cautela práctica: con una cartera de 3-6 valores grandes y
// líquidos, en las duraciones que maneja esta aplicación (unas pocas
// semanas a unos meses), una caída real y genuina de más del 60% es
// prácticamente descartable salvo un desplome bursátil histórico
// generalizado. Se ha detectado (sin encontrar aún la causa exacta)
// que, en circunstancias puntuales, el cálculo puede arrastrarse hacia
// un resultado así de extremo por un motivo interno no resuelto (una
// sesión sin datos, una división por una cantidad casi nula, o algo
// parecido) — no porque la cartera haya perdido de verdad ese valor.
// Mientras no se localice la causa exacta, es más honesto avisar de
// que el resultado no es fiable que mostrar un número que parece
// real y no lo es.
export const UMBRAL_RENTABILIDAD_IMPLAUSIBLE = -60;

export function calcularRentabilidadTotalCarteraAnterior(historico) {
  const valores = historico.map((d) => d.beneficioSinCambio).filter((v) => v !== null && v !== undefined);
  const producto = valores.reduce((p, v) => p * v, 1);
  const rentabilidadPct = Number(((producto - 1) * 100).toFixed(4));
  return {
    rentabilidadPct,
    nDias: valores.length,
    implausible: rentabilidadPct < UMBRAL_RENTABILIDAD_IMPLAUSIBLE,
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

  if (!inicio || !fin || inicio.cierre === null || inicio.cierre === undefined || inicio.cierre === 0 || fin.cierre === null || fin.cierre === undefined) {
    return { fechaInicio: inicio ? inicio.fecha : fechaInicioISO, fechaFin: fin ? fin.fecha : fechaFinISO, rentabilidadPct: null };
  }

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
  { n = N_COMPONENTES, max = PESO_MAXIMO, frecuencia = FRECUENCIA_REBALANCEO_DEFECTO, sesionesPuntuacion = SESIONES_PUNTUACION_DEFECTO } = {}
) {
  let mejor = null;
  for (let i = 0; i <= 30; i++) {
    const factor = Number((i * 0.1).toFixed(2));
    const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia, null, "precio", undefined, sesionesPuntuacion);
    if (!mejor || sumaBeneficioSinCambio > mejor.suma) mejor = { valor: factor, suma: sumaBeneficioSinCambio };
  }
  return mejor.valor;
}

export function buscarMejorN(
  fechas,
  datos,
  { factor = FACTOR_PENALIZACION_DEFECTO, max = PESO_MAXIMO, frecuencia = FRECUENCIA_REBALANCEO_DEFECTO, sesionesPuntuacion = SESIONES_PUNTUACION_DEFECTO } = {}
) {
  let mejor = null;
  for (let n = 3; n <= 6; n++) {
    const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia, null, "precio", undefined, sesionesPuntuacion);
    if (!mejor || sumaBeneficioSinCambio > mejor.suma) mejor = { valor: n, suma: sumaBeneficioSinCambio };
  }
  return mejor.valor;
}

export function buscarMejorMax(
  fechas,
  datos,
  { factor = FACTOR_PENALIZACION_DEFECTO, n = N_COMPONENTES, frecuencia = FRECUENCIA_REBALANCEO_DEFECTO, sesionesPuntuacion = SESIONES_PUNTUACION_DEFECTO } = {}
) {
  const pesoMinimo = 100 / n;
  const candidatos = [];
  for (let m = Math.ceil(pesoMinimo); m < PESO_MAXIMO_TOPE_BUSQUEDA; m += 5) candidatos.push(m);
  candidatos.push(PESO_MAXIMO_TOPE_BUSQUEDA);
  if (!candidatos.includes(Math.round(pesoMinimo * 100) / 100)) candidatos.unshift(Number(pesoMinimo.toFixed(2)));

  let mejor = null;
  for (const max of candidatos) {
    const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia, null, "precio", undefined, sesionesPuntuacion);
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
  { factor = FACTOR_PENALIZACION_DEFECTO, n = N_COMPONENTES, max = PESO_MAXIMO, sesionesPuntuacion = SESIONES_PUNTUACION_DEFECTO } = {}
) {
  const candidatos = ["diario", ...Array.from({ length: n }, (_, i) => n - 1 - i)];
  let mejor = null;
  for (const frecuencia of candidatos) {
    const { sumaBeneficioSinCambio } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia, null, "precio", undefined, sesionesPuntuacion);
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
export function calcularPuntuacionesSesion(fechas, datosPorTicker, numeroSesion, sesionesPuntuacion = SESIONES_PUNTUACION_DEFECTO, criterioPuntuacion = "precio") {
  const minimo = sesionesPuntuacion + 1;
  const maximo = fechas.length;
  if (
    !Number.isInteger(numeroSesion) ||
    numeroSesion < minimo ||
    numeroSesion > maximo
  ) {
    throw new Error(
      `El número de sesión debe ser un entero entre ${minimo} y ${maximo} para esta ventana de ${fechas.length} sesiones (hacen falta ${sesionesPuntuacion} incrementos previos).`
    );
  }

  const t = numeroSesion - 1; // índice 0-based dentro de "fechas"

  // Mismo cálculo que usa la selección real (ver calcularSeleccionCompleta):
  // por precio siempre; por volumen o por el flujo de dinero (precio ×
  // volumen) solo si se pide ese criterio.
  //
  // Un ticker sin precio válido en el día de hoy (por ejemplo, porque
  // falló al descargarse — ver obtenerDatosAlineados) queda excluido
  // aquí del todo, no solo con puntuación 0: si se dejara entrar con
  // 0, podría acabar seleccionado (0 puede ser la puntuación más alta
  // o más baja del día, según cómo vaya el resto) y luego no habría
  // ningún precio real que mostrar de él.
  const puntuaciones = Object.keys(datosPorTicker)
    .filter((ticker) => datosPorTicker[ticker][t] && datosPorTicker[ticker][t].cierre !== null && datosPorTicker[ticker][t].cierre !== undefined)
    .map((ticker) => {
    let incrementos;
    if (criterioPuntuacion === "volumen") {
      incrementos = calcularIncrementos(datosPorTicker[ticker], "volumen");
    } else if (criterioPuntuacion === "flujo") {
      const serieFlujo = datosPorTicker[ticker].map((dia) => ({
        flujo:
          dia.volumen !== null && dia.volumen !== undefined && dia.cierre !== null && dia.cierre !== undefined
            ? dia.cierre * dia.volumen
            : null,
      }));
      incrementos = calcularIncrementos(serieFlujo, "flujo");
    } else {
      incrementos = calcularIncrementos(datosPorTicker[ticker], "cierre");
    }
    let score = 0;
    for (let k = 1; k <= sesionesPuntuacion; k++) {
      score += incrementos[t - k];
    }
    return {
      ticker,
      puntuacion: Number((score * 100).toFixed(2)),
      precio: formatearPrecio(datosPorTicker[ticker][t].cierre),
    };
  }).sort((a, b) => b.puntuacion - a.puntuacion || a.ticker.localeCompare(b.ticker));

  return { fecha: fechas[t], numeroSesion, criterioPuntuacion, puntuaciones };
}

export function calcularBeneficioAcumulado(fechas, datos, factor, n, max, frecuencia = FRECUENCIA_REBALANCEO_DEFECTO, sesionesPuntuacion = SESIONES_PUNTUACION_DEFECTO) {
  const { historico } = calcularSeleccionCompleta(fechas, datos, factor, n, max, frecuencia, null, "precio", undefined, sesionesPuntuacion);
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
  semillaAleatoria = SEMILLA_ALEATORIA_DEFECTO,
  sesionesPuntuacion = SESIONES_PUNTUACION_DEFECTO,
  invertido = false
) {
  const pesoInicial = 100 / nComponentes;

  // Filtro previo: un ticker sin NINGÚN cierre válido en toda la
  // ventana (por ejemplo, porque falló al descargarse — ver
  // obtenerDatosAlineados, que ahora excluye tickers fallidos en vez
  // de romper la petición entera, pero les deja una serie de "sin
  // dato" en su lugar) se quita aquí del todo, antes de que empiece
  // el backtest día a día. Se hace UNA sola vez al principio, no día
  // a día dentro del bucle: así un ticker participa en todo el
  // backtest o en nada, nunca aparece y desaparece entre sesiones,
  // que rompería el seguimiento de la cartera entre días.
  const datosPorTickerValidos = Object.fromEntries(
    Object.entries(datosPorTicker).filter(([, serie]) => serie.some((dia) => dia.cierre !== null && dia.cierre !== undefined))
  );
  datosPorTicker = datosPorTickerValidos;

  // Relleno por arrastre: un ticker que SÍ pasó el filtro anterior
  // (tiene algún dato válido) puede aun así tener huecos puntuales en
  // días concretos (p. ej. un festivo propio no coincidente, o un
  // fallo de descarga de un solo día). Sin rellenar, dividir por el
  // precio de un día con hueco daría 0/0 o x/0 (NaN o Infinity) en el
  // reparto de beneficio y en la derivación de pesos día a día más
  // abajo — no rompería nada visiblemente (NaN no lanza una
  // excepción), pero corrompería el resultado en silencio, que es
  // peor que un error visible. Se arrastra el último precio/volumen
  // válido conocido (mismo criterio que ya se usa en el modelo de
  // réplica de índice, pages/api/replicaIndice.js).
  //
  // OJO — caso que el arrastre hacia delante NO cubre por sí solo, y
  // que causó un fallo real ya detectado en producción (carteras con
  // una rentabilidad de -100% sin motivo aparente, sobre todo en
  // ventanas largas): si un ticker no tiene NINGÚN precio válido al
  // principio de la ventana (p. ej. se incorporó al índice hace poco
  // y su historial no llega tan atrás como pide una duración larga),
  // esos primeros días se quedan en null — no hay nada anterior de lo
  // que arrastrar todavía. Y en JavaScript, "null" en una suma o
  // división aritmética se comporta como si fuera CERO, no como "sin
  // dato" (a diferencia de "undefined", que da NaN) — así que ese
  // hueco inicial entra en el cálculo como si el precio del valor
  // fuera 0€ esos días, arrastrando el resultado hacia un desplome
  // artificial que, acumulado, puede llegar a un -100% completamente
  // ficticio. Por eso hace falta una SEGUNDA pasada, hacia atrás,
  // rellenando cualquier hueco inicial con el primer precio válido
  // que se encuentre más adelante en la serie.
  for (const ticker of Object.keys(datosPorTicker)) {
    const serie = datosPorTicker[ticker];
    let ultimoCierre = null;
    let ultimoVolumen = null;
    const serieArrastrada = serie.map((dia) => {
      const cierre = dia.cierre !== null && dia.cierre !== undefined && dia.cierre !== 0 ? dia.cierre : ultimoCierre;
      const volumen = dia.volumen !== null && dia.volumen !== undefined ? dia.volumen : ultimoVolumen;
      ultimoCierre = cierre;
      ultimoVolumen = volumen;
      return { ...dia, cierre, volumen };
    });

    let primerCierre = null;
    let primerVolumen = null;
    for (let i = serieArrastrada.length - 1; i >= 0; i--) {
      const dia = serieArrastrada[i];
      if (dia.cierre !== null && dia.cierre !== undefined) primerCierre = dia.cierre;
      if (dia.volumen !== null && dia.volumen !== undefined) primerVolumen = dia.volumen;
      if (dia.cierre === null || dia.cierre === undefined) dia.cierre = primerCierre;
      if (dia.volumen === null || dia.volumen === undefined) dia.volumen = primerVolumen;
    }

    datosPorTicker[ticker] = serieArrastrada;
  }

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

  for (let t = sesionesPuntuacion; t < fechas.length; t++) {
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
      // según criterioPuntuacion) de las últimas "sesionesPuntuacion"
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
        for (let k = 1; k <= sesionesPuntuacion; k++) {
          score += incrementosRanking[ticker][t - k];
        }
      }
      return { ticker, score, incrActual };
    });
    const mapaScores = Object.fromEntries(scoresDelDia.map((s) => [s.ticker, s]));

    const topInicial = seleccionarTop(scoresDelDia, nComponentes, invertido);

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
            // "sesionesPuntuacion" sesiones, expresada en puntos
            // porcentuales (p.ej. 2,35 significa +2,35%).
            puntuacion: Number((mapaScores[c.ticker].score * 100).toFixed(2)),
            // Cotización de cierre de ese ticker ese día, para poder
            // hacer comprobaciones manuales.
            precio: formatearPrecio(datosPorTicker[c.ticker][t].cierre),
            // Contador acumulado de días en cartera hasta esa fecha,
            // inclusive (ver nota junto a contadorApariciones).
            vecesSeleccionado: contadorAntes[c.ticker],
          }))
        : null,
      cartera: carteraActual.map((c) => ({
        ticker: c.ticker,
        peso: Number(c.peso.toFixed(2)),
        puntuacion: Number((mapaScores[c.ticker].score * 100).toFixed(2)),
        precio: formatearPrecio(datosPorTicker[c.ticker][t].cierre),
        vecesSeleccionado: contadorApariciones[c.ticker],
      })),
      beneficio: Number(beneficio.toFixed(6)),
      beneficioSinCambio: beneficioSinCambio !== null ? Number(beneficioSinCambio.toFixed(6)) : null,
      rebalanceado: seRebalanceoHoy,
    });
  }

  return { historico, sumaBeneficioSinCambio, contadorApariciones };
}
// ============================================================
// REVERSIÓN A LA MEDIA
// ============================================================
// Estudia si los componentes que peor se han comportado (respecto al
// índice) en una ventana de "formación" tienden a comportarse mejor
// (revertir) en la ventana de "test" siguiente. Ver diseño acordado:
// esquema telescópico (cada test dobla como formación del ciclo
// siguiente), con modo secuencial (sin solape entre formaciones) o
// solapado (arranque de cada ciclo desplazado 1 sesión, útil cuando
// las ventanas son grandes y el modo secuencial dejaría muy pocos
// ciclos independientes).

export {
  REVERSION_VENTANAS_PRESET,
  REVERSION_MAX_VENTANA,
  REVERSION_PROFUNDIDAD_DEFECTO,
  REVERSION_MAX_PEORES,
  REVERSION_MAX_EXCLUSION,
} from "./reversionMediaConstantes";

// Alinea los cierres del índice de referencia (tal y como los
// devuelve obtenerIncrementosIndice, un array [{fecha, cierre}]) con
// el array de fechas ya usado para los componentes, por posición
// (mismo índice 0..n-1). Si a alguna fecha común le falta el cierre
// del índice (festivo no coincidente, hueco puntual), se arrastra el
// último cierre válido conocido — mismo criterio que ya se usa en
// calcularSeleccionCompleta para los componentes.
export function alinearCierresIndice(fechas, cierresIndice) {
  const mapa = Object.fromEntries(cierresIndice.map((c) => [c.fecha, c.cierre]));
  let ultimo = null;
  return fechas.map((f) => {
    if (mapa[f] !== null && mapa[f] !== undefined) ultimo = mapa[f];
    return ultimo;
  });
}

// Modo secuencial (sin solape): kMax ciclos completos, anclados a la
// última sesión, descartando hacia atrás las sesiones sobrantes más
// antiguas. Cada test dobla como formación del ciclo siguiente
// (comparten exactamente el mismo tramo de sesiones); solo el primer
// ciclo usa "ventanaFormacion" como longitud de formación, el resto
// usan "ventanaTest" (por eso, si ambas coinciden, todo el esquema es
// uniforme).
function generarCiclosSecuencial(nSesiones, ventanaFormacion, ventanaTest) {
  const kMax = Math.floor((nSesiones - 1 - ventanaFormacion) / ventanaTest);
  if (kMax < 1) return [];
  const inicioF1 = nSesiones - 1 - ventanaFormacion - kMax * ventanaTest;
  const ciclos = [];
  let inicioFormacion = inicioF1;
  let finFormacion = inicioFormacion + ventanaFormacion;
  for (let i = 0; i < kMax; i++) {
    const inicioTest = finFormacion;
    const finTest = inicioTest + ventanaTest;
    ciclos.push({ inicioFormacion, finFormacion, inicioTest, finTest });
    // La formación del ciclo siguiente reutiliza el tramo que acaba
    // de servir de test (telescopado).
    inicioFormacion = inicioTest;
    finFormacion = finTest;
  }
  return ciclos;
}

// Modo solapado: el arranque de cada ciclo se desplaza solo 1 sesión
// respecto al anterior (en vez de saltar la ventana entera), así que
// las formaciones consecutivas se solapan casi por completo. Dentro
// de cada ciclo, test sigue empezando justo donde acaba su propia
// formación (sin solape interno). Se busca, de más ciclos a menos, el
// mayor número que quepa anclando el ÚLTIMO test a la sesión más
// reciente.
function generarCiclosSolapado(nSesiones, ventanaFormacion, ventanaTest) {
  for (let k = nSesiones; k >= 1; k--) {
    const longitudUltimaFormacion = k === 1 ? ventanaFormacion : ventanaTest;
    const sK = nSesiones - 1 - longitudUltimaFormacion - ventanaTest;
    const s1 = sK - (k - 1);
    if (s1 < 0) continue;
    const ciclos = [];
    for (let j = 1; j <= k; j++) {
      const sJ = s1 + (j - 1);
      const longFormacion = j === 1 ? ventanaFormacion : ventanaTest;
      const inicioFormacion = sJ;
      const finFormacion = inicioFormacion + longFormacion;
      const inicioTest = finFormacion;
      const finTest = inicioTest + ventanaTest;
      ciclos.push({ inicioFormacion, finFormacion, inicioTest, finTest });
    }
    return ciclos;
  }
  return [];
}

// Cálculo principal. datosPorTicker: mismo formato que en
// calcularSeleccionCompleta ({ ticker: [{fecha, cierre, volumen}, ...] }).
// cierresIndiceAlineados: array de cierres del índice, alineado por
// posición con "fechas" (ver alinearCierresIndice).
export function calcularReversionMedia(
  fechas,
  datosPorTicker,
  cierresIndiceAlineados,
  { ventanaFormacion, ventanaTest = ventanaFormacion, solapado = false, nPeores = 3, nExclusion = 0 } = {}
) {
  if (!Number.isInteger(ventanaFormacion) || ventanaFormacion < 1 || ventanaFormacion > REVERSION_MAX_VENTANA) {
    throw new Error(`La ventana de formación debe ser un entero entre 1 y ${REVERSION_MAX_VENTANA}.`);
  }
  if (!Number.isInteger(ventanaTest) || ventanaTest < 1 || ventanaTest > REVERSION_MAX_VENTANA) {
    throw new Error(`La ventana de test debe ser un entero entre 1 y ${REVERSION_MAX_VENTANA}.`);
  }
  if (!Number.isInteger(nPeores) || nPeores < 1 || nPeores > REVERSION_MAX_PEORES) {
    throw new Error(`El número de valores controlados debe ser un entero entre 1 y ${REVERSION_MAX_PEORES}.`);
  }
  if (!Number.isInteger(nExclusion) || nExclusion < 0 || nExclusion > REVERSION_MAX_EXCLUSION) {
    throw new Error(`El número de exclusiones debe ser un entero entre 0 y ${REVERSION_MAX_EXCLUSION}.`);
  }

  const nSesiones = fechas.length;
  const ciclos = solapado
    ? generarCiclosSolapado(nSesiones, ventanaFormacion, ventanaTest)
    : generarCiclosSecuencial(nSesiones, ventanaFormacion, ventanaTest);

  const tickers = Object.keys(datosPorTicker);

  function ratioTicker(ticker, inicio, fin) {
    const serie = datosPorTicker[ticker];
    const p0 = serie[inicio] ? serie[inicio].cierre : undefined;
    const pt = serie[fin] ? serie[fin].cierre : undefined;
    if (p0 === null || p0 === undefined || p0 === 0 || pt === null || pt === undefined) return null;
    return pt / p0;
  }
  function ratioIndice(inicio, fin) {
    const i0 = cierresIndiceAlineados[inicio];
    const it = cierresIndiceAlineados[fin];
    if (i0 === null || i0 === undefined || i0 === 0 || it === null || it === undefined) return null;
    return it / i0;
  }

  const resultados = ciclos.map((ciclo, idx) => {
    const ratioIndiceFormacion = ratioIndice(ciclo.inicioFormacion, ciclo.finFormacion);

    // Ranking de mejor a peor (Pt/P0 - It/I0); el peor queda al final
    // de la lista, como en el ejemplo del Ibex 35 acordado.
    const scores = tickers
      .map((ticker) => {
        const ratioAccion = ratioTicker(ticker, ciclo.inicioFormacion, ciclo.finFormacion);
        if (ratioAccion === null || ratioIndiceFormacion === null) return null;
        return { ticker, score: ratioAccion - ratioIndiceFormacion };
      })
      .filter((s) => s !== null)
      .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));

    const n = scores.length;
    if (nPeores + nExclusion > n) {
      return {
        ciclo: idx + 1,
        fechaInicioFormacion: fechas[ciclo.inicioFormacion],
        fechaFinFormacion: fechas[ciclo.finFormacion],
        fechaInicioTest: fechas[ciclo.inicioTest],
        fechaFinTest: fechas[ciclo.finTest],
        valores: [],
        avisoInsuficiente: true,
      };
    }
    const seleccionados = scores.slice(n - nPeores - nExclusion, n - nExclusion);

    const ratioIndiceTest = ratioIndice(ciclo.inicioTest, ciclo.finTest);
    const valores = seleccionados.map((s) => {
      const ratioTest = ratioTicker(s.ticker, ciclo.inicioTest, ciclo.finTest);
      const rentabilidadValor = ratioTest !== null ? Number(((ratioTest - 1) * 100).toFixed(3)) : null;
      const rentabilidadIndice = ratioIndiceTest !== null ? Number(((ratioIndiceTest - 1) * 100).toFixed(3)) : null;
      const diferencia =
        rentabilidadValor !== null && rentabilidadIndice !== null
          ? Number((rentabilidadValor - rentabilidadIndice).toFixed(3))
          : null;
      return {
        ticker: s.ticker,
        puntuacionFormacion: Number((s.score * 100).toFixed(3)),
        rentabilidadTest: rentabilidadValor,
        rentabilidadIndiceTest: rentabilidadIndice,
        diferencia,
      };
    });

    return {
      ciclo: idx + 1,
      fechaInicioFormacion: fechas[ciclo.inicioFormacion],
      fechaFinFormacion: fechas[ciclo.finFormacion],
      fechaInicioTest: fechas[ciclo.inicioTest],
      fechaFinTest: fechas[ciclo.finTest],
      valores,
      avisoInsuficiente: false,
    };
  });

  return { ciclos: resultados, nCiclos: resultados.length };
  }
