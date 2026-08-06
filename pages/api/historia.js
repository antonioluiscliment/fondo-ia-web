// pages/api/historia.js
//
// Igual que pages/api/especificaciones.js y observaciones.js, pero
// para el documento "Historia" del proyecto (cómo y por qué surgió).
//
// Un fichero monolingüe distinto según el idioma de la interfaz
// (?idioma=es/en) — ver la nota de especificaciones.js.

import mammoth from "mammoth";

const URL_BASE = "https://raw.githubusercontent.com/antonioluiscliment/fondo-ia-web/main/PLAN";

export default async function handler(req, res) {
  try {
    const idioma = req.query.idioma === "en" ? "en" : "es";
    const urlDocx = `${URL_BASE}/historia_${idioma}.docx`;

    const respuesta = await fetch(`${urlDocx}?t=${Date.now()}`, { cache: "no-store" });
    if (!respuesta.ok) {
      throw new Error(
        `No se ha podido descargar el documento de historia en ${idioma} (HTTP ${respuesta.status}). Comprueba la ruta en pages/api/historia.js.`
      );
    }
    const buffer = Buffer.from(await respuesta.arrayBuffer());

    const resultado = await mammoth.convertToHtml({ buffer });
    res.status(200).json({ html: resultado.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
