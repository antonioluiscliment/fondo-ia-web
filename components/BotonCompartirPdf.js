// components/BotonCompartirPdf.js
//
// Botón "Compartir PDF" reutilizable: genera el mismo PDF que
// "Descargar PDF" (mismas opciones, ver lib/pdfComun.js) pero, en vez
// de guardarlo, abre el panel nativo de compartir del dispositivo con
// el fichero ya adjunto — desde ahí el usuario elige Gmail, WhatsApp,
// o lo que tenga instalado.
//
// No se muestra nada si el navegador no soporta compartir ficheros
// (navigator.share con adjuntos — bastantes navegadores de
// escritorio no lo soportan, la mayoría de móviles sí): mejor no
// enseñar un botón que sabemos que va a fallar siempre.
//
// Uso, junto al botón de descarga ya existente:
//   <button onClick={() => descargarTablaPdf(opciones)}>{t.descargarPdfBoton}</button>
//   <BotonCompartirPdf opciones={opciones} />
// donde "opciones" es el mismo objeto que ya se le pasa a
// descargarTablaPdf (título, columnas, filas, nombreArchivo...).
//
// Para el caso de un PDF con varias tablas (una por índice, ver
// "Rentabilidad de todos los ETFs"), se le pasa la función de
// compartir correspondiente en compartirFn:
//   <BotonCompartirPdf opciones={opciones} compartirFn={compartirMultiplesTablasPdf} />

import { useState } from "react";
import { useAppConfig } from "../lib/appConfig";
import { compartirTablaPdf, compartirDisponible } from "../lib/pdfComun";

export default function BotonCompartirPdf({ opciones, style, compartirFn = compartirTablaPdf }) {
  const { t } = useAppConfig();
  const [cargando, setCargando] = useState(false);
  const [noDisponible, setNoDisponible] = useState(false);

  // compartirDisponible() consulta el navegador (no cambia durante la
  // vida del componente), así que basta con comprobarlo una vez aquí,
  // sin necesidad de useEffect ni de otro hook adicional.
  const disponible = compartirDisponible();

  async function compartir() {
    setCargando(true);
    setNoDisponible(false);
    try {
      await compartirFn(opciones);
    } catch {
      setNoDisponible(true);
    } finally {
      setCargando(false);
    }
  }

  if (!disponible) return null;

  return (
    <>
      <button onClick={compartir} disabled={cargando} style={{ marginLeft: 8, ...style }}>
        {cargando ? t.compartirPdfBotonCargando : t.compartirPdfBoton}
      </button>
      {noDisponible && <span style={{ color: "crimson", marginLeft: 8 }}>{t.compartirPdfNoDisponible}</span>}
    </>
  );
}
