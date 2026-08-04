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
  // Factores de penalización disponibles para probar: 0, 1, 2 fijos,
  // más "óptimo" (el que esté configurado ahora mismo en el marco
  // exterior de la app, que puede no coincidir con ninguno de los
  // tres fijos si se ha optimizado antes desde "Parámetros técnicos").
  const FACTORES_DISPONIBLES = [
    { etiqueta: "0", valor: 0 },
    { etiqueta: "1", valor: 1 },
    { etiqueta: "2", valor: 2 },
    { etiqueta: `${t.factorOptimoEtiqueta} (${factorPenalizacion})`, valor: factorPenalizacion },
  ];
  const [factoresRentFlujoBajo, setFactoresRentFlujoBajo] = useState(() =>
    Object.fromEntries(FACTORES_DISPONIBLES.map((f) => [f.etiqueta, false]))
  );

  const NS_DISPONIBLES = [
    { etiqueta: "3", valor: 3 },
    { etiqueta: "5", valor: 5 },
    { etiqueta: "6", valor: 6 },
    { etiqueta: `${t.factorOptimoEtiqueta} (${nComponentes})`, valor: nComponentes },
  ];
  const [nsRentFlujoBajo, setNsRentFlujoBajo] = useState(() => Object.fromEntries(NS_DISPONIBLES.map((f) => [f.etiqueta, false])));

  const MAXS_DISPONIBLES = [
    { etiqueta: "40%", valor: 40 },
    { etiqueta: "50%", valor: 50 },
    { etiqueta: "60%", valor: 60 },
    { etiqueta: `${t.factorOptimoEtiqueta} (${pesoMaximo}%)`, valor: pesoMaximo },
  ];
  const [maxsRentFlujoBajo, setMaxsRentFlujoBajo] = useState(() => Object.fromEntries(MAXS_DISPONIBLES.map((f) => [f.etiqueta, false])));

  const FRECUENCIAS_DISPONIBLES = [
    { etiqueta: t.frecuenciaNuncaEtiqueta, valor: "nunca" },
    { etiqueta: t.frecuenciaSupervivientesEtiqueta(1), valor: 1 },
    { etiqueta: t.frecuenciaSupervivientesEtiqueta(2), valor: 2 },
    { etiqueta: `${t.factorOptimoEtiqueta} (${frecuenciaRebalanceo === "diario" ? t.frecuenciaDiariaEtiqueta : t.frecuenciaSupervivientesEtiqueta(frecuenciaRebalanceo)})`, valor: frecuenciaRebalanceo },
  ];
  const [frecuenciasRentFlujoBajo, setFrecuenciasRentFlujoBajo] = useState(() =>
    Object.fromEntries(FRECUENCIAS_DISPONIBLES.map((f) => [f.etiqueta, false]))
  );

  const [rentFlujoBajo, setRentFlujoBajo] = useState(null);
  const [cargandoRentFlujoBajo, setCargandoRentFlujoBajo] = useState(false);
  const [errorRentFlujoBajo, setErrorRentFlujoBajo] = useState(null);

  // Nº de índices marcados × combinaciones de parámetros marcadas ×
  // sesiones promediadas (2, fijo) × duraciones (4, fijo) — se enseña
  // en la interfaz ANTES de lanzar, para poder ajustar la selección
  // si el coste parece demasiado alto.
  const numIndicesMarcados = Object.values(indicesRentFlujoBajo).filter(Boolean).length;
  const numFactoresMarcados = Object.values(factoresRentFlujoBajo).filter(Boolean).length;
  const numNsMarcados = Object.values(nsRentFlujoBajo).filter(Boolean).length;
  const numMaxsMarcados = Object.values(maxsRentFlujoBajo).filter(Boolean).length;
  const numFrecuenciasMarcadas = Object.values(frecuenciasRentFlujoBajo).filter(Boolean).length;
  const combinacionesParametros = numFactoresMarcados * numNsMarcados * numMaxsMarcados * numFrecuenciasMarcadas;
  const totalEjecucionesEstimado = numIndicesMarcados * combinacionesParametros * 2 * 4; // 2 sesiones × 4 duraciones, fijos

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

      const factoresElegidos = FACTORES_DISPONIBLES.filter((f) => factoresRentFlujoBajo[f.etiqueta]).map((f) => f.valor);
      if (factoresElegidos.length === 0) throw new Error("Marca al menos un factor de penalización.");

      const nsElegidos = NS_DISPONIBLES.filter((f) => nsRentFlujoBajo[f.etiqueta]).map((f) => f.valor);
      if (nsElegidos.length === 0) throw new Error("Marca al menos un nº de componentes.");

      const maxsElegidos = MAXS_DISPONIBLES.filter((f) => maxsRentFlujoBajo[f.etiqueta]).map((f) => f.valor);
      if (maxsElegidos.length === 0) throw new Error("Marca al menos un tope de diversificación.");

      const frecuenciasElegidas = FRECUENCIAS_DISPONIBLES.filter((f) => frecuenciasRentFlujoBajo[f.etiqueta]).map((f) => f.valor);
      if (frecuenciasElegidas.length === 0) throw new Error("Marca al menos una frecuencia de rebalanceo.");

      const resp = await fetch(
        `/api/rentabilidadFlujoBajo?indices=${idsElegidos.join(",")}&factores=${factoresElegidos.join(",")}&ns=${nsElegidos.join(",")}&maxs=${maxsElegidos.join(",")}&frecuencias=${frecuenciasElegidas.join(",")}`
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

      <p style={{ fontWeight: "bold", marginBottom: 4 }}>{t.rentFlujoBajoEtiquetaFactores}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12 }}>
        {FACTORES_DISPONIBLES.map((f) => (
          <label key={f.etiqueta} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={!!factoresRentFlujoBajo[f.etiqueta]}
              onChange={(e) => setFactoresRentFlujoBajo((prev) => ({ ...prev, [f.etiqueta]: e.target.checked }))}
            />
            {f.etiqueta}
          </label>
        ))}
      </div>

      <p style={{ fontWeight: "bold", marginBottom: 4 }}>{t.rentFlujoBajoEtiquetaNs}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12 }}>
        {NS_DISPONIBLES.map((f) => (
          <label key={f.etiqueta} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={!!nsRentFlujoBajo[f.etiqueta]}
              onChange={(e) => setNsRentFlujoBajo((prev) => ({ ...prev, [f.etiqueta]: e.target.checked }))}
            />
            {f.etiqueta}
          </label>
        ))}
      </div>

      <p style={{ fontWeight: "bold", marginBottom: 4 }}>{t.rentFlujoBajoEtiquetaMaxs}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12 }}>
        {MAXS_DISPONIBLES.map((f) => (
          <label key={f.etiqueta} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={!!maxsRentFlujoBajo[f.etiqueta]}
              onChange={(e) => setMaxsRentFlujoBajo((prev) => ({ ...prev, [f.etiqueta]: e.target.checked }))}
            />
            {f.etiqueta}
          </label>
        ))}
      </div>

      <p style={{ fontWeight: "bold", marginBottom: 4 }}>{t.rentFlujoBajoEtiquetaFrecuencias}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 12 }}>
        {FRECUENCIAS_DISPONIBLES.map((f) => (
          <label key={f.etiqueta} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={!!frecuenciasRentFlujoBajo[f.etiqueta]}
              onChange={(e) => setFrecuenciasRentFlujoBajo((prev) => ({ ...prev, [f.etiqueta]: e.target.checked }))}
            />
            {f.etiqueta}
          </label>
        ))}
      </div>

      <p style={{ fontWeight: "bold", color: totalEjecucionesEstimado > 800 ? "crimson" : "inherit" }}>
        {t.totalEjecucionesEtiqueta(totalEjecucionesEstimado)}
        {totalEjecucionesEstimado > 800 && ` — ${t.totalEjecucionesAvisoExceso}`}
      </p>

      <button onClick={realizarRentFlujoBajo} disabled={cargandoRentFlujoBajo || totalEjecucionesEstimado > 800 || totalEjecucionesEstimado === 0}>
        {cargandoRentFlujoBajo ? t.rentFlujoBajoBotonCargando : t.rentFlujoBajoBoton}
      </button>

      {errorRentFlujoBajo && <p style={{ color: "crimson" }}>{t.error}: {errorRentFlujoBajo}</p>}

      {rentFlujoBajo && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <div style={{ background: "#eef2f7", border: "1px solid #9aa9bb", borderRadius: 6, padding: 12, marginBottom: 16 }}>
            <p style={{ fontWeight: "bold", marginTop: 0 }}>{t.factoresSeleccionCarterasTitulo}</p>
            <p style={{ margin: "4px 0" }}>{t.factoresSeleccionFactoresProbados(rentFlujoBajo.factoresProbados.join(", "))}</p>
            <p style={{ margin: "4px 0" }}>{t.rentFlujoBajoNsProbados(rentFlujoBajo.nsProbados.join(", "))}</p>
            <p style={{ margin: "4px 0" }}>{t.rentFlujoBajoMaxsProbados(rentFlujoBajo.maxsProbados.join(", "))}</p>
            <p style={{ margin: "4px 0" }}>{t.rentFlujoBajoFrecuenciasProbadas(rentFlujoBajo.frecuenciasProbadas.map(formatearFrecuencia).join(", "))}</p>
            <p style={{ margin: "4px 0" }}>{t.totalEjecucionesEtiqueta(rentFlujoBajo.totalEjecuciones)}</p>
            <p style={{ margin: "4px 0" }}>{t.repeticionesEsperadasEtiqueta}</p>
          </div>

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
              {rentFlujoBajo.duraciones.map((duracion) => {
                const filas = rentFlujoBajo.resultados
                  .filter((r) => !r.error)
                  .flatMap((r) =>
                    r.ejecuciones
                      .filter((e) => e.sesionesPromediadas === sesiones && e.duracion === duracion)
                      .map((e) => ({ ...e, nombreIndice: r.nombreIndice, indiceId: r.indice }))
                  );
                const hayParametrosVariables =
                  rentFlujoBajo.factoresProbados.length > 1 ||
                  rentFlujoBajo.nsProbados.length > 1 ||
                  rentFlujoBajo.maxsProbados.length > 1 ||
                  rentFlujoBajo.frecuenciasProbadas.length > 1;
                return (
                  <div key={duracion} style={{ marginTop: 12 }}>
                    <h4>{duracion} {t.sesionesEtiqueta}</h4>
                    <div style={{ overflowX: "auto" }}>
                      <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
                        <thead>
                          <tr>
                            <th>{t.colIndice}</th>
                            {hayParametrosVariables && <th>{t.colParametrosCompacto}</th>}
                            <th>{t.colRepeticiones}</th>
                            <th>{t.colRentCarteraMedia}</th>
                            <th>{t.colRentCarteraRango}</th>
                            <th>{t.colRentIndiceMediaSimple}</th>
                            <th>{t.colDistanciaInferior}</th>
                            <th>{t.colDistanciaSuperior}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map((f, i) => (
                            <tr key={i}>
                              <td>{f.nombreIndice}</td>
                              {hayParametrosVariables && <td>{formatearParametrosCompacto(f, t, rentFlujoBajo)}</td>}
                              <td style={f.repeticiones < 6 ? { color: "#cc5500", fontWeight: "bold" } : undefined}>
                                {f.repeticiones < 6 ? `${f.repeticiones} (${t.repeticionesInsuficientesAviso})` : "-"}
                              </td>
                              <td>{f.rentCarteraMedia !== null ? `${f.rentCarteraMedia}%` : "-"}</td>
                              <td>{f.rentCarteraMin !== null && f.rentCarteraMax !== null ? `[${f.rentCarteraMin}%, ${f.rentCarteraMax}%]` : "-"}</td>
                              <td>{f.rentIndiceMedia !== null ? `${f.rentIndiceMedia}%` : "-"}</td>
                              <td>{f.distanciaInferior !== null ? `${f.distanciaInferior}` : "-"}</td>
                              <td>{f.distanciaSuperior !== null ? `${f.distanciaSuperior}` : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {filas.some((f) => f.top3ConRentabilidad.length > 0) && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontStyle: "italic", color: "#555", marginBottom: 4 }}>{t.top3SecuencialTitulo}</p>
                        {filas.map((f, i) => (
                          <p key={i} style={{ margin: "2px 0" }}>
                            <b>{f.nombreIndice}</b> ({formatearParametrosCompacto(f, t, rentFlujoBajo)}):{" "}
                            {f.top3ConRentabilidad.length === 0
                              ? "-"
                              : f.top3ConRentabilidad.map((tk, j) => (
                                  <span key={tk.ticker}>
                                    {j > 0 && ", "}
                                    {tickerVisible(tk.ticker)} (
                                    <span style={{ color: tk.rentabilidadPct === null ? "inherit" : tk.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                                      {tk.rentabilidadPct !== null ? `${tk.rentabilidadPct}%` : "-"}
                                    </span>
                                    {`, ${tk.veces}×)`}
                                  </span>
                                ))}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {(() => {
            const opciones = {
              titulo: t.rentFlujoBajoTitulo,
              parrafos: [
                t.factoresSeleccionFactoresProbados(rentFlujoBajo.factoresProbados.join(", ")),
                t.rentFlujoBajoNsProbados(rentFlujoBajo.nsProbados.join(", ")),
                t.rentFlujoBajoMaxsProbados(rentFlujoBajo.maxsProbados.join(", ")),
                t.rentFlujoBajoFrecuenciasProbadas(rentFlujoBajo.frecuenciasProbadas.map(formatearFrecuencia).join(", ")),
              ],
              columnas: [t.colIndice, t.colParametrosCompacto, t.sesionesPromediadasEtiqueta, t.colDuracion, t.colRepeticiones, t.colRentCarteraMedia, t.colRentCarteraRango, t.colRentIndiceMediaSimple, t.colDistanciaInferior, t.colDistanciaSuperior, t.colTop3Compacto],
              filas: rentFlujoBajo.sesionesPromediadas.flatMap((sesiones) =>
                rentFlujoBajo.duraciones.flatMap((duracion) =>
                  rentFlujoBajo.resultados
                    .filter((r) => !r.error)
                    .flatMap((r) =>
                      r.ejecuciones
                        .filter((e) => e.sesionesPromediadas === sesiones && e.duracion === duracion)
                        .map((e) => {
                          const top3Texto = e.top3ConRentabilidad
                            .map((f) => `${tickerVisible(f.ticker)} (${f.rentabilidadPct !== null ? f.rentabilidadPct + "%" : "-"}, ${f.veces}×)`)
                            .join(", ");
                          return [
                            r.nombreIndice,
                            formatearParametrosCompacto(e, t, rentFlujoBajo),
                            sesiones,
                            duracion,
                            e.repeticiones,
                            e.rentCarteraMedia !== null ? `${e.rentCarteraMedia}%` : "-",
                            e.rentCarteraMin !== null && e.rentCarteraMax !== null ? `[${e.rentCarteraMin}%, ${e.rentCarteraMax}%]` : "-",
                            e.rentIndiceMedia !== null ? `${e.rentIndiceMedia}%` : "-",
                            e.distanciaInferior !== null ? e.distanciaInferior : "-",
                            e.distanciaSuperior !== null ? e.distanciaSuperior : "-",
                            top3Texto || "-",
                          ];
                        })
                    )
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

function formatearFrecuencia(f) {
  if (f === "diario") return "diaria";
  if (f === "nunca") return "nunca";
  return `cada ${f} superviviente${f === 1 ? "" : "s"}`;
}

// Solo incluye en el texto compacto los parámetros que de verdad
// varían en esta ejecución (más de un valor marcado) — si un
// parámetro tiene un único valor para toda la ejecución, ya se dice
// una vez en la cabecera de resultados y repetirlo en cada fila sería
// puro ruido.
function formatearParametrosCompacto(e, t, resultado) {
  const partes = [];
  if (resultado.factoresProbados.length > 1) partes.push(`F=${e.factor}`);
  if (resultado.nsProbados.length > 1) partes.push(`n=${e.n}`);
  if (resultado.maxsProbados.length > 1) partes.push(`tope=${e.max}%`);
  if (resultado.frecuenciasProbadas.length > 1) partes.push(`reb=${formatearFrecuencia(e.frecuencia)}`);
  return partes.length > 0 ? partes.join(", ") : t.parametrosConstantesEtiqueta;
}
