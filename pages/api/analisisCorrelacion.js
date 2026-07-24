// pages/api/analisisCorrelacion.js
//
// Construye una tabla método × duración de backtest, con varias
// repeticiones (ventanas históricas distintas, sin solape entre sí)
// por cada celda, y para el método "aleatorio" además varias semillas
// distintas — para poder valorar si la correlación con el índice y la
// rentabilidad de la selección por precio o por volumen se distinguen
// de verdad de una selección al azar, o si están dentro del rango de
// variación que ya produce el propio azar.
//
// Todo el histórico necesario se descarga UNA SOLA VEZ (una tanda de
// ~380 sesiones para los 30 componentes + el índice), y todas las
// ventanas/repeticiones/semillas se recortan y recalculan en memoria
// a partir de esos mismos datos — así se evita repetir descargas a
// Yahoo Finance por cada celda de la tabla, que es justo lo que
// causaba errores de límite de peticiones en la cadena automática.

import {
  getYahooFinanceInstance,
  obtenerDatosAlineados,
  obtenerIncrementosIndice,
  calcularSeleccionCompleta,
  calcularRentabilidadTotalCarteraAnterior,
  calcularCorrelacion,
  TICKERS,
  FACTOR_PENALIZACION_DEFECTO,
  N_COMPONENTES,
  PESO_MAXIMO,
  FRECUENCIA_REBALANCEO_DEFECTO,
  SESIONES_PUNTUACION,
} from "../../lib/motor";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const DURACIONES = [20, 30, 50, 80, 120];
const MAX_REPETICIONES = 6; // ventanas históricas distintas, sin solape, por duración
const SEMILLAS_ALEATORIO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // semillas de control, distintas de la semilla por defecto (42) de la app

function cortarDatos(datos, desde, hasta) {
  return Object.fromEntries(TICKERS.map((tk) => [tk, datos[tk].slice(desde, hasta)]));
}

// Devuelve las ventanas [inicio, fin) no solapadas de tamaño
// (duracion + SESIONES_PUNTUACION), tantas como quepan hacia atrás
// desde el final del histórico descargado, hasta MAX_REPETICIONES.
function calcularVentanas(totalDias, duracion) {
  const tamano = duracion + SESIONES_PUNTUACION;
  const ventanas = [];
  let fin = totalDias;
  while (ventanas.length < MAX_REPETICIONES && fin - tamano >= 0) {
    ventanas.push({ inicio: fin - tamano, fin });
    fin -= duracion;
  }
  return ventanas;
}

// Rentabilidad del índice entre las fechas de inicio y fin de una
// ventana concreta, a partir de los cierres del índice ya descargados
// (sin nueva llamada de red).
function rentabilidadIndiceEnPeriodo(cierresIndice, fechaInicioObjetivo, fechaFinObjetivo) {
  if (cierresIndice.length === 0) return null;
  const inicio = cierresIndice.find((c) => c.fecha === fechaInicioObjetivo) || cierresIndice[0];
  const fin =
    [...cierresIndice].reverse().find((c) => c.fecha === fechaFinObjetivo) || cierresIndice[cierresIndice.length - 1];
  return Number(((fin.cierre / inicio.cierre - 1) * 100).toFixed(4));
}

// Ejecuta un backtest sobre una ventana concreta y devuelve su
// correlación con el índice y su rentabilidad (de la cartera y del
// propio índice en ese mismo periodo).
function ejecutarVentana(fechas, datos, ventana, criterioPuntuacion, semillaAleatoria, incrementosIndice, cierresIndice, params) {
  const fechasV = fechas.slice(ventana.inicio, ventana.fin);
  const datosV = cortarDatos(datos, ventana.inicio, ventana.fin);

  const { historico } = calcularSeleccionCompleta(
    fechasV,
    datosV,
    params.factor,
    params.n,
    params.max,
    params.frecuencia,
    null,
    criterioPuntuacion,
    semillaAleatoria
  );

  const historicoConIndice = historico.map((dia) => ({
    ...dia,
    incrementoIndice: incrementosIndice[dia.fecha] ?? null,
  }));

  const pares = historicoConIndice
    .filter((dia) => dia.incrementoIndice !== null && dia.incrementoIndice !== undefined)
    .map((dia) => [(dia.beneficio - 1) * 100, dia.incrementoIndice]);
  const correlacion = calcularCorrelacion(pares);

  const rentabilidadCartera = calcularRentabilidadTotalCarteraAnterior(historico).rentabilidadPct;

  const rentabilidadIndice =
    historico.length > 1
      ? rentabilidadIndiceEnPeriodo(cierresIndice, historico[0].fecha, historico[historico.length - 1].fecha)
      : null;

  return { correlacion, rentabilidadCartera, rentabilidadIndice };
}

