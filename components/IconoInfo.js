// components/IconoInfo.js
//
// Icono "i" pequeño, reutilizable, para documentar junto a una
// sección concreta decisiones de diseño o contexto que surgieron
// durante el desarrollo — cosas que no tienen sitio natural en el
// texto descriptivo de la propia herramienta, pero que conviene que
// no se pierdan (para quien use la app, y para retomar el hilo en
// futuras sesiones).
//
// Mismo estilo que el icono (i) general del marco exterior
// (components/MenuLayout.js), pero a esta escala, junto al título de
// una sección concreta en vez de junto al título de toda la app.
//
// Uso, justo después de un <h2>:
//   <h2>{t.miSeccionTitulo} <IconoInfo>{t.miSeccionInfo}</IconoInfo></h2>

import { useState } from "react";

const estiloBoton = {
  background: "none",
  border: "1px solid #999",
  borderRadius: "50%",
  width: 22,
  height: 22,
  padding: 0,
  marginLeft: 8,
  cursor: "pointer",
  fontWeight: "bold",
  fontStyle: "italic",
  fontFamily: "serif",
  fontSize: 13,
  lineHeight: "20px",
  verticalAlign: "middle",
};

const estiloPanel = {
  border: "1px solid #9aa9bb",
  borderRadius: 6,
  padding: 12,
  margin: "8px 0 16px",
  background: "#eef2f7",
  color: "#3d4a5c",
  fontSize: "0.95em",
  fontWeight: "normal",
};

export default function IconoInfo({ children, etiqueta = "i" }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button onClick={() => setAbierto((v) => !v)} aria-label="Más información" title="Más información" style={estiloBoton}>
        {etiqueta}
      </button>
      {abierto && <div style={estiloPanel}>{children}</div>}
    </>
  );
}
