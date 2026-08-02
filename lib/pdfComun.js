// lib/pdfComun.js
//
// Generación de PDF reutilizable para todas las visualizaciones de la
// aplicación (tablas de comprobaciones, selección, análisis...). Se
// genera en el propio navegador con jsPDF + jspdf-autotable, a partir
// de los datos que ya están cargados en pantalla — no vuelve a llamar
// a ningún endpoint.
//
// Dos formas de usar el mismo PDF ya construido:
//   - descargarTablaPdf(...): lo guarda directamente (comportamiento
//     original).
//   - compartirTablaPdf(...): abre el panel nativo de "compartir" del
//     dispositivo (navigator.share), con el PDF ya adjunto — desde
//     ahí el usuario elige Gmail, WhatsApp, o lo que tenga instalado.
//     No hay ningún servidor de por medio: el navegador no puede
//     enviar un correo por sí mismo, así que esta es la vía sin
//     necesidad de dar de alta ningún servicio externo. Comprobar
//     antes con compartirDisponible() si el navegador lo soporta (no
//     todos lo hacen, sobre todo en escritorio) —
//     components/BotonCompartirPdf.js ya se encarga de eso.
//
// Uso típico, tras una tabla ya mostrada en pantalla:
//   <button onClick={() => descargarTablaPdf({
//     titulo: "...",
//     columnas: ["Ticker", "Precio", ...],
//     filas: datos.map((d) => [d.ticker, d.precio, ...]),
//     nombreArchivo: "seleccion-precio.pdf",
//   })}>Descargar PDF</button>

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// titulo: texto principal (obligatorio).
// subtitulo: línea secundaria opcional (p.ej. nombre del índice o
//   criterio usado).
// columnas: array de cabeceras de columna.
// filas: array de arrays, una fila por línea de tabla.
// parrafos: líneas de texto opcionales que se añaden ANTES de la
//   tabla (p.ej. una conclusión o un resumen), cada una en su propia
//   línea, con salto de línea automático si es muy larga.
function construirDocumentoPdf({ titulo, subtitulo, columnas, filas, parrafos }) {
  const doc = new jsPDF();
  const anchoUtil = doc.internal.pageSize.getWidth() - 28; // margen de 14 a cada lado

  doc.setFontSize(14);
  doc.text(titulo, 14, 15);

  let y = 22;
  if (subtitulo) {
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(subtitulo, 14, y);
    doc.setTextColor(0);
    y += 6;
  }

  if (parrafos && parrafos.length > 0) {
    doc.setFontSize(9);
    for (const parrafo of parrafos) {
      const lineas = doc.splitTextToSize(parrafo, anchoUtil);
      doc.text(lineas, 14, y);
      y += lineas.length * 4 + 3;
    }
    y += 2;
  }

  autoTable(doc, {
    startY: y,
    head: [columnas],
    body: filas,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [45, 106, 45] },
    margin: { left: 14, right: 14 },
  });

  return doc;
}

// nombreArchivo: nombre del fichero .pdf a descargar (o a adjuntar,
// en el caso de compartirTablaPdf).
export function descargarTablaPdf(opciones) {
  const doc = construirDocumentoPdf(opciones);
  doc.save(opciones.nombreArchivo);
}

// Comprueba si el navegador puede compartir ficheros (no solo texto)
// con navigator.share — bastantes navegadores de escritorio no lo
// soportan, la mayoría de móviles sí. No garantiza que vaya a
// funcionar (eso solo se sabe al intentarlo), pero evita mostrar un
// botón que seguro que va a fallar.
export function compartirDisponible() {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return false;
  try {
    const pruebaFile = new File(["x"], "prueba.pdf", { type: "application/pdf" });
    return navigator.canShare({ files: [pruebaFile] });
  } catch {
    return false;
  }
}

// Genera el mismo PDF y abre el panel nativo de compartir del
// dispositivo con el fichero ya adjunto. Si el usuario cierra el
// panel sin elegir nada, el navegador lanza un AbortError — no es un
// fallo real, así que se ignora en silencio; cualquier otro error se
// relanza para que quien llama pueda avisar de que no se pudo
// compartir.
export async function compartirTablaPdf(opciones) {
  const doc = construirDocumentoPdf(opciones);
  const blob = doc.output("blob");
  const file = new File([blob], opciones.nombreArchivo, { type: "application/pdf" });
  try {
    await navigator.share({ files: [file], title: opciones.titulo });
  } catch (error) {
    if (error && error.name === "AbortError") return;
    throw error;
  }
}

// Igual que construirDocumentoPdf, pero con varias tablas en el mismo
// documento — una por sección (p.ej. una por índice), cada una con su
// propio subtítulo y, si hace falta, sus propios párrafos. Salta de
// página automáticamente cuando no cabe la siguiente sección.
//
// secciones: array de { subtitulo, parrafos?, columnas, filas }.
function construirDocumentoMultiTablaPdf({ titulo, secciones, nombreArchivo }) {
  const doc = new jsPDF();
  const anchoUtil = doc.internal.pageSize.getWidth() - 28;
  const altoPagina = doc.internal.pageSize.getHeight();

  doc.setFontSize(16);
  doc.text(titulo, 14, 15);
  let y = 24;

  for (const seccion of secciones) {
    if (y > altoPagina - 40) {
      doc.addPage();
      y = 15;
    }

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(seccion.subtitulo, 14, y);
    y += 6;

    if (seccion.parrafos && seccion.parrafos.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(90);
      for (const parrafo of seccion.parrafos) {
        const lineas = doc.splitTextToSize(parrafo, anchoUtil);
        doc.text(lineas, 14, y);
        y += lineas.length * 4 + 2;
      }
      doc.setTextColor(0);
      y += 2;
    }

    autoTable(doc, {
      startY: y,
      head: [seccion.columnas],
      body: seccion.filas,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [45, 106, 45] },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 12;
  }

  return doc;
}

// nombreArchivo: nombre del fichero .pdf a descargar (o a adjuntar,
// en el caso de compartirMultiplesTablasPdf).
export function descargarMultiplesTablasPdf(opciones) {
  const doc = construirDocumentoMultiTablaPdf(opciones);
  doc.save(opciones.nombreArchivo);
}

export async function compartirMultiplesTablasPdf(opciones) {
  const doc = construirDocumentoMultiTablaPdf(opciones);
  const blob = doc.output("blob");
  const file = new File([blob], opciones.nombreArchivo, { type: "application/pdf" });
  try {
    await navigator.share({ files: [file], title: opciones.titulo });
  } catch (error) {
    if (error && error.name === "AbortError") return;
    throw error;
  }
}
