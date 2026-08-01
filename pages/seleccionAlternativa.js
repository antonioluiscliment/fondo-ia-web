import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import BotonCompartirPdf from "../components/BotonCompartirPdf";
import IconoInfo from "../components/IconoInfo";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible } from "../lib/indices";
import { descargarTablaPdf } from "../lib/pdfComun";

// "Selección de cartera por criterios alternativos": selección
// aleatoria (referencia estadística), por mejor fundamental (para
// todos los índices) y siguiendo el consenso de los analistas (para
// el índice elegido).
export default function SeleccionAlternativa() {
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

  const diasEfectivos = diasVentana - sesionesPuntuacion;
  const bloqueadoPorDiasEfectivos = diasEfectivos <= 0;

  const [seleccionAleatoria, setSeleccionAleatoria] = useState(null);
  const [cargandoSeleccionAleatoria, setCargandoSeleccionAleatoria] = useState(false);
  const [errorSeleccionAleatoria, setErrorSeleccionAleatoria] = useState(null);
  const [criterioFundamental, setCriterioFundamental] = useState("per");
  const [mejorFundamental, setMejorFundamental] = useState(null);
  const [cargandoMejorFundamental, setCargandoMejorFundamental] = useState(false);
  const [errorMejorFundamental, setErrorMejorFundamental] = useState(null);
  const [mejorAnalistas, setMejorAnalistas] = useState(null);
  const [cargandoMejorAnalistas, setCargandoMejorAnalistas] = useState(false);
  const [errorMejorAnalistas, setErrorMejorAnalistas] = useState(null);

  const [multifactor, setMultifactor] = useState(null);
  const [cargandoMultifactor, setCargandoMultifactor] = useState(false);
  const [errorMultifactor, setErrorMultifactor] = useState(null);

  async function realizarSeleccionAleatoria() {
    setCargandoSeleccionAleatoria(true);
    setErrorSeleccionAleatoria(null);
    setSeleccionAleatoria(null);
    try {
      const resp = await fetch(`/api/seleccion?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&dias=${diasVentana}&criterio=aleatorio&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionAleatoria(json);
    } catch (e) {
      setErrorSeleccionAleatoria(e.message);
    } finally {
      setCargandoSeleccionAleatoria(false);
    }
  }

  async function realizarMejorFundamental() {
    setCargandoMejorFundamental(true);
    setErrorMejorFundamental(null);
    setMejorFundamental(null);
    try {
      const resp = await fetch(`/api/mejorFundamentalActual?criterio=${criterioFundamental}&max=${pesoMaximo}&dias=${diasVentana}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setMejorFundamental(json);
    } catch (e) {
      setErrorMejorFundamental(e.message);
    } finally {
      setCargandoMejorFundamental(false);
    }
  }

  async function realizarMejorAnalistas() {
    setCargandoMejorAnalistas(true);
    setErrorMejorAnalistas(null);
    setMejorAnalistas(null);
    try {
      const resp = await fetch(`/api/mejorAnalistas?indice=${indiceId}&max=${pesoMaximo}&dias=${diasVentana}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setMejorAnalistas(json);
    } catch (e) {
      setErrorMejorAnalistas(e.message);
    } finally {
      setCargandoMejorAnalistas(false);
    }
  }

  async function realizarMultifactor() {
    setCargandoMultifactor(true);
    setErrorMultifactor(null);
    setMultifactor(null);
    try {
      const resp = await fetch(`/api/multifactor?indice=${indiceId}&sesiones=${sesionesPuntuacion}&max=${pesoMaximo}&n=${nComponentes}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setMultifactor(json);
    } catch (e) {
      setErrorMultifactor(e.message);
    } finally {
      setCargandoMultifactor(false);
    }
  }

  return (
    <MenuLayout>
      <h2>{t.seleccionAleatoriaTitulo}</h2>
      <p>{t.seleccionAleatoriaDesc(nComponentes, pesoMaximo)}</p>
      <button onClick={realizarSeleccionAleatoria} disabled={bloqueadoPorDiasEfectivos || cargandoSeleccionAleatoria}>
        {cargandoSeleccionAleatoria ? t.seleccionBotonCargando : t.seleccionBoton}
      </button>

      {errorSeleccionAleatoria && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionAleatoria}</p>}

      {seleccionAleatoria && (
        <div style={{ marginTop: 20 }}>
          {seleccionAleatoria.historico.map((dia, i) => (
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
                          <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colAleatorio}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
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
                      <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colAleatorio}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
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

      {seleccionAleatoria && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{t.resumenTitulo}</h3>
          <p>{t.resumenDesc(seleccionAleatoria.rentabilidadCarteraAnterior.nDias)}</p>
          <p style={{ fontSize: "1.2em" }}>
            {t.carteraDelModelo}{" "}
            <b style={{ color: seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionAleatoria.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, seleccionAleatoria.rentabilidadIndice.fechaInicio, seleccionAleatoria.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionAleatoria.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionAleatoria.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionAleatoria.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct - seleccionAleatoria.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionAleatoria.rentabilidadIndice.rentabilidadPct - seleccionAleatoria.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {seleccionAleatoria.correlacionBeneficioIndice !== null && seleccionAleatoria.correlacionBeneficioIndice !== undefined && (
            <p>
              {t.coeficienteCorrelacion(nombreIndice)}{" "}
              <b>{seleccionAleatoria.correlacionBeneficioIndice.toFixed(3)}</b>
            </p>
          )}
        </div>
      )}

      {seleccionAleatoria && (() => {
        const opciones = {
              titulo: t.seleccionAleatoriaTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colFecha, t.colTicker, t.colPeso, t.colAleatorio, t.colPrecio, t.colVeces],
              filas: seleccionAleatoria.historico.flatMap((dia) =>
                dia.cartera.map((c) => [dia.fecha, `${tickerVisible(c.ticker)} — ${nombresEmpresas[c.ticker]}`, `${c.peso}%`, c.puntuacion, c.precio, c.vecesSeleccionado])
              ),
              nombreArchivo: `seleccion-aleatoria-${indice.id}.pdf`,
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

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.mejorFundamentalTitulo}</h2>
      <IconoInfo>{t.mejorFundamentalInfo}</IconoInfo>
      <p>{t.mejorFundamentalDesc}</p>
      <p>
        {t.mejorFundamentalCriterioEtiqueta}{" "}
        <select value={criterioFundamental} onChange={(e) => setCriterioFundamental(e.target.value)}>
          <option value="per">{t.colPER}</option>
          <option value="perFuturo">{t.colPERFuturo}</option>
          <option value="eps">{t.mejorFundamentalOpcionEps}</option>
          <option value="epsFuturo">{t.mejorFundamentalOpcionEpsFuturo}</option>
          <option value="pvc">{t.colPVC}</option>
          <option value="dividendo">{t.colDividendo}</option>
        </select>
      </p>
      <button onClick={realizarMejorFundamental} disabled={cargandoMejorFundamental}>
        {cargandoMejorFundamental ? t.mejorFundamentalBotonCargando : t.mejorFundamentalBoton}
      </button>

      {errorMejorFundamental && <p style={{ color: "crimson" }}>{t.error}: {errorMejorFundamental}</p>}

      {mejorFundamental && mejorFundamental.resultados.map((r) => (
        <div key={r.indice} style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <h3 style={{ marginTop: 0 }}>{r.nombreIndice}</h3>

          {r.error ? (
            <p style={{ color: "crimson" }}>{t.error}: {r.error}</p>
          ) : r.insuficiente ? (
            <p style={{ background: "#eef2f7", border: "1px solid #9aa9bb", borderRadius: 6, padding: 12, color: "#3d4a5c" }}>
              {r.mensaje}
            </p>
          ) : (
            <>
              <p>{t.mejorFundamentalNComponentes(r.nComponentes)}</p>
              <div style={{ overflowX: "auto" }}>
                <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th>{t.colTicker}</th>
                      <th>{t.colValorCriterio}</th>
                      <th>{t.colRentabilidadPeriodo}</th>
                      <th>{t.colPeso}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.cartera.map((c) => (
                      <tr key={c.ticker}>
                        <td>{tickerVisible(c.ticker)} — {c.nombre}</td>
                        <td>{c.valor.toFixed(2)}{(criterioFundamental === "eps" || criterioFundamental === "epsFuturo") ? "%" : ""}</td>
                        <td style={{ color: c.retornoPeriodoPct >= 0 ? "green" : "crimson" }}>{c.retornoPeriodoPct.toFixed(2)}%</td>
                        <td>{c.peso}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {r.excluidos.length > 0 && (
                <p style={{ color: "#555", fontStyle: "italic" }}>{t.mejorFundamentalExcluidos(r.excluidos.length)}</p>
              )}

              <h4 style={{ marginTop: 16 }}>{t.expectativaRentabilidad}</h4>
              <p style={{ fontSize: "1.2em" }}>
                {t.modelo}{" "}
                <b style={{ color: r.rentabilidadCartera.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {r.rentabilidadCartera.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              {r.rentabilidadIndice && (
                <>
                  <p style={{ fontSize: "1.2em" }}>
                    {t.indiceFechas(r.nombreIndice, r.rentabilidadIndice.fechaInicio, r.rentabilidadIndice.fechaFin)}{" "}
                    <b style={{ color: r.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                      {r.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                    </b>
                  </p>
                  <p style={{ fontWeight: "bold" }}>
                    {r.rentabilidadCartera.rentabilidadPct >= r.rentabilidadIndice.rentabilidadPct
                      ? t.superaIndice((r.rentabilidadCartera.rentabilidadPct - r.rentabilidadIndice.rentabilidadPct).toFixed(3))
                      : t.quedaPorDebajo((r.rentabilidadIndice.rentabilidadPct - r.rentabilidadCartera.rentabilidadPct).toFixed(3))}
                  </p>
                </>
              )}
              <button
                onClick={() =>
                  descargarTablaPdf({
                    titulo: t.mejorFundamentalTitulo,
                    subtitulo: r.nombreIndice,
                    columnas: [t.colTicker, t.colValorCriterio, t.colRentabilidadPeriodo, t.colPeso],
                    filas: r.cartera.map((c) => [
                      `${tickerVisible(c.ticker)} — ${c.nombre}`,
                      `${c.valor.toFixed(2)}${(criterioFundamental === "eps" || criterioFundamental === "epsFuturo") ? "%" : ""}`,
                      `${c.retornoPeriodoPct.toFixed(2)}%`,
                      `${c.peso}%`,
                    ]),
                    nombreArchivo: `mejor-fundamental-${r.indice}.pdf`,
                  })
                }
                style={{ marginTop: 12 }}
              >
                {t.descargarPdfBoton}
              </button>
              <BotonCompartirPdf
                opciones={{
                  titulo: t.mejorFundamentalTitulo,
                  subtitulo: r.nombreIndice,
                  columnas: [t.colTicker, t.colValorCriterio, t.colRentabilidadPeriodo, t.colPeso],
                  filas: r.cartera.map((c) => [
                    `${tickerVisible(c.ticker)} — ${c.nombre}`,
                    `${c.valor.toFixed(2)}${(criterioFundamental === "eps" || criterioFundamental === "epsFuturo") ? "%" : ""}`,
                    `${c.retornoPeriodoPct.toFixed(2)}%`,
                    `${c.peso}%`,
                  ]),
                  nombreArchivo: `mejor-fundamental-${r.indice}.pdf`,
                }}
              />
            </>
          )}
        </div>
      ))}


      <hr style={{ margin: "32px 0" }} />

      <h2>{t.mejorAnalistasTitulo}</h2>
      <p>{t.mejorAnalistasDesc}</p>
      {indice.tickers.length > 60 && (
        <p style={{ background: "#fff3cd", border: "1px solid #cc9a06", borderRadius: 6, padding: 12, color: "#7a5c00" }}>
          {t.mejorAnalistasAvisoIndiceGrande(indice.tickers.length)}
        </p>
      )}
      <button onClick={realizarMejorAnalistas} disabled={cargandoMejorAnalistas}>
        {cargandoMejorAnalistas ? t.mejorAnalistasBotonCargando : t.mejorAnalistasBoton}
      </button>

      {errorMejorAnalistas && <p style={{ color: "crimson" }}>{t.error}: {errorMejorAnalistas}</p>}

      {mejorAnalistas && mejorAnalistas.insuficiente && (
        <p style={{ background: "#eef2f7", border: "1px solid #9aa9bb", borderRadius: 6, padding: 12, color: "#3d4a5c" }}>
          {mejorAnalistas.mensaje}
        </p>
      )}

      {mejorAnalistas && !mejorAnalistas.insuficiente && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <p>{t.mejorFundamentalNComponentes(mejorAnalistas.nComponentes)}</p>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.colTicker}</th>
                  <th>{t.colConsenso}</th>
                  <th>{t.colNumAnalistas}</th>
                  <th>{t.colRentabilidadPeriodo}</th>
                  <th>{t.colPeso}</th>
                </tr>
              </thead>
              <tbody>
                {mejorAnalistas.cartera.map((c) => (
                  <tr key={c.ticker}>
                    <td>{tickerVisible(c.ticker)} — {c.nombre}</td>
                    <td>{c.recommendationMean.toFixed(2)}{c.recommendationKey ? ` (${c.recommendationKey})` : ""}</td>
                    <td>{c.numeroAnalistas}</td>
                    <td style={{ color: c.retornoPeriodoPct >= 0 ? "green" : "crimson" }}>{c.retornoPeriodoPct.toFixed(2)}%</td>
                    <td>{c.peso}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mejorAnalistas.excluidos.length > 0 && (
            <p style={{ color: "#555", fontStyle: "italic" }}>{t.mejorAnalistasExcluidos(mejorAnalistas.excluidos.length)}</p>
          )}

          <h3 style={{ marginTop: 16 }}>{t.expectativaRentabilidad}</h3>
          <p style={{ fontSize: "1.2em" }}>
            {t.modelo}{" "}
            <b style={{ color: mejorAnalistas.rentabilidadCartera.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {mejorAnalistas.rentabilidadCartera.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {mejorAnalistas.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, mejorAnalistas.rentabilidadIndice.fechaInicio, mejorAnalistas.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: mejorAnalistas.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {mejorAnalistas.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {mejorAnalistas.rentabilidadCartera.rentabilidadPct >= mejorAnalistas.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((mejorAnalistas.rentabilidadCartera.rentabilidadPct - mejorAnalistas.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((mejorAnalistas.rentabilidadIndice.rentabilidadPct - mejorAnalistas.rentabilidadCartera.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
          {(() => {
            const opciones = {
              titulo: t.mejorAnalistasTitulo,
              subtitulo: nombreIndice,
              columnas: [t.colTicker, t.colConsenso, t.colNumAnalistas, t.colRentabilidadPeriodo, t.colPeso],
              filas: mejorAnalistas.cartera.map((c) => [
                `${tickerVisible(c.ticker)} — ${c.nombre}`,
                `${c.recommendationMean.toFixed(2)}${c.recommendationKey ? ` (${c.recommendationKey})` : ""}`,
                c.numeroAnalistas,
                `${c.retornoPeriodoPct.toFixed(2)}%`,
                `${c.peso}%`,
              ]),
              nombreArchivo: `mejor-analistas-${indice.id}.pdf`,
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

      <h2>{t.multifactorTitulo}</h2>
      <IconoInfo>{t.multifactorInfo}</IconoInfo>
      <p>{t.multifactorDesc}</p>

      <button onClick={realizarMultifactor} disabled={cargandoMultifactor}>
        {cargandoMultifactor ? t.multifactorBotonCargando : t.multifactorBoton}
      </button>

      {errorMultifactor && <p style={{ color: "crimson" }}>{t.error}: {errorMultifactor}</p>}

      {multifactor && multifactor.insuficiente && (
        <p style={{ background: "#eef2f7", border: "1px solid #9aa9bb", borderRadius: 6, padding: 12, color: "#3d4a5c" }}>
          {multifactor.mensaje}
        </p>
      )}

      {multifactor && !multifactor.insuficiente && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          {multifactor.avisoMuestraPequena && (
            <p style={{ background: "#fff3cd", border: "1px solid #cc9a06", borderRadius: 6, padding: 12, color: "#7a5c00" }}>
              {t.multifactorAvisoMuestraPequena}
            </p>
          )}

          <h3 style={{ marginTop: 0 }}>{t.multifactorAjusteTitulo}</h3>
          <p>{t.multifactorFilasTitulo(multifactor.nFilasEntrenamiento, multifactor.nFilasValidacion)}</p>
          <p>{t.multifactorR2Entrenamiento(multifactor.r2Entrenamiento)}</p>
          <p style={{ fontWeight: "bold" }}>{t.multifactorR2Validacion(multifactor.r2Validacion)}</p>

          <h3>{t.multifactorPesosTitulo}</h3>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr><th>{t.colVariable}</th><th>{t.colPesoModelo}</th></tr>
              </thead>
              <tbody>
                {[
                  ["intercept", t.varIntercept],
                  ["momentumPrecio", t.varMomentumPrecio],
                  ["momentumVolumen", t.varMomentumVolumen],
                  ["momentumFlujo", t.varMomentumFlujo],
                  ["dispersion", t.varDispersion],
                  ["per", t.varPer],
                  ["epsPrecio", t.varEpsPrecio],
                  ["pvc", t.varPvc],
                  ["consenso", t.varConsenso],
                ].map(([clave, etiqueta]) => (
                  <tr key={clave}>
                    <td>{etiqueta}</td>
                    <td style={{ color: multifactor.pesos[clave] >= 0 ? "green" : "crimson" }}>{multifactor.pesos[clave].toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>{t.multifactorTitulo} — {t.expectativaRentabilidad}</h3>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.colTicker}</th>
                  <th>{t.colPuntuacionModelo}</th>
                  <th>{t.colPrecio}</th>
                  <th>{t.colPeso}</th>
                </tr>
              </thead>
              <tbody>
                {multifactor.cartera.map((c) => (
                  <tr key={c.ticker}>
                    <td>{tickerVisible(c.ticker)} — {c.nombre}</td>
                    <td style={{ color: c.puntuacionModelo >= 0 ? "green" : "crimson" }}>{c.puntuacionModelo.toFixed(3)}%</td>
                    <td>{c.precio}</td>
                    <td>{c.peso}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {multifactor.excluidos.length > 0 && (
            <p style={{ color: "#555", fontStyle: "italic" }}>{t.mejorAnalistasExcluidos(multifactor.excluidos.length)}</p>
          )}

          {(() => {
            const opciones = {
              titulo: t.multifactorTitulo,
              subtitulo: nombreIndice,
              parrafos: [
                t.multifactorFilasTitulo(multifactor.nFilasEntrenamiento, multifactor.nFilasValidacion),
                t.multifactorR2Entrenamiento(multifactor.r2Entrenamiento),
                t.multifactorR2Validacion(multifactor.r2Validacion),
              ],
              columnas: [t.colTicker, t.colPuntuacionModelo, t.colPrecio, t.colPeso],
              filas: multifactor.cartera.map((c) => [
                `${tickerVisible(c.ticker)} — ${c.nombre}`,
                `${c.puntuacionModelo.toFixed(3)}%`,
                c.precio,
                `${c.peso}%`,
              ]),
              nombreArchivo: `multifactor-${indice.id}.pdf`,
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
