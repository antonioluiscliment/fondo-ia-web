// lib/pdfComun.js
//
// Generación de PDF reutilizable para todas las visualizaciones de la
// aplicación (tablas de comprobaciones, selección, análisis...). Se
// genera en el propio navegador con jsPDF + jspdf-autotable, a partir
// de los datos que ya están cargados en pantalla — no vuelve a llamar
// a ningún endpoint.
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
// nombreArchivo: nombre del fichero .pdf a descargar.
// parrafos: líneas de texto opcionales que se añaden ANTES de la
//   tabla (p.ej. una conclusión o un resumen), cada una en su propia
//   línea, con salto de línea automático si es muy larga.
export function descargarTablaPdf({ titulo, subtitulo, columnas, filas, nombreArchivo, parrafos }) {
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

  doc.save(nombreArchivo);
}
