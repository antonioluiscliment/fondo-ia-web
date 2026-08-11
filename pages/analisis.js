import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import BotonCompartirPdf from "../components/BotonCompartirPdf";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible, INDICES } from "../lib/indices";
import { descargarTablaPdf, descargarMultiplesTablasPdf, compartirMultiplesTablasPdf } from "../lib/pdfComun";

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

  const [correlacionPeso, setCorrelacionPeso] = useState(null);
  const [cargandoCorrelacionPeso, setCargandoCorrelacionPeso] = useState(false);
  const [errorCorrelacionPeso, setErrorCorrelacionPeso] = useState(null);
  const [ventanaCorrelacionPeso, setVentanaCorrelacionPeso] = useState(120);

  const [persistencia, setPersistencia] = useState(null);
  const [cargandoPersistencia, setCargandoPersistencia] = useState(false);
  const [errorPersistencia, setErrorPersistencia] = useState(null);
  const [periodoPersistencia, setPeriodoPersistencia] = useState(180);

  async function realizarPersistencia() {
    setCargandoPersistencia(true);
    setErrorPersistencia(null);
    setPersistencia(null);
    try {
      const resp = await fetch(`/api/persistenciaOrden?indice=${indiceId}&periodo=${periodoPersistencia}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setPersistencia(json);
    } catch (e) {
      setErrorPersistencia(e.message);
    } finally {
      setCargandoPersistencia(false);
    }
  }

  async function realizarCorrelacionPeso() {
    setCargandoCorrelacionPeso(true);
    setErrorCorrelacionPeso(null);
    setCorrelacionPeso(null);
    try {
      const resp = await fetch(`/api/correlacionPesoIndice?indice=${indiceId}&ventana=${ventanaCorrelacionPeso}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setCorrelacionPeso(json);
    } catch (e) {
      setErrorCorrelacionPeso(e.message);
    } finally {
      setCargandoCorrelacionPeso(false);
    }
  }

  // Por defecto, marcados solo los índices "normales" (los que ya
  // existían antes de la serie de ADR: Dow Jones, IBEX 35, CAC 40,
  // PSI 20, DAX, AEX, FTSE MIB) — salvo el que más componentes tenga
  // (hoy, el Nasdaq 100). Todos los índices ADR (Argentina, Australia,
  // India, Asia, China, Brasil, Corea, Latinoamérica, Grecia, México)
  // quedan desmarcados por defecto: aunque cada uno por separado sea
  // pequeño, el consenso de analistas solo se puede consultar valor
  // por valor, y sumados entre todos representan bastante carga
  // adicional — se dejan marcar aparte si se quieren incluir.
  const indiceMasGrande = INDICES.reduce((a, b) => (b.tickers.length > a.tickers.length ? b : a));
  const [indicesSeleccionados, setIndicesSeleccionados] = useState(() =>
    Object.fromEntries(INDICES.map((ind) => [ind.id, !ind.id.endsWith("adr") && ind.id !== indiceMasGrande.id]))
  );
  const [correlacionAnalistasIndices, setCorrelacionAnalistasIndices] = useState(null);
  const [cargandoCorrelacionAnalistasIndices, setCargandoCorrelacionAnalistasIndices] = useState(false);
  const [errorCorrelacionAnalistasIndices, setErrorCorrelacionAnalistasIndices] = useState(null);

  const [rentabilidadEtfs, setRentabilidadEtfs] = useState(null);
  const [cargandoRentabilidadEtfs, setCargandoRentabilidadEtfs] = useState(false);
  const [errorRentabilidadEtfs, setErrorRentabilidadEtfs] = useState(null);

  const [rentabilidadEtfsTodos, setRentabilidadEtfsTodos] = useState(null);
  const [cargandoRentabilidadEtfsTodos, setCargandoRentabilidadEtfsTodos] = useState(false);
  const [errorRentabilidadEtfsTodos, setErrorRentabilidadEtfsTodos] = useState(null);

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

  async function consultarRentabilidadEtfsTodos() {
    setCargandoRentabilidadEtfsTodos(true);
    setErrorRentabilidadEtfsTodos(null);
    setRentabilidadEtfsTodos(null);
    try {
      const resp = await fetch(`/api/rentabilidadEtfsTodos`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setRentabilidadEtfsTodos(json);
    } catch (e) {
      setErrorRentabilidadEtfsTodos(e.message);
    } finally {
      setCargandoRentabilidadEtfsTodos(false);
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
                        {fila.ventanasImplausibles > 0 && (
                          <span style={{ color: "#cc5500", fontWeight: "bold" }} title={t.avisoResultadoNoFiableCorto(fila.ventanasImplausibles)}>
                            {" "}*
                          </span>
                        )}
                      </td>
                      <td>{fila.rentabilidadIndiceMedia !== null ? `${fila.rentabilidadIndiceMedia.toFixed(3)}%` : "-"}</td>
                      <td>{fila.rentabilidadIndiceReciente !== null ? `${fila.rentabilidadIndiceReciente.toFixed(3)}%` : "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {(() => {
            const filasOrdenadas = [...analisisCorrelacion.filas].sort(
              (a, b) => a.duracion - b.duracion || ORDEN_METODOS.indexOf(a.metodo) - ORDEN_METODOS.indexOf(b.metodo)
            );
            const opciones = {
              titulo: t.analisisCorrelacionTitulo,
              subtitulo: nombreIndice,
              parrafos: [analisisCorrelacion.conclusion],
              columnas: [
                t.colMetodo, t.colDuracion, t.colRepeticiones, t.colCorrelacionMedia,
                t.colRentCarteraMedia, t.colRentIndiceMedia(indice.abreviatura), t.colRentIndiceReciente(indice.abreviatura),
              ],
              filas: filasOrdenadas.map((fila) => [
                NOMBRE_METODO(t)[fila.metodo],
                fila.duracion,
                fila.repeticiones,
                fila.correlacionMedia !== null
                  ? `${fila.correlacionMedia.toFixed(3)}${fila.correlacionRango ? ` [${fila.correlacionRango.min.toFixed(3)}, ${fila.correlacionRango.max.toFixed(3)}]` : ""}`
                  : "-",
                fila.rentabilidadCarteraMedia !== null
                  ? `${fila.rentabilidadCarteraMedia.toFixed(3)}%${fila.rentabilidadCarteraRango ? ` [${fila.rentabilidadCarteraRango.min.toFixed(2)}%, ${fila.rentabilidadCarteraRango.max.toFixed(2)}%]` : ""}`
                  : "-",
                fila.rentabilidadIndiceMedia !== null ? `${fila.rentabilidadIndiceMedia.toFixed(3)}%` : "-",
                fila.rentabilidadIndiceReciente !== null ? `${fila.rentabilidadIndiceReciente.toFixed(3)}%` : "-",
              ]),
              nombreArchivo: `analisis-correlacion-${indice.id}.pdf`,
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 12 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
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

      {correlacionAnalistas && correlacionAnalistas.insuficiente && (
        <p style={{ background: "#eef2f7", border: "1px solid #9aa9bb", borderRadius: 6, padding: 12, color: "#3d4a5c" }}>
          {correlacionAnalistas.mensaje}
        </p>
      )}

      {correlacionAnalistas && !correlacionAnalistas.insuficiente && (
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
          {(() => {
            const resumen = ["meses1", "meses2", "meses3", "meses6"]
              .map((clave, i) => {
                const etiqueta = [t.col1Mes, t.col2Meses, t.col3Meses, t.col6Meses][i];
                const c = correlacionAnalistas.correlaciones[clave];
                return `${etiqueta}: ${c.valor !== null ? c.valor.toFixed(3) : "-"} (n=${c.n})`;
              })
              .join("  |  ");
            const opciones = {
              titulo: t.correlacionAnalistasTitulo,
              subtitulo: nombreIndice,
              parrafos: [resumen, ...(correlacionAnalistas.conclusion ? [correlacionAnalistas.conclusion] : [])],
              columnas: [t.colTicker, t.colConsenso, t.colNumAnalistas, t.col1Mes, t.col2Meses, t.col3Meses, t.col6Meses],
              filas: correlacionAnalistas.filas.map((f) => [
                `${tickerVisible(f.ticker)} — ${f.nombre}`,
                f.recommendationMean.toFixed(2),
                f.numeroAnalistas,
                ...["incremento1m", "incremento2m", "incremento3m", "incremento6m"].map((campo) =>
                  f[campo] !== null ? `${f[campo].toFixed(2)}%` : t.nd
                ),
              ]),
              nombreArchivo: `correlacion-analistas-${indice.id}.pdf`,
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 12 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
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
                  ) : r.insuficiente ? (
                    <td colSpan={4} style={{ color: "#3d4a5c" }}>{r.mensaje}</td>
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
            .filter((r) => !r.error && !r.insuficiente)
            .map((r) => (
              <p key={r.indice} style={{ marginTop: 12 }}>
                <b>{r.nombreIndice}:</b> {r.conclusion}
              </p>
            ))}

          {(() => {
            const opciones = {
              titulo: t.correlacionAnalistasIndicesTitulo,
              columnas: [t.colIndice, t.col1Mes, t.col2Meses, t.col3Meses, t.col6Meses],
              filas: correlacionAnalistasIndices.resultados.map((r) => {
                if (r.error) return [r.nombreIndice, `${t.error}: ${r.error}`, "", "", ""];
                if (r.insuficiente) return [r.nombreIndice, r.mensaje, "", "", ""];
                return [
                  r.nombreIndice,
                  ...["meses1", "meses2", "meses3", "meses6"].map((clave) => {
                    const c = r.correlaciones[clave];
                    return c.valor !== null ? `${c.valor.toFixed(3)} (n=${c.n})` : "-";
                  }),
                ];
              }),
              nombreArchivo: "correlacion-analistas-indices.pdf",
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 12 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
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
          {rentabilidadEtfs && (() => {
            const opciones = {
              titulo: t.rentabilidadEtfsTitulo,
              subtitulo: nombreIndice,
              columnas: [
                t.colEtf, t.col60Sesiones, t.col120Sesiones, t.col1Anio, t.col2Anios, t.col3Anios,
                t.colVolumen(rentabilidadEtfs.anioVolumen, rentabilidadEtfs.esYTD),
              ],
              filas: rentabilidadEtfs.filas.map((fila) => [
                fila.nombre,
                ...["sesiones60", "sesiones120", "anio1", "anio2", "anio3"].map((campo) =>
                  fila[campo] !== null ? `${fila[campo].toFixed(2)}%` : "-"
                ),
                fila.volumen !== null ? fila.volumen.toLocaleString() : "-",
              ]),
              nombreArchivo: `rentabilidad-etfs-${indice.id}.pdf`,
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 12 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
        </>
      ) : (
        <p style={{ color: "#555" }}>{t.sinEtfsDisponibles}</p>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.rentabilidadEtfsTodosTitulo}</h2>
      <p>{t.rentabilidadEtfsTodosDesc}</p>

      <button onClick={consultarRentabilidadEtfsTodos} disabled={cargandoRentabilidadEtfsTodos}>
        {cargandoRentabilidadEtfsTodos ? t.rentabilidadEtfsTodosBotonCargando : t.rentabilidadEtfsTodosBoton}
      </button>

      {errorRentabilidadEtfsTodos && <p style={{ color: "crimson" }}>{t.error}: {errorRentabilidadEtfsTodos}</p>}

      {rentabilidadEtfsTodos && (
        <>
          {rentabilidadEtfsTodos.resultados.map((r) => (
            <div key={r.indice} style={{ marginTop: 24 }}>
              <h3>{r.nombreIndice}</h3>
              {r.error ? (
                <p style={{ color: "crimson" }}>{t.error}: {r.error}</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        <th>{t.colEtf}</th>
                        <th>{t.col60Sesiones}</th>
                        <th>{t.col120Sesiones}</th>
                        <th>{t.col1Anio}</th>
                        <th>{t.col2Anios}</th>
                        <th>{t.col3Anios}</th>
                        <th>{t.colVolumen(rentabilidadEtfsTodos.anioVolumen, rentabilidadEtfsTodos.esYTD)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.filas.map((fila) => {
                        const filaIndice = r.filas[0];
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
            </div>
          ))}

          {(() => {
            const columnasComunes = [
              t.colEtf, t.col60Sesiones, t.col120Sesiones, t.col1Anio, t.col2Anios, t.col3Anios,
              t.colVolumen(rentabilidadEtfsTodos.anioVolumen, rentabilidadEtfsTodos.esYTD),
            ];
            const opciones = {
              titulo: t.rentabilidadEtfsTodosTitulo,
              secciones: rentabilidadEtfsTodos.resultados.map((r) => ({
                subtitulo: r.nombreIndice,
                columnas: columnasComunes,
                filas: r.error
                  ? [[`${t.error}: ${r.error}`, "", "", "", "", "", ""]]
                  : r.filas.map((fila) => [
                      fila.nombre,
                      ...["sesiones60", "sesiones120", "anio1", "anio2", "anio3"].map((campo) =>
                        fila[campo] !== null ? `${fila[campo].toFixed(2)}%` : "-"
                      ),
                      fila.volumen !== null ? fila.volumen.toLocaleString() : "-",
                    ]),
              })),
              nombreArchivo: "rentabilidad-todos-los-etfs.pdf",
            };
            return (
              <>
                <button onClick={() => descargarMultiplesTablasPdf(opciones)} style={{ marginTop: 12 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} compartirFn={compartirMultiplesTablasPdf} />
              </>
            );
          })()}
        </>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.correlacionPesoTitulo}</h2>
      <p>{t.correlacionPesoDesc}</p>

      <p style={{ margin: "12px 0 4px" }}>
        <label>
          {t.correlacionPesoEtiquetaVentana}{" "}
          <select value={ventanaCorrelacionPeso} onChange={(e) => setVentanaCorrelacionPeso(Number(e.target.value))}>
            <option value={60}>60</option>
            <option value={120}>120</option>
            <option value={180}>180</option>
          </select>
        </label>
      </p>

      <button onClick={realizarCorrelacionPeso} disabled={cargandoCorrelacionPeso}>
        {cargandoCorrelacionPeso ? t.correlacionPesoBotonCargando : t.correlacionPesoBoton}
      </button>

      {errorCorrelacionPeso && <p style={{ color: "crimson" }}>{t.error}: {errorCorrelacionPeso}</p>}

      {correlacionPeso && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <p style={{ margin: "4px 0" }}>{t.correlacionPesoVentana(correlacionPeso.ventanaSesiones)}</p>
          {correlacionPeso.ponderadoPorPrecio && <p style={{ color: "#555", fontStyle: "italic" }}>{t.correlacionPesoAvisoPrecio}</p>}

          <h3>{t.correlacionPesoResumenTitulo}</h3>
          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr><th style={{ textAlign: "left" }}>{t.correlacionPesoVsCorrBruta}</th><td>{correlacionPeso.resumenCruce.pesoVsCorrelacionBruta ?? "-"}</td></tr>
              <tr><th style={{ textAlign: "left" }}>{t.correlacionPesoVsCorrExcl}</th><td>{correlacionPeso.resumenCruce.pesoVsCorrelacionExcluyendo ?? "-"}</td></tr>
              <tr><th style={{ textAlign: "left" }}>{t.correlacionPesoVsBetaBruta}</th><td>{correlacionPeso.resumenCruce.pesoVsBetaBruta ?? "-"}</td></tr>
              <tr><th style={{ textAlign: "left" }}>{t.correlacionPesoVsBetaExcl}</th><td>{correlacionPeso.resumenCruce.pesoVsBetaExcluyendo ?? "-"}</td></tr>
            </tbody>
          </table>

          <h3>{t.correlacionPesoTablaRealTitulo}</h3>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.colTicker}</th>
                  <th>{t.correlacionPesoColPeso}</th>
                  <th>{t.correlacionPesoColCorrBruta}</th>
                  <th>{t.correlacionPesoColCorrExcl}</th>
                  <th>{t.correlacionPesoColBetaBruta}</th>
                  <th>{t.correlacionPesoColBetaExcl}</th>
                  <th>{t.correlacionPesoColCorrExclE2}</th>
                  <th>{t.correlacionPesoColBetaExclE2}</th>
                  <th>{t.correlacionPesoColCorrExclE3}</th>
                  <th>{t.correlacionPesoColBetaExclE3}</th>
                </tr>
              </thead>
              <tbody>
                {correlacionPeso.filasPesoReal.map((f) => (
                  <tr key={f.ticker}>
                    <td>{tickerVisible(f.ticker)} — {f.nombre}</td>
                    <td>{f.pesoPorcentaje}%</td>
                    <td>{f.correlacionBruta ?? "-"}</td>
                    <td>{f.correlacionExcluyendo ?? "-"}</td>
                    <td>{f.betaBruta ?? "-"}</td>
                    <td>{f.betaExcluyendo ?? "-"}</td>
                    <td>{f.correlacionExcluyendoE2 ?? "-"}</td>
                    <td>{f.betaExcluyendoE2 ?? "-"}</td>
                    <td>{f.correlacionExcluyendoE3 ?? "-"}</td>
                    <td>{f.betaExcluyendoE3 ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", color: "#555" }}>{t.correlacionPesoVerDetalle}</summary>
            {correlacionPeso.filasPesoReal.map((f) => (
              <div key={f.ticker} style={{ marginTop: 12 }}>
                <p style={{ fontWeight: "bold", marginBottom: 4 }}>{tickerVisible(f.ticker)} — {f.nombre}</p>
                <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr>
                        <th>{t.colFecha}</th>
                        <th>{t.correlacionPesoColIncrComponente}</th>
                        <th>{t.correlacionPesoColIncrIndice}</th>
                        <th>{t.correlacionPesoColIncrIndiceExcl}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.detallePares.map((p) => (
                        <tr key={p.fecha}>
                          <td>{p.fecha}</td>
                          <td>{p.incrementoComponente !== null ? `${p.incrementoComponente}%` : "-"}</td>
                          <td>{p.incrementoIndice !== null ? `${p.incrementoIndice}%` : "-"}</td>
                          <td>{p.incrementoIndiceExcluyendo !== null ? `${p.incrementoIndiceExcluyendo}%` : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </details>

          {correlacionPeso.filasPesoEstimado.length > 0 && (
            <>
              <h3>{t.correlacionPesoTablaEstimadoTitulo}</h3>
              <p style={{ color: "#555", fontStyle: "italic" }}>{t.correlacionPesoAvisoEstimado}</p>
              <div style={{ overflowX: "auto" }}>
                <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th>{t.colTicker}</th>
                      <th>{t.correlacionPesoColPeso}</th>
                      <th>{t.correlacionPesoColCorrBruta}</th>
                      <th>{t.correlacionPesoColCorrExcl}</th>
                      <th>{t.correlacionPesoColBetaBruta}</th>
                      <th>{t.correlacionPesoColBetaExcl}</th>
                      <th>{t.correlacionPesoColCorrExclE2}</th>
                      <th>{t.correlacionPesoColBetaExclE2}</th>
                      <th>{t.correlacionPesoColCorrExclE3}</th>
                      <th>{t.correlacionPesoColBetaExclE3}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correlacionPeso.filasPesoEstimado.map((f) => (
                      <tr key={f.ticker}>
                        <td>{tickerVisible(f.ticker)} — {f.nombre}</td>
                        <td>{f.pesoPorcentaje}%</td>
                        <td>{f.correlacionBruta ?? "-"}</td>
                        <td>{f.correlacionExcluyendo ?? "-"}</td>
                        <td>{f.betaBruta ?? "-"}</td>
                        <td>{f.betaExcluyendo ?? "-"}</td>
                        <td>{f.correlacionExcluyendoE2 ?? "-"}</td>
                        <td>{f.betaExcluyendoE2 ?? "-"}</td>
                        <td>{f.correlacionExcluyendoE3 ?? "-"}</td>
                        <td>{f.betaExcluyendoE3 ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {(() => {
            const opciones = {
              titulo: t.correlacionPesoTitulo,
              subtitulo: correlacionPeso.nombreIndice,
              columnas: [
                t.colTicker,
                t.correlacionPesoColPeso,
                t.correlacionPesoColCorrBruta,
                t.correlacionPesoColCorrExcl,
                t.correlacionPesoColBetaBruta,
                t.correlacionPesoColBetaExcl,
                t.correlacionPesoColCorrExclE2,
                t.correlacionPesoColBetaExclE2,
                t.correlacionPesoColCorrExclE3,
                t.correlacionPesoColBetaExclE3,
              ],
              filas: correlacionPeso.filasPesoReal.map((f) => [
                `${tickerVisible(f.ticker)} — ${f.nombre}`,
                `${f.pesoPorcentaje}%`,
                f.correlacionBruta ?? "-",
                f.correlacionExcluyendo ?? "-",
                f.betaBruta ?? "-",
                f.betaExcluyendo ?? "-",
                f.correlacionExcluyendoE2 ?? "-",
                f.betaExcluyendoE2 ?? "-",
                f.correlacionExcluyendoE3 ?? "-",
                f.betaExcluyendoE3 ?? "-",
              ]),
              nombreArchivo: `correlacion-peso-${indice.id}.pdf`,
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 12 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.persistenciaTitulo}</h2>
      <p>{t.persistenciaDesc}</p>

      <p style={{ margin: "12px 0 4px" }}>
        <label>
          {t.persistenciaEtiquetaPeriodo}{" "}
          <select value={periodoPersistencia} onChange={(e) => setPeriodoPersistencia(Number(e.target.value))}>
            <option value={60}>60</option>
            <option value={120}>120</option>
            <option value={180}>180</option>
            <option value={250}>250</option>
          </select>
        </label>
      </p>

      <button onClick={realizarPersistencia} disabled={cargandoPersistencia}>
        {cargandoPersistencia ? t.persistenciaBotonCargando : t.persistenciaBoton}
      </button>

      {errorPersistencia && <p style={{ color: "crimson" }}>{t.error}: {errorPersistencia}</p>}

      {persistencia && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <p style={{ margin: "4px 0" }}>{t.persistenciaCabecera(persistencia.periodoSesiones, persistencia.candidatosValidos)}</p>

          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.persistenciaColVentana}</th>
                  <th>{t.persistenciaColComparaciones}</th>
                  <th>{t.persistenciaColSpearman}</th>
                  <th>{t.persistenciaColAzar}</th>
                  <th>{t.persistenciaColMejores}</th>
                  <th>{t.persistenciaColPeores}</th>
                  <th>{t.persistenciaColEsperadoAzar}</th>
                </tr>
              </thead>
              <tbody>
                {persistencia.filas.map((f) => {
                  // Se resalta cuando el resultado real se aleja del
                  // azar más de 2 desviaciones típicas — el umbral
                  // habitual para "esto probablemente no es
                  // casualidad", aunque con pocas comparaciones hay
                  // que leerlo con cautela igualmente.
                  const destacado =
                    f.spearmanMedio !== null && f.azarMedio !== null && f.azarDesviacion
                      ? Math.abs(f.spearmanMedio - f.azarMedio) > 2 * f.azarDesviacion
                      : false;
                  return (
                    <tr key={f.longitud} style={{ background: destacado ? "#e6f4ea" : "transparent" }}>
                      <td>{f.longitud}</td>
                      <td>{f.numComparaciones}</td>
                      <td style={{ fontWeight: destacado ? "bold" : "normal" }}>{f.spearmanMedio ?? "-"}</td>
                      <td>{f.azarMedio ?? "-"} ± {f.azarDesviacion ?? "-"}</td>
                      <td>{f.aciertosMejoresMedio ?? "-"}</td>
                      <td>{f.aciertosPeoresMedio ?? "-"}</td>
                      <td>{f.coincidenciasEsperadasAzar ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p style={{ color: "#555", fontStyle: "italic", marginTop: 8 }}>{t.persistenciaAviso}</p>

          {(() => {
            const opciones = {
              titulo: t.persistenciaTitulo,
              subtitulo: persistencia.nombreIndice,
              columnas: [
                t.persistenciaColVentana,
                t.persistenciaColComparaciones,
                t.persistenciaColSpearman,
                t.persistenciaColAzar,
                t.persistenciaColMejores,
                t.persistenciaColPeores,
                t.persistenciaColEsperadoAzar,
              ],
              filas: persistencia.filas.map((f) => [
                f.longitud,
                f.numComparaciones,
                f.spearmanMedio ?? "-",
                `${f.azarMedio ?? "-"} ± ${f.azarDesviacion ?? "-"}`,
                f.aciertosMejoresMedio ?? "-",
                f.aciertosPeoresMedio ?? "-",
                f.coincidenciasEsperadasAzar ?? "-",
              ]),
              nombreArchivo: `persistencia-orden-${indice.id}.pdf`,
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 12 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
        </div>
      )}
    </MenuLayout>
  );
}
