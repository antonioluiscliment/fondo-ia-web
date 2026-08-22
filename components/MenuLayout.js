import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAppConfig } from "../lib/appConfig";
import { INDICES, obtenerIndice } from "../lib/indices";
import BotonCompartirPdf from "./BotonCompartirPdf";
import { descargarHtmlPdf, compartirHtmlPdf } from "../lib/pdfComun";

// "General" ya no es una opción del menú hamburguesa: el selector de
// índice e idioma viven siempre visibles en el marco exterior (más
// abajo en este mismo componente). El panel del icono de info (ⓘ)
// reúne, en este orden: Especificaciones, Documentación (esta misma
// documentación técnica, generada a partir de los comentarios del
// código — ver /PLAN/documentacion.html y pages/api/documentacion.js),
// Observaciones, Historia, Experiencia, y Presentación.

const ENLACES = [
  { href: "/comprobaciones", labelKey: "menuComprobaciones" },
  { href: "/parametrosTecnicos", labelKey: "menuParametrosTecnicos" },
  { href: "/", labelKey: "menuSeleccionTecnica" },
  { href: "/seleccionAlternativa", labelKey: "menuSeleccionAlternativa" },
  { href: "/analisis", labelKey: "menuAnalisis" },
  { href: "/anomaliasFlujoBajo", labelKey: "menuAnomaliasFlujoBajo" },
  { href: "/comparacionRedNeuronal", labelKey: "menuComparacionRedNeuronal" },
  { href: "/reversionMedia", labelKey: "menuReversionMedia" },
];

// Icono de tres rayas (hamburguesa), dibujado a mano con <span> para no
// depender de ninguna librería de iconos.
function IconoMenu() {
  const raya = { display: "block", width: 22, height: 2.5, background: "#333", margin: "4px 0", borderRadius: 2 };
  return (
    <span style={{ display: "inline-block" }}>
      <span style={raya} />
      <span style={raya} />
      <span style={raya} />
    </span>
  );
}

const estiloBotonIcono = {
  background: "none",
  border: "1px solid #999",
  borderRadius: 6,
  padding: "6px 8px",
  cursor: "pointer",
  lineHeight: 0,
};

const estiloPanelDocx = {
  border: "1px solid #ccc",
  borderRadius: 6,
  padding: 16,
  margin: "16px 0",
  maxHeight: 480,
  overflowY: "auto",
  background: "#fafafa",
};

// "Presentación": a diferencia de especificaciones/observaciones/
// historia (documentos .docx que hay que convertir a HTML con
// mammoth, vía un endpoint propio), el PowerPoint y el audio se
// muestran directamente desde la URL pública del repositorio — no
// hace falta ningún endpoint ni conversión, un iframe con el visor de
// Office de Microsoft (que acepta cualquier URL pública de un .pptx)
// y una etiqueta <audio> normal bastan. Un fichero distinto según el
// idioma de la interfaz (es/en).
const REPO_RAW_BASE = "https://raw.githubusercontent.com/antonioluiscliment/fondo-ia-web/main/PLAN";
const PRESENTACION_ARCHIVOS = {
  es: { pptx: "Gestion_Carteras_IA.pptx", mp3: "speech_ESPAÑOL.mp3" },
  en: { pptx: "AI_Guided_Portfolio_Management.pptx", mp3: "speech_ENGLISH.mp3" },
};

