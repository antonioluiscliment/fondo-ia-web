import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import BotonCompartirPdf from "../components/BotonCompartirPdf";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible } from "../lib/indices";
import { descargarTablaPdf } from "../lib/pdfComun";

const SESIONES_TEST_DEFECTO = 4;
const SESIONES_TEST_MINIMO = 1;
const SESIONES_TEST_MAXIMO = 10;

// "Comparación con red neuronal": nace de la propuesta de calibrar
// dos modelos de selección — una regresión ridge y una red neuronal
// pequeña, las dos construidas y entrenadas desde cero, sin ninguna
// librería de aprendizaje automático — mediante walk-forward: entrenar
// con lo ya conocido, aplicar al tramo siguiente, comparar con lo que
// de verdad pasó, reajustar, deslizar la ventana. Ver
// lib/walkForwardComun.js para el detalle completo del mecanismo.
export default function ComparacionRedNeuronal() {
  const { t, indiceId } = useAppConfig();
  const indice = obtenerIndice(indiceId);

  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [sesionesTest, setSesionesTest] = useState(SESIONES_TEST_DEFECTO);

  const [clasificacion, setClasificacion] = useState(null);
  const [cargandoClasificacion, setCargandoClasificacion] = useState(false);
  const [errorClasificacion, setErrorClasificacion] = useState(null);
  const [periodoClasificacion, setPeriodoClasificacion] = useState(180);

  async function realizarClasificacion() {
    setCargandoClasificacion(true);
    setErrorClasificacion(null);
    setClasificacion(null);
    try {
      const resp = await fetch(`/api/clasificacionIndice?indice=${indiceId}&periodo=${periodoClasificacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setClasificacion(json);
    } catch (e) {
      setErrorClasificacion(e.message);
    } finally {
      setCargandoClasificacion(false);
    }
  }

  async function realizar() {
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const resp = await fetch(`/api/redVsRidge?indice=${indiceId}&sesionesTest=${sesionesTest}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultado(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  function listaRecomendacion(lista) {
    if (!lista || lista.length === 0) return <p>{t.redVsRidgeSinRecomendacion}</p>;
    return (
      <ol style={{ marginTop: 4 }}>
        {lista.map((c) => (
          <li key={c.ticker}>
            {tickerVisible(c.ticker)} — {c.nombre}
            {c.incremento !== null && c.incremento !== undefined && (
              <span style={{ color: c.incremento >= 0 ? "green" : "crimson", fontWeight: "bold" }}>
                {" "}({c.incremento >= 0 ? "+" : ""}{c.incremento}%)
              </span>
            )}
          </li>
        ))}
      </ol>
    );
  }

  function historialRentabilidad(hist) {
    if (!hist || hist.numPasos === 0) return <p style={{ color: "#555", fontSize: "0.9em" }}>{t.redVsRidgeSinHistorial}</p>;
    const diferencia = hist.retornoTopHistoricoMedio - hist.retornoBaseHistoricoMedio;
    return (
      <div style={{ background: "#eef2f7", border: "1px solid #9aa9bb", borderRadius: 6, padding: 10, marginTop: 8 }}>
        <p style={{ margin: "2px 0", fontWeight: "bold" }}>{t.redVsRidgeHistorialTitulo}</p>
        <p style={{ margin: "2px 0" }}>{t.redVsRidgeHistorialTop(hist.retornoTopHistoricoMedio)}</p>
        <p style={{ margin: "2px 0" }}>{t.redVsRidgeHistorialBase(hist.retornoBaseHistoricoMedio)}</p>
        <p style={{ margin: "2px 0", color: diferencia >= 0 ? "green" : "crimson", fontWeight: "bold" }}>
          {t.redVsRidgeHistorialDiferencia(diferencia)}
        </p>
        <p style={{ margin: "2px 0" }}>{t.redVsRidgeHistorialTasa(hist.tasaSuperaBase, hist.numPasos)}</p>
        <p style={{ margin: "6px 0 0", fontSize: "0.85em", fontStyle: "italic", color: "#555" }}>{t.redVsRidgeHistorialAvisoMuestra}</p>
      </div>
    );
  }

  return (
    <MenuLayout>
      <h2>{t.menuComparacionRedNeuronal}</h2>
      <p>{t.comparacionRedNeuronalIntro}</p>

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.redVsRidgeTitulo}</h2>
      <p>{t.redVsRidgeDesc}</p>

      <p style={{ margin: "12px 0 4px" }}>
        <label>
          {t.redVsRidgeEtiquetaSesionesTest}{" "}
          <select value={sesionesTest} onChange={(e) => setSesionesTest(Number(e.target.value))}>
            {Array.from({ length: SESIONES_TEST_MAXIMO - SESIONES_TEST_MINIMO + 1 }, (_, i) => SESIONES_TEST_MINIMO + i).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </p>

      <button onClick={realizar} disabled={cargando}>
        {cargando ? t.redVsRidgeBotonCargando : t.redVsRidgeBoton}
      </button>

      {error && <p style={{ color: "crimson" }}>{t.error}: {error}</p>}

      {resultado && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <p style={{ margin: "4px 0" }}>
            {t.redVsRidgeParametros(resultado.parametros.ventana, resultado.parametros.totalSesiones, resultado.parametros.pasoRidge, resultado.parametros.pasoRed)}{" "}
            {t.redVsRidgeParametrosTest(resultado.parametros.sesionesTest)}
          </p>
          {resultado.parametros.sesionesReducidas && (
            <p style={{ background: "#fff3cd", border: "1px solid #cc9a06", borderRadius: 6, padding: 10, color: "#7a5c00" }}>
              {t.redVsRidgeAvisoSesionesReducidas(resultado.parametros.umbralTickers, resultado.parametros.totalSesionesNormal, resultado.parametros.totalSesiones)}
            </p>
          )}
          <p style={{ margin: "4px 0" }}>{t.redVsRidgeCandidatos(resultado.candidatosValidos, resultado.excluidos)}</p>
          <p style={{ margin: "8px 0", fontWeight: "bold" }}>
            {t.redVsRidgeIncrementoIndice}{" "}
            {resultado.incrementoIndice !== null && resultado.incrementoIndice !== undefined ? (
              <span style={{ color: resultado.incrementoIndice >= 0 ? "green" : "crimson" }}>
                {resultado.incrementoIndice >= 0 ? "+" : ""}{resultado.incrementoIndice}%
              </span>
            ) : (
              "-"
            )}
          </p>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 16 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3>{t.redVsRidgeRecomendacionRidge}</h3>
              {listaRecomendacion(resultado.ridge.recomendacionFinal)}
              <p style={{ color: "#555", fontSize: "0.9em" }}>
                {t.redVsRidgePasosInfo(resultado.ridge.pasosConRecomendacion, resultado.ridge.filasEntrenamiento)}
              </p>
              {historialRentabilidad(resultado.ridge.historialRentabilidad)}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3>{t.redVsRidgeRecomendacionRed}</h3>
              {listaRecomendacion(resultado.red.recomendacionFinal)}
              <p style={{ color: "#555", fontSize: "0.9em" }}>
                {t.redVsRidgePasosInfo(resultado.red.pasosConRecomendacion, resultado.red.filasEntrenamiento)}
              </p>
              {historialRentabilidad(resultado.red.historialRentabilidad)}
            </div>
          </div>

          <hr style={{ margin: "16px 0" }} />

          <h3>{t.redVsRidgeCorrelacionTitulo}</h3>
          <p style={{ fontWeight: "bold" }}>{t.redVsRidgeNumPares(resultado.correlacion.numPares)}</p>
          <p>{t.redVsRidgeSolape(resultado.correlacion.solapeMedio, resultado.correlacion.solapeMaximo)}</p>
          <p>{t.redVsRidgeSpearman(resultado.correlacion.spearmanMedio)}</p>
          <p style={{ color: "#555", fontStyle: "italic" }}>{t.redVsRidgeAvisoPares}</p>

          {(() => {
            const opciones = {
              titulo: t.redVsRidgeTitulo,
              subtitulo: resultado.nombreIndice,
              parrafos: [
                `${t.redVsRidgeIncrementoIndice} ${resultado.incrementoIndice !== null && resultado.incrementoIndice !== undefined ? `${resultado.incrementoIndice >= 0 ? "+" : ""}${resultado.incrementoIndice}%` : "-"}`,
              ],
              columnas: [t.colMetodo, t.colRecomendacion],
              filas: [
                [t.redVsRidgeRecomendacionRidge, resultado.ridge.recomendacionFinal.map((c) => `${tickerVisible(c.ticker)} — ${c.nombre} (${c.incremento !== null && c.incremento !== undefined ? `${c.incremento >= 0 ? "+" : ""}${c.incremento}%` : "-"})`).join(", ") || "-"],
                [t.redVsRidgeRecomendacionRed, resultado.red.recomendacionFinal.map((c) => `${tickerVisible(c.ticker)} — ${c.nombre} (${c.incremento !== null && c.incremento !== undefined ? `${c.incremento >= 0 ? "+" : ""}${c.incremento}%` : "-"})`).join(", ") || "-"],
                [
                  `${t.redVsRidgeRecomendacionRidge} — ${t.redVsRidgeHistorialTitulo}`,
                  resultado.ridge.historialRentabilidad.numPasos > 0
                    ? `${t.redVsRidgeHistorialTop(resultado.ridge.historialRentabilidad.retornoTopHistoricoMedio)} ${t.redVsRidgeHistorialBase(resultado.ridge.historialRentabilidad.retornoBaseHistoricoMedio)} ${t.redVsRidgeHistorialTasa(resultado.ridge.historialRentabilidad.tasaSuperaBase, resultado.ridge.historialRentabilidad.numPasos)}`
                    : t.redVsRidgeSinHistorial,
                ],
                [
                  `${t.redVsRidgeRecomendacionRed} — ${t.redVsRidgeHistorialTitulo}`,
                  resultado.red.historialRentabilidad.numPasos > 0
                    ? `${t.redVsRidgeHistorialTop(resultado.red.historialRentabilidad.retornoTopHistoricoMedio)} ${t.redVsRidgeHistorialBase(resultado.red.historialRentabilidad.retornoBaseHistoricoMedio)} ${t.redVsRidgeHistorialTasa(resultado.red.historialRentabilidad.tasaSuperaBase, resultado.red.historialRentabilidad.numPasos)}`
                    : t.redVsRidgeSinHistorial,
                ],
                [t.redVsRidgeCorrelacionTitulo, `${t.redVsRidgeNumPares(resultado.correlacion.numPares)} — ${t.redVsRidgeSolape(resultado.correlacion.solapeMedio, resultado.correlacion.solapeMaximo)} — ${t.redVsRidgeSpearman(resultado.correlacion.spearmanMedio)}`],
              ],
              nombreArchivo: `red-vs-ridge-${indice.id}.pdf`,
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

      <h2>{t.clasificacionTitulo}</h2>
      <p>{t.clasificacionDesc}</p>

      <p style={{ margin: "12px 0 4px" }}>
        <label>
          {t.clasificacionEtiquetaPeriodo}{" "}
          <select value={periodoClasificacion} onChange={(e) => setPeriodoClasificacion(Number(e.target.value))}>
            <option value={120}>120</option>
            <option value={180}>180</option>
            <option value={250}>250</option>
          </select>
        </label>
      </p>

      <button onClick={realizarClasificacion} disabled={cargandoClasificacion}>
        {cargandoClasificacion ? t.clasificacionBotonCargando : t.clasificacionBoton}
      </button>

      {errorClasificacion && <p style={{ color: "crimson" }}>{t.error}: {errorClasificacion}</p>}

      {clasificacion && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{clasificacion.nombreIndice}</h3>
          <p style={{ margin: "4px 0" }}>
            {t.clasificacionParametros(clasificacion.parametros.ventanaEntrada, clasificacion.parametros.horizonte, clasificacion.parametros.numVariables)}
          </p>
          <p style={{ margin: "4px 0" }}>
            {t.clasificacionReparto(clasificacion.reparto.sesionesEntrenamiento, clasificacion.reparto.ejemplosEntrenamiento, clasificacion.reparto.huecoSesiones, clasificacion.reparto.sesionesPrueba)}
          </p>

          <h3>{t.clasificacionEvaluacionTitulo}</h3>
          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <th style={{ textAlign: "left" }}>{t.clasificacionFilaAciertos}</th>
                <td style={{ fontWeight: "bold", background: clasificacion.evaluacion.porcentajeAciertos > 55 ? "#e6f4ea" : "transparent" }}>
                  {clasificacion.evaluacion.porcentajeAciertos}%
                </td>
              </tr>
              <tr>
                <th style={{ textAlign: "left" }}>{t.clasificacionFilaAciertosSeguros}</th>
                <td>{clasificacion.evaluacion.porcentajeAciertosSeguros}%</td>
              </tr>
              <tr>
                <th style={{ textAlign: "left" }}>{t.clasificacionFilaRentDestacados(clasificacion.parametros.numDestacados)}</th>
                <td>{clasificacion.evaluacion.rentDestacadosMedia}%</td>
              </tr>
              <tr>
                <th style={{ textAlign: "left" }}>{t.clasificacionFilaRentMedia}</th>
                <td>{clasificacion.evaluacion.rentMediaIndice}%</td>
              </tr>
              <tr>
                <th style={{ textAlign: "left" }}>{t.clasificacionFilaSuperaMedia}</th>
                <td>
                  {clasificacion.evaluacion.pasosSuperaMedia} / {clasificacion.evaluacion.numPasos} (
                  {((clasificacion.evaluacion.pasosSuperaMedia / clasificacion.evaluacion.numPasos) * 100).toFixed(1)}%)
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ color: "#555", fontStyle: "italic", marginTop: 8 }}>{t.clasificacionAvisoLineaBase}</p>

          <h3>{t.clasificacionHoyTitulo}</h3>
          <p style={{ color: "#555" }}>{t.clasificacionHoyDesc}</p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {["arriba", "abajo"].map((grupo) => (
              <div key={grupo} style={{ flex: 1, minWidth: 260 }}>
                <p style={{ fontWeight: "bold" }}>{grupo === "arriba" ? t.clasificacionGrupoArriba : t.clasificacionGrupoAbajo}</p>
                <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.9em" }}>
                  <thead>
                    <tr>
                      <th>{t.colTicker}</th>
                      <th>{t.clasificacionColProbabilidad}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clasificacion.clasificacionHoy
                      .filter((c) => c.grupo === grupo)
                      .map((c) => (
                        <tr key={c.ticker} style={{ background: c.destacado ? "#e6f4ea" : "transparent" }}>
                          <td style={{ fontWeight: c.destacado ? "bold" : "normal" }}>
                            {tickerVisible(c.ticker)} — {c.nombre}
                            {c.destacado && " ★"}
                          </td>
                          <td>{c.probabilidad}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {(() => {
            const opciones = {
              titulo: t.clasificacionTitulo,
              subtitulo: clasificacion.nombreIndice,
              columnas: [t.colTicker, t.clasificacionColProbabilidad, t.clasificacionColGrupo],
              filas: clasificacion.clasificacionHoy.map((c) => [
                `${tickerVisible(c.ticker)} — ${c.nombre}${c.destacado ? " ★" : ""}`,
                c.probabilidad,
                c.grupo === "arriba" ? t.clasificacionGrupoArriba : t.clasificacionGrupoAbajo,
              ]),
              nombreArchivo: `clasificacion-${indice.id}.pdf`,
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
