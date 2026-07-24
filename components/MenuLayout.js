import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAppConfig } from "../lib/appConfig";

const ENLACES = [
  { href: "/", labelKey: "menuGeneral" },
  { href: "/comprobaciones", labelKey: "menuComprobaciones" },
  { href: "/seleccionValores", labelKey: "menuFormasSeleccion" },
  { href: "/analisis", labelKey: "menuAnalisis" },
];

// Icono de tres rayas (hamburguesa), dibujado a mano con <span> para no
// depender de ninguna librería de iconos.
function IconoMenu() {
  const raya = { display: "block", width: 22, height: 2.5, background: "#333", margin: "4px 0", borderRadius: 2 };
  return (
    <span style={{ display: "inline-block" }}>
      <span style={raya} />
      <span style={raya} />
      <span style={raya} />
    </span>
  );
}

export default function MenuLayout({ children }) {
  const { idioma, setIdioma, t } = useAppConfig();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const router = useRouter();

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif", padding: "16px", background: "#ffe4d6", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            aria-label={menuAbierto ? t.menuCerrar : t.menuAbrir}
            style={{
              background: "none",
              border: "1px solid #999",
              borderRadius: 6,
              padding: "6px 8px",
              cursor: "pointer",
              lineHeight: 0,
            }}
          >
            <IconoMenu />
          </button>
          <h1 style={{ margin: 0 }}>{t.titulo}</h1>
        </div>
        <div>
          {t.idiomaEtiqueta}{" "}
          <select value={idioma} onChange={(e) => setIdioma(e.target.value)}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {menuAbierto && (
        <nav
          style={{
            marginTop: 12,
            border: "1px solid #999",
            borderRadius: 8,
            background: "#fff8f3",
            overflow: "hidden",
          }}
        >
          {ENLACES.map((enlace) => {
            const activo = router.pathname === enlace.href;
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                onClick={() => setMenuAbierto(false)}
                style={{
                  display: "block",
                  padding: "12px 16px",
                  textDecoration: "none",
                  color: activo ? "#fff" : "#222",
                  background: activo ? "#2d6a2d" : "transparent",
                  borderBottom: "1px solid #eee",
                  fontWeight: activo ? "bold" : "normal",
                }}
              >
                {t[enlace.labelKey]}
              </Link>
            );
          })}
        </nav>
      )}

      <div style={{ marginTop: 16 }}>{children}</div>
    </main>
  );
}
