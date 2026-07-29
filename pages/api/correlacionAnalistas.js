// pages/api/correlacionAnalistas.js
//
// Grupo "Análisis" > "Correlación con recomendaciones de los
// analistas": para el índice elegido, comprueba si el consenso de
// analistas de HOY guarda relación con la rentabilidad que ha tenido
// después cada valor, en 1, 2, 3 y 6 meses.
//
// Cómo se calcula la puntuación de Yahoo (recommendationMean): por
// debajo de ese número hay un recuento de cuántos analistas han
// emitido cada tipo de recomendación (esto es lo que Yahoo llama
// recommendationTrend: nº de "compra fuerte", "compra", "mantener",
// "venta" y "venta fuerte" del mes en curso). El recommendationMean es
// la media ponderada de ese recuento, usando esos mismos números 1-5
// como peso:
//
//   media = (1×compra_fuerte + 2×compra + 3×mantener + 4×venta + 5×venta_fuerte) / total_analistas
//
// Por ejemplo, si 6 analistas dicen "compra fuerte" (1), 3 dicen
// "compra" (2) y 1 dice "mantener" (3): media = (6×1 + 3×2 + 1×3) / 10
// = 15/10 = 1,5.
//
// En esa escala, 1 = consenso más optimista y 5 = más pesimista — es
// decir, va al revés de lo que uno esperaría correlacionar con una
// subida de cotización (cuanto MEJOR el consenso, MENOR el número).
// Para que la correlación salga en el sentido intuitivo (positiva
// cuando buen consenso → sube más) y no invertida, aquí se usa como
// puntuación la diferencia con 5: puntuacion = 5 − recommendationMean.
// Con eso, cuanto más optimista el consenso, MAYOR la puntuación.
//
// La correlación de Pearson se calcula por separado para cada plazo
// (1, 2, 3 y 6 meses) entre esa puntuación (fija, la de hoy — no hay
// histórico diario de recomendaciones) y el incremento real de
// cotización de cada valor en ese plazo. No tiene sentido mirar más
// atrás de 6 meses: las recomendaciones de los analistas cambian con
// relativa frecuencia, así que una recomendación de hace más de medio
// año ya no dice mucho del consenso actual.
//
// Igual que en "Selección de los analistas" y "Recomendaciones de los
// analistas": el consenso solo se puede consultar valor por valor
// (módulo "financialData" de Yahoo, sin versión ligera por lotes), en
// tandas pequeñas, no todo el índice de golpe. Solo se cuentan valores
// con al menos MIN_ANALISTAS analistas cubriéndolos.
//
// Parámetros de la query:
//   indice - id del índice a analizar.

import { getYahooFinanceInstance, mensajeErrorAmigable, obtenerCierresConActual, calcularCorrelacion } from "../../lib/motor";
import { obtenerIndice } from "../../lib/indices";

let yahooFinance;
let errorInicializacion = null;
try {
  yahooFinance = getYahooFinanceInstance();
} catch (e) {
  errorInicializacion = e;
}

const TAMANO_TANDA = 8; // consultas simultáneas por tanda, no todo el índice de golpe
const MIN_ANALISTAS = 3; // mínimo de analistas cubriendo el valor para considerar el consenso fiable
const SESIONES_DESCARGA = 200; // cubre 6 meses de sobra (~200×1.6+5 ≈ 325 días naturales)

// Plazos a analizar, en meses y su equivalente aproximado en días
// naturales (para buscar el cierre de referencia por fecha).
const PERIODOS = [
  { meses: 1, dias: 30 },
  { meses: 2, dias: 61 },
  { meses: 3, dias: 91 },
  { meses: 6, dias: 182 },
];

function numeroValido(valor) {
  return typeof valor === "number" && !Number.isNaN(valor);
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

async function consultarTandaAnalistas(tickers) {
  return Promise.all(
    tickers.map(async (ticker) => {
      try {
        const data = await yahooFinance.quoteSummary(ticker, { modules: ["financialData"] });
        return { ticker, financialData: data.financialData || null };
      } catch {
        return { ticker, financialData: null };
      }
    })
  );
}

export default async function handler(req, res) {
  try {
    if (errorInicializacion) throw errorInicializacion;

    const indice = obtenerIndice(req.query.indice);

    // 1) Consenso de analistas de cada componente, por tandas.
    const candidatos = [];
    const excluidos = [];
    for (let i = 0; i < indice.tickers.length; i += TAMANO_TANDA) {
      const tanda = indice.tickers.slice(i, i + TAMANO_TANDA);
      const resultados = await consultarTandaAnalistas(tanda);
      for (const { ticker, financialData } of resultados) {
        const mean = financialData ? financialData.recommendationMean : undefined;
        const numOpiniones = financialData ? financialData.numberOfAnalystOpinions : undefined;
        if (!numeroValido(mean) || !numeroValido(numOpiniones) || numOpiniones < MIN_ANALISTAS) {
          excluidos.push({ ticker, nombre: indice.nombresEmpresas[ticker], motivo: "sinConsenso" });
          continue;
        }
        candidatos.push({ ticker, nombre: indice.nombresEmpresas[ticker], recommendationMean: mean, numeroAnalistas: numOpiniones });
      }
    }

    if (candidatos.length < 3) {
      throw new Error(
        `Hacen falta al menos 3 componentes con consenso de analistas fiable para calcular una correlación con sentido, y solo hay ${candidatos.length} en este momento.`
      );
    }

    // 2) Precio de cada candidato, con margen suficiente para 6 meses.
    const filas = [];
    for (const c of candidatos) {
      let cierres;
      try {
        cierres = await obtenerCierresConActual(yahooFinance, c.ticker, SESIONES_DESCARGA);
      } catch {
        excluidos.push({ ticker: c.ticker, nombre: c.nombre, motivo: "sinPrecio" });
        continue;
      }
      const actual = cierres[cierres.length - 1].cierre;
      const fila = {
        ticker: c.ticker,
        nombre: c.nombre,
        recommendationMean: Number(c.recommendationMean.toFixed(2)),
        numeroAnalistas: c.numeroAnalistas,
        puntuacion: Number((5 - c.recommendationMean).toFixed(2)),
      };
      for (const periodo of PERIODOS) {
        const ref = valorEnFechaOAntes(cierres, fechaHaceDiasISO(periodo.dias));
        fila[`incremento${periodo.meses}m`] = ref ? Number(((actual / ref.cierre - 1) * 100).toFixed(3)) : null;
      }
      filas.push(fila);
    }

    // 3) Correlación de Pearson entre la puntuación (fija, la de hoy)
    // y el incremento real de cada plazo, usando solo los valores con
    // dato válido en ese plazo concreto.
    const correlaciones = {};
    for (const periodo of PERIODOS) {
      const campo = `incremento${periodo.meses}m`;
      const pares = filas.filter((f) => f[campo] !== null).map((f) => [f.puntuacion, f[campo]]);
      const r = calcularCorrelacion(pares);
      correlaciones[`meses${periodo.meses}`] = { valor: r !== null ? Number(r.toFixed(3)) : null, n: pares.length };
    }

    res.status(200).json({ indice: indice.id, filas, correlaciones, excluidos });
  } catch (error) {
    res.status(500).json({ error: mensajeErrorAmigable(error) });
  }
}
