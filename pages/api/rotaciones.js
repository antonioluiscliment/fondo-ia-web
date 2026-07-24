// pages/api/rotaciones.js
//
// Igual que pages/api/especificaciones.js, observaciones.js e
// historia.js, pero para el documento "Rotaciones" (el cuaderno de
// gestión de carteras del periodo de pruebas real / paper trading):
// cada rotación con fecha/hora, cartera anterior (con su resultado y
// el acumulado) y cartera nueva.

import mammoth from "mammoth";

const URL_DOCX_RAW =
  "https://raw.githubusercontent.com/antonioluiscliment/fondo-ia-web/main/PLAN/rotaciones.docx";

export default async function handler(req, res) {
  try {
    const respuesta = await fetch(`${URL_DOCX_RAW}?t=${Date.now()}`, { cache: "no-store" });
    if (!respuesta.ok) {
      throw new Error(
        `No se ha podido descargar el documento de rotaciones (HTTP ${respuesta.status}). Comprueba la ruta en pages/api/rotaciones.js.`
      );
    }
    const buffer = Buffer.from(await respuesta.arrayBuffer());

    const resultado = await mammoth.convertToHtml({ buffer });
    res.status(200).json({ html: resultado.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
