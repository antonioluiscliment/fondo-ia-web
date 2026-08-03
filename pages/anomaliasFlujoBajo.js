import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import BotonCompartirPdf from "../components/BotonCompartirPdf";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible } from "../lib/indices";
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
  const { t, indiceId, factorPenalizacion, nComponentes, pesoMaximo, frecuenciaRebalanceo, sesionesPuntuacion } =
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
    </MenuLayout>
  );
}
