import { createContext, useContext, useState } from "react";
import { T } from "./i18n";
import { INDICE_DEFECTO } from "./indices";

// Estado compartido entre las páginas de la aplicación (se mantiene
// mientras se navega entre ellas con el menú, dentro de la misma
// sesión del navegador; se reinicia con una recarga completa, igual
// que cualquier otro estado de React).
//
// Aquí solo vive lo que hace falta en más de un grupo de páginas:
//  - idioma: usado en la cabecera y en todas las páginas.
//  - indiceId: el índice a analizar (Dow Jones, IBEX 35, ...); se
//    elige en el marco exterior persistente (junto al idioma) y lo
//    usan todas las páginas.
//  - factorPenalizacion / nComponentes / pesoMaximo / frecuenciaRebalanceo:
//    se ajustan en "Formas de seleccionar los valores" pero también
//    los usa "Análisis" (el análisis de correlación).
//  - diasVentana: se ajusta en "Formas de seleccionar los valores"
//    pero también lo usa "Comprobaciones" (puntuaciones de una sesión).
//  - sesionesPuntuacion: nº de últimas sesiones cuya suma de
//    incrementos forma la puntuación de cada componente (3 por
//    defecto; también puede ser 5, 8 o 13). Se elige en el marco
//    exterior persistente porque afecta a "Formas de seleccionar los
//    valores" (todos los métodos de selección), "Comprobaciones"
//    (puntuaciones de una sesión) y "Análisis" (análisis de
//    correlación) por igual.
//
// El resto de estado (resultados de cada cálculo, formularios locales,
// etc.) vive dentro de cada página, no aquí.

const AppConfigContext = createContext(null);

export function AppConfigProvider({ children }) {
  const [idioma, setIdioma] = useState("es");
  const [indiceId, setIndiceId] = useState(INDICE_DEFECTO);

  const [factorPenalizacion, setFactorPenalizacion] = useState(2);
  const [nComponentes, setNComponentes] = useState(5);
  const [pesoMaximo, setPesoMaximo] = useState(40);
  const [frecuenciaRebalanceo, setFrecuenciaRebalanceo] = useState("diario");
  const [diasVentana, setDiasVentana] = useState(20); // valor de partida
  const [sesionesPuntuacion, setSesionesPuntuacion] = useState(3); // valor de partida; opciones: 3, 5, 8, 13

  const value = {
    idioma,
    setIdioma,
    t: T[idioma],
    indiceId,
    setIndiceId,
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
    setSesionesPuntuacion,
  };

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    throw new Error("useAppConfig debe usarse dentro de <AppConfigProvider>");
  }
  return ctx;
}
