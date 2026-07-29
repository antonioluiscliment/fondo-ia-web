import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible } from "../lib/indices";

// Página HUÉRFANA a propósito: no tiene enlace en el menú hamburguesa
// (ver components/MenuLayout.js) desde la reestructuración del menú
// de selección en tres submenús. Se conserva el código por si se
// quiere recuperar más adelante, pero no aparece en la navegación.
// Sigue siendo accesible tecleando la URL directamente
// (/seleccionVeces).
//
// Contiene "Selección por número de veces seleccionado" y "Selección
// por veces seleccionado por volumen" — los dos métodos más complejos
// de selección (doble backtest para evitar sesgo de anticipación),
// cuya aportación frente a la selección directa por precio/volumen se
// consideró dudosa frente a la complejidad añadida.
export default function SeleccionVeces() {
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

  const [seleccionVeces, setSeleccionVeces] = useState(null);
  const [cargandoSeleccionVeces, setCargandoSeleccionVeces] = useState(false);
  const [errorSeleccionVeces, setErrorSeleccionVeces] = useState(null);
  const [modoVeces, setModoVeces] = useState("analisis");
  const [sesionesVeces, setSesionesVeces] = useState(10);
  const [seleccionVecesVolumen, setSeleccionVecesVolumen] = useState(null);
  const [cargandoSeleccionVecesVolumen, setCargandoSeleccionVecesVolumen] = useState(false);
  const [errorSeleccionVecesVolumen, setErrorSeleccionVecesVolumen] = useState(null);
  const [modoVecesVolumen, setModoVecesVolumen] = useState("analisis");
  const [sesionesVecesVolumen, setSesionesVecesVolumen] = useState(10);

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

  return (
    <MenuLayout>
      <h2>{t.seleccionVecesTitulo}</h2>
      <p>{modoVeces === "real" ? t.seleccionVecesDescReal(sesionesVeces) : t.seleccionVecesDescAnalisis(sesionesVeces, indice.tickers.length)}</p>

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

      <h2>{t.seleccionVecesVolumenTitulo}</h2>
      <p>{modoVecesVolumen === "real" ? t.seleccionVecesVolumenDescReal(sesionesVecesVolumen) : t.seleccionVecesVolumenDescAnalisis(sesionesVecesVolumen, indice.tickers.length)}</p>

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

    </MenuLayout>
  );
}
