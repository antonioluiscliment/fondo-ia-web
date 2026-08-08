import { useState } from "react";
import MenuLayout from "../components/MenuLayout";
import BotonCompartirPdf from "../components/BotonCompartirPdf";
import { useAppConfig } from "../lib/appConfig";
import { obtenerIndice, tickerVisible } from "../lib/indices";
import { descargarTablaPdf } from "../lib/pdfComun";

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

  async function realizar() {
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const resp = await fetch(`/api/redVsRidge?indice=${indiceId}`);
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
          <li key={c.ticker}>{tickerVisible(c.ticker)} — {c.nombre}</li>
        ))}
      </ol>
    );
  }

  return (
    <MenuLayout>
      <h2>{t.menuComparacionRedNeuronal}</h2>
      <p>{t.comparacionRedNeuronalIntro}</p>

      <hr style={{ margin: "32px 0" }} />

      <h2>{t.redVsRidgeTitulo}</h2>
      <p>{t.redVsRidgeDesc}</p>

      <button onClick={realizar} disabled={cargando}>
        {cargando ? t.redVsRidgeBotonCargando : t.redVsRidgeBoton}
      </button>

      {error && <p style={{ color: "crimson" }}>{t.error}: {error}</p>}

      {resultado && (
        <div style={{ border: "2px solid #333", borderRadius: 6, padding: 16, margin: "12px 0" }}>
          <p style={{ margin: "4px 0" }}>
            {t.redVsRidgeParametros(resultado.parametros.ventana, resultado.parametros.totalSesiones, resultado.parametros.pasoRidge, resultado.parametros.pasoRed)}
          </p>
          {resultado.parametros.sesionesReducidas && (
            <p style={{ background: "#fff3cd", border: "1px solid #cc9a06", borderRadius: 6, padding: 10, color: "#7a5c00" }}>
              {t.redVsRidgeAvisoSesionesReducidas(resultado.parametros.umbralTickers, resultado.parametros.totalSesionesNormal, resultado.parametros.totalSesiones)}
            </p>
          )}
          <p style={{ margin: "4px 0" }}>{t.redVsRidgeCandidatos(resultado.candidatosValidos, resultado.excluidos)}</p>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 16 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3>{t.redVsRidgeRecomendacionRidge}</h3>
              {listaRecomendacion(resultado.ridge.recomendacionFinal)}
              <p style={{ color: "#555", fontSize: "0.9em" }}>
                {t.redVsRidgePasosInfo(resultado.ridge.pasosConRecomendacion, resultado.ridge.filasEntrenamiento)}
              </p>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h3>{t.redVsRidgeRecomendacionRed}</h3>
              {listaRecomendacion(resultado.red.recomendacionFinal)}
              <p style={{ color: "#555", fontSize: "0.9em" }}>
                {t.redVsRidgePasosInfo(resultado.red.pasosConRecomendacion, resultado.red.filasEntrenamiento)}
              </p>
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
              columnas: [t.colMetodo, t.colRecomendacion],
              filas: [
                [t.redVsRidgeRecomendacionRidge, resultado.ridge.recomendacionFinal.map((c) => `${tickerVisible(c.ticker)} — ${c.nombre}`).join(", ") || "-"],
                [t.redVsRidgeRecomendacionRed, resultado.red.recomendacionFinal.map((c) => `${tickerVisible(c.ticker)} — ${c.nombre}`).join(", ") || "-"],
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
    </MenuLayout>
  );
}
