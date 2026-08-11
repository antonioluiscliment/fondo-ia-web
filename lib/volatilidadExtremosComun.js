// lib/volatilidadExtremosComun.js
//
// "Volatilidad de los valores de un índice" (menú Análisis): mide qué
// valores son los más volátiles de su índice, pero no con una fórmula
// estadística abstracta, sino de una forma muy concreta y práctica:
// ¿cuántas veces ha estado este valor entre los mejores o entre los
// peores de su índice?
//
// POR QUÉ ESTA HERRAMIENTA MIDE VOLATILIDAD Y NO CALIDAD: nace de un
// hallazgo de "Persistencia en el orden relativo" (la herramienta
// hermana). Allí se observó que ciertos valores aparecían a la vez
// entre los que más veces ocupaban la cabeza Y entre los que más
// veces ocupaban la cola. Eso no es una contradicción: es la firma
// inequívoca de un valor que oscila con mucha amplitud — está arriba
// las ventanas que sube y abajo las que baja. Para estar en un
// extremo hace falta MOVERSE MUCHO, en la dirección que sea, así que
// contar apariciones en ambos extremos es, en la práctica, una medida
// de volatilidad.
//
// EL REPARTO ENTRE CABEZA Y COLA es el dato que distingue las dos
// situaciones: un reparto cercano al 50/50 es volatilidad pura (sube
// y baja con la misma facilidad); un reparto muy desequilibrado
// (muchas veces arriba, pocas abajo) sería un sesgo direccional
// sostenido, que es otra cosa distinta y más interesante. Con lo
// observado hasta ahora, lo esperable es que casi todos salgan
// repartidos, pero conviene comprobarlo en vez de suponerlo.
//
// VENTANAS CORTAS Y SIN SOLAPE: ventanas de 5 u 8 sesiones,
// consecutivas y sin solaparse entre sí — si se solaparan,
// compartirían casi todas sus sesiones y un valor contaría varias
// veces por el mismo movimiento.

export const LONGITUDES_VENTANA = [5, 8];
export const PORCENTAJES_EXTREMO = [15, 20];
export const MINIMO_EXTREMOS = 2;

// Rentabilidad de cada ticker en la ventana [inicio, fin) — el cambio
// porcentual entre el cierre ANTERIOR al primer día de la ventana y
// el cierre del último día (misma convención que el resto de la
// aplicación: la rentabilidad de un tramo se mide contra el cierre
// previo, no contra el primer día del propio tramo).
function rentabilidadesEnVentana(tickers, precioPorTicker, inicio, fin) {
  const resultado = {};
  if (inicio < 1) return resultado;
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

// Recorre el histórico en ventanas consecutivas sin solape y cuenta,
// para cada valor, cuántas veces aparece entre el porcentaje superior
// (cabeza) y cuántas entre el inferior (cola).
//
// Devuelve la lista ordenada por apariciones totales (de más a
// menos), con el reparto entre cabeza y cola de cada valor, y las
// apariciones que cabría esperar por puro azar como referencia.
export function analizarVolatilidad(tickers, precioPorTicker, numSesiones, longitud, porcentajeExtremo) {
  const vecesCabeza = {};
  const vecesCola = {};
  let numVentanasUsadas = 0;
  let plazasPorExtremo = null;

  const numVentanas = Math.floor(numSesiones / longitud);
  for (let v = 1; v < numVentanas; v++) {
    const inicio = v * longitud;
    const rentabilidades = rentabilidadesEnVentana(tickers, precioPorTicker, inicio, inicio + longitud);
    const comunes = Object.keys(rentabilidades);
    if (comunes.length < 5) continue;

    const ordenados = comunes.sort((a, b) => rentabilidades[b] - rentabilidades[a]);
    const n = Math.max(MINIMO_EXTREMOS, Math.round((comunes.length * porcentajeExtremo) / 100));
    plazasPorExtremo = n;

    for (const tk of ordenados.slice(0, n)) vecesCabeza[tk] = (vecesCabeza[tk] || 0) + 1;
    for (const tk of ordenados.slice(-n)) vecesCola[tk] = (vecesCola[tk] || 0) + 1;
    numVentanasUsadas++;
  }

  // Apariciones esperadas por azar: en cada ventana, un valor
  // cualquiera tiene una probabilidad de (plazas/total) de caer en
  // cada extremo — a lo largo de todas las ventanas, eso da
  // numVentanas × plazas/total apariciones esperadas en cada uno.
  const totalValores = tickers.length;
  const esperadoPorExtremo =
    plazasPorExtremo !== null && totalValores > 0
      ? Number(((numVentanasUsadas * plazasPorExtremo) / totalValores).toFixed(2))
      : null;

  const todosLosTickers = new Set([...Object.keys(vecesCabeza), ...Object.keys(vecesCola)]);
  const filas = [...todosLosTickers]
    .map((ticker) => {
      const cabeza = vecesCabeza[ticker] || 0;
      const cola = vecesCola[ticker] || 0;
      const total = cabeza + cola;
      return {
        ticker,
        cabeza,
        cola,
        total,
        // Porcentaje de sus apariciones que son en cabeza — 50%
        // significa perfectamente repartido (volatilidad pura); muy
        // por encima o por debajo indica un sesgo direccional.
        porcentajeCabeza: total > 0 ? Number(((cabeza / total) * 100).toFixed(1)) : null,
        // Cuántas veces más aparece que lo esperado por azar.
        vecesSobreAzar: esperadoPorExtremo && esperadoPorExtremo > 0 ? Number((total / (esperadoPorExtremo * 2)).toFixed(2)) : null,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    longitud,
    porcentajeExtremo,
    numVentanasUsadas,
    plazasPorExtremo,
    esperadoPorExtremo,
    esperadoTotal: esperadoPorExtremo !== null ? Number((esperadoPorExtremo * 2).toFixed(2)) : null,
    filas,
  };
}
