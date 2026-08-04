import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import BotonCompartirPdf from "../components/BotonCompartirPdf";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible, INDICES } from "../lib/indices";
import { descargarTablaPdf } from "../lib/pdfComun";

// Sección de investigación, nacida de una observación durante el
// desarrollo: al comparar "flujo de dinero bajo" con el resto de
// métodos en varias duraciones de backtest, su dispersión de
// resultados se estrecha (en vez de ensancharse, como el resto) al
// alargar la ventana, con un sesgo positivo claro. Cada herramienta
// de esta página es una comprobación distinta para entender si es un
// efecto real o un artefacto de la muestra — ver el icono de
// información del título para el contexto completo.
export default function AnomaliasFlujoBajo() {
  const { t, idioma, indiceId, factorPenalizacion, nComponentes, pesoMaximo, frecuenciaRebalanceo, sesionesPuntuacion } =
    useAppConfig();
  const indice = obtenerIndice(indiceId);
  const nombreIndice = indice.nombre.es;
  const nombresEmpresas = indice.nombresEmpresas;

  const [concentracion, setConcentracion] = useState(null);
  const [cargandoConcentracion, setCargandoConcentracion] = useState(false);
  const [errorConcentracion, setErrorConcentracion] = useState(null);

  const [caidas, setCaidas] = useState(null);
  const [cargandoCaidas, setCargandoCaidas] = useState(false);
  const [errorCaidas, setErrorCaidas] = useState(null);

  const [volumen, setVolumen] = useState(null);
  const [cargandoVolumen, setCargandoVolumen] = useState(false);
  const [errorVolumen, setErrorVolumen] = useState(null);

  const INDICES_DISPONIBLES_RENT = INDICES.filter((i) => !!i.etfReferencia || i.id === "psi20");
  const [indicesRentFlujoBajo, setIndicesRentFlujoBajo] = useState(() =>
    Object.fromEntries(INDICES_DISPONIBLES_RENT.map((i) => [i.id, false]))
  );
  const [rentFlujoBajo, setRentFlujoBajo] = useState(null);
  const [cargandoRentFlujoBajo, setCargandoRentFlujoBajo] = useState(false);
  const [errorRentFlujoBajo, setErrorRentFlujoBajo] = useState(null);

  const queryComun = `indice=${indiceId}&sesiones=${sesionesPuntuacion}&factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}`;

  async function realizarConcentracion() {
    setCargandoConcentracion(true);
    setErrorConcentracion(null);
    setConcentracion(null);
    try {
      const resp = await fetch(`/api/concentracionSeleccion?${queryComun}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setConcentracion(json);
    } catch (e) {
      setErrorConcentracion(e.message);
    } finally {
      setCargandoConcentracion(false);
    }
  }

  async function realizarCaidas() {
    setCargandoCaidas(true);
    setErrorCaidas(null);
    setCaidas(null);
    try {
      const resp = await fetch(`/api/caidasPrevias?${queryComun}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setCaidas(json);
    } catch (e) {
      setErrorCaidas(e.message);
    } finally {
      setCargandoCaidas(false);
    }
  }

  async function realizarVolumen() {
    setCargandoVolumen(true);
    setErrorVolumen(null);
    setVolumen(null);
    try {
      const resp = await fetch(`/api/perfilVolumenPrevio?${queryComun}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setVolumen(json);
    } catch (e) {
      setErrorVolumen(e.message);
    } finally {
      setCargandoVolumen(false);
    }
  }

  async function realizarRentFlujoBajo() {
    setCargandoRentFlujoBajo(true);
    setErrorRentFlujoBajo(null);
    setRentFlujoBajo(null);
    try {
      const idsElegidos = Object.entries(indicesRentFlujoBajo)
        .filter(([, marcado]) => marcado)
        .map(([id]) => id);
      if (idsElegidos.length === 0) throw new Error("Marca al menos un índice.");
      const resp = await fetch(
        `/api/rentabilidadFlujoBajo?indices=${idsElegidos.join(",")}&factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}`
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setRentFlujoBajo(json);
    } catch (e) {
      setErrorRentFlujoBajo(e.message);
    } finally {
      setCargandoRentFlujoBajo(false);
    }
  }

  function tablaFrecuencias(frecuencias) {
    return (
      <div style={{ overflowX: "auto" }}>
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>{t.colTicker}</th>
              <th>{t.colVecesSeleccionadoConcentracion}</th>
              <th>{t.colPctSeleccion}</th>
            </tr>
          </thead>
          <tbody>
            {frecuencias.map((f) => (
              <tr key={f.ticker}>
                <td>{tickerVisible(f.ticker)} — {f.nombre}</td>
                <td>{f.veces}</td>
                <td>{f.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <MenuLayout>
      <h2>{t.anomaliasFlujoBajoTitulo}</h2>
      <p>{t.anomaliasFlujoBajoIntro}</p>

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.concentracionTitulo}</h2>
      <p>{t.concentracionDesc}</p>

      <button onClick={realizarConcentracion} disabled={cargandoConcentracion}>
        {cargandoConcentracion ? t.concentracionBotonCargando : t.concentracionBoton}
      </button>

      {errorConcentracion && <p style={{ color: "crimson" }}>{t.error}: {errorConcentracion}</p>}

      {concentracion && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          {["flujoBajo", "flujo"].map((metodo) => {
            const r = concentracion.resultados[metodo];
            return (
              <div key={metodo} style={{ marginTop: metodo === "flujo" ? 32 : 0 }}>
                <h3 style={{ marginTop: 0 }}>
                  {metodo === "flujoBajo" ? t.metodoFlujoBajo : t.metodoFlujo}
                </h3>

                <h4>{t.concentracionResumenTitulo}</h4>
                <p style={{ fontWeight: "bold" }}>{t.concentracionTop3(r.global.top3Pct)}</p>
                {tablaFrecuencias(r.global.frecuencias)}

                <h4>{t.concentracionPorDuracionTitulo}</h4>
                {r.porDuracion.map((d) => (
                  <div key={d.duracion} style={{ marginTop: 16 }}>
                    <p>
                      <b>{d.duracion} {t.sesionesEtiqueta}</b> ({d.repeticiones} {t.ventanasEtiqueta}) —{" "}
                      {t.concentracionTop3(d.top3Pct)}
                    </p>
                    {tablaFrecuencias(d.frecuencias)}

                    {d.top3ConRentabilidad && d.top3ConRentabilidad.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontStyle: "italic", color: "#555", marginBottom: 4 }}>{t.top3RentabilidadRealTitulo(d.duracion)}</p>
                        <div style={{ overflowX: "auto" }}>
                          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
                            <thead>
                              <tr>
                                <th>{t.colTicker}</th>
                                <th>{t.colVecesSeleccionadoConcentracion}</th>
                                <th>{t.colRentabilidadRealTicker}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.top3ConRentabilidad.map((f) => (
                                <tr key={f.ticker}>
                                  <td>{tickerVisible(f.ticker)} — {f.nombre}</td>
                                  <td>{f.veces}</td>
                                  <td style={f.rentabilidadPct !== null ? { color: f.rentabilidadPct >= 0 ? "green" : "crimson" } : undefined}>
                                    {f.rentabilidadPct !== null ? `${f.rentabilidadPct}%` : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {(() => {
            const opciones = {
              titulo: t.concentracionTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colTicker, t.colVecesSeleccionadoConcentracion, t.colPctSeleccion],
              filas: ["flujoBajo", "flujo"].flatMap((metodo) => {
                const r = concentracion.resultados[metodo];
                const etiquetaMetodo = metodo === "flujoBajo" ? t.metodoFlujoBajo : t.metodoFlujo;
                return [
                  [etiquetaMetodo, "", ""],
                  ...r.global.frecuencias.map((f) => [`${tickerVisible(f.ticker)} — ${f.nombre}`, f.veces, `${f.pct}%`]),
                ];
              }),
              nombreArchivo: `concentracion-seleccion-${indice.id}.pdf`,
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

      <h2>{t.caidasPreviasTitulo}</h2>
      <p>{t.caidasPreviasDesc}</p>

      <button onClick={realizarCaidas} disabled={cargandoCaidas}>
        {cargandoCaidas ? t.caidasPreviasBotonCargando : t.caidasPreviasBoton}
      </button>

      {errorCaidas && <p style={{ color: "crimson" }}>{t.error}: {errorCaidas}</p>}

      {caidas && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.colMetodo}</th>
                  <th>{t.colUmbralCaida}</th>
                  <th>{t.colPctAlcanzado}</th>
                  <th>{t.colSesionesAtras}</th>
                </tr>
              </thead>
              <tbody>
                {["flujoBajo", "flujo"].flatMap((metodo) =>
                  caidas.resultados[metodo].porUmbral.map((u, i) => (
                    <tr key={`${metodo}-${u.umbral}`}>
                      {i === 0 && (
                        <td rowSpan={caidas.resultados[metodo].porUmbral.length} style={{ fontWeight: "bold", verticalAlign: "top" }}>
                          {metodo === "flujoBajo" ? t.metodoFlujoBajo : t.metodoFlujo}
                          <br />
                          <span style={{ fontWeight: "normal", color: "#555" }}>
                            ({caidas.resultados[metodo].totalSelecciones} {t.seleccionesEtiqueta})
                          </span>
                        </td>
                      )}
                      <td>{u.umbral}%</td>
                      <td>{u.pctAlcanzado !== null ? `${u.pctAlcanzado}%` : "-"}</td>
                      <td>{u.xMedio !== null ? u.xMedio : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {(() => {
            const opciones = {
              titulo: t.caidasPreviasTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colMetodo, t.colUmbralCaida, t.colPctAlcanzado, t.colSesionesAtras],
              filas: ["flujoBajo", "flujo"].flatMap((metodo) =>
                caidas.resultados[metodo].porUmbral.map((u) => [
                  metodo === "flujoBajo" ? t.metodoFlujoBajo : t.metodoFlujo,
                  `${u.umbral}%`,
                  u.pctAlcanzado !== null ? `${u.pctAlcanzado}%` : "-",
                  u.xMedio !== null ? u.xMedio : "-",
                ])
              ),
              nombreArchivo: `caidas-previas-${indice.id}.pdf`,
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

      <h2>{t.perfilVolumenTitulo}</h2>
      <p>{t.perfilVolumenDesc}</p>

      <button onClick={realizarVolumen} disabled={cargandoVolumen}>
        {cargandoVolumen ? t.perfilVolumenBotonCargando : t.perfilVolumenBoton}
      </button>

      {errorVolumen && <p style={{ color: "crimson" }}>{t.error}: {errorVolumen}</p>}

      {volumen && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.colMetodo}</th>
                  <th>{t.colSelecciones}</th>
                  <th>{t.colPicoRatioMedio}</th>
                  <th>{t.colPctConPico}</th>
                  <th>{t.colPctSinPico}</th>
                </tr>
              </thead>
              <tbody>
                {["flujoBajo", "flujo"].map((metodo) => {
                  const r = volumen.resultados[metodo];
                  return (
                    <tr key={metodo}>
                      <td style={{ fontWeight: "bold" }}>{metodo === "flujoBajo" ? t.metodoFlujoBajo : t.metodoFlujo}</td>
                      <td>{r.totalSelecciones}</td>
                      <td>{r.picoRatioMedio !== null ? `${r.picoRatioMedio}×` : "-"}</td>
                      <td>{r.pctConPico !== null ? `${r.pctConPico}%` : "-"}</td>
                      <td>{r.pctSinPico !== null ? `${r.pctSinPico}%` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(() => {
            const opciones = {
              titulo: t.perfilVolumenTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colMetodo, t.colSelecciones, t.colPicoRatioMedio, t.colPctConPico, t.colPctSinPico],
              filas: ["flujoBajo", "flujo"].map((metodo) => {
                const r = volumen.resultados[metodo];
                return [
                  metodo === "flujoBajo" ? t.metodoFlujoBajo : t.metodoFlujo,
                  r.totalSelecciones,
                  r.picoRatioMedio !== null ? `${r.picoRatioMedio}×` : "-",
                  r.pctConPico !== null ? `${r.pctConPico}%` : "-",
                  r.pctSinPico !== null ? `${r.pctSinPico}%` : "-",
                ];
              }),
              nombreArchivo: `perfil-volumen-previo-${indice.id}.pdf`,
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

      <h2>{t.rentFlujoBajoTitulo}</h2>
      <p>{t.rentFlujoBajoDesc}</p>

      <p style={{ fontWeight: "bold", marginBottom: 4 }}>{t.rentFlujoBajoEtiquetaSeleccion}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12 }}>
        {INDICES_DISPONIBLES_RENT.map((ind) => (
          <label key={ind.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={!!indicesRentFlujoBajo[ind.id]}
              onChange={(e) => setIndicesRentFlujoBajo((prev) => ({ ...prev, [ind.id]: e.target.checked }))}
            />
            {ind.nombre[idioma]}
          </label>
        ))}
      </div>

      <button onClick={realizarRentFlujoBajo} disabled={cargandoRentFlujoBajo}>
        {cargandoRentFlujoBajo ? t.rentFlujoBajoBotonCargando : t.rentFlujoBajoBoton}
      </button>

      {errorRentFlujoBajo && <p style={{ color: "crimson" }}>{t.error}: {errorRentFlujoBajo}</p>}

      {rentFlujoBajo && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          {rentFlujoBajo.resultados
            .filter((r) => r.error)
            .map((r) => (
              <p key={r.indice} style={{ color: "crimson" }}>
                {r.nombreIndice} — {t.error}: {r.error}
              </p>
            ))}

          {rentFlujoBajo.sesionesPromediadas.map((sesiones) => (
            <div key={sesiones} style={{ marginTop: 24 }}>
              <h3>{t.sesionesPromediadasEtiqueta}: {sesiones}</h3>
              {rentFlujoBajo.duraciones.map((duracion) => (
                <div key={duracion} style={{ marginTop: 12 }}>
                  <h4>{duracion} {t.sesionesEtiqueta}</h4>
                  <div style={{ overflowX: "auto" }}>
                    <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
                      <thead>
                        <tr>
                          <th>{t.colIndice}</th>
                          <th>{t.colRepeticiones}</th>
                          <th>{t.colRentCarteraMedia}</th>
                          <th>{t.colRentCarteraRango}</th>
                          <th>{t.colRentIndiceMediaSimple}</th>
                          <th>{t.colDistanciaInferior}</th>
                          <th>{t.colDistanciaSuperior}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentFlujoBajo.resultados
                          .filter((r) => !r.error)
                          .map((r) => {
                            const c = r.porCombinacion.find((x) => x.sesionesPromediadas === sesiones && x.duracion === duracion);
                            if (!c) return null;
                            return (
                              <tr key={r.indice}>
                                <td>{r.nombreIndice}</td>
                                <td style={c.repeticiones < 6 ? { color: "#cc5500", fontWeight: "bold" } : undefined}>
                                  {c.repeticiones}{c.repeticiones < 6 ? ` (${t.repeticionesInsuficientesAviso})` : ""}
                                </td>
                                <td>{c.rentCarteraMedia !== null ? `${c.rentCarteraMedia}%` : "-"}</td>
                                <td>
                                  {c.rentCarteraMin !== null && c.rentCarteraMax !== null
                                    ? `[${c.rentCarteraMin}%, ${c.rentCarteraMax}%]`
                                    : "-"}
                                </td>
                                <td>{c.rentIndiceMedia !== null ? `${c.rentIndiceMedia}%` : "-"}</td>
                                <td>{c.distanciaInferior !== null ? `${c.distanciaInferior}` : "-"}</td>
                                <td>{c.distanciaSuperior !== null ? `${c.distanciaSuperior}` : "-"}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {(() => {
            const opciones = {
              titulo: t.rentFlujoBajoTitulo,
              columnas: [t.colIndice, t.sesionesPromediadasEtiqueta, t.colDuracion, t.colRepeticiones, t.colRentCarteraMedia, t.colRentCarteraRango, t.colRentIndiceMediaSimple, t.colDistanciaInferior, t.colDistanciaSuperior],
              filas: rentFlujoBajo.sesionesPromediadas.flatMap((sesiones) =>
                rentFlujoBajo.duraciones.flatMap((duracion) =>
                  rentFlujoBajo.resultados
                    .filter((r) => !r.error)
                    .map((r) => {
                      const c = r.porCombinacion.find((x) => x.sesionesPromediadas === sesiones && x.duracion === duracion);
                      if (!c) return null;
                      return [
                        r.nombreIndice,
                        sesiones,
                        duracion,
                        c.repeticiones,
                        c.rentCarteraMedia !== null ? `${c.rentCarteraMedia}%` : "-",
                        c.rentCarteraMin !== null && c.rentCarteraMax !== null ? `[${c.rentCarteraMin}%, ${c.rentCarteraMax}%]` : "-",
                        c.rentIndiceMedia !== null ? `${c.rentIndiceMedia}%` : "-",
                        c.distanciaInferior !== null ? c.distanciaInferior : "-",
                        c.distanciaSuperior !== null ? c.distanciaSuperior : "-",
                      ];
                    })
                    .filter(Boolean)
                )
              ),
              nombreArchivo: `rentabilidad-flujo-bajo.pdf`,
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
