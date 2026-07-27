import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import { useAppConfig } from "../lib/appConfig";
import { FACTOR_PENALIZACION_DEFECTO_DISPLAY } from "../lib/i18n";
import { obtenerIndice, tickerVisible } from "../lib/indices";

// Página de aterrizaje ("/"): Formas de seleccionar los valores —
// cadena, penalización, número de componentes, diversificación,
// rebalanceo, ventana de backtest, selección de componentes, por
// veces seleccionado, por volumen, por flujo de dinero, veces
// seleccionado por volumen y selección aleatoria.
export default function Home() {
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

  const [seleccion, setSeleccion] = useState(null);
  const [cargandoSeleccion, setCargandoSeleccion] = useState(false);
  const [errorSeleccion, setErrorSeleccion] = useState(null);

  const [seleccionVeces, setSeleccionVeces] = useState(null);
  const [cargandoSeleccionVeces, setCargandoSeleccionVeces] = useState(false);
  const [errorSeleccionVeces, setErrorSeleccionVeces] = useState(null);
  const [modoVeces, setModoVeces] = useState("analisis");
  const [sesionesVeces, setSesionesVeces] = useState(10);

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

  const [seleccionVecesVolumen, setSeleccionVecesVolumen] = useState(null);
  const [cargandoSeleccionVecesVolumen, setCargandoSeleccionVecesVolumen] = useState(false);
  const [errorSeleccionVecesVolumen, setErrorSeleccionVecesVolumen] = useState(null);
  const [modoVecesVolumen, setModoVecesVolumen] = useState("analisis");
  const [sesionesVecesVolumen, setSesionesVecesVolumen] = useState(10);

  const [seleccionAleatoria, setSeleccionAleatoria] = useState(null);
  const [cargandoSeleccionAleatoria, setCargandoSeleccionAleatoria] = useState(false);
  const [errorSeleccionAleatoria, setErrorSeleccionAleatoria] = useState(null);

  const [criterioFundamental, setCriterioFundamental] = useState("per");
  const [mejorFundamental, setMejorFundamental] = useState(null);
  const [cargandoMejorFundamental, setCargandoMejorFundamental] = useState(false);
  const [errorMejorFundamental, setErrorMejorFundamental] = useState(null);

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

  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [mostrarAvisoDias, setMostrarAvisoDias] = useState(false);

  const [cargandoCadena, setCargandoCadena] = useState(false);
  const [errorCadena, setErrorCadena] = useState(null);
  const [resultadoCadena, setResultadoCadena] = useState(null);

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

  async function realizarSeleccionVeces() {
    setCargandoSeleccionVeces(true);
    setErrorSeleccionVeces(null);
    setSeleccionVeces(null);
    try {
      const params = `factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&sesionesVeces=${sesionesVeces}&modo=${modoVeces}&indice=${indiceId}&sesiones=${sesionesPuntuacion}`;
      const url = modoVeces === "real" ? `/api/seleccionVeces?${params}` : `/api/seleccionVeces?${params}&dias=${diasVentana}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionVeces(json);
    } catch (e) {
      setErrorSeleccionVeces(e.message);
    } finally {
      setCargandoSeleccionVeces(false);
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

  async function realizarSeleccionVecesVolumen() {
    setCargandoSeleccionVecesVolumen(true);
    setErrorSeleccionVecesVolumen(null);
    setSeleccionVecesVolumen(null);
    try {
      const params = `factor=${factorPenalizacion}&n=${nComponentes}&max=${pesoMaximo}&frecuencia=${frecuenciaRebalanceo}&sesionesVeces=${sesionesVecesVolumen}&modo=${modoVecesVolumen}&criterio=volumen&indice=${indiceId}&sesiones=${sesionesPuntuacion}`;
      const url = modoVecesVolumen === "real" ? `/api/seleccionVeces?${params}` : `/api/seleccionVeces?${params}&dias=${diasVentana}`;
      const resp = await fetch(url);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setSeleccionVecesVolumen(json);
    } catch (e) {
      setErrorSeleccionVecesVolumen(e.message);
    } finally {
      setCargandoSeleccionVecesVolumen(false);
    }
  }

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
      setSeleccion(jsonSel);
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
        </details>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.optFrecuenciaTitulo}</h2>
      <p>{t.optFrecuenciaDesc}</p>
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

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionTitulo}</h2>
      <p>{t.seleccionDesc(nComponentes, pesoMaximo)}</p>
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

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionVecesTitulo}</h2>
      <p>{modoVeces === "real" ? t.seleccionVecesDescReal(sesionesVeces) : t.seleccionVecesDescAnalisis(sesionesVeces)}</p>

      <p>
        {t.modoVecesEtiqueta}{" "}
        <select value={modoVeces} onChange={(e) => { setModoVeces(e.target.value); setSeleccionVeces(null); }}>
          <option value="analisis">{t.modoVecesAnalisis}</option>
          <option value="real">{t.modoVecesReal}</option>
        </select>
      </p>
      <p>
        {t.sesionesVecesEtiqueta}{" "}
        <select value={sesionesVeces} onChange={(e) => setSesionesVeces(Number(e.target.value))}>
          {[5, 10, 15, 20, 30].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </p>

      <button onClick={realizarSeleccionVeces} disabled={bloqueadoPorDiasEfectivos || cargandoSeleccionVeces}>
        {cargandoSeleccionVeces ? t.seleccionVecesBotonCargando : t.seleccionVecesBoton}
      </button>

      {errorSeleccionVeces && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionVeces}</p>}

      {seleccionVeces && seleccionVeces.modo === "real" && (
        <div style={{ marginTop: 16 }}>
          <h3>{t.carteraHoyTitulo(seleccionVeces.fechaReferencia)}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colVecesEnPeriodo}</th><th>{t.colPeso}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {seleccionVeces.carteraHoy.map((c) => (
                <tr key={c.ticker}>
                  <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                  <td>{c.veces}</td>
                  <td>{c.peso}%</td>
                  <td>{c.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seleccionVeces && seleccionVeces.modo !== "real" && (
        <div style={{ marginTop: 16 }}>
          <h3>{t.elegidosPorVecesTitulo}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colVecesEnPeriodo}</th></tr>
            </thead>
            <tbody>
              {seleccionVeces.elegidosPorVeces.map((e) => (
                <tr key={e.ticker}>
                  <td>{tickerVisible(e.ticker)} — {nombresEmpresas[e.ticker]}</td>
                  <td>{e.veces}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>
            {t.carteraFijaTitulo(seleccionVeces.historico[seleccionVeces.historico.length - 1].fecha)}
          </h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {seleccionVeces.historico[seleccionVeces.historico.length - 1].cartera.map((c) => (
                <tr key={c.ticker}>
                  <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                  <td>{c.peso}%</td>
                  <td>{c.puntuacion}</td>
                  <td>{c.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>{t.expectativaRentabilidad}</h3>
          <p style={{ fontSize: "1.2em" }}>
            {t.modelo}{" "}
            <b style={{ color: seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionVeces.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, seleccionVeces.rentabilidadIndice.fechaInicio, seleccionVeces.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionVeces.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionVeces.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionVeces.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct - seleccionVeces.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionVeces.rentabilidadIndice.rentabilidadPct - seleccionVeces.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionVolumenTitulo}</h2>
      <p>{t.seleccionVolumenDesc(nComponentes, pesoMaximo)}</p>
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

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.seleccionFlujoTitulo}</h2>
      <p>{t.seleccionFlujoDesc(nComponentes, pesoMaximo)}</p>
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

      <h2>{t.seleccionVecesVolumenTitulo}</h2>
      <p>{modoVecesVolumen === "real" ? t.seleccionVecesVolumenDescReal(sesionesVecesVolumen) : t.seleccionVecesVolumenDescAnalisis(sesionesVecesVolumen)}</p>

      <p>
        {t.modoVecesEtiqueta}{" "}
        <select value={modoVecesVolumen} onChange={(e) => { setModoVecesVolumen(e.target.value); setSeleccionVecesVolumen(null); }}>
          <option value="analisis">{t.modoVecesAnalisis}</option>
          <option value="real">{t.modoVecesReal}</option>
        </select>
      </p>
      <p>
        {t.sesionesVecesEtiqueta}{" "}
        <select value={sesionesVecesVolumen} onChange={(e) => setSesionesVecesVolumen(Number(e.target.value))}>
          {[5, 10, 15, 20, 30].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </p>

      <button onClick={realizarSeleccionVecesVolumen} disabled={bloqueadoPorDiasEfectivos || cargandoSeleccionVecesVolumen}>
        {cargandoSeleccionVecesVolumen ? t.seleccionVecesBotonCargando : t.seleccionVecesBoton}
      </button>

      {errorSeleccionVecesVolumen && <p style={{ color: "crimson" }}>{t.error}: {errorSeleccionVecesVolumen}</p>}

      {seleccionVecesVolumen && seleccionVecesVolumen.modo === "real" && (
        <div style={{ marginTop: 16 }}>
          <h3>{t.carteraHoyTitulo(seleccionVecesVolumen.fechaReferencia)}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colVecesEnPeriodo}</th><th>{t.colPeso}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {seleccionVecesVolumen.carteraHoy.map((c) => (
                <tr key={c.ticker}>
                  <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                  <td>{c.veces}</td>
                  <td>{c.peso}%</td>
                  <td>{c.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seleccionVecesVolumen && seleccionVecesVolumen.modo !== "real" && (
        <div style={{ marginTop: 16 }}>
          <h3>{t.elegidosPorVecesTitulo}</h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colVecesEnPeriodo}</th></tr>
            </thead>
            <tbody>
              {seleccionVecesVolumen.elegidosPorVeces.map((e) => (
                <tr key={e.ticker}>
                  <td>{tickerVisible(e.ticker)} — {nombresEmpresas[e.ticker]}</td>
                  <td>{e.veces}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>
            {t.carteraFijaTitulo(seleccionVecesVolumen.historico[seleccionVecesVolumen.historico.length - 1].fecha)}
          </h3>
          <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr><th>{t.colTicker}</th><th>{t.colPeso}</th><th>{t.colPuntuacion}</th><th>{t.colPrecio}</th></tr>
            </thead>
            <tbody>
              {seleccionVecesVolumen.historico[seleccionVecesVolumen.historico.length - 1].cartera.map((c) => (
                <tr key={c.ticker}>
                  <td>{tickerVisible(c.ticker)} — {nombresEmpresas[c.ticker]}</td>
                  <td>{c.peso}%</td>
                  <td>{c.puntuacion}</td>
                  <td>{c.precio}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>{t.expectativaRentabilidad}</h3>
          <p style={{ fontSize: "1.2em" }}>
            {t.modelo}{" "}
            <b style={{ color: seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct >= 0 ? "green" : "crimson" }}>
              {seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct.toFixed(3)}%
            </b>
          </p>
          {seleccionVecesVolumen.rentabilidadIndice && (
            <>
              <p style={{ fontSize: "1.2em" }}>
                {t.indiceFechas(nombreIndice, seleccionVecesVolumen.rentabilidadIndice.fechaInicio, seleccionVecesVolumen.rentabilidadIndice.fechaFin)}{" "}
                <b style={{ color: seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct >= 0 ? "green" : "crimson" }}>
                  {seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct.toFixed(3)}%
                </b>
              </p>
              <p style={{ fontWeight: "bold" }}>
                {seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct >= seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct
                  ? t.superaIndice((seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct - seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct).toFixed(3))
                  : t.quedaPorDebajo((seleccionVecesVolumen.rentabilidadIndice.rentabilidadPct - seleccionVecesVolumen.rentabilidadCarteraAnterior.rentabilidadPct).toFixed(3))}
              </p>
            </>
          )}
        </div>
      )}

      <hr style={{ margin: "32px 0" }} />

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

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.mejorFundamentalTitulo}</h2>
      <p>{t.mejorFundamentalDesc}</p>
      <p>
        {t.mejorFundamentalCriterioEtiqueta}{" "}
        <select value={criterioFundamental} onChange={(e) => setCriterioFundamental(e.target.value)}>
          <option value="per">{t.colPER}</option>
          <option value="perFuturo">{t.colPERFuturo}</option>
          <option value="eps">{t.colEPS}</option>
          <option value="epsFuturo">{t.colEPSFuturo}</option>
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
                        <td>{c.valor.toFixed(2)}</td>
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
            </>
          )}
        </div>
      ))}
    </MenuLayout>
  );
}
