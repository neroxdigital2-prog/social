"use client";

import { useEffect, useState } from "react";

interface Servicio {
  id: string;
  nombre: string;
  duracionMin: number;
  precio: number | null;
  activo: boolean;
}

interface DiaDisponible {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

interface Cita {
  id: string;
  nombreCliente: string;
  telefono: string;
  email: string | null;
  fechaHora: string;
  estado: string;
  notas: string | null;
  servicioNombre: string;
  duracionMin: number;
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const ESTADOS_CITA = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "CONFIRMADA", label: "Confirmada" },
  { value: "CANCELADA", label: "Cancelada" },
  { value: "COMPLETADA", label: "Completada" },
  { value: "NO_ASISTIO", label: "No asistió" },
];

function formatearFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgendaPanel({ empresaId }: { empresaId: string }) {
  const [tab, setTab] = useState<"citas" | "servicios" | "horario">("citas");

  return (
    <div>
      <div className="agenda-tabs">
        <button className={tab === "citas" ? "agenda-tab-activo" : "agenda-tab"} onClick={() => setTab("citas")}>
          Citas
        </button>
        <button className={tab === "servicios" ? "agenda-tab-activo" : "agenda-tab"} onClick={() => setTab("servicios")}>
          Servicios
        </button>
        <button className={tab === "horario" ? "agenda-tab-activo" : "agenda-tab"} onClick={() => setTab("horario")}>
          Horario semanal
        </button>
      </div>

      {tab === "citas" && <PanelCitas empresaId={empresaId} />}
      {tab === "servicios" && <PanelServicios empresaId={empresaId} />}
      {tab === "horario" && <PanelHorario empresaId={empresaId} />}
    </div>
  );
}

