"use client";

import { useState } from "react";

interface Lead {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  origen: string;
  estado: string;
  valorEstimado: number | null;
  createdAt: string;
}

const ESTADOS = [
  { value: "NUEVO", label: "Nuevo" },
  { value: "CONTACTADO", label: "Contactado" },
  { value: "CALIFICADO", label: "Calificado" },
  { value: "PROPUESTA", label: "Propuesta" },
  { value: "GANADO", label: "Ganado" },
  { value: "PERDIDO", label: "Perdido" },
];

const ORIGEN_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  WHATSAPP: "WhatsApp",
  FORMULARIO_WEB: "Formulario web",
  RED_SOCIAL: "Red social",
  REFERIDO: "Referido",
  OTRO: "Otro",
};

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export function CRMLista({ leads, empresaId }: { leads: Lead[]; empresaId: string }) {
  const [items, setItems] = useState(leads);
  const [filtro, setFiltro] = useState("TODOS");
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [creando, setCreando] = useState(false);

  const leadsFiltrados = filtro === "TODOS" ? items : items.filter((l) => l.estado === filtro);

  async function cambiarEstado(id: string, estado: string) {
    setGuardandoId(id);
    setError(null);
    const res = await fetch(`/api/leads/${id}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const data = await res.json().catch(() => null);
    setGuardandoId(null);
    if (!res.ok) {
      setError(data?.error || "No se pudo actualizar el estado.");
      return;
    }
    setItems((prev) => prev.map((l) => (l.id === id ? { ...l, estado } : l)));
  }

  async function crearLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreando(true);
    setError(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId, nombre, telefono, email }),
    });
    const data = await res.json().catch(() => null);
    setCreando(false);
    if (!res.ok) {
      setError(data?.error || "No se pudo crear el lead.");
      return;
    }
    setItems((prev) => [
      {
        id: data.id,
        nombre,
        email: email || null,
        telefono: telefono || null,
        origen: "MANUAL",
        estado: "NUEVO",
        valorEstimado: null,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setNombre("");
    setTelefono("");
    setEmail("");
  }

  return (
    <div className="crm-tarjeta">
      <form onSubmit={crearLead} className="crm-form-nuevo">
        <input
          type="text"
          placeholder="Nombre del lead"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
        <input
          type="tel"
          placeholder="Teléfono (opcional)"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email (opcional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={creando || !nombre.trim()}>
          {creando ? "Añadiendo…" : "+ Añadir lead"}
        </button>
      </form>

      {error && (
        <p role="alert" className="cal-error" style={{ marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      <div className="crm-filtros">
        <button
          type="button"
          className={`crm-filtro-btn ${filtro === "TODOS" ? "crm-filtro-activo" : ""}`}
          onClick={() => setFiltro("TODOS")}
        >
          Todos ({items.length})
        </button>
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            type="button"
            className={`crm-filtro-btn ${filtro === e.value ? "crm-filtro-activo" : ""}`}
            onClick={() => setFiltro(e.value)}
          >
            {e.label} ({items.filter((l) => l.estado === e.value).length})
          </button>
        ))}
      </div>

      {leadsFiltrados.length === 0 ? (
        <p className="cal-sin-publicaciones">No hay leads en esta categoría.</p>
      ) : (
        <div className="crm-lista">
          {leadsFiltrados.map((lead) => (
            <div key={lead.id} className="crm-item">
              <div className="crm-item-info">
                <strong className="crm-item-nombre">{lead.nombre}</strong>
                <div className="crm-item-meta">
                  {lead.telefono && <span>{lead.telefono}</span>}
                  {lead.email && <span>{lead.email}</span>}
                  <span className="crm-item-origen">{ORIGEN_LABEL[lead.origen] || lead.origen}</span>
                  <span>{formatearFecha(lead.createdAt)}</span>
                </div>
              </div>
              <select
                className="crm-select-estado"
                value={lead.estado}
                disabled={guardandoId === lead.id}
                onChange={(e) => cambiarEstado(lead.id, e.target.value)}
              >
                {ESTADOS.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
