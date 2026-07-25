// pages/api/rentabilidadETFs.js
//
// Grupo "Análisis" > "Rentabilidad de los ETFs": compara la
// rentabilidad del propio índice con la de sus ETFs UCITS de
// distribución de referencia (ver lib/indices.js, campo
// etfsRentabilidad), en 60 y 120 sesiones y en 1, 2 y 3 años.
//
// Se usan ETFs de DISTRIBUCIÓN, no de acumulación: el índice se
// calcula con las cotizaciones ex-dividendo de sus componentes, y un
// ETF de distribución también cae en la fecha ex-dividendo (el
// dividendo sale del fondo hacia el inversor), así que su cotización
// es comparable a la del índice. Un ETF de acumulación reinvierte el
// dividendo dentro del fondo, lo que infla su cotización frente al
// índice y haría la comparación injusta.
//
// Parámetros de la query:
//   indice - id del índice a comprobar (dowjones, ibex35, ...).

import { getYahooFinanceInstance, obtenerCierresConActual, mensajeErrorAmigable } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

// Sesiones a descargar: cubren 3 años de sobra (obtenerCierres pide
// dias*1.6+5 días naturales hacia atrás, así que con 800 sesiones se
// llega a ~3.5 años de calendario) más margen para el cálculo de 60 y
// 120 sesiones dentro de esa misma ventana.
const SESIONES_DESCARGA = 800;

function rentabilidadSesiones(cierres, n) {
  if (cierres.length < n + 1) return null;
  const actual = cierres[cierres.length - 1].cierre;
  const previo = cierres[cierres.length - 1 - n].cierre;
  return Number(((actual / previo - 1) * 100).toFixed(2));
}

// Último cierre disponible en o antes de la fecha objetivo (los
// cierres vienen ordenados cronológicamente ascendente).
function valorEnFechaOAntes(cierres, fechaObjetivoISO) {
  let elegido = null;
  for (const c of cierres) {
    if (c.fecha <= fechaObjetivoISO) elegido = c;
    else break;
  }
  return elegido;
}

function fechaHaceDiasISO(diasCalendario) {
  const d = new Date();
  d.setDate(d.getDate() - diasCalendario);
  return d.toISOString().slice(0, 10);
}

function calcularRentabilidades(cierres) {
  const actual = cierres[cierres.length - 1].cierre;
  const ref1a = valorEnFechaOAntes(cierres, fechaHaceDiasISO(365));
  const ref2a = valorEnFechaOAntes(cierres, fechaHaceDiasISO(730));
  const ref3a = valorEnFechaOAntes(cierres, fechaHaceDiasISO(1095));
  return {
    sesiones60: rentabilidadSesiones(cierres, 60),
    sesiones120: rentabilidadSesiones(cierres, 120),
    anio1: ref1a ? Number(((actual / ref1a.cierre - 1) * 100).toFixed(2)) : null,
    anio2: ref2a ? Number(((actual / ref2a.cierre - 1) * 100).toFixed(2)) : null,
    anio3: ref3a ? Number(((actual / ref3a.cierre - 1) * 100).toFixed(2)) : null,
  };
}

// Año a usar para la columna de volumen: el año en curso (YTD), salvo
// en los primeros días de enero, cuando apenas hay sesiones del año
// nuevo y el volumen acumulado sería poco representativo — en ese
// caso se usa el año natural anterior completo.
function calcularAnioVolumen() {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const diaDelAnio = Math.ceil((hoy - new Date(anioActual, 0, 0)) / 86400000);
  const anio = diaDelAnio > 10 ? anioActual : anioActual - 1;
  return { anio, esYTD: anio === anioActual };
}

function sumaVolumenAnio(cierres, anio) {
  const prefijo = String(anio);
  let suma = 0;
  let hayDatos = false;
  for (const c of cierres) {
    if (c.fecha.startsWith(prefijo) && c.volumen !== null && c.volumen !== undefined) {
      suma += c.volumen;
      hayDatos = true;
    }
  }
  return hayDatos ? suma : null;
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);
    const { anio: anioVolumen, esYTD } = calcularAnioVolumen();

    const [cierresIndice, ...cierresEtfs] = await Promise.all([
      obtenerCierresConActual(yahooFinance, indice.simboloIndice, SESIONES_DESCARGA),
      ...indice.etfsRentabilidad.map((etf) => obtenerCierresConActual(yahooFinance, etf.ticker, SESIONES_DESCARGA)),
    ]);

    const filas = [
      {
        ticker: indice.simboloIndice,
        nombre: indice.nombre.es,
        esIndice: true,
        volumen: null,
        ...calcularRentabilidades(cierresIndice),
      },
      ...indice.etfsRentabilidad.map((etf, i) => ({
        ticker: etf.ticker,
        nombre: etf.nombre,
        esIndice: false,
        volumen: sumaVolumenAnio(cierresEtfs[i], anioVolumen),
        ...calcularRentabilidades(cierresEtfs[i]),
      })),
    ];

    res.status(200).json({ indice: indice.id, anioVolumen, esYTD, filas });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