// ---------- SERVICIOS ----------
function PanelServicios({ empresaId }: { empresaId: string }) {
  const [items, setItems] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [duracion, setDuracion] = useState(30);
  const [precio, setPrecio] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const res = await fetch(`/api/agenda/servicios?empresa=${empresaId}`);
    const data = await res.json().catch(() => []);
    setItems(Array.isArray(data) ? data : []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/agenda/servicios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId, nombre, duracionMin: duracion, precio: precio || null, activo: true }),
    });
    const data = await res.json().catch(() => null);
    setGuardando(false);
    if (!res.ok) {
      setError(data?.error || "No se pudo crear el servicio.");
      return;
    }
    setItems((prev) => [
      ...prev,
      { id: data.id, nombre, duracionMin: duracion, precio: precio ? Number(precio) : null, activo: true },
    ]);
    setNombre("");
    setDuracion(30);
    setPrecio("");
  }

  async function alternarActivo(s: Servicio) {
    const nuevoActivo = !s.activo;
    setItems((prev) => prev.map((it) => (it.id === s.id ? { ...it, activo: nuevoActivo } : it)));
    await fetch(`/api/agenda/servicios/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId, nombre: s.nombre, duracionMin: s.duracionMin, precio: s.precio, activo: nuevoActivo }),
    });
  }

  async function eliminar(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    await fetch(`/api/agenda/servicios/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <form onSubmit={crear} className="agenda-form-fila">
        <input type="text" placeholder="Nombre del servicio" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input
          type="number"
          min={5}
          step={5}
          placeholder="Minutos"
          value={duracion}
          onChange={(e) => setDuracion(Number(e.target.value))}
          style={{ maxWidth: 110 }}
        />
        <input
          type="number"
          min={0}
          step={0.01}
          placeholder="Precio (opcional)"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          style={{ maxWidth: 140 }}
        />
        <button type="submit" className="btn-primary" disabled={guardando || !nombre.trim()}>
          + Añadir servicio
        </button>
      </form>

      {error && <p className="cal-error">{error}</p>}

      {cargando ? (
        <p className="text-muted">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="cal-sin-publicaciones">Aún no tienes servicios. Añade el primero arriba.</p>
      ) : (
        <div className="agenda-lista">
          {items.map((s) => (
            <div key={s.id} className={`agenda-servicio-item ${!s.activo ? "agenda-servicio-inactivo" : ""}`}>
              <div>
                <strong>{s.nombre}</strong>
                <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                  {s.duracionMin} min{s.precio ? ` · ${s.precio.toFixed(2)}€` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn-secundario" onClick={() => alternarActivo(s)}>
                  {s.activo ? "Desactivar" : "Activar"}
                </button>
                <button type="button" className="btn-secundario" onClick={() => eliminar(s.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- HORARIO SEMANAL ----------
function PanelHorario({ empresaId }: { empresaId: string }) {
  const [activos, setActivos] = useState<Record<number, { horaInicio: string; horaFin: string } | null>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const res = await fetch(`/api/agenda/disponibilidad?empresa=${empresaId}`);
      const data: DiaDisponible[] = await res.json().catch(() => []);
      const mapa: Record<number, { horaInicio: string; horaFin: string } | null> = {};
      for (let i = 0; i < 7; i++) mapa[i] = null;
      data.forEach((d) => {
        mapa[d.diaSemana] = { horaInicio: d.horaInicio, horaFin: d.horaFin };
      });
      setActivos(mapa);
      setCargando(false);
    })();
  }, [empresaId]);

  function alternarDia(dia: number) {
    setActivos((prev) => ({
      ...prev,
      [dia]: prev[dia] ? null : { horaInicio: "09:00", horaFin: "18:00" },
    }));
  }

  function actualizarHora(dia: number, campo: "horaInicio" | "horaFin", valor: string) {
    setActivos((prev) => (prev[dia] ? { ...prev, [dia]: { ...prev[dia]!, [campo]: valor } } : prev));
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    const dias = Object.entries(activos)
      .filter(([, v]) => v !== null)
      .map(([dia, v]) => ({ diaSemana: Number(dia), horaInicio: v!.horaInicio, horaFin: v!.horaFin }));

    const res = await fetch("/api/agenda/disponibilidad", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId, dias }),
    });
    setGuardando(false);
    setMensaje(res.ok ? "Horario guardado." : "No se pudo guardar el horario.");
  }

  if (cargando) return <p className="text-muted">Cargando…</p>;

  return (
    <div>
      <div className="agenda-horario-lista">
        {DIAS.map((nombreDia, i) => (
          <div key={i} className="agenda-horario-fila">
            <label className="agenda-horario-check">
              <input type="checkbox" checked={!!activos[i]} onChange={() => alternarDia(i)} />
              {nombreDia}
            </label>
            {activos[i] && (
              <div className="agenda-horario-horas">
                <input
                  type="time"
                  value={activos[i]!.horaInicio}
                  onChange={(e) => actualizarHora(i, "horaInicio", e.target.value)}
                />
                <span>a</span>
                <input
                  type="time"
                  value={activos[i]!.horaFin}
                  onChange={(e) => actualizarHora(i, "horaFin", e.target.value)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="btn-primary" onClick={guardar} disabled={guardando} style={{ marginTop: "1rem" }}>
        {guardando ? "Guardando…" : "Guardar horario"}
      </button>
      {mensaje && <p className="text-muted" style={{ marginTop: "0.5rem" }}>{mensaje}</p>}
    </div>
  );
}

// ---------- CITAS ----------
function PanelCitas({ empresaId }: { empresaId: string }) {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [servicioId, setServicioId] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");

  async function cargar() {
    setCargando(true);
    const [resCitas, resServicios] = await Promise.all([
      fetch(`/api/agenda/citas?empresa=${empresaId}`),
      fetch(`/api/agenda/servicios?empresa=${empresaId}`),
    ]);
    const dataCitas = await resCitas.json().catch(() => []);
    const dataServicios = await resServicios.json().catch(() => []);
    setCitas(Array.isArray(dataCitas) ? dataCitas : []);
    setServicios(Array.isArray(dataServicios) ? dataServicios.filter((s: Servicio) => s.activo) : []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function crearCita(e: React.FormEvent) {
    e.preventDefault();
    if (!servicioId || !nombreCliente.trim() || !fecha || !hora) return;
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/agenda/citas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresaId,
        servicioId,
        nombreCliente,
        telefono,
        fechaHora: `${fecha} ${hora}:00`,
      }),
    });
    const data = await res.json().catch(() => null);
    setGuardando(false);
    if (!res.ok) {
      setError(data?.error || "No se pudo crear la cita.");
      return;
    }
    await cargar();
    setMostrarForm(false);
    setNombreCliente("");
    setTelefono("");
    setFecha("");
    setHora("");
  }

  async function cambiarEstado(id: string, estado: string) {
    setCitas((prev) => prev.map((c) => (c.id === id ? { ...c, estado } : c)));
    await fetch(`/api/agenda/citas/${id}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
  }

  return (
    <div>
      <button type="button" className="btn-primary" onClick={() => setMostrarForm((v) => !v)} style={{ marginBottom: "1rem" }}>
        {mostrarForm ? "Cancelar" : "+ Nueva cita"}
      </button>

      {mostrarForm && (
        <form onSubmit={crearCita} className="agenda-form-cita">
          <select value={servicioId} onChange={(e) => setServicioId(e.target.value)} required>
            <option value="">Selecciona un servicio</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} ({s.duracionMin} min)
              </option>
            ))}
          </select>
          <input type="text" placeholder="Nombre del cliente" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} required />
          <input type="text" placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required />
          <button type="submit" className="btn-primary" disabled={guardando}>
            {guardando ? "Guardando…" : "Crear cita"}
          </button>
        </form>
      )}

      {error && <p className="cal-error">{error}</p>}

      {cargando ? (
        <p className="text-muted">Cargando…</p>
      ) : citas.length === 0 ? (
        <p className="cal-sin-publicaciones">Aún no hay citas programadas.</p>
      ) : (
        <div className="agenda-lista">
          {citas.map((c) => (
            <div key={c.id} className="crm-item">
              <div className="crm-item-info">
                <strong className="crm-item-nombre">{c.nombreCliente}</strong>
                <div className="crm-item-meta">
                  <span>{formatearFechaHora(c.fechaHora)}</span>
                  <span className="crm-item-origen">{c.servicioNombre}</span>
                  {c.telefono && <span>{c.telefono}</span>}
                </div>
              </div>
              <select
                className="crm-select-estado"
                value={c.estado}
                onChange={(e) => cambiarEstado(c.id, e.target.value)}
              >
                {ESTADOS_CITA.map((e) => (
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
