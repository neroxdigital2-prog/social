"use client";

import { useEffect, useState } from "react";

interface ResultadoBridge {
  nombre: string;
  url: string | null;
  estado: string;
  statusHttp: number | null;
  tiempoMs: number | null;
  detalle?: string;
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  OK: "✅ OK",
  SIN_VARIABLE: "⚠️ Falta la variable en Vercel",
  SIN_SECRETO: "⚠️ Falta BRIDGE_SECRET",
  RESPUESTA_NO_JSON: "❌ No responde JSON válido",
  ERROR_RED: "❌ Error de red",
  TIMEOUT: "❌ Tardó demasiado (timeout)",
};

export function PanelSalud() {
  const [cargando, setCargando] = useState(true);
  const [resultados, setResultados] = useState<ResultadoBridge[]>([]);
  const [resumen, setResumen] = useState<{ total: number; ok: number; conProblemas: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/salud");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudo revisar el estado del sistema.");
        setCargando(false);
        return;
      }
      setResultados(data.resultados);
      setResumen(data.resumen);
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  if (cargando) {
    return <p className="text-muted">Revisando los {resultados.length || "..."} bridges, puede tardar unos segundos…</p>;
  }

  if (error) {
    return <p className="field-error">{error}</p>;
  }

  const conProblemas = resultados.filter((r) => r.estado !== "OK");
  const funcionandoBien = resultados.filter((r) => r.estado === "OK");

  return (
    <div>
      {resumen && (
        <p style={{ marginBottom: "1.25rem" }}>
          <strong>{resumen.ok}</strong> de <strong>{resumen.total}</strong> bridges funcionando correctamente.
          {resumen.conProblemas > 0 && (
            <span style={{ color: "var(--color-error)" }}> {resumen.conProblemas} con problemas.</span>
          )}
        </p>
      )}

      <button type="button" className="btn-secondary" onClick={cargar} style={{ marginBottom: "1.25rem" }}>
        Volver a revisar
      </button>

      {conProblemas.length > 0 && (
        <>
          <h3 style={{ color: "var(--color-error)" }}>Con problemas</h3>
          <div className="cal-sin-programar-lista" style={{ marginBottom: "2rem" }}>
            {conProblemas.map((r) => (
              <div key={r.nombre} className="cal-sin-programar-item" style={{ alignItems: "flex-start" }}>
                <div>
                  <strong className="cal-item-titulo">{r.nombre}</strong>
                  <div className="cal-item-tipo">
                    {ETIQUETAS_ESTADO[r.estado] || r.estado}
                    {r.statusHttp ? ` · HTTP ${r.statusHttp}` : ""}
                    {r.tiempoMs ? ` · ${r.tiempoMs}ms` : ""}
                  </div>
                  {r.detalle && <div className="cal-item-tipo" style={{ marginTop: 4 }}>{r.detalle}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>Funcionando bien ({funcionandoBien.length})</h3>
      <div className="cal-sin-programar-lista">
        {funcionandoBien.map((r) => (
          <div key={r.nombre} className="cal-sin-programar-item">
            <strong className="cal-item-titulo" style={{ fontSize: "0.85rem" }}>{r.nombre}</strong>
            <span className="cal-item-tipo">{r.tiempoMs}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}
