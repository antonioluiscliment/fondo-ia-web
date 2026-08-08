// pages/api/documentacion.js
//
// Sirve /PLAN/documentacion.html — la documentación técnica generada
// a partir de los comentarios del código fuente (estructura del
// proyecto, qué hace cada módulo, funciones principales) — dentro de
// un iframe en el panel del icono de información (ⓘ → Documentación,
// justo después de Especificaciones).
//
// Por qué un endpoint propio y no un iframe apuntando directamente a
// la URL de GitHub: raw.githubusercontent.com sirve los ficheros
// .html con el tipo de contenido "text/plain" a propósito (para
// evitar que cualquiera pueda alojar HTML/JavaScript ejecutable bajo
// el dominio de GitHub) — un iframe apuntando ahí mostraría el código
// fuente en bruto, no la página renderizada. Este endpoint descarga
// ese mismo HTML y lo reenvía con el tipo de contenido correcto
// ("text/html"), sin ninguna conversión: a diferencia de
// especificaciones.js/observaciones.js/historia.js/experiencia.js,
// aquí no hace falta mammoth, el fichero de origen ya es HTML.

const URL_BASE = "https://raw.githubusercontent.com/antonioluiscliment/fondo-ia-web/main/PLAN";

export default async function handler(req, res) {
  try {
    const respuesta = await fetch(`${URL_BASE}/documentacion.html?t=${Date.now()}`, { cache: "no-store" });
    if (!respuesta.ok) {
      throw new Error(`No se ha podido descargar la documentación técnica (HTTP ${respuesta.status}).`);
    }
    const html = await respuesta.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (error) {
    res.status(500).send(`<p style="font-family: sans-serif; color: crimson; padding: 20px;">Error: ${error.message}</p>`);
  }
}
