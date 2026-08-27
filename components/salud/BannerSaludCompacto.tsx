"use client";

import { useEffect, useState } from "react";

interface ResumenSalud {
  total: number;
  ok: number;
  conProblemas: number;
}

export function BannerSaludCompacto() {
  const [resumen, setResumen] = useState<ResumenSalud | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/salud")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.resumen) setResumen(data.resumen);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  if (cargando || !resumen) return null;

  const bien = resumen.conProblemas === 0;

  return (
    <a
      href="/salud"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.75rem 1.1rem",
        borderRadius: "var(--radius-md)",
        marginBottom: "1.5rem",
        textDecoration: "none",
        color: "white",
        fontWeight: 600,
        background: bien ? "var(--color-success)" : "var(--color-error)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.2rem" }}>{bien ? "🟢" : "🔴"}</span>
        {bien
          ? `Todos los agentes funcionando (${resumen.ok}/${resumen.total})`
          : `${resumen.conProblemas} agente${resumen.conProblemas > 1 ? "s" : ""} con problemas`}
      </span>
      <span style={{ fontSize: "0.8rem", opacity: 0.9, whiteSpace: "nowrap" }}>Ver detalle →</span>
    </a>
  );
}
