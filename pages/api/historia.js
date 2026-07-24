// pages/api/historia.js
//
// Igual que pages/api/especificaciones.js y observaciones.js, pero
// para el documento "Historia" del proyecto (cómo y por qué surgió),
// bilingüe (español/inglés) igual que los demás documentos.

import mammoth from "mammoth";

const URL_DOCX_RAW =
  "https://raw.githubusercontent.com/antonioluiscliment/fondo-ia-web/main/PLAN/historia.docx";

export default async function handler(req, res) {
  try {
    const respuesta = await fetch(`${URL_DOCX_RAW}?t=${Date.now()}`, { cache: "no-store" });
    if (!respuesta.ok) {
      throw new Error(
        `No se ha podido descargar el documento de historia (HTTP ${respuesta.status}). Comprueba la ruta en pages/api/historia.js.`
      );
    }
    const buffer = Buffer.from(await respuesta.arrayBuffer());

    const resultado = await mammoth.convertToHtml({ buffer });
    res.status(200).json({ html: resultado.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
