import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible } from "../lib/indices";
import {
  REVERSION_VENTANAS_PRESET,
  REVERSION_MAX_PEORES,
  REVERSION_MAX_EXCLUSION,
  REVERSION_PROFUNDIDAD_PRESET,
  REVERSION_PROFUNDIDAD_DEFECTO,
} from "../lib/reversionMediaConstantes";

export default function ReversionMedia() {
  const { t, idioma, indiceId } = useAppConfig();
  const indice = obtenerIndice(indiceId);
  const { nombresEmpresas } = indice;

  const [ventanaFormacion, setVentanaFormacion] = useState(5);
  const [ventanaTest, setVentanaTest] = useState(5);
  const [testIgualFormacion, setTestIgualFormacion] = useState(true);
  const [solapado, setSolapado] = useState(false);
  const [nPeores, setNPeores] = useState(3);
  const [nExclusion, setNExclusion] = useState(0);
  const [profundidad, setProfundidad] = useState(REVERSION_PROFUNDIDAD_DEFECTO);

  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  async function calcular() {
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const vTest = testIgualFormacion ? ventanaFormacion : ventanaTest;
      const resp = await fetch(
        `/api/reversionMedia?indice=${indiceId}&ventanaFormacion=${ventanaFormacion}&ventanaTest=${vTest}&solapado=${solapado}&nPeores=${nPeores}&nExclusion=${nExclusion}&profundidad=${profundidad}`
      );
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Error desconocido");
      setResultado(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <MenuLayout>
      <h2>{t.reversionMediaTitulo}</h2>
      <p>{t.reversionMediaDesc}</p>
      <p style={{ color: "#7a5c00", background: "#fff3cd", border: "1px solid #cc9a06", borderRadius: 6, padding: 12 }}>
        {t.reversionMediaAvisoComposicion}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", margin: "16px 0" }}>
        <label>
          {t.reversionMediaEtiquetaProfundidad}{" "}
          <select value={profundidad} onChange={(e) => setProfundidad(Number(e.target.value))}>
            {REVERSION_PROFUNDIDAD_PRESET.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label>
          {t.reversionMediaEtiquetaFormacion}{" "}
          <select value={ventanaFormacion} onChange={(e) => setVentanaFormacion(Number(e.target.value))}>
            {REVERSION_VENTANAS_PRESET.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label>
          <input
            type="checkbox"
            checked={testIgualFormacion}
            onChange={(e) => setTestIgualFormacion(e.target.checked)}
          />{" "}
          {t.reversionMediaEtiquetaTest} {testIgualFormacion ? `(= ${ventanaFormacion})` : ""}
        </label>
        {!testIgualFormacion && (
          <select value={ventanaTest} onChange={(e) => setVentanaTest(Number(e.target.value))}>
            {REVERSION_VENTANAS_PRESET.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}

        <label>
          {t.reversionMediaEtiquetaPeores}{" "}
          <select value={nPeores} onChange={(e) => setNPeores(Number(e.target.value))}>
            {Array.from({ length: REVERSION_MAX_PEORES }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label>
          {t.reversionMediaEtiquetaExclusion}{" "}
          <select value={nExclusion} onChange={(e) => setNExclusion(Number(e.target.value))}>
            {Array.from({ length: REVERSION_MAX_EXCLUSION + 1 }, (_, i) => i).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label>
          <input type="checkbox" checked={solapado} onChange={(e) => setSolapado(e.target.checked)} />{" "}
          {t.reversionMediaEtiquetaSolapado}
        </label>
      </div>

      <button onClick={calcular} disabled={cargando}>
        {cargando ? t.reversionMediaBotonCargando : t.reversionMediaBoton}
      </button>

      {error && <p style={{ color: "crimson" }}>{t.error}: {error}</p>}

      {resultado && resultado.nCiclos <= 1 && (
        <p style={{ background: "#ffe0e0", border: "1px solid crimson", borderRadius: 6, padding: 12, color: "crimson", marginTop: 12 }}>
          {t.reversionMediaAvisoPocosCiclos}
        </p>
      )}

      {resultado && (
        <table border="1" cellPadding="4" style={{ borderCollapse: "collapse", width: "100%", marginTop: 16, fontSize: "0.9em" }}>
          <thead>
            <tr>
              <th>{t.reversionMediaColCiclo}</th>
              <th>{t.reversionMediaColFechasFormacion}</th>
              <th>{t.reversionMediaColFechasTest}</th>
              <th>{t.reversionMediaColTicker}</th>
              <th>{t.reversionMediaColRentabilidadValor}</th>
              <th>{t.reversionMediaColRentabilidadIndice}</th>
              <th>{t.reversionMediaColDiferencia}</th>
            </tr>
          </thead>
          <tbody>
            {resultado.ciclos.flatMap((c) =>
              c.valores.map((v, i) => (
                <tr key={`${c.ciclo}-${v.ticker}`}>
                  {i === 0 && (
                    <>
                      <td rowSpan={c.valores.length}>{c.ciclo}</td>
                      <td rowSpan={c.valores.length}>{c.fechaInicioFormacion} → {c.fechaFinFormacion}</td>
                      <td rowSpan={c.valores.length}>{c.fechaInicioTest} → {c.fechaFinTest}</td>
                    </>
                  )}
                  <td>{tickerVisible(v.ticker)} — {nombresEmpresas[v.ticker]}</td>
                  <td style={{ color: v.rentabilidadTest >= 0 ? "green" : "crimson" }}>{v.rentabilidadTest}%</td>
                  <td style={{ color: v.rentabilidadIndiceTest >= 0 ? "green" : "crimson" }}>{v.rentabilidadIndiceTest}%</td>
                  <td style={{ color: v.diferencia >= 0 ? "green" : "crimson", fontWeight: "bold" }}>{v.diferencia}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </MenuLayout>
  );
        }
  );
}
