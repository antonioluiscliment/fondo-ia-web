// pages/api/observaciones.js
//
// Igual que pages/api/especificaciones.js, pero para el documento de
// observaciones, comentarios e hipótesis de trabajo (un cuaderno de
// bitácora que se va ampliando conforme se prueba la aplicación).

import mammoth from "mammoth";

const URL_DOCX_RAW =
  "https://raw.githubusercontent.com/antonioluiscliment/fondo-ia-web/main/PLAN/observaciones.docx";

export default async function handler(req, res) {
  try {
    const respuesta = await fetch(URL_DOCX_RAW);
    if (!respuesta.ok) {
      throw new Error(
        `No se ha podido descargar el documento de observaciones (HTTP ${respuesta.status}). Comprueba la ruta en pages/api/observaciones.js.`
      );
    }
    const buffer = Buffer.from(await respuesta.arrayBuffer());

    const resultado = await mammoth.convertToHtml({ buffer });
    res.status(200).json({ html: resultado.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
