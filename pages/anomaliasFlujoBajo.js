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

  async function realizarConcentracion() {
    setCargandoConcentracion(true);
    setErrorConcentracion(null);
    setConcentracion(null);
    try {
      const resp = await fetch(
        `/api/concentracionSeleccion?indice=${indiceId}&sesiones=${sesionesPuntuacion}&factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}`
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setConcentracion(json);
    } catch (e) {
      setErrorConcentracion(e.message);
    } finally {
      setCargandoConcentracion(false);
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
    </MenuLayout>
  );
}
