"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { AGENTES, NOMBRE_AGENTE, fechaHoraBD } from "@/lib/agentes";
import { useCentro } from "@/components/centro/useCentro";
import { PanelAgentes } from "@/components/centro/PanelAgentes";
import { TelegramConexion } from "@/components/centro/TelegramConexion";
import { HistorialDisponibilidad } from "@/components/centro/HistorialDisponibilidad";
import { EmpresasActivas } from "@/components/centro/EmpresasActivas";
import { IncidenciaTarjeta, textoEvento } from "@/components/centro/IncidenciaTarjeta";
import type { DisponibilidadDia, EventoIncidencia, IncidenciaVista } from "@/components/centro/tipos";

type Filtro = "pendientes" | "abiertas" | "silenciadas" | "resueltas" | "todas";

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: "pendientes", texto: "Pendientes" },
  { id: "abiertas", texto: "Abiertas" },
  { id: "silenciadas", texto: "Silenciadas" },
  { id: "resueltas", texto: "Resueltas" },
  { id: "todas", texto: "Todas" },
];

function Incidencias({ onCambio }: { onCambio: () => void }) {
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [agente, setAgente] = useState("");
  const [dias, setDias] = useState(30);
  const [lista, setLista] = useState<IncidenciaVista[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const q = new URLSearchParams({ estado: filtro, dias: String(dias) });
    if (agente) q.set("agente", agente);
    const res = await fetch(`/api/centro/incidencias?${q}`, { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !Array.isArray(data)) {
      setError(data?.error || "No se pudo cargar el historial.");
      setLista([]);
      return;
    }
    setLista(data);
  }, [filtro, agente, dias]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function limpiar(modo: "resueltas" | "todas") {
    const txt = modo === "resueltas" ? "¿Borrar TODOS los reportes ya resueltos? No se puede deshacer." : "¿Borrar TODOS los reportes (también los abiertos)? Si el fallo sigue, el vigilante lo volverá a abrir. No se puede deshacer.";
    if (!window.confirm(txt)) return;
    const res = await fetch("/api/centro/incidencias", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limpiar: modo }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) setError(data?.error || "No se pudo borrar.");
    await cargar();
    onCambio();
  }

  return (
    <section className="dsh-card" aria-labelledby="cc-historial-titulo">
      <header className="dsh-card-header">
        <div>
          <h2 id="cc-historial-titulo">Reporte de averías</h2>
          <p className="dsh-muted">Qué falló, a quién se avisó (canal, destino, fecha y hora, si se entregó) y quién lo resolvió.</p>
        </div>
        <div className="cc-acciones">
          <button type="button" className="dsh-boton dsh-boton-mini" onClick={cargar}>
            <RefreshCw size={14} aria-hidden="true" /> Actualizar
          </button>
          <button type="button" className="dsh-boton dsh-boton-mini" onClick={() => limpiar("resueltas")}>
            <Trash2 size={14} aria-hidden="true" /> Borrar resueltas
          </button>
          <button type="button" className="dsh-boton dsh-boton-mini" onClick={() => limpiar("todas")}>
            <Trash2 size={14} aria-hidden="true" /> Borrar todas
          </button>
        </div>
      </header>

      <div className="cc-filtros">
        <div className="crm-pestanas" role="tablist" aria-label="Estado">
          {FILTROS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} className="crm-pestana" onClick={() => setFiltro(f.id)}>
              {f.texto}
            </button>
          ))}
        </div>
        <label className="cc-select">
          <span>Agente</span>
          <select value={agente} onChange={(e) => setAgente(e.target.value)}>
            <option value="">Todos</option>
            {AGENTES.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        <label className="cc-select">
          <span>Resueltas de los últimos</span>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {[7, 30, 90].map((d) => <option key={d} value={d}>{d} días</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="dsh-alerta dsh-alerta-error">{error}</p>}
      {lista === null ? (
        <p className="dsh-muted">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="cc-sin-averias">✅ No hay averías en esta vista.</p>
      ) : (
        <div className="cc-incidencias">
          {lista.map((i) => (
            <IncidenciaTarjeta key={i.clave} inc={i} onCambio={() => { cargar(); onCambio(); }} />
          ))}
        </div>
      )}
    </section>
  );
}

