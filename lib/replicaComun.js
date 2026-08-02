// lib/replicaComun.js
//
// Base matemática de "Modelo de réplica de un índice": para el
// puñado de valores al que un inversor tiene acceso real (los índices
// ADR de la aplicación, que no tienen ningún ETF de referencia), busca
// la combinación de 3 a 6 valores y los pesos que hacen que la
// cartera se parezca lo más posible al índice — no que lo bata, que
// lo REPLIQUE, minimizando la diferencia (el "tracking error") entre
// el incremento diario de la cartera y el del índice.
//
// Por qué esto y no intentar batir al índice: toda la evidencia que
// hemos ido recogiendo en la propia aplicación (ningún método de
// selección probado bate de forma consistente ni al índice ni a una
// selección aleatoria) apunta a que intentar ganarle al índice con un
// puñado de valores es una apuesta perdedora. Si la referencia es
// difícil de mejorar, tiene más sentido intentar parecerse a ella lo
// más posible con los pocos valores disponibles, en vez de arriesgar
// buscando una diferencia que probablemente no exista.
//
// Cómo se ajustan los pesos: para una combinación concreta de valores,
// se buscan los pesos que minimizan la suma de las diferencias al
// cuadrado entre el incremento diario de la cartera y el del índice,
// sesión a sesión, con la restricción de que los pesos sumen 100%
// (mínimos cuadrados con una restricción de igualdad, resuelto con las
// mismas herramientas de álgebra lineal que la regresión ridge del
// modelo multifactor — ver lib/algebraComun.js).
//
// Cómo se elige la combinación de valores: por fuerza bruta. Con los
// índices "parciales" de la aplicación (como mucho, unas 18-20
// componentes), probar TODAS las combinaciones posibles de 3 a 6
// valores es perfectamente factible en un instante — no hace falta
// ningún atajo ni aproximación. Por eso esta herramienta no está
// pensada para índices grandes (ver MAX_TICKERS_FUERZA_BRUTA): con
// más de unas pocas decenas de componentes, el número de
// combinaciones se dispara, y además esos índices grandes ya suelen
// tener un ETF de verdad — la opción sensata ahí es comprarlo
// directamente, no intentar replicarlo con 5 valores.

import { transponer, multiplicar, multiplicarVector, invertir } from "./algebraComun";
import { calcularIncrementosSerie } from "./multifactorComun";

export const N_MIN = 3;
export const N_MAX = 6;
export const MAX_TICKERS_FUERZA_BRUTA = 25;
const LAMBDA_ESTABILIDAD = 1e-6; // ridge mínimo, solo para evitar matrices singulares con valores casi idénticos

export { calcularIncrementosSerie };

// Genera todas las combinaciones de tamaño "tamano" de los elementos
// de "elementos" (array de índices 0..n-1, no de tickers directamente,
// para no copiar arrays de texto en cada combinación).
export function* generarCombinaciones(n, tamano, inicio = 0, actual = []) {
  if (actual.length === tamano) {
    yield [...actual];
    return;
  }
  for (let i = inicio; i <= n - (tamano - actual.length); i++) {
    actual.push(i);
    yield* generarCombinaciones(n, tamano, i + 1, actual);
    actual.pop();
  }
}

// Ajusta los pesos (array de longitud n, uno por columna de
// matrizRetornos) que minimizan la suma de diferencias al cuadrado
// frente a retornosIndice, con la restricción de que sumen 1 (100%).
//
// matrizRetornos: array de T filas × n columnas (T sesiones, n
// valores de la combinación probada).
// retornosIndice: array de T incrementos diarios del índice, mismas
// fechas que matrizRetornos.
//
// Devuelve los pesos SIN acotar por pesoMaximo todavía (eso se aplica
// después, con aplicarTopeYRenormalizar) — aquí solo se resuelve el
// problema de mínimos cuadrados puro.
function ajustarPesosMinimosCuadrados(matrizRetornos, retornosIndice) {
  const n = matrizRetornos[0].length;
  if (n === 1) return [1]; // con un solo valor, todo el peso va ahí por definición

  // Sustitución w_n = 1 - suma(w_1..w_{n-1}): convierte el problema
  // restringido en uno sin restricciones, de n-1 variables.
  // R'_i = R_i - R_n (columna i menos la última columna)
  // y' = índice - R_n
  const columnaN = matrizRetornos.map((fila) => fila[n - 1]);
  const Rprima = matrizRetornos.map((fila, t) => fila.slice(0, n - 1).map((valor) => valor - columnaN[t]));
  const yPrima = retornosIndice.map((valor, t) => valor - columnaN[t]);

  const Rt = transponer(Rprima);
  const RtR = multiplicar(Rt, Rprima);
  for (let i = 0; i < n - 1; i++) RtR[i][i] += LAMBDA_ESTABILIDAD;
  const RtRinv = invertir(RtR);
  const Rty = Rt.map((fila) => fila.reduce((suma, valor, t) => suma + valor * yPrima[t], 0));
  const wPrima = multiplicarVector(RtRinv, Rty);

  const wN = 1 - wPrima.reduce((a, b) => a + b, 0);
  return [...wPrima, wN];
}

