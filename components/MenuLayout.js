import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAppConfig } from "../lib/appConfig";
import { INDICES, obtenerIndice } from "../lib/indices";
import BotonCompartirPdf from "./BotonCompartirPdf";
import { descargarHtmlPdf, compartirHtmlPdf } from "../lib/pdfComun";

// "General" ya no es una opción del menú hamburguesa: el selector de
// índice e idioma viven siempre visibles en el marco exterior (más
// abajo en este mismo componente), y las especificaciones/historia/
// observaciones se han movido al panel del icono de info (ⓘ).
const ENLACES = [
  { href: "/comprobaciones", labelKey: "menuComprobaciones" },
  { href: "/parametrosTecnicos", labelKey: "menuParametrosTecnicos" },
  { href: "/", labelKey: "menuSeleccionTecnica" },
  { href: "/seleccionAlternativa", labelKey: "menuSeleccionAlternativa" },
  { href: "/analisis", labelKey: "menuAnalisis" },
  { href: "/anomaliasFlujoBajo", labelKey: "menuAnomaliasFlujoBajo" },
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
  const [cargandoEspecificaciones, setCargandoEspecificaciones] = useState(false);
  const [errorEspecificaciones, setErrorEspecificaciones] = useState(null);
  const [mostrarEspecificaciones, setMostrarEspecificaciones] = useState(false);

  const [observaciones, setObservaciones] = useState(null);
  const [cargandoObservaciones, setCargandoObservaciones] = useState(false);
  const [errorObservaciones, setErrorObservaciones] = useState(null);
  const [mostrarObservaciones, setMostrarObservaciones] = useState(false);

  const [historia, setHistoria] = useState(null);
  const [cargandoHistoria, setCargandoHistoria] = useState(false);
  const [errorHistoria, setErrorHistoria] = useState(null);
  const [mostrarHistoria, setMostrarHistoria] = useState(false);

  async function verEspecificaciones() {
    if (especificaciones) {
      setMostrarEspecificaciones((v) => !v);
      return;
    }
    setCargandoEspecificaciones(true);
    setErrorEspecificaciones(null);
    try {
      const resp = await fetch(`/api/especificaciones`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setEspecificaciones(json.html);
      setMostrarEspecificaciones(true);
    } catch (e) {
      setErrorEspecificaciones(e.message);
    } finally {
      setCargandoEspecificaciones(false);
    }
  }

  async function verObservaciones() {
    if (observaciones) {
      setMostrarObservaciones((v) => !v);
      return;
    }
    setCargandoObservaciones(true);
    setErrorObservaciones(null);
    try {
      const resp = await fetch(`/api/observaciones`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setObservaciones(json.html);
      setMostrarObservaciones(true);
    } catch (e) {
      setErrorObservaciones(e.message);
    } finally {
      setCargandoObservaciones(false);
    }
  }

  async function verHistoria() {
    if (historia) {
      setMostrarHistoria((v) => !v);
      return;
    }
    setCargandoHistoria(true);
    setErrorHistoria(null);
    try {
      const resp = await fetch(`/api/historia`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setHistoria(json.html);
      setMostrarHistoria(true);
    } catch (e) {
      setErrorHistoria(e.message);
    } finally {
      setCargandoHistoria(false);
    }
  }

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
        </div>
      )}

      <div style={{ marginTop: 16 }}>{children}</div>
    </main>
  );
}
