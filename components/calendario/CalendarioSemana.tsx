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

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function mismodia(fechaISO: string, dia: Date) {
  const f = new Date(fechaISO);
  return (
    f.getFullYear() === dia.getFullYear() &&
    f.getMonth() === dia.getMonth() &&
    f.getDate() === dia.getDate()
  );
}

function esHoy(dia: Date) {
  const hoy = new Date();
  return mismodia(hoy.toISOString(), dia);
}

function inputAIso(valor: string): string {
  const [fecha, hora] = valor.split("T");
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const d = new Date(anio, mes - 1, dia, h, m, 0);
  return d.toISOString();
}

function isoAInput(iso: string): string {
  const d = new Date(iso);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${anio}-${mes}-${dia}T${h}:${m}`;
}

function franjaDelDia(iso: string): string {
  const hora = new Date(iso).getHours();
  if (hora < 12) return "Mañana";
  if (hora < 19) return "Tarde";
  return "Noche";
}

const NOMBRES_RED: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
  TWITTER: "X",
  GOOGLE_BUSINESS: "Google Business",
};

export function CalendarioSemana({
  publicaciones,
  inicioSemanaISO,
  offsetSemanas,
  empresaId,
  redesConectadas,
}: {
  publicaciones: Publicacion[];
  inicioSemanaISO: string;
  offsetSemanas: number;
  empresaId: string;
  redesConectadas: string[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(publicaciones);
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Por defecto, todas las redes conectadas quedan seleccionadas (mismo comportamiento que antes)
  const [redesPorPublicacion, setRedesPorPublicacion] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(publicaciones.map((p) => [p.id, [...redesConectadas]]))
  );
  const [guardandoRedesId, setGuardandoRedesId] = useState<string | null>(null);

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

  async function guardarRedes(id: string, redes: string[]) {
    setGuardandoRedesId(id);
    setError(null);
    const res = await fetch(`/api/publicaciones/${id}/redes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redes }),
    });
    setGuardandoRedesId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "No se pudieron guardar las redes.");
      return;
    }
    setRedesPorPublicacion((prev) => ({ ...prev, [id]: redes }));
  }

  function alternarRed(id: string, red: string) {
    const actuales = redesPorPublicacion[id] || [];
    const nuevas = actuales.includes(red) ? actuales.filter((r) => r !== red) : [...actuales, red];
    guardarRedes(id, nuevas);
  }

  function irASemana(nuevoOffset: number) {
    router.push(`/calendario?empresa=${empresaId}&semana=${nuevoOffset}`);
  }

  function pubsDelDiaOrdenadas(dia: Date) {
    return items
      .filter((p) => p.fechaProgramada && mismodia(p.fechaProgramada, dia))
      .sort((a, b) => new Date(a.fechaProgramada!).getTime() - new Date(b.fechaProgramada!).getTime());
  }

  return (
    <div className="cal-tarjeta">
      <div className="cal-nav">
        <button type="button" className="cal-btn-nav" onClick={() => irASemana(offsetSemanas - 1)}>
          ← Semana anterior
        </button>
        <span className="cal-rango">
          {formatearFechaCorta(diasSemana[0])} – {formatearFechaCorta(diasSemana[6])}
        </span>
        <button type="button" className="cal-btn-nav" onClick={() => irASemana(offsetSemanas + 1)}>
          Semana siguiente →
        </button>
        {offsetSemanas !== 0 && (
          <button type="button" className="cal-btn-hoy" onClick={() => irASemana(0)}>
            Hoy
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="cal-error">
          {error}
        </p>
      )}

      <div className="cal-grid">
        {diasSemana.map((dia, i) => {
          const pubsDelDia = pubsDelDiaOrdenadas(dia);
          return (
            <div key={i} className={`cal-columna ${esHoy(dia) ? "cal-columna-hoy" : ""}`}>
              <div className="cal-dia-header">
                <span className="cal-dia-nombre">{DIAS[i]}</span>
                <span className="cal-dia-fecha">{formatearFechaCorta(dia)}</span>
              </div>
              <div className="cal-dia-contenido">
                {pubsDelDia.length === 0 ? (
                  <p className="cal-sin-publicaciones">Sin publicaciones</p>
                ) : (
                  pubsDelDia.map((p) => (
                    <div key={p.id} className="cal-item">
                      <div className="cal-item-top">
                        <span className="cal-item-hora">{formatearHora(p.fechaProgramada!)}</span>
                        <span className="cal-item-franja">{franjaDelDia(p.fechaProgramada!)}</span>
                      </div>
                      <p className="cal-item-titulo">{p.titulo}</p>
                      <div className="cal-item-acciones">
                        <input
                          type="datetime-local"
                          className="cal-input-fecha"
                          value={isoAInput(p.fechaProgramada!)}
                          disabled={guardandoId === p.id}
                          onChange={(e) => e.target.value && reprogramar(p.id, inputAIso(e.target.value))}
                        />
                        <button
                          type="button"
                          className="cal-btn-quitar"
                          onClick={() => reprogramar(p.id, null)}
                          disabled={guardandoId === p.id}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="cal-sin-programar-seccion">
        <h2 className="cal-subtitulo">Sin programar ({sinProgramar.length})</h2>
        {sinProgramar.length === 0 ? (
          <p className="cal-sin-publicaciones">Todas las publicaciones están programadas.</p>
        ) : (
          <div className="cal-sin-programar-lista">
            {sinProgramar.map((p) => (
              <div key={p.id} className="cal-sin-programar-item">
                <div>
                  <strong className="cal-item-titulo">{p.titulo}</strong>
                  <div className="cal-item-tipo">{p.tipo.replace(/_/g, " ")}</div>
                  {redesConectadas.length > 0 && (
                    <div className="cal-redes-selector" role="group" aria-label="Redes donde publicar">
                      {redesConectadas.map((red) => {
                        const marcada = (redesPorPublicacion[p.id] || []).includes(red);
                        return (
                          <label key={red} className="cal-red-checkbox">
                            <input
                              type="checkbox"
                              checked={marcada}
                              disabled={guardandoRedesId === p.id}
                              onChange={() => alternarRed(p.id, red)}
                            />
                            {NOMBRES_RED[red] || red}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                <input
                  type="datetime-local"
                  className="cal-input-fecha"
                  disabled={guardandoId === p.id}
                  onChange={(e) => e.target.value && reprogramar(p.id, inputAIso(e.target.value))}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
