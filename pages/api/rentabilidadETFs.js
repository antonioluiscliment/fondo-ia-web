// pages/api/rentabilidadETFs.js
//
// Grupo "Análisis" > "Rentabilidad de los ETFs": compara la
// rentabilidad del propio índice con la de sus ETFs UCITS de
// referencia (ver lib/indices.js), en 60 y 120 sesiones y en 1, 2 y 3
// años.
//
// Dos grupos de ETFs:
//   - etfsRentabilidad: los COMPARABLES con el índice — de
//     distribución para todos los índices salvo el DAX (donde son de
//     acumulación, por ser el DAX un índice de rentabilidad total; ver
//     el comentario junto a DAX.etfsRentabilidad en lib/indices.js).
//   - etfsOpuestos: el resto de ETFs UCITS del mismo índice, del tipo
//     contrario (acumulación donde los comparables son de
//     distribución, o al revés para el DAX) — no son directamente
//     comparables con el índice por el mismo motivo, pero se
//     muestran igualmente para que se puedan consultar, marcados como
//     tales (frontend: "esComparable: false").
//
// Por qué importa la distinción: el índice se calcula con las
// cotizaciones ex-dividendo de sus componentes. Un ETF de
// distribución también cae en la fecha ex-dividendo (el dividendo
// sale del fondo hacia el inversor), así que su cotización es
// comparable a la del índice. Un ETF de acumulación reinvierte el
// dividendo dentro del fondo, lo que infla su cotización frente al
// índice y haría la comparación injusta — de ahí que los "opuestos"
// no se traten como comparables.
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

    const [cierresIndice, ...cierresTodos] = await Promise.all([
      obtenerCierresConActual(yahooFinance, indice.simboloIndice, SESIONES_DESCARGA),
      ...indice.etfsRentabilidad.map((etf) => obtenerCierresConActual(yahooFinance, etf.ticker, SESIONES_DESCARGA)),
      ...indice.etfsOpuestos.map((etf) => obtenerCierresConActual(yahooFinance, etf.ticker, SESIONES_DESCARGA)),
    ]);
    const cierresEtfs = cierresTodos.slice(0, indice.etfsRentabilidad.length);
    const cierresOpuestos = cierresTodos.slice(indice.etfsRentabilidad.length);

    const filas = [
      {
        ticker: indice.simboloIndice,
        nombre: indice.nombre.es,
        esIndice: true,
        esComparable: true,
        volumen: null,
        ...calcularRentabilidades(cierresIndice),
      },
      ...indice.etfsRentabilidad.map((etf, i) => ({
        ticker: etf.ticker,
        nombre: etf.nombre,
        esIndice: false,
        esComparable: true,
        volumen: sumaVolumenAnio(cierresEtfs[i], anioVolumen),
        ...calcularRentabilidades(cierresEtfs[i]),
      })),
      ...indice.etfsOpuestos.map((etf, i) => ({
        ticker: etf.ticker,
        nombre: etf.nombre,
        esIndice: false,
        esComparable: false,
        volumen: sumaVolumenAnio(cierresOpuestos[i], anioVolumen),
        ...calcularRentabilidades(cierresOpuestos[i]),
      })),
    ];

    res.status(200).json({ indice: indice.id, anioVolumen, esYTD, filas });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
