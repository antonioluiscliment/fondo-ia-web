// lib/reversionMediaConstantes.js
//
// Constantes del módulo de reversión a la media que necesita también
// el FRONTEND (pages/reversionMedia.js). Viven en un archivo aparte
// de lib/motor.js a propósito: motor.js importa yahoo-finance2, que
// usa módulos internos de Node ("node:url") incompatibles con el
// bundle del navegador. Si el frontend importara estas constantes
// directamente de motor.js, arrastraría también yahoo-finance2 al
// código de cliente y rompería el build de Vercel.
export const REVERSION_VENTANAS_PRESET = [5, 10, 20, 60, 120];
export const REVERSION_MAX_VENTANA = 120;
export const REVERSION_PROFUNDIDAD_DEFECTO = 240;
export const REVERSION_MAX_PEORES = 5;
export const REVERSION_MAX_EXCLUSION = 3;
