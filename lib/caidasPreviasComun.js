// lib/caidasPreviasComun.js
//
// "Medición de caídas previas" (Anomalías en el flujo de dinero
// bajo): para cada valor seleccionado, ¿venía de una caída de precio
// reciente? Para cada umbral de caída (5%, 10%, 15%, 20%), se busca
// cuántas sesiones atrás (x) hace falta retroceder para encontrar un
// precio que sea al menos ese % más alto que el del día de la
// selección — es decir, el punto más reciente desde el que el precio
// de hoy ya representa esa caída.
//
// Por qué importa: tanto la hipótesis "técnica" (fase de acumulación
// tras una caída, antes de volver a tendencia) como la hipótesis
// "aburrida" (el criterio evita mecánicamente los desplomes recientes
// porque vienen con volumen alto, pero puede pescar el valor justo
// después) predicen que SÍ hubo una caída antes de la selección —
// esta comprobación por sí sola no las separa (para eso está "Perfil
// de volumen previo", el complemento de esta herramienta), pero
// confirma o descarta que el patrón de precio exista de verdad.

export const UMBRALES_CAIDA = [5, 10, 15, 20];
export const MAX_RETROCESO = 60; // sesiones hacia atrás a explorar como máximo (unos 3 meses)

// serieCompleta: datos[ticker] completo (sin recortar a la ventana
// del backtest), array de {fecha, cierre, volumen}.
// t: posición (índice) del día de selección dentro de serieCompleta.
//
// Devuelve, para cada umbral, el x mínimo que lo alcanza, o null si
// no se alcanza dentro de MAX_RETROCESO sesiones. Devuelve null (el
// objeto entero) si el propio precio de selección no es válido.
export function medirCaidaPrevia(serieCompleta, t) {
  const diaSeleccion = serieCompleta[t];
  const precioSeleccion = diaSeleccion ? diaSeleccion.cierre : undefined;
  if (precioSeleccion === null || precioSeleccion === undefined || precioSeleccion === 0) return null;

  const resultado = Object.fromEntries(UMBRALES_CAIDA.map((u) => [u, null]));

  for (let x = 1; x <= MAX_RETROCESO && t - x >= 0; x++) {
    const diaPasado = serieCompleta[t - x];
    const precioPasado = diaPasado ? diaPasado.cierre : undefined;
    if (precioPasado === null || precioPasado === undefined || precioPasado === 0) continue;

    const caidaPct = ((precioPasado - precioSeleccion) / precioPasado) * 100;
    for (const umbral of UMBRALES_CAIDA) {
      if (resultado[umbral] === null && caidaPct >= umbral) {
        resultado[umbral] = x;
      }
    }
  }

  return resultado;
}

// Agrega los resultados de medirCaidaPrevia de muchas selecciones: %
// de selecciones que alcanzaron cada umbral dentro del rango
// explorado, y la x media entre las que sí lo alcanzaron (cuántas
// sesiones atrás, de media, se encontró esa caída).
export function agregarCaidasPrevias(resultadosIndividuales) {
  const validos = resultadosIndividuales.filter((r) => r !== null);
  const total = validos.length;

  const porUmbral = UMBRALES_CAIDA.map((umbral) => {
    const alcanzados = validos.map((r) => r[umbral]).filter((x) => x !== null);
    const pctAlcanzado = total > 0 ? Number(((alcanzados.length / total) * 100).toFixed(2)) : null;
    const xMedio =
      alcanzados.length > 0 ? Number((alcanzados.reduce((a, b) => a + b, 0) / alcanzados.length).toFixed(1)) : null;
    return { umbral, pctAlcanzado, xMedio, numAlcanzado: alcanzados.length };
  });

  return { totalSelecciones: total, porUmbral };
}
