// pages/api/observaciones.js
//
// Igual que pages/api/especificaciones.js, pero para el documento de
// observaciones, comentarios e hipótesis de trabajo (un cuaderno de
// bitácora que se va ampliando conforme se prueba la aplicación).
//
// Un fichero monolingüe distinto según el idioma de la interfaz
// (?idioma=es/en) — ver la nota de especificaciones.js.

import mammoth from "mammoth";

const URL_BASE = "https://raw.githubusercontent.com/antonioluiscliment/fondo-ia-web/main/PLAN";

export default async function handler(req, res) {
  try {
    const idioma = req.query.idioma === "en" ? "en" : "es";
    const urlDocx = `${URL_BASE}/observaciones_${idioma}.docx`;

    const respuesta = await fetch(urlDocx);
    if (!respuesta.ok) {
      throw new Error(
        `No se ha podido descargar el documento de observaciones en ${idioma} (HTTP ${respuesta.status}). Comprueba la ruta en pages/api/observaciones.js.`
      );
    }
    const buffer = Buffer.from(await respuesta.arrayBuffer());

    const resultado = await mammoth.convertToHtml({ buffer });
    res.status(200).json({ html: resultado.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