// Media de un array de correlaciones usando la transformación de
// Fisher (z = atanh(r)), que es la forma correcta de promediar
// coeficientes de correlación sin sesgo; se deshace al final
// (r = tanh(z_medio)). Ignora valores null.
function mediaFisher(correlaciones) {
  const validos = correlaciones.filter((r) => r !== null && r !== undefined && r > -1 && r < 1);
  if (validos.length === 0) return null;
  const zMedio = validos.reduce((s, r) => s + Math.atanh(r), 0) / validos.length;
  return Math.tanh(zMedio);
}

function media(valores) {
  const validos = valores.filter((v) => v !== null && v !== undefined);
  if (validos.length === 0) return null;
  return validos.reduce((s, v) => s + v, 0) / validos.length;
}

function desviacion(valores, mediaValor) {
  const validos = valores.filter((v) => v !== null && v !== undefined);
  if (validos.length < 2 || mediaValor === null) return null;
  const varianza = validos.reduce((s, v) => s + (v - mediaValor) ** 2, 0) / (validos.length - 1);
  return Math.sqrt(varianza);
}

function rango(valores) {
  const validos = valores.filter((v) => v !== null && v !== undefined);
  if (validos.length === 0) return null;
  return { min: Math.min(...validos), max: Math.max(...validos) };
}

