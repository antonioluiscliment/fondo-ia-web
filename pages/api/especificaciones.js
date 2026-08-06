// pages/api/especificaciones.js
//
// Descarga el documento de especificaciones (.docx) directamente del
// repositorio de GitHub y lo convierte a HTML con "mammoth", para
// poder mostrar su contenido dentro de la propia web, sin enviar al
// usuario al repositorio.
//
// Un fichero MONOLINGÜE distinto según el idioma de la interfaz
// (?idioma=es/en), no un único documento bilingüe con las dos
// columnas — así cada visita descarga y convierte solo el idioma que
// necesita, igual que ya hace "Presentación" con el PowerPoint y el
// audio (más eficiente que descargar y convertir siempre las dos
// columnas para mostrar solo una).

import mammoth from "mammoth";

// Ruta "raw" de cada versión en GitHub. Actualiza esto si cambias la
// ubicación o el nombre de los documentos.
const URL_BASE = "https://raw.githubusercontent.com/antonioluiscliment/fondo-ia-web/main/PLAN";

export default async function handler(req, res) {
  try {
    const idioma = req.query.idioma === "en" ? "en" : "es";
    const urlDocx = `${URL_BASE}/especificaciones_${idioma}.docx`;

    const respuesta = await fetch(urlDocx);
    if (!respuesta.ok) {
      throw new Error(
        `No se ha podido descargar el documento de especificaciones en ${idioma} (HTTP ${respuesta.status}). Comprueba la ruta en pages/api/especificaciones.js.`
      );
    }
    const buffer = Buffer.from(await respuesta.arrayBuffer());

    const resultado = await mammoth.convertToHtml({ buffer });
    res.status(200).json({ html: resultado.value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
