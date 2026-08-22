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

  const [resultado, setResultado] = useState
