import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import BotonCompartirPdf from "../components/BotonCompartirPdf";
import { useAppConfig } from "../lib/appConfig";
import { FACTOR_PENALIZACION_DEFECTO_DISPLAY } from "../lib/i18n";
import { obtenerIndice, tickerVisible } from "../lib/indices";
import { descargarTablaPdf } from "../lib/pdfComun";

// "Parámetros técnicos para la selección de valores": la cadena
// automática (optimiza todo y selecciona de una vez, usando el
// criterio de precio) y los 5 ajustes que usan el resto de páginas de
// selección: factor de penalización, número de componentes, tope de
// diversificación, frecuencia de rebalanceo y ventana de backtest.
export default function ParametrosTecnicos() {
  const {
    t,
    idioma,
    indiceId,
    factorPenalizacion,
    setFactorPenalizacion,
    nComponentes,
    setNComponentes,
    pesoMaximo,
    setPesoMaximo,
    frecuenciaRebalanceo,
    setFrecuenciaRebalanceo,
    diasVentana,
    setDiasVentana,
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

  const [resultadosOptimizacion, setResultadosOptimizacion] = useState(null);
  const [cargandoOptimizacion, setCargandoOptimizacion] = useState(false);
  const [errorOptimizacion, setErrorOptimizacion] = useState(null);
  const [resultadosOptimizacionN, setResultadosOptimizacionN] = useState(null);
  const [cargandoOptimizacionN, setCargandoOptimizacionN] = useState(false);
  const [errorOptimizacionN, setErrorOptimizacionN] = useState(null);
  const [resultadosOptimizacionMax, setResultadosOptimizacionMax] = useState(null);
  const [cargandoOptimizacionMax, setCargandoOptimizacionMax] = useState(false);
  const [errorOptimizacionMax, setErrorOptimizacionMax] = useState(null);
  const [resultadosOptimizacionFrecuencia, setResultadosOptimizacionFrecuencia] = useState(null);
  const [cargandoOptimizacionFrecuencia, setCargandoOptimizacionFrecuencia] = useState(false);
  const [errorOptimizacionFrecuencia, setErrorOptimizacionFrecuencia] = useState(null);
  const [mostrarAvisoDias, setMostrarAvisoDias] = useState(false);
  const [cargandoCadena, setCargandoCadena] = useState(false);
  const [errorCadena, setErrorCadena] = useState(null);
  const [resultadoCadena, setResultadoCadena] = useState(null);

  async function optimizarFactor() {
    setCargandoOptimizacion(true);
    setErrorOptimizacion(null);
    setResultadosOptimizacion(null);
    try {
      const resp = await fetch(`/api/optimizar?dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadosOptimizacion(json);
      setFactorPenalizacion(json.mejorFactor);
    } catch (e) {
      setErrorOptimizacion(e.message);
    } finally {
      setCargandoOptimizacion(false);
    }
  }

  async function optimizarNumeroComponentes() {
    setCargandoOptimizacionN(true);
    setErrorOptimizacionN(null);
    setResultadosOptimizacionN(null);
    try {
      const resp = await fetch(`/api/optimizarN?factor=${factorPenalizacion}&dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadosOptimizacionN(json);
      setNComponentes(json.mejorNComponentes);
    } catch (e) {
      setErrorOptimizacionN(e.message);
    } finally {
      setCargandoOptimizacionN(false);
    }
  }

  async function optimizarTopeDiversificacion() {
    setCargandoOptimizacionMax(true);
    setErrorOptimizacionMax(null);
    setResultadosOptimizacionMax(null);
    try {
      const resp = await fetch(`/api/optimizarMax?factor=${factorPenalizacion}&n=${nComponentes}&dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadosOptimizacionMax(json);
      setPesoMaximo(json.mejorPesoMaximo);
    } catch (e) {
      setErrorOptimizacionMax(e.message);
    } finally {
      setCargandoOptimizacionMax(false);
    }
  }

  async function optimizarFrecuenciaRebalanceo() {
    setCargandoOptimizacionFrecuencia(true);
    setErrorOptimizacionFrecuencia(null);
    setResultadosOptimizacionFrecuencia(null);
    try {
      const resp = await fetch(`/api/optimizarFrecuencia?factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultadosOptimizacionFrecuencia(json);
      setFrecuenciaRebalanceo(json.mejorFrecuenciaRebalanceo);
    } catch (e) {
      setErrorOptimizacionFrecuencia(e.message);
    } finally {
      setCargandoOptimizacionFrecuencia(false);
    }
  }

  async function ejecutarCadena() {
    setCargandoCadena(true);
    setErrorCadena(null);
    setResultadoCadena(null);
    try {
      const respOpt = await fetch(`/api/optimizar?dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const jsonOpt = await respOpt.json();
      if (!respOpt.ok) throw new Error(jsonOpt.error || "Error al optimizar el factor");

      const respOptN = await fetch(`/api/optimizarN?factor=${jsonOpt.mejorFactor}&dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const jsonOptN = await respOptN.json();
      if (!respOptN.ok) throw new Error(jsonOptN.error || "Error al optimizar el número de componentes");

      const respOptMax = await fetch(`/api/optimizarMax?factor=${jsonOpt.mejorFactor}&n=${jsonOptN.mejorNComponentes}&dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`);
      const jsonOptMax = await respOptMax.json();
      if (!respOptMax.ok) throw new Error(jsonOptMax.error || "Error al optimizar el tope de diversificación");

      const respOptFrec = await fetch(
        `/api/optimizarFrecuencia?factor=${jsonOpt.mejorFactor}&n=${jsonOptN.mejorNComponentes}&max=${jsonOptMax.mejorPesoMaximo}&dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`
      );
      const jsonOptFrec = await respOptFrec.json();
      if (!respOptFrec.ok) throw new Error(jsonOptFrec.error || "Error al optimizar la frecuencia de rebalanceo");

      const respSel = await fetch(
        `/api/seleccion?factor=${jsonOpt.mejorFactor}&n=${jsonOptN.mejorNComponentes}&max=${jsonOptMax.mejorPesoMaximo}&frecuencia=${jsonOptFrec.mejorFrecuenciaRebalanceo}&dias=${diasVentana}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`
      );
      const jsonSel = await respSel.json();
      if (!respSel.ok) throw new Error(jsonSel.error || "Error al realizar la selección");

      setResultadoCadena({
        factor: jsonOpt.mejorFactor,
        n: jsonOptN.mejorNComponentes,
        max: jsonOptMax.mejorPesoMaximo,
        frecuencia: jsonOptFrec.mejorFrecuenciaRebalanceo,
        seleccion: jsonSel,
      });

      setFactorPenalizacion(jsonOpt.mejorFactor);
      setResultadosOptimizacion(jsonOpt);
      setNComponentes(jsonOptN.mejorNComponentes);
      setResultadosOptimizacionN(jsonOptN);
      setPesoMaximo(jsonOptMax.mejorPesoMaximo);
      setResultadosOptimizacionMax(jsonOptMax);
      setFrecuenciaRebalanceo(jsonOptFrec.mejorFrecuenciaRebalanceo);
      setResultadosOptimizacionFrecuencia(jsonOptFrec);
    } catch (e) {
      setErrorCadena(e.message);
    } finally {
      setCargandoCadena(false);
    }
  }

  return (
    <MenuLayout>
      <div style={{ border: "3px solid #2d6a2d", borderRadius: 8, padding: 16, background: "#f3fff3" }}>
        <h2 style={{ marginTop: 0 }}>{t.cadenaTitulo}</h2>
        <p>{t.cadenaDesc}</p>
        <button onClick={ejecutarCadena} disabled={bloqueadoPorDiasEfectivos || cargandoCadena}>
          {cargandoCadena ? t.cadenaBotonCargando : t.cadenaBoton}
        </button>

        {errorCadena && <p style={{ color: "crimson" }}>{t.error}: {errorCadena}</p>}

        {resultadoCadena && (
          <div style={{ marginTop: 16 }}>
            <h3>{t.carteraSeleccionadaFecha(resultadoCadena.seleccion.historico[resultadoCadena.seleccion.historico.length - 1].fecha)}</h3>
            <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th><th>{t.colVeces}</th></tr>
              </thead>
              <tbody>
                {resultadoCadena.seleccion.historico[resultadoCadena.seleccion.historico.length - 1].cartera.map((c) => (
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
            {(() => {
              const opciones = {
                titulo: t.cadenaTitulo,
                subtitulo: `${nombreIndice} — ${resultadoCadena.seleccion.historico[resultadoCadena.seleccion.historico.length - 1].fecha}`,
                columnas: [t.colTicker, t.colPeso, t.colPuntuacion, t.colPrecio, t.colVeces],
                filas: resultadoCadena.seleccion.historico[resultadoCadena.seleccion.historico.length - 1].cartera.map((c) => [
                  `${tickerVisible(c.ticker)} — ${nombresEmpresas[c.ticker]}`,
                  `${c.peso}%`,
                  c.puntuacion,
                  c.precio,
                  c.vecesSeleccionado,
                ]),
                nombreArchivo: `cadena-seleccion-${indice.id}.pdf`,
              };
              return (
                <>
                  <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 8 }}>
                    {t.descargarPdfBoton}
                  </button>
                  <BotonCompartirPdf opciones={opciones} />
                </>
              );
            })()}

            <h3>{t.expectativaRentabilidad}</h3>
            <p style={{ fontSize: "1.2em" }}>
              {t.modelo}{" "}
              <b style={{ color: resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                {resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
              </b>
            </p>
            {resultadoCadena.seleccion.rentabilidadIndice && (
              <>
                <p style={{ fontSize: "1.2em" }}>
                  {t.indiceEtiqueta(nombreIndice)}{" "}
                  <b style={{ color: resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                    {resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                  </b>
                </p>
                <p style={{ fontWeight: "bold" }}>
                  {resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct >=
                  resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct
                    ? t.superaIndice((resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct - resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct).toFixed(3))
                    : t.quedaPorDebajo((resultadoCadena.seleccion.rentabilidadIndice.rentabilidadPct - resultadoCadena.seleccion.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
                </p>
              </>
            )}
            <p style={{ fontSize: "0.85em", color: "#666" }}>
              {t.cadenaPie(resultadoCadena.factor, resultadoCadena.n, resultadoCadena.max, resultadoCadena.frecuencia)}
            </p>
          </div>
        )}
      </div>


      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optFactorTitulo}</h2>
      <p>{t.optFactorDesc(FACTOR_PENALIZACION_DEFECTO_DISPLAY)}</p>
      <button onClick={optimizarFactor} disabled={bloqueadoPorDiasEfectivos || cargandoOptimizacion}>
        {cargandoOptimizacion ? t.optFactorBotonCargando : t.optFactorBoton}
      </button>

      {errorOptimizacion && <p style={{ color: "crimson" }}>{t.error}: {errorOptimizacion}</p>}

      <p style={{ marginTop: 8 }}>
        {t.factorUsado} <b>{factorPenalizacion}</b>
        {resultadosOptimizacion && t.calculadoAuto}
      </p>

      {resultadosOptimizacion && (
        <details style={{ marginTop: 8 }}>
          <summary>{t.verFactoresProbados}</summary>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", marginTop: 4 }}>
            <thead>
              <tr><th>{t.colFactor}</th><th>{t.colSumaBeneficio}</th></tr>
            </thead>
            <tbody>
              {resultadosOptimizacion.resultados.map((r) => (
                <tr key={r.factor} style={r.factor === resultadosOptimizacion.mejorFactor ? { fontWeight: "bold", background: "#e6ffe6" } : {}}>
                  <td>{r.factor}</td>
                  <td>{r.sumaBeneficioSinCambio}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(() => {
            const opciones = {
                titulo: t.optFactorTitulo,
                subtitulo: nombreIndice,
                columnas: [t.colFactor, t.colSumaBeneficio],
                filas: resultadosOptimizacion.resultados.map((r) => [r.factor, r.sumaBeneficioSinCambio]),
                nombreArchivo: `optimizar-factor-${indice.id}.pdf`,
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 8 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
        </details>
      )}


      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optNTitulo}</h2>
      <p>{t.optNDesc}</p>
      <button onClick={optimizarNumeroComponentes} disabled={bloqueadoPorDiasEfectivos || cargandoOptimizacionN}>
        {cargandoOptimizacionN ? t.optNBotonCargando : t.optNBoton}
      </button>

      {errorOptimizacionN && <p style={{ color: "crimson" }}>{t.error}: {errorOptimizacionN}</p>}

      <p style={{ marginTop: 8 }}>
        {t.nUsado} <b>{nComponentes}</b>
        {resultadosOptimizacionN && t.calculadoAuto}
      </p>

      {resultadosOptimizacionN && (
        <details style={{ marginTop: 8 }}>
          <summary>{t.verNumerosProbados}</summary>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", marginTop: 4 }}>
            <thead>
              <tr><th>{t.colNComponentes}</th><th>{t.colSumaBeneficio}</th></tr>
            </thead>
            <tbody>
              {resultadosOptimizacionN.resultados.map((r) => (
                <tr key={r.nComponentes} style={r.nComponentes === resultadosOptimizacionN.mejorNComponentes ? { fontWeight: "bold", background: "#e6ffe6" } : {}}>
                  <td>{r.nComponentes}</td>
                  <td>{r.sumaBeneficioSinCambio}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(() => {
            const opciones = {
                titulo: t.optNTitulo,
                subtitulo: nombreIndice,
                columnas: [t.colNComponentes, t.colSumaBeneficio],
                filas: resultadosOptimizacionN.resultados.map((r) => [r.nComponentes, r.sumaBeneficioSinCambio]),
                nombreArchivo: `optimizar-n-${indice.id}.pdf`,
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 8 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
        </details>
      )}


      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optMaxTitulo}</h2>
      <p>{t.optMaxDesc}</p>
      <button onClick={optimizarTopeDiversificacion} disabled={bloqueadoPorDiasEfectivos || cargandoOptimizacionMax}>
        {cargandoOptimizacionMax ? t.optMaxBotonCargando : t.optMaxBoton}
      </button>

      {errorOptimizacionMax && <p style={{ color: "crimson" }}>{t.error}: {errorOptimizacionMax}</p>}

      <p style={{ marginTop: 8 }}>
        {t.maxUsado} <b>{pesoMaximo}%</b>
        {resultadosOptimizacionMax && t.calculadoAuto}
      </p>

      {resultadosOptimizacionMax && (
        <details style={{ marginTop: 8 }}>
          <summary>{t.verTopesProbados}</summary>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", marginTop: 4 }}>
            <thead>
              <tr><th>{t.colTopePct}</th><th>{t.colSumaBeneficio}</th></tr>
            </thead>
            <tbody>
              {resultadosOptimizacionMax.resultados.map((r) => (
                <tr key={r.pesoMaximo} style={r.pesoMaximo === resultadosOptimizacionMax.mejorPesoMaximo ? { fontWeight: "bold", background: "#e6ffe6" } : {}}>
                  <td>{r.pesoMaximo}</td>
                  <td>{r.sumaBeneficioSinCambio}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(() => {
            const opciones = {
                titulo: t.optMaxTitulo,
                subtitulo: nombreIndice,
                columnas: [t.colTopePct, t.colSumaBeneficio],
                filas: resultadosOptimizacionMax.resultados.map((r) => [r.pesoMaximo, r.sumaBeneficioSinCambio]),
                nombreArchivo: `optimizar-max-${indice.id}.pdf`,
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 8 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
        </details>
      )}


      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optFrecuenciaTitulo}</h2>
      <p>{t.optFrecuenciaDesc(indice.tickers.length)}</p>
      <button onClick={optimizarFrecuenciaRebalanceo} disabled={bloqueadoPorDiasEfectivos || cargandoOptimizacionFrecuencia}>
        {cargandoOptimizacionFrecuencia ? t.optFrecuenciaBotonCargando : t.optFrecuenciaBoton}
      </button>

      {errorOptimizacionFrecuencia && <p style={{ color: "crimson" }}>{t.error}: {errorOptimizacionFrecuencia}</p>}

      <p style={{ marginTop: 8 }}>
        {t.frecuenciaUsada}{" "}
        <select
          value={frecuenciaRebalanceo}
          onChange={(e) => {
            const v = e.target.value;
            setFrecuenciaRebalanceo(v === "diario" ? "diario" : Number(v));
            setResultadosOptimizacionFrecuencia(null);
          }}
        >
          <option value="diario">{t.frecuenciaDiaria}</option>
          {Array.from({ length: nComponentes }, (_, i) => nComponentes - 1 - i).map((k) => (
            <option key={k} value={k}>{t.frecuenciaUmbral(k)}</option>
          ))}
        </select>
        {resultadosOptimizacionFrecuencia && t.calculadoAuto}
      </p>

      {resultadosOptimizacionFrecuencia && (
        <details style={{ marginTop: 8 }}>
          <summary>{t.verFrecuenciasProbadas}</summary>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", marginTop: 4 }}>
            <thead>
              <tr><th>{t.colFrecuenciaProbada}</th><th>{t.colSumaBeneficio}</th></tr>
            </thead>
            <tbody>
              {resultadosOptimizacionFrecuencia.resultados.map((r) => (
                <tr key={r.frecuencia} style={r.frecuencia === resultadosOptimizacionFrecuencia.mejorFrecuenciaRebalanceo ? { fontWeight: "bold", background: "#e6ffe6" } : {}}>
                  <td>{r.frecuencia === "diario" ? t.frecuenciaDiaria : t.frecuenciaUmbral(r.frecuencia)}</td>
                  <td>{r.sumaBeneficioSinCambio}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(() => {
            const opciones = {
                titulo: t.optFrecuenciaTitulo,
                subtitulo: nombreIndice,
                columnas: [t.colFrecuenciaProbada, t.colSumaBeneficio],
                filas: resultadosOptimizacionFrecuencia.resultados.map((r) => [r.frecuencia === "diario" ? t.frecuenciaDiaria : t.frecuenciaUmbral(r.frecuencia), r.sumaBeneficioSinCambio]),
                nombreArchivo: `optimizar-frecuencia-${indice.id}.pdf`,
            };
            return (
              <>
                <button onClick={() => descargarTablaPdf(opciones)} style={{ marginTop: 8 }}>
                  {t.descargarPdfBoton}
                </button>
                <BotonCompartirPdf opciones={opciones} />
              </>
            );
          })()}
        </details>
      )}


      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optDiasTitulo}</h2>
      <p>{t.optDiasDesc}</p>
      <p>
        {t.diasUsado}{" "}
        <select value={diasVentana} onChange={(e) => setDiasVentana(Number(e.target.value))}>
          {[20, 30, 50, 80, 120].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>{" "}
        {avisoDiasEfectivos && (
          <button
            onClick={() => setMostrarAvisoDias((v) => !v)}
            aria-label={t.diasEfectivosAviso(diasEfectivos)}
            title={t.diasEfectivosAviso(diasEfectivos)}
            style={{
              background: "#fff3cd",
              border: "1px solid #cc9a06",
              borderRadius: "50%",
              width: 22,
              height: 22,
              lineHeight: "20px",
              padding: 0,
              cursor: "pointer",
              fontWeight: "bold",
              fontStyle: "italic",
              fontFamily: "serif",
              color: "#7a5c00",
            }}
          >
            i
          </button>
        )}
      </p>

      {avisoDiasEfectivos && mostrarAvisoDias && (
        <p style={{ background: "#fff3cd", border: "1px solid #cc9a06", borderRadius: 6, padding: 12, color: "#7a5c00" }}>
          {t.diasEfectivosAviso(diasEfectivos)}
        </p>
      )}

      {bloqueadoPorDiasEfectivos && (
        <p style={{ background: "#ffe0e0", border: "1px solid crimson", borderRadius: 6, padding: 12, color: "crimson" }}>
          {t.diasEfectivosBloqueo(diasVentana, sesionesPuntuacion)}
        </p>
      )}

    </MenuLayout>
  );
}