function Autocorrecciones() {
  const [eventos, setEventos] = useState<EventoIncidencia[] | null>(null);
  useEffect(() => {
    fetch("/api/centro/autocorrecciones?dias=7", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEventos(Array.isArray(d) ? d : []))
      .catch(() => setEventos([]));
  }, []);

  return (
    <section className="dsh-card" aria-labelledby="cc-auto-titulo">
      <div>
        <h2 id="cc-auto-titulo">Correcciones automáticas y avisos generales</h2>
        <p className="dsh-muted">Últimos 7 días: lo que el vigilante arregló solo y los partes enviados.</p>
      </div>
      {eventos === null ? (
        <p className="dsh-muted">Cargando…</p>
      ) : eventos.length === 0 ? (
        <p className="dsh-muted">Nada registrado todavía.</p>
      ) : (
        <div className="cc-tabla-scroll">
          <table className="cc-tabla">
            <thead>
              <tr>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Agente</th>
                <th scope="col">Qué pasó</th>
                <th scope="col">Entrega</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                const t = textoEvento(e);
                return (
                  <tr key={e.id}>
                    <td className="cc-nowrap">{fechaHoraBD(e.momento)}</td>
                    <td>{NOMBRE_AGENTE[e.agente || ""] || "—"}</td>
                    <td>
                      <strong>{t.titulo}</strong>
                      {t.nota && <span className="cc-celda-nota">{t.nota}</span>}
                    </td>
                    <td>{e.tipo === "AVISO" ? (Number(e.entregado) === 1 ? "✅ entregado" : "❌ no entregado") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Disponibilidad({ filas }: { filas: DisponibilidadDia[] }) {
  const [historial, setHistorial] = useState(false);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
  });
  const mapa = new Map(filas.map((f) => [`${f.agente}|${f.dia}`, f]));

  return (
    <section className="dsh-card" aria-labelledby="cc-disp-titulo">
      <div>
        <h2 id="cc-disp-titulo">Disponibilidad · {historial ? "historial" : "hoy"}</h2>
        <p className="dsh-muted">% de revisiones en las que cada agente estaba operativo.</p>
        <button type="button" className="dsh-btn" aria-expanded={historial} onClick={() => setHistorial((v) => !v)}>
          {historial ? "Ocultar historial" : "Ver historial"}
        </button>
      </div>
      {historial ? <HistorialDisponibilidad /> : (
      <div className="cc-tabla-scroll">
        <table className="cc-tabla cc-disp">
          <thead>
            <tr>
              <th scope="col">Agente</th>
              {dias.map((d, i) => i === 6 && <th key={d} scope="col">{d.slice(8, 10)}/{d.slice(5, 7)}</th>)}
              <th scope="col">Media 7d</th>
            </tr>
          </thead>
          <tbody>
            {AGENTES.map((a) => {
              const celdas = dias.map((d) => mapa.get(`${a.id}|${d}`));
              const con = celdas.filter((c): c is DisponibilidadDia => !!c && c.pct !== null);
              const media = con.length ? Math.round((con.reduce((s, c) => s + (c.pct || 0), 0) / con.length) * 10) / 10 : null;
              return (
                <tr key={a.id}>
                  <th scope="row"><span aria-hidden="true">{a.icono}</span> {a.nombre}</th>
                  {celdas.map((c, i) => {
                    if (i !== 6) return null;
                    const nivel = !c || c.pct === null ? "nd" : c.pct >= 99 ? "ok" : c.pct >= 90 ? "aviso" : "error";
                    return (
                      <td key={dias[i]}>
                        <span className={`cc-celda cc-celda-${nivel}`} title={c ? `${c.muestras} revisiones · ${c.avisos} avisos · ${c.errores} errores` : "Sin datos"}>
                          {c?.pct != null ? `${c.pct}%` : "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td><strong>{media !== null ? `${media}%` : "—"}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}

export function CentroControl() {
  const { datos, sinAcceso, error, recargar } = useCentro();

  if (sinAcceso) {
    return (
      <section className="dsh-card">
        <h2>Sin acceso</h2>
        <p className="dsh-muted">El Centro de control está reservado a los operadores (VIGILANTE_ADMINS).</p>
      </section>
    );
  }

  return (
    <>
      <PanelAgentes datos={datos} error={error} recargar={recargar} />
      <section className="dsh-card" aria-labelledby="cc-emp-titulo">
        <div>
          <h2 id="cc-emp-titulo">🏢 Empresas activas</h2>
        </div>
        {datos ? <EmpresasActivas empresas={datos.empresas || []} onCambio={recargar} /> : <p className="dsh-muted">Cargando…</p>}
      </section>
      <section className="dsh-card" aria-labelledby="cc-tg-titulo">
        <div>
          <h2 id="cc-tg-titulo">📨 Avisos por Telegram</h2>
          <p className="dsh-muted">Quién recibe los avisos del vigilante. Vincula tu Telegram con un clic, sin tocar Vercel.</p>
        </div>
        <TelegramConexion onCambio={recargar} />
      </section>
      <Incidencias onCambio={recargar} />
      <div className="dsh-rejilla">
        <div className="dsh-columna-principal">
          <Autocorrecciones />
        </div>
        <div className="dsh-columna-lateral cc-col-disp">
          <Disponibilidad filas={datos?.disponibilidad || []} />
        </div>
      </div>
      <p className="dsh-muted">
        Telegram: {datos?.telegram ? "✅ conectado" : "⚠️ sin configurar"} · Email de escalado: {datos?.config?.email ? "✅ configurado" : "⚠️ sin configurar"} ·
        Modo noche: {datos?.config?.modoNoche ? `${datos.config.modoNoche}${datos.config.nocheAhora ? " (activo ahora 🌙)" : ""}` : "desactivado"} · Escalado a los{" "}
        {datos?.config?.escaladoMin ?? 30} min · Detalle técnico de los bridges en <a href="/salud">Salud</a>.
      </p>
    </>
  );
}

export function PanelAgentesDashboard() {
  const { datos, sinAcceso, error, recargar } = useCentro();
  if (sinAcceso) return null;
  return <PanelAgentes datos={datos} error={error} recargar={recargar} compacto />;
}
