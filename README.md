# Fondo IA — Paso 1 (web)

Aplicación web mínima para probar el cálculo de ratios sobre los últimos
20 cierres diarios de los componentes del Dow Jones, usando `yahoo-finance2`.

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
