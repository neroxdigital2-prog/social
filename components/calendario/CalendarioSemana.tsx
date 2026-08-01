"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Publicacion {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  hashtags: string[];
  estado: string;
  imagenUrl: string | null;
  fechaProgramada: string | null;
}

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function formatearFechaCorta(d: Date) {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function mismodia(fechaISO: string, dia: Date) {
  const f = new Date(fechaISO);
  return (
    f.getFullYear() === dia.getFullYear() &&
    f.getMonth() === dia.getMonth() &&
    f.getDate() === dia.getDate()
  );
}

// Convierte un <input type="date"> (YYYY-MM-DD) a ISO con hora fija 10:00 local
function fechaInputAIso(valor: string): string {
  const [anio, mes, dia] = valor.split("-").map(Number);
  const d = new Date(anio, mes - 1, dia, 10, 0, 0);
  return d.toISOString();
}

function isoAFechaInput(iso: string): string {
  const d = new Date(iso);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function CalendarioSemana({
  publicaciones,
  inicioSemanaISO,
  offsetSemanas,
  empresaId,
}: {
  publicaciones: Publicacion[];
  inicioSemanaISO: string;
  offsetSemanas: number;
  empresaId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(publicaciones);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inicioSemana = new Date(inicioSemanaISO);
  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return d;
  });

  const sinProgramar = items.filter((p) => !p.fechaProgramada);

  async function reprogramar(id: string, fechaISO: string | null) {
    setGuardandoId(id);
    setError(null);
    const res = await fetch(`/api/publicaciones/${id}/programar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fechaProgramada: fechaISO }),
    });
    const data = await res.json().catch(() => null);
    setGuardandoId(null);
    if (!res.ok) {
      setError(data?.error || "No se pudo actualizar la fecha.");
      return;
    }
    setItems((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, fechaProgramada: fechaISO, estado: fechaISO ? "PROGRAMADA" : "BORRADOR" } : p
      )
    );
  }

  function irASemana(nuevoOffset: number) {
    router.push(`/calendario?empresa=${empresaId}&semana=${nuevoOffset}`);
  }

  return (
    <div className="calendario-semana">
      <div className="calendario-nav" style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
        <button type="button" className="btn-secondary" onClick={() => irASemana(offsetSemanas - 1)}>
          ← Semana anterior
        </button>
        <span className="text-muted">
          {formatearFechaCorta(diasSemana[0])} – {formatearFechaCorta(diasSemana[6])}
        </span>
        <button type="button" className="btn-secondary" onClick={() => irASemana(offsetSemanas + 1)}>
          Semana siguiente →
        </button>
        {offsetSemanas !== 0 && (
          <button type="button" className="btn-secondary" onClick={() => irASemana(0)}>
            Hoy
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="field-error" style={{ marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      <div
        className="calendario-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.5rem", marginBottom: "2rem" }}
      >
        {diasSemana.map((dia, i) => {
          const pubsDelDia = items.filter((p) => p.fechaProgramada && mismodia(p.fechaProgramada, dia));
          return (
            <div key={i} className="calendario-dia" style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "0.75rem", minHeight: "160px" }}>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
                {DIAS[i]} <span className="text-muted">{formatearFechaCorta(dia)}</span>
              </div>
              {pubsDelDia.length === 0 ? (
                <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                  Sin publicaciones
                </p>
              ) : (
                pubsDelDia.map((p) => (
                  <div key={p.id} className="calendario-item" style={{ background: "var(--color-background)", borderRadius: "6px", padding: "0.5rem", marginBottom: "0.5rem", fontSize: "0.8rem" }}>
                    <strong>{p.titulo}</strong>
                    <div style={{ marginTop: "0.25rem" }}>
                      <input
                        type="date"
                        value={isoAFechaInput(p.fechaProgramada!)}
                        disabled={guardandoId === p.id}
                        onChange={(e) => reprogramar(p.id, fechaInputAIso(e.target.value))}
                      />
                      <button
                        type="button"
                        onClick={() => reprogramar(p.id, null)}
                        disabled={guardandoId === p.id}
                        style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Sin programar ({sinProgramar.length})</h2>
      {sinProgramar.length === 0 ? (
        <p className="text-muted">Todas las publicaciones están programadas.</p>
      ) : (
        <div className="calendario-sin-programar" style={{ display: "grid", gap: "0.5rem" }}>
          {sinProgramar.map((p) => (
            <div
              key={p.id}
              className="calendario-item"
              style={{ background: "var(--color-surface)", borderRadius: "var(--radius-md)", padding: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}
            >
              <div>
                <strong>{p.titulo}</strong>
                <div className="text-muted" style={{ fontSize: "0.8rem" }}>{p.tipo.replace(/_/g, " ")}</div>
              </div>
              <input
                type="date"
                disabled={guardandoId === p.id}
                onChange={(e) => e.target.value && reprogramar(p.id, fechaInputAIso(e.target.value))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