// Aplica el tope de diversificación (pesoMaximo, en tanto por cien) a
// un array de pesos que suman 1 (pueden venir con negativos, del
// ajuste de mínimos cuadrados: un peso negativo significaría "vender
// a corto", que esta aplicación no contempla en ningún otro sitio, así
// que se recorta a 0 igual que se haría con una posición corta no
// permitida) y devuelve pesos en tanto por cien que siguen sumando
// 100, respetando el tope.
function aplicarTopeYRenormalizar(pesos, pesoMaximoPct) {
  const n = pesos.length;

  // Caso límite: si el tope es tan bajo que ni siquiera un reparto
  // igual entre los n valores lo respetaría (n × tope < 100), no hay
  // ningún reparto que cumpla la restricción — el reparto igual es el
  // menos malo posible en ese caso, así que se usa directamente en
  // vez de intentar que el bucle de más abajo converja a algo que no
  // existe.
  if (n * pesoMaximoPct < 100 - 1e-9) {
    const igual = Number((100 / n).toFixed(2));
    return pesos.map(() => igual);
  }

  // 1) Recortar negativos a 0.
  let ajustados = pesos.map((p) => Math.max(0, p * 100));

  // 2) Renormalizar para que sumen 100 (si se recortó algo negativo,
  // la suma ya no será 100).
  const suma = ajustados.reduce((a, b) => a + b, 0);
  if (suma > 1e-9) ajustados = ajustados.map((p) => (p / suma) * 100);

  // 3) Aplicar el tope, redistribuyendo el exceso entre los pesos que
  // todavía no lo alcanzan. Cada peso que se capa en una vuelta queda
  // FIJO a partir de ahí — si no, en la siguiente vuelta podría volver
  // a recibir parte del reparto y superar el tope otra vez (fue
  // justo el fallo que se detectó al probarlo: sin fijar, el reparto
  // "reabría" pesos ya capados y se quedaba oscilando cerca del
  // límite en vez de converger a él con exactitud).
  const fijado = new Array(ajustados.length).fill(false);
  for (let vuelta = 0; vuelta < ajustados.length; vuelta++) {
    const excedidos = ajustados.map((p, i) => !fijado[i] && p > pesoMaximoPct + 1e-9);
    if (!excedidos.some(Boolean)) break;

    let excesoTotal = 0;
    for (let i = 0; i < ajustados.length; i++) {
      if (excedidos[i]) {
        excesoTotal += ajustados[i] - pesoMaximoPct;
        ajustados[i] = pesoMaximoPct;
        fijado[i] = true;
      }
    }
    const sumaLibre = ajustados.reduce((s, p, i) => s + (fijado[i] ? 0 : p), 0);
    if (sumaLibre < 1e-9) break; // todos capados, no hay dónde redistribuir más
    for (let i = 0; i < ajustados.length; i++) {
      if (!fijado[i]) {
        ajustados[i] += (ajustados[i] / sumaLibre) * excesoTotal;
      }
    }
  }

  return ajustados.map((p) => Number(p.toFixed(2)));
}

// Error de seguimiento (RMSE de las diferencias diarias entre la
// cartera con estos pesos y el índice) y correlación entre ambas
// series, para un conjunto de pesos ya definitivo (en tanto por cien).
function calcularErrorSeguimiento(pesosPct, matrizRetornos, retornosIndice) {
  const pesos = pesosPct.map((p) => p / 100);
  const t = matrizRetornos.length;
  const retornosCartera = matrizRetornos.map((fila) => fila.reduce((suma, r, i) => suma + r * pesos[i], 0));

  let sumaCuadrados = 0;
  for (let i = 0; i < t; i++) {
    sumaCuadrados += (retornosCartera[i] - retornosIndice[i]) ** 2;
  }
  const rmse = Math.sqrt(sumaCuadrados / t);

  const media = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const mediaCartera = media(retornosCartera);
  const mediaIndice = media(retornosIndice);
  let numerador = 0;
  let sumaCuadCartera = 0;
  let sumaCuadIndice = 0;
  for (let i = 0; i < t; i++) {
    const dc = retornosCartera[i] - mediaCartera;
    const di = retornosIndice[i] - mediaIndice;
    numerador += dc * di;
    sumaCuadCartera += dc * dc;
    sumaCuadIndice += di * di;
  }
  const denominador = Math.sqrt(sumaCuadCartera * sumaCuadIndice);
  const correlacion = denominador > 1e-12 ? numerador / denominador : null;

  return { rmse, correlacion, retornosCartera };
}

// Busca, entre todas las combinaciones de 3 a 6 valores de la lista de
// candidatos, la que consigue el menor error de seguimiento frente al
// índice, con los pesos ya ajustados y acotados por pesoMaximo.
//
// retornosPorTicker: { ticker: [incrementos diarios...] }, todas las
// series con las MISMAS fechas y longitud que retornosIndice.
export function buscarMejorReplica(tickers, retornosPorTicker, retornosIndice, pesoMaximoPct) {
  let mejor = null;

  for (let n = N_MIN; n <= Math.min(N_MAX, tickers.length); n++) {
    for (const combinacionIndices of generarCombinaciones(tickers.length, n)) {
      const combinacionTickers = combinacionIndices.map((i) => tickers[i]);
      const matrizRetornos = retornosIndice.map((_, t) => combinacionTickers.map((ticker) => retornosPorTicker[ticker][t]));

      let pesosCrudos;
      try {
        pesosCrudos = ajustarPesosMinimosCuadrados(matrizRetornos, retornosIndice);
      } catch {
        continue; // combinación con matriz singular (valores casi idénticos entre sí): se descarta, no rompe la búsqueda
      }

      const pesosPct = aplicarTopeYRenormalizar(pesosCrudos, pesoMaximoPct);
      const { rmse, correlacion } = calcularErrorSeguimiento(pesosPct, matrizRetornos, retornosIndice);

      if (!mejor || rmse < mejor.rmse) {
        mejor = { tickers: combinacionTickers, pesos: pesosPct, rmse, correlacion, n };
      }
    }
  }

  return mejor;
}
