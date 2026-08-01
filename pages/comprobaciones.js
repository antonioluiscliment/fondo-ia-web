import { Fragment, useEffect, useState } from "react";
import MenuLayout from "../components/MenuLayout";
import BotonCompartirPdf from "../components/BotonCompartirPdf";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible } from "../lib/indices";
import { descargarTablaPdf } from "../lib/pdfComun";

// Grupo 2: Comprobaciones — herramientas de consulta y auditoría.
// Este grupo irá creciendo con el desarrollo de la aplicación.
export default function Comprobaciones() {
  const { t, idioma, diasVentana, indiceId, sesionesPuntuacion } = useAppConfig();
  const indice = obtenerIndice(indiceId);
  const { tickers, nombresEmpresas } = indice;

  const [ticker, setTicker] = useState(tickers[0]);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Si se cambia de índice (en el marco exterior persistente) mientras
  // se está en esta página, el ticker elegido puede dejar de existir
  // en el nuevo índice: se reinicia al primero de la lista nueva.
  useEffect(() => {
    setTicker(tickers[0]);
  }, [indiceId]);

  const [numeroSesionConsulta, setNumeroSesionConsulta] = useState(20);
  const [criterioPuntuacionConsulta, setCriterioPuntuacionConsulta] = useState("precio");
  const [resultadoPuntuaciones, setResultadoPuntuaciones] = useState(null);
  const [cargandoPuntuaciones, setCargandoPuntuaciones] = useState(false);
  const [errorPuntuaciones, setErrorPuntuaciones] = useState(null);

  const [variacionIndices, setVariacionIndices] = useState(null);
  const [cargandoVariacionIndices, setCargandoVariacionIndices] = useState(false);
  const [errorVariacionIndices, setErrorVariacionIndices] = useState(null);

  const [componentesEtf, setComponentesEtf] = useState(null);
  const [cargandoComponentesEtf, setCargandoComponentesEtf] = useState(false);
  const [errorComponentesEtf, setErrorComponentesEtf] = useState(null);

  useEffect(() => {
    setComponentesEtf(null);
    setErrorComponentesEtf(null);
  }, [indiceId]);

  const [fundamentales, setFundamentales] = useState(null);
  const [cargandoFundamentales, setCargandoFundamentales] = useState(false);
  const [errorFundamentales, setErrorFundamentales] = useState(null);

  useEffect(() => {
    setFundamentales(null);
    setErrorFundamentales(null);
  }, [indiceId]);

  const [recomendacionesAnalistas, setRecomendacionesAnalistas] = useState(null);
  const [cargandoRecomendacionesAnalistas, setCargandoRecomendacionesAnalistas] = useState(false);
  const [errorRecomendacionesAnalistas, setErrorRecomendacionesAnalistas] = useState(null);

  useEffect(() => {
    setRecomendacionesAnalistas(null);
    setErrorRecomendacionesAnalistas(null);
  }, [indiceId]);

  async function consultar() {
    setCargando(true);
    setError(null);
    setDatos(null);
    try {
      const resp = await fetch(`/api/ratios?ticker=${ticker}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setDatos(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  // Prueba de descarga en PDF: genera el PDF en el propio navegador
  // (jsPDF), con la misma tabla que ya se ve en pantalla — sin volver
  // a llamar a Yahoo Finance, usa los datos que ya están cargados.
  // Devuelve las opciones (no genera nada por sí misma) para que las
  // pueda usar tanto el botón de descargar como el de compartir.
  function opcionesPdfComprobacion() {
    if (!datos) return null;
    const nombreTicker = `${tickerVisible(datos.ticker)} — ${nombresEmpresas[datos.ticker] || ""}`;

    const filas = datos.cierres.map((c, i) => {
      const vxp = c.volumen !== undefined && c.volumen !== null ? (c.volumen * c.cierre) / 1000 : null;
      const anterior = i > 0 ? datos.cierres[i - 1] : null;
      const vxpAnterior =
        anterior && anterior.volumen !== undefined && anterior.volumen !== null
          ? (anterior.volumen * anterior.cierre) / 1000
          : null;
      return [
        c.fecha.slice(0, 10),
        c.cierre.toFixed(2),
        i > 0 ? `${(datos.ratios[i - 1].incremento * 100).toFixed(3)}%` : "",
        c.volumen !== undefined && c.volumen !== null ? c.volumen.toLocaleString() : "-",
        vxp !== null ? vxp.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-",
        vxp !== null && vxpAnterior !== null ? `${((vxp / vxpAnterior - 1) * 100).toFixed(3)}%` : "-",
      ];
    });

    return {
      titulo: t.ultimosCierres(tickerVisible(datos.ticker), datos.cierres.length),
      subtitulo: nombreTicker,
      columnas: [t.colFecha, t.colPrecio, t.colIncremento, t.colVolumen, t.colVxP, t.colVariacionVxP],
      filas,
      nombreArchivo: `${datos.ticker}-comprobacion.pdf`,
    };
  }

  async function consultarPuntuaciones() {
    setCargandoPuntuaciones(true);
    setErrorPuntuaciones(null);
    setResultadoPuntuaciones(null);
    try {
      const resp = await fetch(`/api/puntuaciones?dias=${diasVentana}&sesion=${numeroSesionConsulta}&indice=${indiceId}&sesiones=${sesionesPuntuacion}&criterio=${criterioPuntuacionConsulta}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadoPuntuaciones(json);
    } catch (e) {
      setErrorPuntuaciones(e.message);
    } finally {
      setCargandoPuntuaciones(false);
    }
  }

  async function consultarVariacionIndices() {
    setCargandoVariacionIndices(true);
    setErrorVariacionIndices(null);
    setVariacionIndices(null);
    try {
      const resp = await fetch(`/api/variacionIndices?dias=${diasVentana}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setVariacionIndices(json);
    } catch (e) {
      setErrorVariacionIndices(e.message);
    } finally {
      setCargandoVariacionIndices(false);
    }
  }

  async function consultarComponentesEtf() {
    setCargandoComponentesEtf(true);
    setErrorComponentesEtf(null);
    setComponentesEtf(null);
    try {
      const resp = await fetch(`/api/holdingsETF?indice=${indiceId}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setComponentesEtf(json);
    } catch (e) {
      setErrorComponentesEtf(e.message);
    } finally {
      setCargandoComponentesEtf(false);
    }
  }

  async function consultarFundamentales() {
    setCargandoFundamentales(true);
    setErrorFundamentales(null);
    setFundamentales(null);
    try {
      const resp = await fetch(`/api/fundamentales?indice=${indiceId}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setFundamentales(json);
    } catch (e) {
      setErrorFundamentales(e.message);
    } finally {
      setCargandoFundamentales(false);
    }
  }

  async function consultarRecomendacionesAnalistas() {
    setCargandoRecomendacionesAnalistas(true);
    setErrorRecomendacionesAnalistas(null);
    setRecomendacionesAnalistas(null);
    try {
      const resp = await fetch(`/api/recomendacionesAnalistas?indice=${indiceId}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setRecomendacionesAnalistas(json);
    } catch (e) {
      setErrorRecomendacionesAnalistas(e.message);
    } finally {
      setCargandoRecomendacionesAnalistas(false);
    }
  }

  return (
    <MenuLayout>
      <h2>{t.comprobacionTitulo}</h2>
      <p>{t.comprobacionDesc}</p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "20px 0", flexWrap: "wrap" }}>
        <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
          {tickers.map((tk) => (
            <option key={tk} value={tk}>{tickerVisible(tk)} — {nombresEmpresas[tk].slice(0, 25)}</option>
          ))}
        </select>
        <button onClick={consultar} disabled={cargando}>
          {cargando ? t.consultando : t.calcular}
        </button>
      </div>

      {error && <p style={{ color: "crimson" }}>{t.error}: {error}</p>}

      {datos && (
        <>
          <h2>{t.ultimosCierres(tickerVisible(datos.ticker), datos.cierres.length)}</h2>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>{t.colFecha}</th>
                  <th>{t.colPrecio}</th>
                  <th>{t.colIncremento}</th>
                  <th>{t.colVolumen}</th>
                  <th>{t.colVxP}</th>
                  <th>{t.colVariacionVxP}</th>
                </tr>
              </thead>
              <tbody>
                {datos.cierres.map((c, i) => {
                  const vxp = c.volumen !== undefined && c.volumen !== null ? (c.volumen * c.cierre) / 1000 : null;
                  const anterior = i > 0 ? datos.cierres[i - 1] : null;
                  const vxpAnterior =
                    anterior && anterior.volumen !== undefined && anterior.volumen !== null
                      ? (anterior.volumen * anterior.cierre) / 1000
                      : null;
                  return (
                    <tr key={i}>
                      <td>{c.fecha.slice(0, 10)}</td>
                      <td>{c.cierre.toFixed(2)}</td>
                      <td>{i > 0 ? `${(datos.ratios[i - 1].incremento * 100).toFixed(3)}%` : ""}</td>
                      <td>{c.volumen !== undefined && c.volumen !== null ? c.volumen.toLocaleString() : "-"}</td>
                      <td>{vxp !== null ? vxp.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-"}</td>
                      <td>{vxp !== null && vxpAnterior !== null ? `${((vxp / vxpAnterior - 1) * 100).toFixed(3)}%` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button onClick={() => descargarTablaPdf(opcionesPdfComprobacion())} style={{ marginTop: 12 }}>
            {t.descargarPdfBoton}
          </button>
          <BotonCompartirPdf opciones={opcionesPdfComprobacion()} />
        </>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.puntuacionesTitulo}</h2>
      <p>{t.puntuacionesDesc(sesionesPuntuacion, tickers.length)}</p>
      <p style={{ color: "#555", fontStyle: "italic" }}>{t.puntuacionesAplicabilidad}</p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
        <label>
          {t.puntuacionesEtiquetaCriterio}{" "}
          <select value={criterioPuntuacionConsulta} onChange={(e) => setCriterioPuntuacionConsulta(e.target.value)}>
            <option value="precio">{t.metodoPrecio}</option>
            <option value="volumen">{t.metodoVolumen}</option>
            <option value="flujo">{t.metodoFlujo}</option>
          </select>
        </label>
        <label>
          {t.puntuacionesEtiquetaSesion(sesionesPuntuacion + 1, diasVentana, sesionesPuntuacion)}{" "}
          <input
            type="number"
            min={sesionesPuntuacion + 1}
            max={diasVentana}
            value={numeroSesionConsulta}
            onChange={(e) => setNumeroSesionConsulta(Number(e.target.value))}
            style={{ width: 70 }}
          />
        </label>
        <button onClick={consultarPuntuaciones} disabled={cargandoPuntuaciones}>
          {cargandoPuntuaciones ? t.puntuacionesBotonCargando : t.puntuacionesBoton}
        </button>
      </div>

      {errorPuntuaciones && <p style={{ color: "crimson" }}>{t.error}: {errorPuntuaciones}</p>}

      {resultadoPuntuaciones && (
        <>
          <h3>{t.puntuacionesResultadoTitulo(resultadoPuntuaciones.fecha, resultadoPuntuaciones.numeroSesion)}</h3>
          <p style={{ color: "#555" }}>
            {t.puntuacionesEtiquetaCriterio}{" "}
            {resultadoPuntuaciones.criterioPuntuacion === "volumen"
              ? t.metodoVolumen
              : resultadoPuntuaciones.criterioPuntuacion === "flujo"
              ? t.metodoFlujo
              : t.metodoPrecio}
          </p>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {resultadoPuntuaciones.puntuaciones.map((p) => (
                <tr key={p.ticker}>
                  <td>{tickerVisible(p.ticker)} — {nombresEmpresas[p.ticker]}</td>
                  <td>{p.puntuacion}</td>
                  <td>{p.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(() => {
            const opciones = {
              titulo: t.puntuacionesResultadoTitulo(resultadoPuntuaciones.fecha, resultadoPuntuaciones.numeroSesion),
              columnas: [t.colTicker, t.colPuntuacion, t.colPrecio],
              filas: resultadoPuntuaciones.puntuaciones.map((p) => [
                `${tickerVisible(p.ticker)} — ${nombresEmpresas[p.ticker]}`,
                p.puntuacion,
                p.precio,
              ]),
              nombreArchivo: `puntuaciones-sesion-${resultadoPuntuaciones.numeroSesion}.pdf`,
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
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.variacionIndicesTitulo}</h2>
      <p>{t.variacionIndicesDesc}</p>

      <button onClick={consultarVariacionIndices} disabled={cargandoVariacionIndices}>
        {cargandoVariacionIndices ? t.variacionIndicesBotonCargando : t.variacionIndicesBoton}
      </button>

      {errorVariacionIndices && <p style={{ color: "crimson" }}>{t.error}: {errorVariacionIndices}</p>}

      {variacionIndices && (
        <>
          <p style={{ color: "#555", fontStyle: "italic" }}>{t.avisoScrollHorizontal}</p>
          <div style={{ overflowX: "auto" }}>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
              <thead>
                <tr>
                  {variacionIndices.indices.map((ind) => (
                    <th key={ind.id} colSpan={3}>{ind.abreviatura}</th>
                  ))}
                </tr>
                <tr>
                  {variacionIndices.indices.map((ind) => (
                    <Fragment key={ind.id}>
                      <th>{t.colFecha}</th>
                      <th>{t.colValor}</th>
                      <th>{t.colIncremento}</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: diasVentana }).map((_, fila) => (
                  <tr key={fila}>
                    {variacionIndices.indices.map((ind) => {
                      const datosIndice = variacionIndices.porIndice[ind.id];
                      const f = datosIndice && datosIndice.filas[fila];
                      if (datosIndice && datosIndice.error && fila === 0) {
                        return (
                          <td key={ind.id} colSpan={3} rowSpan={diasVentana} style={{ color: "crimson", verticalAlign: "top" }}>
                            {t.error}: {datosIndice.error}
                          </td>
                        );
                      }
                      if (datosIndice && datosIndice.error) return null;
                      return (
                        <Fragment key={ind.id}>
                          <td>{f ? f.fecha.slice(0, 10) : "-"}</td>
                          <td>{f ? f.cierre.toLocaleString() : "-"}</td>
                          <td>{f && f.incremento !== null ? `${f.incremento.toFixed(3)}%` : "-"}</td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(() => {
            const columnas = variacionIndices.indices.flatMap((ind) => [
              `${ind.abreviatura} ${t.colFecha}`,
              `${ind.abreviatura} ${t.colValor}`,
              `${ind.abreviatura} ${t.colIncremento}`,
            ]);
            const filas = Array.from({ length: diasVentana }).map((_, fila) =>
              variacionIndices.indices.flatMap((ind) => {
                const datosIndice = variacionIndices.porIndice[ind.id];
                if (datosIndice && datosIndice.error) return ["-", "-", "-"];
                const f = datosIndice && datosIndice.filas[fila];
                return [
                  f ? f.fecha.slice(0, 10) : "-",
                  f ? f.cierre.toLocaleString() : "-",
                  f && f.incremento !== null ? `${f.incremento.toFixed(3)}%` : "-",
                ];
              })
            );
            const opciones = { titulo: t.variacionIndicesTitulo, columnas, filas, nombreArchivo: "variacion-indices.pdf" };
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
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.componentesEtfTitulo}</h2>
      {indice.etfReferencia ? (
        <>
          <p>{t.componentesEtfDesc(indice.etfReferencia, indice.nombre[idioma])}</p>

          <button onClick={consultarComponentesEtf} disabled={cargandoComponentesEtf}>
            {cargandoComponentesEtf ? t.componentesEtfBotonCargando : t.componentesEtfBoton}
          </button>

          {errorComponentesEtf && <p style={{ color: "crimson" }}>{t.error}: {errorComponentesEtf}</p>}

          {componentesEtf && (
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
              <thead>
                <tr>
                  <th>{t.colTicker}</th>
                  <th>{t.colPeso}</th>
                  <th>{t.colEnNuestraLista}</th>
                </tr>
              </thead>
              <tbody>
                {componentesEtf.holdings.map((h) => (
                  <tr key={h.ticker} style={{ background: h.enNuestraLista ? "transparent" : "#ffe0e0" }}>
                    <td>{tickerVisible(h.ticker)} — {h.nombre}</td>
                    <td>{h.porcentaje}%</td>
                    <td>
                      {h.enNuestraLista
                        ? h.notaBolsa ? `${t.enNuestraListaSi} (${h.notaBolsa})` : t.enNuestraListaSi
                        : t.enNuestraListaNo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {componentesEtf && (() => {
            const opciones = {
              titulo: t.componentesEtfTitulo,
              subtitulo: `${indice.nombre[idioma]} — ${indice.etfReferencia}`,
              columnas: [t.colTicker, t.colPeso, t.colEnNuestraLista],
              filas: componentesEtf.holdings.map((h) => [
                `${tickerVisible(h.ticker)} — ${h.nombre}`,
                `${h.porcentaje}%`,
                h.enNuestraLista
                  ? h.notaBolsa
                    ? `${t.enNuestraListaSi} (${h.notaBolsa})`
                    : t.enNuestraListaSi
                  : t.enNuestraListaNo,
              ]),
              nombreArchivo: `componentes-etf-${indice.id}.pdf`,
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

      <h2>{t.fundamentalesTitulo}</h2>
      <p>{t.fundamentalesDesc}</p>

      <button onClick={consultarFundamentales} disabled={cargandoFundamentales}>
        {cargandoFundamentales ? t.fundamentalesBotonCargando : t.fundamentalesBoton}
      </button>

      {errorFundamentales && <p style={{ color: "crimson" }}>{t.error}: {errorFundamentales}</p>}

      {fundamentales && (
        <div style={{ overflowX: "auto" }}>
          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
            <thead>
              <tr>
                <th>{t.colTicker}</th>
                <th>{t.colPER}</th>
                <th>{t.colPERFuturo}</th>
                <th>{t.colEPS}</th>
                <th>{t.colEPSFuturo}</th>
                <th>{t.colPVC}</th>
                <th>{t.colDividendo}</th>
                <th>{t.colPrecioActual}</th>
                <th>{t.colVariacionDia}</th>
                <th>{t.colMax52}</th>
                <th>{t.colMin52}</th>
              </tr>
            </thead>
            <tbody>
              {fundamentales.filas.map((f) => (
                <tr key={f.ticker}>
                  <td>{tickerVisible(f.ticker)} — {f.nombre}</td>
                  <td>{f.trailingPE !== null ? f.trailingPE.toFixed(2) : t.nd}</td>
                  <td>{f.forwardPE !== null ? f.forwardPE.toFixed(2) : t.nd}</td>
                  <td>{f.epsTrailingTwelveMonths !== null ? f.epsTrailingTwelveMonths.toFixed(2) : t.nd}</td>
                  <td>{f.epsForward !== null ? f.epsForward.toFixed(2) : t.nd}</td>
                  <td>{f.priceToBook !== null ? f.priceToBook.toFixed(2) : t.nd}</td>
                  <td>{f.dividendYield !== null ? `${f.dividendYield.toFixed(2)}%` : t.nd}</td>
                  <td>{f.regularMarketPrice !== null ? f.regularMarketPrice.toFixed(2) : t.nd}</td>
                  <td style={{ color: f.regularMarketChangePercent === null ? "inherit" : f.regularMarketChangePercent >= 0 ? "green" : "crimson" }}>
                    {f.regularMarketChangePercent !== null ? `${f.regularMarketChangePercent.toFixed(2)}%` : t.nd}
                  </td>
                  <td>{f.fiftyTwoWeekHigh !== null ? f.fiftyTwoWeekHigh.toFixed(2) : t.nd}</td>
                  <td>{f.fiftyTwoWeekLow !== null ? f.fiftyTwoWeekLow.toFixed(2) : t.nd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {fundamentales && (() => {
        const opciones = {
          titulo: t.fundamentalesTitulo,
          subtitulo: indice.nombre[idioma],
          columnas: [
            t.colTicker, t.colPER, t.colPERFuturo, t.colEPS, t.colEPSFuturo,
            t.colPVC, t.colDividendo, t.colPrecioActual, t.colVariacionDia, t.colMax52, t.colMin52,
          ],
          filas: fundamentales.filas.map((f) => [
            `${tickerVisible(f.ticker)} — ${f.nombre}`,
            f.trailingPE !== null ? f.trailingPE.toFixed(2) : t.nd,
            f.forwardPE !== null ? f.forwardPE.toFixed(2) : t.nd,
            f.epsTrailingTwelveMonths !== null ? f.epsTrailingTwelveMonths.toFixed(2) : t.nd,
            f.epsForward !== null ? f.epsForward.toFixed(2) : t.nd,
            f.priceToBook !== null ? f.priceToBook.toFixed(2) : t.nd,
            f.dividendYield !== null ? `${f.dividendYield.toFixed(2)}%` : t.nd,
            f.regularMarketPrice !== null ? f.regularMarketPrice.toFixed(2) : t.nd,
            f.regularMarketChangePercent !== null ? `${f.regularMarketChangePercent.toFixed(2)}%` : t.nd,
            f.fiftyTwoWeekHigh !== null ? f.fiftyTwoWeekHigh.toFixed(2) : t.nd,
            f.fiftyTwoWeekLow !== null ? f.fiftyTwoWeekLow.toFixed(2) : t.nd,
          ]),
          nombreArchivo: `datos-fundamentales-${indice.id}.pdf`,
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

      <h2>{t.recomendacionesAnalistasTitulo}</h2>
      <p>{t.recomendacionesAnalistasDesc}</p>
      {indice.tickers.length > 60 && (
        <p style={{ background: "#fff3cd", border: "1px solid #cc9a06", borderRadius: 6, padding: 12, color: "#7a5c00" }}>
          {t.recomendacionesAnalistasAvisoIndiceGrande(indice.tickers.length)}
        </p>
      )}

      <button onClick={consultarRecomendacionesAnalistas} disabled={cargandoRecomendacionesAnalistas}>
        {cargandoRecomendacionesAnalistas ? t.recomendacionesAnalistasBotonCargando : t.recomendacionesAnalistasBoton}
      </button>

      {errorRecomendacionesAnalistas && <p style={{ color: "crimson" }}>{t.error}: {errorRecomendacionesAnalistas}</p>}

      {recomendacionesAnalistas && (
        <div style={{ overflowX: "auto" }}>
          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
            <thead>
              <tr>
                <th>{t.colTicker}</th>
                <th>{t.colConsenso}</th>
                <th>{t.colNumAnalistas}</th>
              </tr>
            </thead>
            <tbody>
              {recomendacionesAnalistas.filas.map((f) => (
                <tr key={f.ticker}>
                  <td>{tickerVisible(f.ticker)} — {f.nombre}</td>
                  <td>
                    {f.recommendationMean !== null
                      ? `${f.recommendationMean.toFixed(2)}${f.recommendationKey ? ` (${f.recommendationKey})` : ""}`
                      : t.nd}
                  </td>
                  <td>{f.numeroAnalistas !== null ? f.numeroAnalistas : t.nd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {recomendacionesAnalistas && (() => {
        const opciones = {
          titulo: t.recomendacionesAnalistasTitulo,
          subtitulo: indice.nombre[idioma],
          columnas: [t.colTicker, t.colConsenso, t.colNumAnalistas],
          filas: recomendacionesAnalistas.filas.map((f) => [
            `${tickerVisible(f.ticker)} — ${f.nombre}`,
            f.recommendationMean !== null
              ? `${f.recommendationMean.toFixed(2)}${f.recommendationKey ? ` (${f.recommendationKey})` : ""}`
              : t.nd,
            f.numeroAnalistas !== null ? f.numeroAnalistas : t.nd,
          ]),
          nombreArchivo: `recomendaciones-analistas-${indice.id}.pdf`,
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
    </MenuLayout>
  );
}
