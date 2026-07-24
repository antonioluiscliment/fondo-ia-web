import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import { useAppConfig } from "../lib/appConfig";
import { INDICES } from "../lib/indices";

// Grupo 1: Características generales — título (en MenuLayout), qué
// hace la aplicación, especificaciones/historia/observaciones,
// selección de índice e idioma (en MenuLayout).
export default function Home() {
  const { t, idioma, indiceId, setIndiceId } = useAppConfig();

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
    <MenuLayout>
      <div style={{ marginBottom: 20 }}>
        <label>
          {t.indiceSeleccionadoEtiqueta}{" "}
          <select value={indiceId} onChange={(e) => setIndiceId(e.target.value)}>
            {INDICES.map((ind) => (
              <option key={ind.id} value={ind.id}>{ind.nombre[idioma]}</option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
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
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: 16,
            margin: "16px 0",
            maxHeight: 480,
            overflowY: "auto",
            background: "#fafafa",
          }}
          dangerouslySetInnerHTML={{ __html: especificaciones }}
        />
      )}

      {errorObservaciones && <p style={{ color: "crimson" }}>{t.error}: {errorObservaciones}</p>}

      {mostrarObservaciones && observaciones && (
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: 16,
            margin: "16px 0",
            maxHeight: 480,
            overflowY: "auto",
            background: "#fafafa",
          }}
          dangerouslySetInnerHTML={{ __html: observaciones }}
        />
      )}

      {errorHistoria && <p style={{ color: "crimson" }}>{t.error}: {errorHistoria}</p>}

      {mostrarHistoria && historia && (
        <div
          style={{
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: 16,
            margin: "16px 0",
            maxHeight: 480,
            overflowY: "auto",
            background: "#fafafa",
          }}
          dangerouslySetInnerHTML={{ __html: historia }}
        />
      )}

      <hr style={{ margin: "24px 0" }} />
    </MenuLayout>
  );
}
