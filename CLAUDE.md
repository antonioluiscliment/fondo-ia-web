# Fondo IA — Contexto para Claude Code

## Qué es este proyecto

Aplicación web financiera de análisis y selección de carteras bursátiles, con
capacidades de backtesting. Consume datos de Yahoo Finance. Desarrollo en
solitario por Antonio, gestionado a menudo desde el móvil.

- **Framework:** Next.js (Pages Router), React 18
- **Despliegue:** Vercel, desde GitHub
- **Datos de mercado:** `yahoo-finance2` (con wrapper propio para errores de validación)
- **Lógica de negocio central:** `lib/motor.js`
- **Internacionalización:** `lib/i18n.js`
- **Índices soportados:** estructura modular en `lib/indices/`

## Arquitectura actual

- App multi-página con sidebar hamburguesa, no monolítica (antes era un único
  `pages/index.js` de ~2000 líneas; ya no).
- Contextos globales: `IdiomaContext`, `IndiceContext`, con layout persistente.
- 8 índices: Dow Jones, IBEX 35, CAC 40, PSI 20, DAX, AEX, FTSE MIB, Nasdaq 100.
- Parámetro global "sesiones promediadas": 3, 5, 8 o 13 (Fibonacci).
- 6 métodos de selección de cartera (incluye 3 métodos "antítesis": precio/volumen/flujo bajo).
- Menú de selección dividido en 3 submenús: parámetros técnicos, selección técnica,
  criterios alternativos.
- Análisis fundamental y rentabilidad de ETFs implementados.
- Correlación con recomendaciones de analistas (single y multi-índice), usando
  `5 - recommendationMean` para que el signo de la correlación sea intuitivo.
- `pages/seleccionVeces.js` existe pero está huérfana (sin enlace en el menú,
  solo accesible por URL directa) — no borrar sin preguntar.

## Gotchas técnicos importantes (no repetir estos errores)

1. **Comillas en `lib/i18n.js`:** comillas dobles sin escapar dentro de un string
   rompen el build en Vercel, y `node --check` en local NO lo detecta. Usar
   siempre comillas simples dentro de los strings de este archivo.
2. **Versiones:** `next@14.2.5` + `react@18.3.1` provoca el error React #130 en
   producción. Versión estable confirmada: `next@14.2.35`. No actualizar Next sin
   verificar esta combinación.
3. **Validación de Yahoo Finance:** `FailedYahooValidationError` se resuelve
   globalmente en `getYahooFinanceInstance()`, devolviendo `error.result` en los
   métodos `chart`/`quote`/`quoteSummary`. Esto evita crashes en índices europeos.
   No duplicar esta lógica en otros sitios.
4. **DAX es un índice de rentabilidad total:** requiere ETFs de acumulación para
   comparación justa, a diferencia del resto de índices, que usan ETFs de
   distribución. Tenerlo en cuenta en cualquier cálculo comparativo con DAX.
5. **Despliegues parciales:** discrepancias entre versiones de archivos son causa
   recurrente de fallos silenciosos. Verificar que todos los archivos relacionados
   se entregan/commitean juntos.

## Pendiente / rendimiento conocido

- Nasdaq 100 es lento: las llamadas per-ticker a `quoteSummary` para datos de
  analistas tardan bastante. Falta comunicar advertencias de rendimiento en la UI
  para índices grandes.

## Cómo trabajar en este repo (reglas del proyecto)

- **Entregas incrementales y validadas.** No agrupar muchos cambios sin
  checkpoints intermedios: un batch grande de cambios simultáneos ha causado más
  problemas de los que resolvía (rollback ya sufrido por esto). Prefiere pasos
  pequeños: proponer → validar → avanzar.
- **No eliminar código sin consultar explícitamente antes**, aunque parezca
  código muerto u obsoleto (ver caso de `seleccionVeces.js`).
- **Rutas de archivo exactas del repo desde el principio** (p. ej.
  `pages/seleccion/index.js`, no `seleccion.js`), para evitar renombrados
  manuales después.
- **Transparencia técnica:** explica limitaciones y trade-offs con honestidad
  antes de implementar; valora si una funcionalidad aporta valor real antes de
  construirla.
- Antonio gestiona el repo con frecuencia desde el móvil — evita workflows que
  asuman acceso cómodo a terminal/escritorio salvo que se indique lo contrario.

## Estado de esta integración

Antonio está empezando a usar Claude Code de forma progresiva, en paralelo con
Claude en chat para planificación/diseño. No asumas un cambio total de flujo de
trabajo; mantén el mismo estilo de entregas incrementales que ya se usa fuera de
Claude Code.
