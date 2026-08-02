# Fondo IA (repo fondo-ia-web)

Aplicación web de análisis y selección de carteras bursátiles con backtesting, construida en Next.js (Pages Router) + React 18, que consume datos de Yahoo Finance. Desarrollo en solitario, desplegada en Vercel desde GitHub, gestionada a menudo desde el móvil.

Estado actual

Arquitectura multi-página con sidebar hamburguesa, contextos globales IdiomaContext e IndiceContext, layout persistente.
8 índices soportados: Dow Jones, IBEX 35, CAC 40, PSI 20, DAX, AEX, FTSE MIB, Nasdaq 100.
Parámetro global "sesiones promediadas": 3, 5, 8 o 13 (Fibonacci).
6 métodos de selección de cartera (incluyendo 3 "antítesis").
Análisis fundamental y rentabilidad de ETFs implementados.
Correlación con recomendaciones de analistas (single y multi-índice).
Lógica central en lib/motor.js, i18n en lib/i18n.js, índices en lib/indices/.
pages/seleccionVeces.js existe pero está huérfana (sin enlace en menú).

## Cómo desplegarlo en Vercel sin escribir código

1. Sube esta carpeta completa a tu repositorio de GitHub (`FONDO-IA`),
   por ejemplo dentro de una carpeta `web/`.
2. Entra en https://vercel.com y conecta tu cuenta de GitHub.
3. Pulsa "Add New... → Project" y selecciona el repositorio `FONDO-IA`.
4. Si el proyecto Next.js no está en la raíz del repo, indica el
   "Root Directory" correspondiente (por ejemplo `web`).
5. Pulsa "Deploy". Vercel detecta automáticamente que es un proyecto
   Next.js, instala las dependencias (incluida `yahoo-finance2`) y
   publica la web. No hace falta ninguna configuración adicional.
6. Al terminar, Vercel te da una URL pública (algo como
   `fondo-ia-web.vercel.app`) donde cualquiera puede entrar, elegir un
   ticker y ver los ratios calculados.

## Desarrollo local (opcional)

```bash
npm install
npm run dev
```

Y abre http://localhost:3000
"# fondo-ia-web" 
