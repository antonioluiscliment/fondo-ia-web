// pages/api/especificaciones.js
//
// Descarga el documento de especificaciones (.docx) directamente del
// repositorio de GitHub y lo convierte a HTML con "mammoth", para
// poder mostrar su contenido dentro de la propia web, sin enviar al
// usuario al repositorio.

import mammoth from "mammoth";

// Ruta "raw" del fichero en GitHub. Actualiza esto si cambias la
// ubicación o el nombre del documento.
const URL_DOCX_RAW =
  "https://raw.githubusercontent.com/antonioluiscliment/fondo-ia-web/main/PLAN/especificaciones.docx";

export default async function handler(req, res) {
  try {
    const respuesta = await fetch(URL_DOCX_RAW);
    if (!respuesta.ok) {
      throw new Error(
        `No se ha podido descargar el documento de especificaciones (HTTP ${respuesta.status}). Comprueba la ruta en pages/api/especificaciones.js.`
      );
    }
    const buffer = Buffer.from(await respuesta.arrayBuffer());

    const resultado = await mammoth.convertToHtml({ buffer });
    res.status(200).json({ html: resultado.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
