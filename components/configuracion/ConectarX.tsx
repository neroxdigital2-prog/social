"use client";

import { useState } from "react";

const ENLACE_RECARGA_X = "https://console.x.com/en/billing/credits";

export function ConectarX({ empresaId, yaConectado }: { empresaId: string; yaConectado: boolean }) {
  const [conectando, setConectando] = useState(false);
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function conectar() {
    setConectando(true);
    setEstado("idle");
    setMensaje(null);
    try {
      const res = await fetch("/api/redes/x/conectar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEstado("error");
        setMensaje(data?.error || "No se pudo conectar X.");
      } else {
        setEstado("ok");
      }
    } catch {
      setEstado("error");
      setMensaje("Error de red al conectar X.");
    } finally {
      setConectando(false);
    }
  }

  return (
    <div className="red-card">
      <div className="red-card-top">
        <strong>X (Twitter)</strong>
        {yaConectado || estado === "ok" ? (
          <span className="red-badge red-badge-ok">Conectada</span>
        ) : (
          <span className="red-badge red-badge-pendiente">No conectada</span>
        )}
      </div>

      <p className="text-muted" style={{ marginTop: 4 }}>
        Publicar en X tiene costo por publicación (~$0.015 por post, ~$0.20 si incluye un enlace).
        No hay nivel gratuito.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn-primary" onClick={conectar} disabled={conectando}>
          {conectando ? "Conectando..." : yaConectado ? "Reconectar X" : "Conectar X"}
        </button>
        <a href={ENLACE_RECARGA_X} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          Recargar saldo en X →
        </a>
      </div>

      {mensaje && (
        <p role="alert" className="cal-error" style={{ marginTop: 8 }}>
          {mensaje}
        </p>
      )}
      {estado === "ok" && (
        <p style={{ marginTop: 8, color: "var(--color-success, #16a34a)" }}>
          X conectado correctamente. Recuerda cargar saldo antes de programar publicaciones para esta red.
        </p>
      )}
    </div>
  );
}