export default function MenuLayout({ children }) {
  const { idioma, setIdioma, t, indiceId, setIndiceId, sesionesPuntuacion, setSesionesPuntuacion } = useAppConfig();
  const indiceActual = obtenerIndice(indiceId);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [infoAbierto, setInfoAbierto] = useState(false);
  const router = useRouter();

  // Especificaciones / historia / observaciones: antes vivían en la
  // página "Características generales"; ahora, al ser contenido que
  // queremos accesible desde cualquier pantalla, viven aquí, en el
  // marco exterior persistente, detrás del icono de info.
  const [especificaciones, setEspecificaciones] = useState(null);
  const [especificacionesIdioma, setEspecificacionesIdioma] = useState(null);
  const [cargandoEspecificaciones, setCargandoEspecificaciones] = useState(false);
  const [errorEspecificaciones, setErrorEspecificaciones] = useState(null);
  const [mostrarEspecificaciones, setMostrarEspecificaciones] = useState(false);

  // "Documentación" no tiene versión por idioma (los comentarios del
  // código de los que sale están en español) — un simple mostrar/
  // ocultar, como Presentación, con un iframe apuntando a un
  // endpoint propio en vez de a mammoth (el fichero ya es HTML, no
  // hace falta convertir nada).
  const [mostrarDocumentacion, setMostrarDocumentacion] = useState(false);

  const [observaciones, setObservaciones] = useState(null);
  const [observacionesIdioma, setObservacionesIdioma] = useState(null);
  const [cargandoObservaciones, setCargandoObservaciones] = useState(false);
  const [errorObservaciones, setErrorObservaciones] = useState(null);
  const [mostrarObservaciones, setMostrarObservaciones] = useState(false);

  const [historia, setHistoria] = useState(null);
  const [historiaIdioma, setHistoriaIdioma] = useState(null);
  const [cargandoHistoria, setCargandoHistoria] = useState(false);
  const [errorHistoria, setErrorHistoria] = useState(null);
  const [mostrarHistoria, setMostrarHistoria] = useState(false);

  const [experiencia, setExperiencia] = useState(null);
  const [experienciaIdioma, setExperienciaIdioma] = useState(null);
  const [cargandoExperiencia, setCargandoExperiencia] = useState(false);
  const [errorExperiencia, setErrorExperiencia] = useState(null);
  const [mostrarExperiencia, setMostrarExperiencia] = useState(false);

  const [mostrarPresentacion, setMostrarPresentacion] = useState(false);

  async function verEspecificaciones() {
    if (especificaciones && especificacionesIdioma === idioma) {
      setMostrarEspecificaciones((v) => !v);
      return;
    }
    setCargandoEspecificaciones(true);
    setErrorEspecificaciones(null);
    try {
      const resp = await fetch(`/api/especificaciones?idioma=${idioma}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setEspecificaciones(json.html);
      setEspecificacionesIdioma(idioma);
      setMostrarEspecificaciones(true);
    } catch (e) {
      setErrorEspecificaciones(e.message);
    } finally {
      setCargandoEspecificaciones(false);
    }
  }

  async function verObservaciones() {
    if (observaciones && observacionesIdioma === idioma) {
      setMostrarObservaciones((v) => !v);
      return;
    }
    setCargandoObservaciones(true);
    setErrorObservaciones(null);
    try {
      const resp = await fetch(`/api/observaciones?idioma=${idioma}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setObservaciones(json.html);
      setObservacionesIdioma(idioma);
      setMostrarObservaciones(true);
    } catch (e) {
      setErrorObservaciones(e.message);
    } finally {
      setCargandoObservaciones(false);
    }
  }

  async function verHistoria() {
    if (historia && historiaIdioma === idioma) {
      setMostrarHistoria((v) => !v);
      return;
    }
    setCargandoHistoria(true);
    setErrorHistoria(null);
    try {
      const resp = await fetch(`/api/historia?idioma=${idioma}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setHistoria(json.html);
      setHistoriaIdioma(idioma);
      setMostrarHistoria(true);
    } catch (e) {
      setErrorHistoria(e.message);
    } finally {
      setCargandoHistoria(false);
    }
  }

  async function verExperiencia() {
    if (experiencia && experienciaIdioma === idioma) {
      setMostrarExperiencia((v) => !v);
      return;
    }
    setCargandoExperiencia(true);
    setErrorExperiencia(null);
    try {
      const resp = await fetch(`/api/experiencia?idioma=${idioma}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setExperiencia(json.html);
      setExperienciaIdioma(idioma);
      setMostrarExperiencia(true);
    } catch (e) {
      setErrorExperiencia(e.message);
    } finally {
      setCargandoExperiencia(false);
    }
  }

  // Si el usuario cambia el idioma con el panel ya abierto, se
  // recarga solo, sin que haga falta volver a pulsar el botón —
  // mismo espíritu que el iframe de "Presentación" (más abajo), que
  // se recarga con la clave `idioma`.
  useEffect(() => {
    if (mostrarEspecificaciones && especificacionesIdioma !== idioma) verEspecificaciones();
  }, [idioma]);
  useEffect(() => {
    if (mostrarObservaciones && observacionesIdioma !== idioma) verObservaciones();
  }, [idioma]);
  useEffect(() => {
    if (mostrarHistoria && historiaIdioma !== idioma) verHistoria();
  }, [idioma]);
  useEffect(() => {
    if (mostrarExperiencia && experienciaIdioma !== idioma) verExperiencia();
  }, [idioma]);

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif", padding: "16px", background: "#ffe4d6", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label={menuAbierto ? t.menuCerrar : t.menuAbrir}
            style={estiloBotonIcono}
          >
            <IconoMenu />
          </button>
          <h1 style={{ margin: 0 }}>{t.titulo}</h1>
        </div>
        <button
          onClick={() => setInfoAbierto((v) => !v)}
          aria-label={t.infoEtiqueta}
          title={t.infoEtiqueta}
          style={{ ...estiloBotonIcono, fontWeight: "bold", fontStyle: "italic", fontFamily: "serif" }}
        >
          i
        </button>
      </div>

      {/* Marco exterior persistente: índice, sesiones promediadas e
          idioma, visibles siempre, en cualquier pantalla,
          independientemente del menú hamburguesa. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", marginTop: 12 }}>
        <label>
          {t.indiceSeleccionadoEtiqueta}{" "}
          <select value={indiceId} onChange={(e) => setIndiceId(e.target.value)}>
            {INDICES.map((ind) => (
              <option key={ind.id} value={ind.id}>{ind.nombre[idioma]}</option>
            ))}
          </select>
        </label>
        <label>
          {t.sesionesPuntuacionEtiqueta}{" "}
          <select value={sesionesPuntuacion} onChange={(e) => setSesionesPuntuacion(Number(e.target.value))}>
            {[3, 5, 8, 13].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          {t.idiomaEtiqueta}{" "}
          <select value={idioma} onChange={(e) => setIdioma(e.target.value)}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      {indiceActual.advertencia && (
        <p style={{ background: "#fff3cd", border: "1px solid #cc9a06", borderRadius: 6, padding: 12, color: "#7a5c00", marginTop: 8 }}>
          {indiceActual.advertencia[idioma]}
        </p>
      )}

      {menuAbierto && (
        <nav
          style={{
            marginTop: 12,
            border: "1px solid #999",
            borderRadius: 8,
            background: "#fff8f3",
            overflow: "hidden",
          }}
        >
          {ENLACES.map((enlace) => {
            const activo = router.pathname === enlace.href;
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                onClick={() => setMenuAbierto(false)}
                style={{
                  display: "block",
                  padding: "12px 16px",
                  textDecoration: "none",
                  color: activo ? "#fff" : "#222",
                  background: activo ? "#2d6a2d" : "transparent",
                  borderBottom: "1px solid #eee",
                  fontWeight: activo ? "bold" : "normal",
                }}
              >
                {t[enlace.labelKey]}
              </Link>
            );
          })}
        </nav>
      )}

      {infoAbierto && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #999",
            borderRadius: 8,
            background: "#fff8f3",
            padding: 16,
          }}
        >
          <div>
            <button onClick={verEspecificaciones} disabled={cargandoEspecificaciones}>
              {cargandoEspecificaciones
                ? t.especificacionesCargando
                : mostrarEspecificaciones
                ? t.especificacionesOcultar
                : t.especificacionesMostrar}
            </button>{" "}
            <button onClick={() => setMostrarDocumentacion((v) => !v)}>
              {mostrarDocumentacion ? t.documentacionOcultar : t.documentacionMostrar}
            </button>{" "}
            <button onClick={verObservaciones} disabled={cargandoObservaciones}>
              {cargandoObservaciones
                ? t.especificacionesCargando
                : mostrarObservaciones
                ? t.observacionesOcultar
                : t.observacionesMostrar}
            </button>{" "}
            <button onClick={verHistoria} disabled={cargandoHistoria}>
              {cargandoHistoria
                ? t.especificacionesCargando
                : mostrarHistoria
                ? t.historiaOcultar
                : t.historiaMostrar}
            </button>{" "}
            <button onClick={verExperiencia} disabled={cargandoExperiencia}>
              {cargandoExperiencia
                ? t.especificacionesCargando
                : mostrarExperiencia
                ? t.experienciaOcultar
                : t.experienciaMostrar}
            </button>{" "}
            <button onClick={() => setMostrarPresentacion((v) => !v)}>
              {mostrarPresentacion ? t.presentacionOcultar : t.presentacionMostrar}
            </button>
          </div>

          {errorEspecificaciones && <p style={{ color: "crimson" }}>{t.error}: {errorEspecificaciones}</p>}
          {mostrarEspecificaciones && especificaciones && (
            <>
              <div style={estiloPanelDocx} dangerouslySetInnerHTML={{ __html: especificaciones }} />
              <button
                onClick={() =>
                  descargarHtmlPdf({ titulo: t.especificacionesMostrar, html: especificaciones, nombreArchivo: "especificaciones.pdf" })
                }
              >
                {t.descargarPdfBoton}
              </button>
              <BotonCompartirPdf
                opciones={{ titulo: t.especificacionesMostrar, html: especificaciones, nombreArchivo: "especificaciones.pdf" }}
                compartirFn={compartirHtmlPdf}
              />
            </>
          )}

          {mostrarDocumentacion && (
            <iframe
              src="/api/documentacion"
              title={t.documentacionMostrar}
              style={{ width: "100%", height: 600, border: "1px solid #ccc", borderRadius: 6, margin: "16px 0" }}
            />
          )}

          {errorObservaciones && <p style={{ color: "crimson" }}>{t.error}: {errorObservaciones}</p>}
          {mostrarObservaciones && observaciones && (
            <>
              <div style={estiloPanelDocx} dangerouslySetInnerHTML={{ __html: observaciones }} />
              <button
                onClick={() =>
                  descargarHtmlPdf({ titulo: t.observacionesMostrar, html: observaciones, nombreArchivo: "observaciones.pdf" })
                }
              >
                {t.descargarPdfBoton}
              </button>
              <BotonCompartirPdf
                opciones={{ titulo: t.observacionesMostrar, html: observaciones, nombreArchivo: "observaciones.pdf" }}
                compartirFn={compartirHtmlPdf}
              />
            </>
          )}

          {errorHistoria && <p style={{ color: "crimson" }}>{t.error}: {errorHistoria}</p>}
          {mostrarHistoria && historia && (
            <div style={estiloPanelDocx} dangerouslySetInnerHTML={{ __html: historia }} />
          )}

          {errorExperiencia && <p style={{ color: "crimson" }}>{t.error}: {errorExperiencia}</p>}
          {mostrarExperiencia && experiencia && (
            <div style={estiloPanelDocx} dangerouslySetInnerHTML={{ __html: experiencia }} />
          )}

          {mostrarPresentacion && (() => {
            const archivos = PRESENTACION_ARCHIVOS[idioma] || PRESENTACION_ARCHIVOS.es;
            const urlPptx = `${REPO_RAW_BASE}/${encodeURIComponent(archivos.pptx)}`;
            const urlMp3 = `${REPO_RAW_BASE}/${encodeURIComponent(archivos.mp3)}`;
            const urlVisor = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(urlPptx)}`;
            return (
              <div style={{ ...estiloPanelDocx, maxHeight: "none" }}>
                <audio controls src={urlMp3} style={{ width: "100%", marginBottom: 12 }}>
                  {t.presentacionAudioNoSoportado}
                </audio>
                <iframe
                  key={idioma}
                  src={urlVisor}
                  title={t.presentacionMostrar}
                  style={{ width: "100%", height: 480, border: "1px solid #ccc" }}
                  allowFullScreen
                />
                <p style={{ marginTop: 8 }}>
                  <a href={urlPptx} target="_blank" rel="noopener noreferrer">
                    {t.presentacionDescargarPptx}
                  </a>
                </p>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ marginTop: 16 }}>{children}</div>
    </main>
  );
}
