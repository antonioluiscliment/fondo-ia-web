import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible } from "../lib/indices";
import { descargarTablaPdf } from "../lib/pdfComun";

// Página de aterrizaje ("/"): "Selección de cartera por parámetros
// técnicos" — selección de componentes por precio, por volumen, por
// flujo de dinero, y sus tres antítesis (precio/volumen/flujo bajo).
// Los parámetros que se usan aquí (factor, nº de componentes, tope,
// frecuencia, ventana de backtest) se ajustan en la página "Parámetros
// técnicos para la selección de valores" — aquí solo se leen.
export default function Home() {
  const {
    t,
    idioma,
    indiceId,
    factorPenalizacion,
    nComponentes,
    pesoMaximo,
    frecuenciaRebalanceo,
    diasVentana,
    sesionesPuntuacion,
  } = useAppConfig();
  const indice = obtenerIndice(indiceId);
  const { nombresEmpresas } = indice;
  const nombreIndice = indice.nombre[idioma];

  // Días efectivos de selección real = ventana de backtest menos las
  // sesiones que se consumen como "calentamiento" para poder calcular
  // la primera puntuación (ver sesionesPuntuacion). Si son 0 o menos,
  // no habría ningún día con cartera seleccionada: se bloquean los
  // botones de cálculo hasta que se ajuste la ventana o las sesiones
  // promediadas. Si son pocos pero válidos, solo se avisa.
  const diasEfectivos = diasVentana - sesionesPuntuacion;
  const UMBRAL_AVISO_DIAS_EFECTIVOS = 8;
  const bloqueadoPorDiasEfectivos = diasEfectivos <= 0;
  const avisoDiasEfectivos = !bloqueadoPorDiasEfectivos && diasEfectivos < UMBRAL_AVISO_DIAS_EFECTIVOS;

  const [seleccion, setSeleccion] = useState(null);
  const [cargandoSeleccion, setCargandoSeleccion] = useState(false);
  const [errorSeleccion, setErrorSeleccion] = useState(null);
  const [seleccionVolumen, setSeleccionVolumen] = useState(null);
  const [cargandoSeleccionVolumen, setCargandoSeleccionVolumen] = useState(false);
  const [errorSeleccionVolumen, setErrorSeleccionVolumen] = useState(null);
  const [seleccionFlujo, setSeleccionFlujo] = useState(null);
  const [cargandoSeleccionFlujo, setCargandoSeleccionFlujo] = useState(false);
  const [errorSeleccionFlujo, setErrorSeleccionFlujo] = useState(null);
  const [seleccionPrecioBajo, setSeleccionPrecioBajo] = useState(null);
  const [cargandoSeleccionPrecioBajo, setCargandoSeleccionPrecioBajo] = useState(false);
  const [errorSeleccionPrecioBajo, setErrorSeleccionPrecioBajo] = useState(null);
  const [seleccionVolumenBajo, setSeleccionVolumenBajo] = useState(null);
  const [cargandoSeleccionVolumenBajo, setCargandoSeleccionVolumenBajo] = useState(false);
  const [errorSeleccionVolumenBajo, setErrorSeleccionVolumenBajo] = useState(null);
  const [seleccionFlujoBajo, setSeleccionFlujoBajo] = useState(null);
  const [cargandoSeleccionFlujoBajo, setCargandoSeleccionFlujoBajo] = useState(false);
  const [errorSeleccionFlujoBajo, setErrorSeleccionFlujoBajo] = useState(null);
  const [mostrarResumen, setMostrarResumen] = useState(false);

  async function realizarSeleccion() {
    setCargandoSeleccion(true);
    setErrorSeleccion(null);
    setSeleccion(null);
    setMostrarResumen(false);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccion(json);
      setMostrarResumen(true);
    } catch (e) {
      setErrorSeleccion(e.message);
    } finally {
      setCargandoSeleccion(false);
    }
  }

  async function realizarSeleccionVolumen() {
    setCargandoSeleccionVolumen(true);
    setErrorSeleccionVolumen(null);
    setSeleccionVolumen(null);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&criterio=volumen&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionVolumen(json);
    } catch (e) {
      setErrorSeleccionVolumen(e.message);
    } finally {
      setCargandoSeleccionVolumen(false);
    }
  }

  async function realizarSeleccionFlujo() {
    setCargandoSeleccionFlujo(true);
    setErrorSeleccionFlujo(null);
    setSeleccionFlujo(null);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&criterio=flujo&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionFlujo(json);
    } catch (e) {
      setErrorSeleccionFlujo(e.message);
    } finally {
      setCargandoSeleccionFlujo(false);
    }
  }

  async function realizarSeleccionPrecioBajo() {
    setCargandoSeleccionPrecioBajo(true);
    setErrorSeleccionPrecioBajo(null);
    setSeleccionPrecioBajo(null);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&criterio=precioBajo&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionPrecioBajo(json);
    } catch (e) {
      setErrorSeleccionPrecioBajo(e.message);
    } finally {
      setCargandoSeleccionPrecioBajo(false);
    }
  }

  async function realizarSeleccionVolumenBajo() {
    setCargandoSeleccionVolumenBajo(true);
    setErrorSeleccionVolumenBajo(null);
    setSeleccionVolumenBajo(null);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&criterio=volumenBajo&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionVolumenBajo(json);
    } catch (e) {
      setErrorSeleccionVolumenBajo(e.message);
    } finally {
      setCargandoSeleccionVolumenBajo(false);
    }
  }

  async function realizarSeleccionFlujoBajo() {
    setCargandoSeleccionFlujoBajo(true);
    setErrorSeleccionFlujoBajo(null);
    setSeleccionFlujoBajo(null);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&criterio=flujoBajo&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionFlujoBajo(json);
    } catch (e) {
      setErrorSeleccionFlujoBajo(e.message);
    } finally {
      setCargandoSeleccionFlujoBajo(false);
    }
  }

  return (
    <MenuLayout>
      {bloqueadoPorDiasEfectivos && (
        <p style={{ background: "#ffe0e0", border: "1px solid crimson", borderRadius: 6, padding: 12, color: "crimson" }}>
          {t.diasEfectivosBloqueo(diasVentana, sesionesPuntuacion)}
        </p>
      )}

      <h2>{t.seleccionTitulo}</h2>
      <p>{t.seleccionDesc(nComponentes, pesoMaximo, diasVentana, indice.tickers.length)}</p>
      <button onClick={realizarSeleccion} disabled={bloqueadoPorDiasEfectivos || cargandoSeleccion}>
        {cargandoSeleccion ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>
      <br />
      <button
        onClick={() => setMostrarResumen((v) => !v)}
        disabled={!seleccion}
        style={{ marginTop: 8 }}
      >
        {mostrarResumen ? t.ocultarResumen : t.mostrarResumen}
      </button>

      {errorSeleccion && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccion}</p>}

      {seleccion && (
        <div style={{ marginTop: 20 }}>
          {seleccion.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.indiceAbrevEtiqueta(indice.abreviatura)}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccion && mostrarResumen && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccion.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccion.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccion.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccion.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, seleccion.rentabilidadIndice.fechaInicio, seleccion.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccion.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccion.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccion.rentabilidadCarteraAnterior.rentabilidadPct >= seleccion.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccion.rentabilidadCarteraAnterior.rentabilidadPct - seleccion.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccion.rentabilidadIndice.rentabilidadPct - seleccion.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccion.correlacionBeneficioIndice !== null && seleccion.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion(nombreIndice)}{" "}
              <b>{seleccion.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}

      {seleccion && (
        <button
          onClick={() =>
            descargarTablaPdf({
              titulo: t.seleccionTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colFecha, t.colTicker, t.colPeso, t.colPuntuacion, t.colPrecio, t.colVeces],
              filas: seleccion.historico.flatMap((dia) =>
                dia.cartera.map((c) => [dia.fecha, `${tickerVisible(c.ticker)} — ${nombresEmpresas[c.ticker]}`, `${c.peso}%`, c.puntuacion, c.precio, c.vecesSeleccionado])
              ),
              nombreArchivo: `seleccion-precio-${indice.id}.pdf`,
            })
          }
          style={{ marginTop: 12 }}
        >
          {t.descargarPdfBoton}
        </button>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionVolumenTitulo}</h2>
      <p>{t.seleccionVolumenDesc(nComponentes, pesoMaximo, indice.tickers.length, sesionesPuntuacion)}</p>
      <button onClick={realizarSeleccionVolumen} disabled={bloqueadoPorDiasEfectivos || cargandoSeleccionVolumen}>
        {cargandoSeleccionVolumen ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>

      {errorSeleccionVolumen && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionVolumen}</p>}

      {seleccionVolumen && (
        <div style={{ marginTop: 20 }}>
          {seleccionVolumen.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.indiceAbrevEtiqueta(indice.abreviatura)}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccionVolumen && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccionVolumen.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionVolumen.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, seleccionVolumen.rentabilidadIndice.fechaInicio, seleccionVolumen.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionVolumen.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionVolumen.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionVolumen.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct - seleccionVolumen.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionVolumen.rentabilidadIndice.rentabilidadPct - seleccionVolumen.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccionVolumen.correlacionBeneficioIndice !== null && seleccionVolumen.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion(nombreIndice)}{" "}
              <b>{seleccionVolumen.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}



      {seleccionVolumen && (
        <button
          onClick={() =>
            descargarTablaPdf({
              titulo: t.seleccionVolumenTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colFecha, t.colTicker, t.colPeso, t.colPuntuacion, t.colPrecio, t.colVeces],
              filas: seleccionVolumen.historico.flatMap((dia) =>
                dia.cartera.map((c) => [dia.fecha, `${tickerVisible(c.ticker)} — ${nombresEmpresas[c.ticker]}`, `${c.peso}%`, c.puntuacion, c.precio, c.vecesSeleccionado])
              ),
              nombreArchivo: `seleccion-volumen-${indice.id}.pdf`,
            })
          }
          style={{ marginTop: 12 }}
        >
          {t.descargarPdfBoton}
        </button>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionFlujoTitulo}</h2>
      <p>{t.seleccionFlujoDesc(nComponentes, pesoMaximo, indice.tickers.length, sesionesPuntuacion)}</p>
      <button onClick={realizarSeleccionFlujo} disabled={bloqueadoPorDiasEfectivos || cargandoSeleccionFlujo}>
        {cargandoSeleccionFlujo ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>

      {errorSeleccionFlujo && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionFlujo}</p>}

      {seleccionFlujo && (
        <div style={{ marginTop: 20 }}>
          {seleccionFlujo.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.indiceAbrevEtiqueta(indice.abreviatura)}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccionFlujo && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccionFlujo.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionFlujo.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, seleccionFlujo.rentabilidadIndice.fechaInicio, seleccionFlujo.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionFlujo.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionFlujo.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionFlujo.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct - seleccionFlujo.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionFlujo.rentabilidadIndice.rentabilidadPct - seleccionFlujo.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccionFlujo.correlacionBeneficioIndice !== null && seleccionFlujo.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion(nombreIndice)}{" "}
              <b>{seleccionFlujo.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}



      {seleccionFlujo && (
        <button
          onClick={() =>
            descargarTablaPdf({
              titulo: t.seleccionFlujoTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colFecha, t.colTicker, t.colPeso, t.colPuntuacion, t.colPrecio, t.colVeces],
              filas: seleccionFlujo.historico.flatMap((dia) =>
                dia.cartera.map((c) => [dia.fecha, `${tickerVisible(c.ticker)} — ${nombresEmpresas[c.ticker]}`, `${c.peso}%`, c.puntuacion, c.precio, c.vecesSeleccionado])
              ),
              nombreArchivo: `seleccion-flujo-${indice.id}.pdf`,
            })
          }
          style={{ marginTop: 12 }}
        >
          {t.descargarPdfBoton}
        </button>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionPrecioBajoTitulo}</h2>
      <p>{t.seleccionPrecioBajoDesc(nComponentes, pesoMaximo)}</p>
      <button onClick={realizarSeleccionPrecioBajo} disabled={bloqueadoPorDiasEfectivos || cargandoSeleccionPrecioBajo}>
        {cargandoSeleccionPrecioBajo ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>

      {errorSeleccionPrecioBajo && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionPrecioBajo}</p>}

      {seleccionPrecioBajo && (
        <div style={{ marginTop: 20 }}>
          {seleccionPrecioBajo.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.indiceAbrevEtiqueta(indice.abreviatura)}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccionPrecioBajo && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccionPrecioBajo.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccionPrecioBajo.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionPrecioBajo.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionPrecioBajo.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, seleccionPrecioBajo.rentabilidadIndice.fechaInicio, seleccionPrecioBajo.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionPrecioBajo.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionPrecioBajo.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionPrecioBajo.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionPrecioBajo.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionPrecioBajo.rentabilidadCarteraAnterior.rentabilidadPct - seleccionPrecioBajo.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionPrecioBajo.rentabilidadIndice.rentabilidadPct - seleccionPrecioBajo.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccionPrecioBajo.correlacionBeneficioIndice !== null && seleccionPrecioBajo.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion(nombreIndice)}{" "}
              <b>{seleccionPrecioBajo.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}


      {seleccionPrecioBajo && (
        <button
          onClick={() =>
            descargarTablaPdf({
              titulo: t.seleccionPrecioBajoTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colFecha, t.colTicker, t.colPeso, t.colPuntuacion, t.colPrecio, t.colVeces],
              filas: seleccionPrecioBajo.historico.flatMap((dia) =>
                dia.cartera.map((c) => [dia.fecha, `${tickerVisible(c.ticker)} — ${nombresEmpresas[c.ticker]}`, `${c.peso}%`, c.puntuacion, c.precio, c.vecesSeleccionado])
              ),
              nombreArchivo: `seleccion-precio-bajo-${indice.id}.pdf`,
            })
          }
          style={{ marginTop: 12 }}
        >
          {t.descargarPdfBoton}
        </button>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionVolumenBajoTitulo}</h2>
      <p>{t.seleccionVolumenBajoDesc(nComponentes, pesoMaximo)}</p>
      <button onClick={realizarSeleccionVolumenBajo} disabled={bloqueadoPorDiasEfectivos || cargandoSeleccionVolumenBajo}>
        {cargandoSeleccionVolumenBajo ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>

      {errorSeleccionVolumenBajo && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionVolumenBajo}</p>}

      {seleccionVolumenBajo && (
        <div style={{ marginTop: 20 }}>
          {seleccionVolumenBajo.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.indiceAbrevEtiqueta(indice.abreviatura)}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccionVolumenBajo && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccionVolumenBajo.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccionVolumenBajo.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionVolumenBajo.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionVolumenBajo.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, seleccionVolumenBajo.rentabilidadIndice.fechaInicio, seleccionVolumenBajo.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionVolumenBajo.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionVolumenBajo.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionVolumenBajo.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionVolumenBajo.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionVolumenBajo.rentabilidadCarteraAnterior.rentabilidadPct - seleccionVolumenBajo.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionVolumenBajo.rentabilidadIndice.rentabilidadPct - seleccionVolumenBajo.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccionVolumenBajo.correlacionBeneficioIndice !== null && seleccionVolumenBajo.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion(nombreIndice)}{" "}
              <b>{seleccionVolumenBajo.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}


      {seleccionVolumenBajo && (
        <button
          onClick={() =>
            descargarTablaPdf({
              titulo: t.seleccionVolumenBajoTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colFecha, t.colTicker, t.colPeso, t.colPuntuacion, t.colPrecio, t.colVeces],
              filas: seleccionVolumenBajo.historico.flatMap((dia) =>
                dia.cartera.map((c) => [dia.fecha, `${tickerVisible(c.ticker)} — ${nombresEmpresas[c.ticker]}`, `${c.peso}%`, c.puntuacion, c.precio, c.vecesSeleccionado])
              ),
              nombreArchivo: `seleccion-volumen-bajo-${indice.id}.pdf`,
            })
          }
          style={{ marginTop: 12 }}
        >
          {t.descargarPdfBoton}
        </button>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionFlujoBajoTitulo}</h2>
      <p>{t.seleccionFlujoBajoDesc(nComponentes, pesoMaximo)}</p>
      <button onClick={realizarSeleccionFlujoBajo} disabled={bloqueadoPorDiasEfectivos || cargandoSeleccionFlujoBajo}>
        {cargandoSeleccionFlujoBajo ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>

      {errorSeleccionFlujoBajo && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionFlujoBajo}</p>}

      {seleccionFlujoBajo && (
        <div style={{ marginTop: 20 }}>
          {seleccionFlujoBajo.historico.map((dia, i) => (
            <div key={i} style={{ marginBottom: 28, borderBottom: "1px solid #ddd", paddingBottom: 16 }}>
              <strong>{dia.fecha}</strong>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraAnterior}</em>
                  {dia.carteraAntes ? (
                    <>
                      <p style={{ margin: "4px 0" }}>
                        {t.beneficioSinCambio}{" "}
                        <b style={{ color: dia.beneficioSinCambio >= 1 ? "green" : "crimson" }}>
                          {((dia.beneficioSinCambio - 1) * 100).toFixed(3)}%
                        </b>
                      </p>
                      <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                        <thead>
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                        </thead>
                        <tbody>
                          {dia.carteraAntes.map((c) => (
                            <tr key={c.ticker}>
                              <td>{c.ticker}</td>
                              <td>{c.peso}%</td>
                              <td>{c.puntuacion}</td>
                              <td>{c.precio}</td>
                              <td>{c.vecesSeleccionado}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>{t.primeraSeleccion}</p>
                  )}
                </div>

                <div style={{ flex: "1 1 220px" }}>
                  <em>{t.carteraSeleccionada}{dia.rebalanceado === false ? t.sinCambiosEtiqueta : ""}</em>
                  <p style={{ margin: "4px 0" }}>
                    {t.beneficio}{" "}
                    <b style={{ color: dia.beneficio >= 1 ? "green" : "crimson" }}>
                      {((dia.beneficio - 1) * 100).toFixed(3)}%
                    </b>
                    {dia.incrementoIndice !== null && dia.incrementoIndice !== undefined && (
                      <>
                        {" — "}{t.indiceAbrevEtiqueta(indice.abreviatura)}{" "}
                        <b style={{ color: dia.incrementoIndice >= 0 ? "green" : "crimson" }}>
                          {dia.incrementoIndice.toFixed(3)}%
                        </b>
                      </>
                    )}
                  </p>
                  <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85em" }}>
                    <thead>
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
                    </thead>
                    <tbody>
                      {dia.cartera.map((c) => (
                        <tr key={c.ticker}>
                          <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                          <td>{c.peso}%</td>
                          <td>{c.puntuacion}</td>
                          <td>{c.precio}</td>
                          <td>{c.vecesSeleccionado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dia.beneficioSinCambio !== null && (
                <p style={{ color: "#666", marginTop: 4 }}>
                  {dia.beneficio >= dia.beneficioSinCambio ? t.mejoraResultado : t.empeoraResultado}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {seleccionFlujoBajo && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccionFlujoBajo.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccionFlujoBajo.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionFlujoBajo.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionFlujoBajo.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, seleccionFlujoBajo.rentabilidadIndice.fechaInicio, seleccionFlujoBajo.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionFlujoBajo.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionFlujoBajo.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionFlujoBajo.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionFlujoBajo.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionFlujoBajo.rentabilidadCarteraAnterior.rentabilidadPct - seleccionFlujoBajo.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionFlujoBajo.rentabilidadIndice.rentabilidadPct - seleccionFlujoBajo.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccionFlujoBajo.correlacionBeneficioIndice !== null && seleccionFlujoBajo.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion(nombreIndice)}{" "}
              <b>{seleccionFlujoBajo.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}

      {seleccionFlujoBajo && (
        <button
          onClick={() =>
            descargarTablaPdf({
              titulo: t.seleccionFlujoBajoTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colFecha, t.colTicker, t.colPeso, t.colPuntuacion, t.colPrecio, t.colVeces],
              filas: seleccionFlujoBajo.historico.flatMap((dia) =>
                dia.cartera.map((c) => [dia.fecha, `${tickerVisible(c.ticker)} — ${nombresEmpresas[c.ticker]}`, `${c.peso}%`, c.puntuacion, c.precio, c.vecesSeleccionado])
              ),
              nombreArchivo: `seleccion-flujo-bajo-${indice.id}.pdf`,
            })
          }
          style={{ marginTop: 12 }}
        >
          {t.descargarPdfBoton}
        </button>
      )}
    </MenuLayout>
  );
}
