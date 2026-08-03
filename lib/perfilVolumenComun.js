// lib/perfilVolumenComun.js
//
// "Perfil de volumen previo" (Anomalías en el flujo de dinero bajo):
// complemento de "Medición de caídas previas". Si un valor viene de
// una caída de precio, ¿esa caída vino con un pico puntual de
// volumen (todo el mundo vendiendo a la vez, la firma típica de un
// desplome real) o con volumen bajo y sostenido (sin ningún pico,
// más compatible con una fase de acumulación o desinterés gradual)?
//
// Esta es la comprobación que de verdad separa las dos hipótesis que
// quedaban en pie tras "Medición de caídas previas": la "aburrida"
// (el criterio evita mecánicamente los desplomes recientes, que
// vienen con volumen alto) predice un pico claro; la "técnica"
// (acumulación silenciosa) predice volumen bajo sin ningún pico.

export const VENTANA_VOLUMEN = 20; // sesiones antes de la selección a examinar
export const UMBRAL_PICO = 2.5; // ratio máximo/promedio por encima del cual se considera que hubo "pico"
const MINIMO_DATOS_VALIDOS = Math.floor(VENTANA_VOLUMEN * 0.5); // con menos días de volumen válido en la ventana, no se calcula (dato poco fiable)

// serieCompleta: datos[ticker] completo (sin recortar a la ventana
// del backtest), array de {fecha, cierre, volumen}.
// t: posición (índice) del día de selección dentro de serieCompleta.
//
// Devuelve { promedio, pico, picoRatio, conPico } o null si no hay
// suficientes datos de volumen válidos en la ventana previa.
export function medirPerfilVolumen(serieCompleta, t) {
  const volumenes = [];
  for (let x = 1; x <= VENTANA_VOLUMEN && t - x >= 0; x++) {
    const dia = serieCompleta[t - x];
    const v = dia ? dia.volumen : undefined;
    if (v !== null && v !== undefined) volumenes.push(v);
  }
  if (volumenes.length < MINIMO_DATOS_VALIDOS) return null;

  const promedio = volumenes.reduce((a, b) => a + b, 0) / volumenes.length;
  const pico = Math.max(...volumenes);
  const picoRatio = promedio > 0 ? Number((pico / promedio).toFixed(3)) : null;
  const conPico = picoRatio !== null && picoRatio > UMBRAL_PICO;

  return { promedio: Math.round(promedio), pico: Math.round(pico), picoRatio, conPico };
}

// Agrega los resultados de medirPerfilVolumen de muchas selecciones:
// ratio pico/promedio medio, y % de selecciones clasificadas "con
// pico" frente a "sin pico" (volumen sostenido, sin ningún día
// destacado).
export function agregarPerfilVolumen(resultadosIndividuales) {
  const validos = resultadosIndividuales.filter((r) => r !== null);
  const total = validos.length;
  if (total === 0) {
    return { totalSelecciones: 0, picoRatioMedio: null, pctConPico: null, pctSinPico: null };
  }

  const ratiosValidos = validos.map((r) => r.picoRatio).filter((r) => r !== null);
  const picoRatioMedio =
    ratiosValidos.length > 0 ? Number((ratiosValidos.reduce((a, b) => a + b, 0) / ratiosValidos.length).toFixed(3)) : null;

  const conPico = validos.filter((r) => r.conPico).length;
  const pctConPico = Number(((conPico / total) * 100).toFixed(2));
  const pctSinPico = Number((100 - pctConPico).toFixed(2));

  return { totalSelecciones: total, picoRatioMedio, pctConPico, pctSinPico };
}
