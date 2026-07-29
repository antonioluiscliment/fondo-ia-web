import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible, INDICES } from "../lib/indices";

// Grupo 4: Análisis — de momento solo el análisis de correlación con
// el índice, usando los parámetros ajustados en "Formas de
// seleccionar los valores" (factor, número de componentes, tope y
// frecuencia de rebalanceo) y el índice elegido en el marco exterior
// persistente.

// Orden en el que se muestran los métodos en la tabla (agrupando cada
// criterio con su antítesis), y su nombre traducido.
const ORDEN_METODOS = ["precio", "precioBajo", "volumen", "volumenBajo", "flujo", "flujoBajo", "aleatorio"];
function NOMBRE_METODO(t) {
  return {
    precio: t.metodoPrecio,
    precioBajo: t.metodoPrecioBajo,
    volumen: t.metodoVolumen,
    volumenBajo: t.metodoVolumenBajo,
    flujo: t.metodoFlujo,
    flujoBajo: t.metodoFlujoBajo,
    aleatorio: t.metodoAleatorio,
  };
}
export default function Analisis() {
  const { t, idioma, indiceId, factorPenalizacion, nComponentes, pesoMaximo, frecuenciaRebalanceo, sesionesPuntuacion } = useAppConfig();
  const indice = obtenerIndice(indiceId);
  const nombreIndice = indice.nombre[idioma];

  const [analisisCorrelacion, setAnalisisCorrelacion] = useState(null);
  const [cargandoAnalisisCorrelacion, setCargandoAnalisisCorrelacion] = useState(false);
  const [errorAnalisisCorrelacion, setErrorAnalisisCorrelacion] = useState(null);

  const [correlacionAnalistas, setCorrelacionAnalistas] = useState(null);
  const [cargandoCorrelacionAnalistas, setCargandoCorrelacionAnalistas] = useState(false);
  const [errorCorrelacionAnalistas, setErrorCorrelacionAnalistas] = useState(null);

  // Por defecto, todos los índices marcados salvo el que más
  // componentes tenga (hoy, el Nasdaq 100): consultar el consenso de
  // analistas de un índice tan grande, sumado a los demás, puede
  // tardar bastante — se deja marcar aparte si se quiere incluir.
  const indiceMasGrande = INDICES.reduce((a, b) => (b.tickers.length > a.tickers.length ? b : a));
  const [indicesSeleccionados, setIndicesSeleccionados] = useState(() =>
    Object.fromEntries(INDICES.map((ind) => [ind.id, ind.id !== indiceMasGrande.id]))
  );
  const [correlacionAnalistasIndices, setCorrelacionAnalistasIndices] = useState(null);
  const [cargandoCorrelacionAnalistasIndices, setCargandoCorrelacionAnalistasIndices] = useState(false);
  const [errorCorrelacionAnalistasIndices, setErrorCorrelacionAnalistasIndices] = useState(null);

  const [rentabilidadEtfs, setRentabilidadEtfs] = useState(null);
  const [cargandoRentabilidadEtfs, setCargandoRentabilidadEtfs] = useState(false);
  const [errorRentabilidadEtfs, setErrorRentabilidadEtfs] = useState(null);

  async function realizarAnalisisCorrelacion() {
    setCargandoAnalisisCorrelacion(true);
    setErrorAnalisisCorrelacion(null);
    setAnalisisCorrelacion(null);
    try {
      const resp = await fetch(`/api/analisisCorrelacion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setAnalisisCorrelacion(json);
    } catch (e) {
      setErrorAnalisisCorrelacion(e.message);
    } finally {
      setCargandoAnalisisCorrelacion(false);
    }
  }

  async function realizarCorrelacionAnalistas() {
    setCargandoCorrelacionAnalistas(true);
    setErrorCorrelacionAnalistas(null);
    setCorrelacionAnalistas(null);
    try {
      const resp = await fetch(`/api/correlacionAnalistas?indice=${indiceId}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setCorrelacionAnalistas(json);
    } catch (e) {
      setErrorCorrelacionAnalistas(e.message);
    } finally {
      setCargandoCorrelacionAnalistas(false);
    }
  }

  async function realizarCorrelacionAnalistasIndices() {
    setCargandoCorrelacionAnalistasIndices(true);
    setErrorCorrelacionAnalistasIndices(null);
    setCorrelacionAnalistasIndices(null);
    try {
      const idsElegidos = Object.entries(indicesSeleccionados)
        .filter(([, marcado]) => marcado)
        .map(([id]) => id);
      if (idsElegidos.length === 0) {
        throw new Error("Marca al menos un índice.");
      }
      const resp = await fetch(`/api/correlacionAnalistasIndices?indices=${idsElegidos.join(",")}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setCorrelacionAnalistasIndices(json);
    } catch (e) {
      setErrorCorrelacionAnalistasIndices(e.message);
    } finally {
      setCargandoCorrelacionAnalistasIndices(false);
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

          <div style={{ overflowX: "auto" }}>
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
                  .sort((a, b) => a.duracion - b.duracion || ORDEN_METODOS.indexOf(a.metodo) - ORDEN_METODOS.indexOf(b.metodo))
                  .map((fila, i) => (
                    <tr key={i}>
                      <td>{NOMBRE_METODO(t)[fila.metodo]}</td>
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
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.correlacionAnalistasTitulo}</h2>
      <p>{t.correlacionAnalistasDesc}</p>
      {indice.tickers.length > 60 && (
        <p style={{ background: "#fff3cd", border: "1px solid #cc9a06", borderRadius: 6, padding: 12, color: "#7a5c00" }}>
          {t.recomendacionesAnalistasAvisoIndiceGrande(indice.tickers.length)}
        </p>
      )}
      <button onClick={realizarCorrelacionAnalistas} disabled={cargandoCorrelacionAnalistas}>
        {cargandoCorrelacionAnalistas ? t.correlacionAnalistasBotonCargando : t.correlacionAnalistasBoton}
      </button>

      {errorCorrelacionAnalistas && <p style={{ color: "crimson" }}>{t.error}: {errorCorrelacionAnalistas}</p>}

      {correlacionAnalistas && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.correlacionAnalistasResumenTitulo}</h3>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.col1Mes}</th>
                  <th>{t.col2Meses}</th>
                  <th>{t.col3Meses}</th>
                  <th>{t.col6Meses}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {["meses1", "meses2", "meses3", "meses6"].map((clave) => (
                    <td key={clave}>
                      {correlacionAnalistas.correlaciones[clave].valor !== null
                        ? correlacionAnalistas.correlaciones[clave].valor.toFixed(3)
                        : "-"}
                      <span style={{ color: "#666" }}> (n={correlacionAnalistas.correlaciones[clave].n})</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {correlacionAnalistas.excluidos.length > 0 && (
            <p style={{ color: "#555", fontStyle: "italic" }}>{t.mejorAnalistasExcluidos(correlacionAnalistas.excluidos.length)}</p>
          )}

          {correlacionAnalistas.conclusion && (
            <>
              <h3>{t.correlacionAnalistasConclusionTitulo}</h3>
              <p>{correlacionAnalistas.conclusion}</p>
            </>
          )}

          <h3>{t.correlacionAnalistasDetalleTitulo}</h3>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.colTicker}</th>
                  <th>{t.colConsenso}</th>
                  <th>{t.colNumAnalistas}</th>
                  <th>{t.col1Mes}</th>
                  <th>{t.col2Meses}</th>
                  <th>{t.col3Meses}</th>
                  <th>{t.col6Meses}</th>
                </tr>
              </thead>
              <tbody>
                {correlacionAnalistas.filas.map((f) => (
                  <tr key={f.ticker}>
                    <td>{tickerVisible(f.ticker)} — {f.nombre}</td>
                    <td>{f.recommendationMean.toFixed(2)}</td>
                    <td>{f.numeroAnalistas}</td>
                    {["incremento1m", "incremento2m", "incremento3m", "incremento6m"].map((campo) => (
                      <td key={campo} style={{ color: f[campo] === null ? "inherit" : f[campo] >= 0 ? "green" : "crimson" }}>
                        {f[campo] !== null ? `${f[campo].toFixed(2)}%` : t.nd}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.correlacionAnalistasIndicesTitulo}</h2>
      <p>{t.correlacionAnalistasIndicesDesc}</p>

      <p style={{ fontWeight: "bold", marginBottom: 4 }}>{t.correlacionAnalistasIndicesEtiquetaSeleccion}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12 }}>
        {INDICES.map((ind) => (
          <label key={ind.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={!!indicesSeleccionados[ind.id]}
              onChange={(e) => setIndicesSeleccionados((prev) => ({ ...prev, [ind.id]: e.target.checked }))}
            />
            {ind.nombre[idioma]}
          </label>
        ))}
      </div>

      <button onClick={realizarCorrelacionAnalistasIndices} disabled={cargandoCorrelacionAnalistasIndices}>
        {cargandoCorrelacionAnalistasIndices ? t.correlacionAnalistasIndicesBotonCargando : t.correlacionAnalistasIndicesBoton}
      </button>

      {errorCorrelacionAnalistasIndices && <p style={{ color: "crimson" }}>{t.error}: {errorCorrelacionAnalistasIndices}</p>}

      {correlacionAnalistasIndices && (
        <div style={{ overflowX: "auto" }}>
          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
            <thead>
              <tr>
                <th>{t.colIndice}</th>
                <th>{t.col1Mes}</th>
                <th>{t.col2Meses}</th>
                <th>{t.col3Meses}</th>
                <th>{t.col6Meses}</th>
              </tr>
            </thead>
            <tbody>
              {correlacionAnalistasIndices.resultados.map((r) => (
                <tr key={r.indice}>
                  <td>{r.nombreIndice}</td>
                  {r.error ? (
                    <td colSpan={4} style={{ color: "crimson" }}>{t.error}: {r.error}</td>
                  ) : (
                    ["meses1", "meses2", "meses3", "meses6"].map((clave) => (
                      <td key={clave}>
                        {r.correlaciones[clave].valor !== null ? r.correlaciones[clave].valor.toFixed(3) : "-"}
                        <span style={{ color: "#666" }}> (n={r.correlaciones[clave].n})</span>
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {correlacionAnalistasIndices.resultados
            .filter((r) => !r.error)
            .map((r) => (
              <p key={r.indice} style={{ marginTop: 12 }}>
                <b>{r.nombreIndice}:</b> {r.conclusion}
              </p>
            ))}
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
            <div style={{ overflowX: "auto" }}>
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
                        <td style={fila.esComparable === false ? { color: "#cc5500", fontWeight: "bold" } : undefined}>
                          {fila.nombre}
                        </td>
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
            </div>
          )}
        </>
      ) : (
        <p style={{ color: "#555" }}>{t.sinEtfsDisponibles}</p>
      )}
    </MenuLayout>
  );
}
