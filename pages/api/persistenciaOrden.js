// pages/api/persistenciaOrden.js
//
// "Persistencia en el orden relativo" (menú Análisis): ¿los valores
// que van arriba en una ventana siguen arriba en la siguiente? Ver
// lib/persistenciaOrdenComun.js para el detalle del método (ventanas
// consecutivas sin solape, línea base aleatoria, análisis de los
// extremos).
//
// Recorre las 6 primeras longitudes de la serie de Fibonacci (1, 2,
// 3, 5, 8 y 13 sesiones) de una vez, en la misma tabla — así se ve de
// un vistazo si la persistencia crece, decrece o desaparece según la
// escala temporal, en vez de tener que ejecutar seis veces y comparar
// entre ejecuciones.
//
// OJO al leer los resultados: con una ventana de 1 sesión caben
// muchas comparaciones en el histórico, pero con 13 caben pocas — las
// columnas de ventana larga tienen mucho menos respaldo, y por eso se
// muestra siempre el número de comparaciones de cada una.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerDatosAlineados } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";
import { analizarLongitud, coincidenciasEsperadasPorAzar, calcularPosicionesActuales, LONGITUDES_VENTANA, HORIZONTES_ACTUALES } from "../../lib/persistenciaOrdenComun";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

export const PERIODOS_PERMITIDOS = [60, 120, 180, 250];
export const PERIODO_DEFECTO = 180;

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);

    const periodoParam = req.query.periodo !== undefined ? Number(req.query.periodo) : PERIODO_DEFECTO;
    if (!PERIODOS_PERMITIDOS.includes(periodoParam)) {
      throw new Error(`El parámetro 'periodo' debe ser uno de: ${PERIODOS_PERMITIDOS.join(", ")}.`);
    }

    const { fechas, datos } = await obtenerDatosAlineados(yahooFinance, periodoParam, indice.tickers);

    const precioPorTicker = {};
    const tickersValidos = [];
    for (const ticker of indice.tickers) {
      if (!datos[ticker]) continue;
      const serie = datos[ticker].map((d) => d.cierre);
      if (!serie.some((c) => c !== null && c !== undefined)) continue;
      precioPorTicker[ticker] = serie;
      tickersValidos.push(ticker);
    }

    if (tickersValidos.length < 5) {
      throw new Error(`Solo ${tickersValidos.length} valores de ${indice.nombre.es} tienen datos suficientes (mínimo 5).`);
    }

    const numSesiones = fechas.length;
    const filas = LONGITUDES_VENTANA.map((longitud) => {
      const r = analizarLongitud(tickersValidos, precioPorTicker, numSesiones, longitud);
      return {
        ...r,
        coincidenciasEsperadasAzar: coincidenciasEsperadasPorAzar(r.numExtremos, tickersValidos.length),
      };
    });

    // Foto de hoy: los mejores y peores de la última sesión, con su
    // número de orden en cada horizonte — la versión "de ahora mismo"
    // de la misma pregunta que responde la tabla de persistencia.
    const cuantosExtremos = Math.max(2, Math.round(tickersValidos.length * 0.1));
    const actuales = calcularPosicionesActuales(tickersValidos, precioPorTicker, numSesiones, cuantosExtremos);
    const conNombre = (lista) => lista.map((f) => ({ ...f, nombre: indice.nombresEmpresas[f.ticker] }));

    res.status(200).json({
      indice: indice.id,
      nombreIndice: indice.nombre.es,
      periodoSesiones: numSesiones,
      candidatosValidos: tickersValidos.length,
      filas,
      horizontesActuales: HORIZONTES_ACTUALES,
      actuales: {
        totalOrdenados: actuales.totalOrdenados,
        cuantos: cuantosExtremos,
        mejores: conNombre(actuales.mejores),
        peores: conNombre(actuales.peores),
      },
    });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