// Genera, a partir de la tabla ya agregada, una conclusión en
// castellano describienda si precio y/o volumen se distinguen de la
// selección aleatoria (comparando cada uno, duración a duración, con
// la media y desviación típica de "aleatorio" en esa misma duración
// mediante una puntuación z), y si las correlaciones de los tres
// métodos son o no parecidas entre sí.
function generarConclusion(filas) {
  const porDuracion = {};
  for (const fila of filas) {
    if (!porDuracion[fila.duracion]) porDuracion[fila.duracion] = {};
    porDuracion[fila.duracion][fila.metodo] = fila;
  }

  const METODOS_COMPARABLES = ["precio", "volumen", "flujo"];
  const NOMBRE_METODO = { precio: "por precio", volumen: "por volumen", flujo: "por flujo de dinero" };

  const resumenMetodo = Object.fromEntries(
    METODOS_COMPARABLES.map((m) => [m, { supera: 0, similar: 0, peor: 0, total: 0 }])
  );
  let diferenciasCorrelacion = [];

  for (const duracion of Object.keys(porDuracion)) {
    const grupo = porDuracion[duracion];
    const aleatorio = grupo.aleatorio;
    if (!aleatorio || aleatorio.rentabilidadCarteraMedia === null) continue;

    for (const metodo of METODOS_COMPARABLES) {
      const fila = grupo[metodo];
      if (!fila || fila.rentabilidadCarteraMedia === null) continue;
      const std = aleatorio.rentabilidadCarteraDesv;
      resumenMetodo[metodo].total++;
      if (std && std > 0) {
        const z = (fila.rentabilidadCarteraMedia - aleatorio.rentabilidadCarteraMedia) / std;
        if (z > 0.5) resumenMetodo[metodo].supera++;
        else if (z < -0.5) resumenMetodo[metodo].peor++;
        else resumenMetodo[metodo].similar++;
      } else {
        resumenMetodo[metodo].similar++;
      }

      if (fila.correlacionMedia !== null && aleatorio.correlacionMedia !== null) {
        diferenciasCorrelacion.push(Math.abs(fila.correlacionMedia - aleatorio.correlacionMedia));
      }
    }
  }

  const partes = [];

  for (const metodo of METODOS_COMPARABLES) {
    const r = resumenMetodo[metodo];
    if (r.total === 0) continue;
    const nombre = NOMBRE_METODO[metodo];
    if (r.supera > r.total / 2) {
      partes.push(
        `La selección ${nombre} supera de forma consistente a la selección aleatoria (en ${r.supera} de ${r.total} duraciones probadas), con una rentabilidad media claramente por encima de lo que ya produce el azar — un indicio real de valor, aunque conviene contrastarlo con más periodos históricos antes de confiar en él.`
      );
    } else if (r.peor > r.total / 2) {
      partes.push(
        `La selección ${nombre} queda por debajo de la selección aleatoria en la mayoría de duraciones probadas (${r.peor} de ${r.total}) — no hay indicios de que este criterio aporte valor frente al azar en este periodo.`
      );
    } else {
      partes.push(
        `La selección ${nombre} no se distingue de forma consistente de la selección aleatoria (similar en ${r.similar} de ${r.total} duraciones): su rentabilidad cae dentro del rango normal de variación que ya produce el propio azar.`
      );
    }
  }

  const diferenciaMediaCorrelacion = media(diferenciasCorrelacion);
  if (diferenciaMediaCorrelacion !== null) {
    if (diferenciaMediaCorrelacion < 0.1) {
      partes.push(
        `La correlación con el índice es, además, muy parecida entre los tres métodos (diferencia media de solo ${diferenciaMediaCorrelacion.toFixed(3)} frente al azar) — un indicio de que ese comovimiento es sobre todo un efecto de pertenecer al mismo universo de 30 valores del Dow Jones, no del criterio de selección en sí.`
      );
    } else {
      partes.push(
        `La correlación con el índice sí difiere de forma más notable entre métodos (diferencia media de ${diferenciaMediaCorrelacion.toFixed(3)} frente al azar), lo que sugiere que el criterio de selección influye también en el comovimiento con el mercado, no solo en la rentabilidad.`
      );
    }
  }

  return partes.join(" ");
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const factor = req.query.factor !== undefined ? Number(req.query.factor) : FACTOR_PENALIZACION_DEFECTO;
    const n = req.query.n !== undefined ? Number(req.query.n) : N_COMPONENTES;
    const max = req.query.max !== undefined ? Number(req.query.max) : PESO_MAXIMO;
    const frecuenciaParam = req.query.frecuencia;
    const frecuencia =
      frecuenciaParam === undefined || frecuenciaParam === "diario"
        ? FRECUENCIA_REBALANCEO_DEFECTO
        : Number(frecuenciaParam);
    const params = { factor, n, max, frecuencia };

    const diasTotal = Math.max(...DURACIONES) * MAX_REPETICIONES + SESIONES_PUNTUACION + 20;
    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, diasTotal);
    const { incrementos: incrementosIndice, cierres: cierresIndice } = await obtenerIncrementosIndice(yahooFinance, fechas);

    const filas = [];

    for (const duracion of DURACIONES) {
      const ventanas = calcularVentanas(fechas.length, duracion);
      if (ventanas.length === 0) continue;

      for (const metodo of ["precio", "volumen", "flujo"]) {
        const resultados = ventanas.map((v) =>
          ejecutarVentana(fechas, datos, v, metodo, undefined, incrementosIndice, cierresIndice, params)
        );
        const correlaciones = resultados.map((r) => r.correlacion);
        const rentabilidadesCartera = resultados.map((r) => r.rentabilidadCartera);
        const rentabilidadesIndice = resultados.map((r) => r.rentabilidadIndice);
        const rentCarteraMedia = media(rentabilidadesCartera);
        filas.push({
          metodo,
          duracion,
          repeticiones: ventanas.length,
          correlacionMedia: mediaFisher(correlaciones),
          correlacionRango: rango(correlaciones),
          rentabilidadCarteraMedia: rentCarteraMedia,
          rentabilidadCarteraDesv: desviacion(rentabilidadesCartera, rentCarteraMedia),
          rentabilidadCarteraRango: rango(rentabilidadesCartera),
          rentabilidadIndiceMedia: media(rentabilidadesIndice),
        });
      }

      // Aleatorio: varias semillas × las mismas ventanas.
      const resultadosAleatorio = [];
      for (const semilla of SEMILLAS_ALEATORIO) {
        for (const v of ventanas) {
          resultadosAleatorio.push(
            ejecutarVentana(fechas, datos, v, "aleatorio", semilla, incrementosIndice, cierresIndice, params)
          );
        }
      }
      const correlacionesA = resultadosAleatorio.map((r) => r.correlacion);
      const rentabilidadesCarteraA = resultadosAleatorio.map((r) => r.rentabilidadCartera);
      const rentabilidadesIndiceA = resultadosAleatorio.map((r) => r.rentabilidadIndice);
      const rentCarteraMediaA = media(rentabilidadesCarteraA);
      filas.push({
        metodo: "aleatorio",
        duracion,
        repeticiones: resultadosAleatorio.length,
        correlacionMedia: mediaFisher(correlacionesA),
        correlacionRango: rango(correlacionesA),
        rentabilidadCarteraMedia: rentCarteraMediaA,
        rentabilidadCarteraDesv: desviacion(rentabilidadesCarteraA, rentCarteraMediaA),
        rentabilidadCarteraRango: rango(rentabilidadesCarteraA),
        rentabilidadIndiceMedia: media(rentabilidadesIndiceA),
      });
    }

    const conclusion = generarConclusion(filas);

    res.status(200).json({
      duraciones: DURACIONES,
      maxRepeticiones: MAX_REPETICIONES,
      numSemillas: SEMILLAS_ALEATORIO.length,
      filas,
      conclusion,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
