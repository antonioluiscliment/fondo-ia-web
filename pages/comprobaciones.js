import { useEffect, useState } from "react";
import MenuLayout from "../components/MenuLayout";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible } from "../lib/indices";

// Grupo 2: Comprobaciones — herramientas de consulta y auditoría.
// Este grupo irá creciendo con el desarrollo de la aplicación.
export default function Comprobaciones() {
  const { t, diasVentana, indiceId } = useAppConfig();
  const indice = obtenerIndice(indiceId);
  const { tickers, nombresEmpresas } = indice;

  const [ticker, setTicker] = useState(tickers[0]);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Si se cambia de índice (en "Características generales") mientras
  // se está en esta página, el ticker elegido puede dejar de existir
  // en el nuevo índice: se reinicia al primero de la lista nueva.
  useEffect(() => {
    setTicker(tickers[0]);
  }, [indiceId]);

  const [numeroSesionConsulta, setNumeroSesionConsulta] = useState(20);
  const [resultadoPuntuaciones, setResultadoPuntuaciones] = useState(null);
  const [cargandoPuntuaciones, setCargandoPuntuaciones] = useState(false);
  const [errorPuntuaciones, setErrorPuntuaciones] = useState(null);

  const [variacionIndices, setVariacionIndices] = useState(null);
  const [cargandoVariacionIndices, setCargandoVariacionIndices] = useState(false);
  const [errorVariacionIndices, setErrorVariacionIndices] = useState(null);

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

  async function consultarPuntuaciones() {
    setCargandoPuntuaciones(true);
    setErrorPuntuaciones(null);
    setResultadoPuntuaciones(null);
    try {
      const resp = await fetch(`/api/puntuaciones?dias=${diasVentana}&sesion=${numeroSesionConsulta}&indice=${indiceId}`);
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
        </>
      )}

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.puntuacionesTitulo}</h2>
      <p>{t.puntuacionesDesc}</p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
        <label>
          {t.puntuacionesEtiquetaSesion(4, diasVentana)}{" "}
          <input
            type="number"
            min={4}
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
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
          <thead>
            <tr>
              <th>{t.colFecha}</th>
              <th>Dow Jones</th>
              <th>{t.colIncremento}</th>
              <th>IBEX 35</th>
              <th>{t.colIncremento}</th>
            </tr>
          </thead>
          <tbody>
            {variacionIndices.filas.map((f) => (
              <tr key={f.fecha}>
                <td>{f.fecha.slice(0, 10)}</td>
                <td>{f.dowJones.toLocaleString()}</td>
                <td>{f.incrementoDowJones !== null ? `${f.incrementoDowJones.toFixed(3)}%` : "-"}</td>
                <td>{f.ibex35.toLocaleString()}</td>
                <td>{f.incrementoIbex35 !== null ? `${f.incrementoIbex35.toFixed(3)}%` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </MenuLayout>
  );
}
