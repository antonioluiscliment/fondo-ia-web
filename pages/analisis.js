import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice } from "../lib/indices";

// Grupo 4: Análisis — de momento solo el análisis de correlación con
// el índice, usando los parámetros ajustados en "Formas de
// seleccionar los valores" (factor, número de componentes, tope y
// frecuencia de rebalanceo) y el índice elegido en "Características
// generales".
export default function Analisis() {
  const { t, idioma, indiceId, factorPenalizacion, nComponentes, pesoMaximo, frecuenciaRebalanceo } = useAppConfig();
  const indice = obtenerIndice(indiceId);
  const nombreIndice = indice.nombre[idioma];

  const [analisisCorrelacion, setAnalisisCorrelacion] = useState(null);
  const [cargandoAnalisisCorrelacion, setCargandoAnalisisCorrelacion] = useState(false);
  const [errorAnalisisCorrelacion, setErrorAnalisisCorrelacion] = useState(null);

  const [rentabilidadEtfs, setRentabilidadEtfs] = useState(null);
  const [cargandoRentabilidadEtfs, setCargandoRentabilidadEtfs] = useState(false);
  const [errorRentabilidadEtfs, setErrorRentabilidadEtfs] = useState(null);

  async function realizarAnalisisCorrelacion() {
    setCargandoAnalisisCorrelacion(true);
    setErrorAnalisisCorrelacion(null);
    setAnalisisCorrelacion(null);
    try {
      const resp = await fetch(`/api/analisisCorrelacion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&indice=${indiceId}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setAnalisisCorrelacion(json);
    } catch (e) {
      setErrorAnalisisCorrelacion(e.message);
    } finally {
      setCargandoAnalisisCorrelacion(false);
    }
  }

  async function consultarRentabilidadEtfs() {
    setCargandoRentabilidadEtfs(true);
    setErrorRentabilidadEtfs(null);
    setRentabilidadEtfs(null);
    try {
      const resp = await fetch(`/api/rentabilidadETFs?indice=${indiceId}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setRentabilidadEtfs(json);
    } catch (e) {
      setErrorRentabilidadEtfs(e.message);
    } finally {
      setCargandoRentabilidadEtfs(false);
    }
  }

  return (
    <MenuLayout>
      <h2>{t.analisisCorrelacionTitulo}</h2>
      <p>{t.analisisCorrelacionDesc(nombreIndice)}</p>
      <button onClick={realizarAnalisisCorrelacion} disabled={cargandoAnalisisCorrelacion}>
        {cargandoAnalisisCorrelacion ? t.analisisCorrelacionBotonCargando : t.analisisCorrelacionBoton}
      </button>

      {errorAnalisisCorrelacion && <p style={{ color: "crimson" }}>{t.error}: {errorAnalisisCorrelacion}</p>}

      {analisisCorrelacion && (
        <div style={{ marginTop: 16 }}>
          <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
            <h3 style={{ marginTop: 0 }}>{t.conclusionTitulo}</h3>
            <p>{analisisCorrelacion.conclusion}</p>
          </div>

          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.88em" }}>
            <thead>
              <tr>
                <th>{t.colMetodo}</th>
                <th>{t.colDuracion}</th>
                <th>{t.colRepeticiones}</th>
                <th>{t.colCorrelacionMedia}</th>
                <th>{t.colRentCarteraMedia}</th>
                <th>{t.colRentIndiceMedia(indice.abreviatura)}</th>
                <th>{t.colRentIndiceReciente(indice.abreviatura)}</th>
              </tr>
            </thead>
            <tbody>
              {[...analisisCorrelacion.filas]
                .sort((a, b) => a.duracion - b.duracion || ["precio", "volumen", "flujo", "aleatorio"].indexOf(a.metodo) - ["precio", "volumen", "flujo", "aleatorio"].indexOf(b.metodo))
                .map((fila, i) => (
                  <tr key={i}>
                    <td>{fila.metodo === "precio" ? t.metodoPrecio : fila.metodo === "volumen" ? t.metodoVolumen : fila.metodo === "flujo" ? t.metodoFlujo : t.metodoAleatorio}</td>
                    <td>{fila.duracion}</td>
                    <td>{fila.repeticiones}</td>
                    <td>
                      {fila.correlacionMedia !== null ? fila.correlacionMedia.toFixed(3) : "-"}
                      {fila.correlacionRango && (
                        <span style={{ color: "#666" }}> [{fila.correlacionRango.min.toFixed(3)}, {fila.correlacionRango.max.toFixed(3)}]</span>
                      )}
                    </td>
                    <td>
                      {fila.rentabilidadCarteraMedia !== null ? `${fila.rentabilidadCarteraMedia.toFixed(3)}%` : "-"}
                      {fila.rentabilidadCarteraRango && (
                        <span style={{ color: "#666" }}> [{fila.rentabilidadCarteraRango.min.toFixed(2)}%, {fila.rentabilidadCarteraRango.max.toFixed(2)}%]</span>
                      )}
                    </td>
                    <td>{fila.rentabilidadIndiceMedia !== null ? `${fila.rentabilidadIndiceMedia.toFixed(3)}%` : "-"}</td>
                    <td>{fila.rentabilidadIndiceReciente !== null ? `${fila.rentabilidadIndiceReciente.toFixed(3)}%` : "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.rentabilidadEtfsTitulo}</h2>
      {indice.etfsRentabilidad.length > 0 ? (
        <>
          <p>{t.rentabilidadEtfsDesc}</p>
          <button onClick={consultarRentabilidadEtfs} disabled={cargandoRentabilidadEtfs}>
            {cargandoRentabilidadEtfs ? t.rentabilidadEtfsBotonCargando : t.rentabilidadEtfsBoton}
          </button>

          {errorRentabilidadEtfs && <p style={{ color: "crimson" }}>{t.error}: {errorRentabilidadEtfs}</p>}

          {rentabilidadEtfs && (
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
              <thead>
                <tr>
                  <th>{t.colEtf}</th>
                  <th>{t.col60Sesiones}</th>
                  <th>{t.col120Sesiones}</th>
                  <th>{t.col1Anio}</th>
                  <th>{t.col2Anios}</th>
                  <th>{t.col3Anios}</th>
                  <th>{t.colVolumen(rentabilidadEtfs.anioVolumen, rentabilidadEtfs.esYTD)}</th>
                </tr>
              </thead>
              <tbody>
                {rentabilidadEtfs.filas.map((fila) => {
                  const filaIndice = rentabilidadEtfs.filas[0];
                  return (
                    <tr key={fila.ticker} style={{ fontWeight: fila.esIndice ? "bold" : "normal" }}>
                      <td>{fila.nombre}</td>
                      {["sesiones60", "sesiones120", "anio1", "anio2", "anio3"].map((campo) => {
                        const valor = fila[campo];
                        const valorIndice = filaIndice[campo];
                        let color = "inherit";
                        if (!fila.esIndice && valor !== null && valorIndice !== null) {
                          if (valor > valorIndice) color = "green";
                          else if (valor < valorIndice) color = "crimson";
                        }
                        return (
                          <td key={campo} style={{ color }}>
                            {valor !== null ? `${valor.toFixed(2)}%` : "-"}
                          </td>
                        );
                      })}
                      <td>{fila.volumen !== null ? fila.volumen.toLocaleString() : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <p style={{ color: "#555" }}>{t.sinEtfsDisponibles}</p>
      )}
    </MenuLayout>
  );
}
