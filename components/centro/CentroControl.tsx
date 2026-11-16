"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { AGENTES, NOMBRE_AGENTE, TEXTO_VIA, duracion, fechaHoraBD, reparacionDe } from "@/lib/agentes";
import { descargarCSV, sello } from "@/lib/exportar";
import { useCentro } from "@/components/centro/useCentro";
import { PanelAgentes } from "@/components/centro/PanelAgentes";
import { TelegramConexion } from "@/components/centro/TelegramConexion";
import { HistorialDisponibilidad } from "@/components/centro/HistorialDisponibilidad";
import { EmpresasActivas } from "@/components/centro/EmpresasActivas";
import { IncidenciaTarjeta, textoEvento } from "@/components/centro/IncidenciaTarjeta";
import { Desplegable } from "@/components/ui/Desplegable";
import { Plegable } from "@/components/ui/Plegable";
import type { DisponibilidadDia, EmpresaActiva, EventoIncidencia, IncidenciaVista } from "@/components/centro/tipos";

type Vista = "activas" | "historial";

function leerAgenteUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("agente") || "";
}

/** Averías activas (abiertas y silenciadas) o historial de resueltas. Las resueltas salen del panel y quedan aquí con fecha y hora. */
function Incidencias({ vista, onCambio, empresas }: { vista: Vista; onCambio: () => void; empresas: EmpresaActiva[] }) {
  const [agente, setAgente] = useState(vista === "historial" ? leerAgenteUrl() : "");
  const [dias, setDias] = useState(30);
  const [empresa, setEmpresa] = useState("");
  const [buscarTxt, setBuscarTxt] = useState("");
  const [buscar, setBuscar] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setBuscar(buscarTxt.trim()), 400);
    return () => clearTimeout(t);
  }, [buscarTxt]);
  const [lista, setLista] = useState<IncidenciaVista[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    const q = new URLSearchParams({ estado: vista === "activas" ? "pendientes" : "resueltas", dias: String(dias) });
    if (agente) q.set("agente", agente);
    if (empresa) q.set("empresa", empresa);
    if (buscar) q.set("buscar", buscar);
    if (desde && hasta) {
      q.set("desde", desde);
      q.set("hasta", hasta);
    }
    const res = await fetch(`/api/centro/incidencias?${q}`, { cache: "no-store" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !Array.isArray(data)) {
      setError(data?.error || "No se pudo cargar.");
      setLista([]);
      return;
    }
    setLista(data);
  }, [vista, agente, dias, empresa, buscar, desde, hasta]);

  useEffect(() => {
    cargar();
    if (vista === "activas") {
      const t = setInterval(() => document.visibilityState === "visible" && cargar(), 60_000);
      return () => clearInterval(t);
    }
  }, [cargar, vista]);

  // Si una avería cambia en una lista (resuelta, borrada…), la otra se actualiza también
  useEffect(() => {
    const alCambiar = () => cargar();
    window.addEventListener("cc-incidencias", alCambiar);
    return () => window.removeEventListener("cc-incidencias", alCambiar);
  }, [cargar]);

  useEffect(() => {
    if (vista === "historial" && window.location.hash === "#historial") document.getElementById("historial")?.scrollIntoView({ behavior: "smooth" });
  }, [vista]);

  async function limpiar() {
    if (!window.confirm("¿Borrar del historial TODOS los reportes resueltos? No se puede deshacer.")) return;
    const res = await fetch("/api/centro/incidencias", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limpiar: "resueltas" }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) setError(data?.error || "No se pudo borrar.");
    window.dispatchEvent(new Event("cc-incidencias"));
    onCambio();
  }

  function exportar() {
    if (!lista?.length) return;
    descargarCSV(
      `historial-averias-${sello()}.csv`,
      ["Detectada", "Avería", "Agente", "Nivel", "Dónde se repara", "Resuelta", "Resuelta por", "Vía", "Motivo", "Duración", "Avisos enviados", "Asignada a", "Nota de reparación", "Veces en 7 días"],
      lista.map((i) => {
        const r = reparacionDe(i.clave, i.agente);
        return [
          fechaHoraBD(i.primeraVez),
          i.titulo,
          NOMBRE_AGENTE[i.agente || ""] || "Sistema",
          i.nivel === "CRITICO" ? "Crítico" : "Aviso",
          r.lugar,
          fechaHoraBD(i.resueltaEn),
          i.resueltaPor || "",
          i.resueltaVia ? TEXTO_VIA[i.resueltaVia] || i.resueltaVia : "",
          i.motivoResolucion || "",
          duracion(i.duracionSeg),
          i.eventos.filter((e) => e.tipo === "AVISO" && Number(e.entregado) === 1).length,
          i.asignadaA || "",
          i.nota ? `${i.nota}${i.notaPor ? ` (${i.notaPor})` : ""}` : "",
          i.repeticiones7d ?? "",
        ];
      })
    );
  }

  const esHistorial = vista === "historial";
  const filtrando = !!(empresa || buscar || (desde && hasta) || agente);
  return (
    <Desplegable
      id={esHistorial ? "historial" : "activas"}
      titulo={esHistorial ? "📜 Historial de averías resueltas" : "🔴 Averías activas"}
      subtitulo={
        esHistorial
          ? "Registro permanente: qué falló, dónde se reparó, quién lo hizo, qué hizo y cuándo (fecha y hora)."
          : "Lo que falla ahora: qué es, dónde se repara, quién la tiene asignada y la guía paso a paso. Al resolverse pasa al historial."
      }
      resumen={lista ? `${lista.length}${lista.length === 200 ? "+" : ""} ${esHistorial ? "resuelta(s)" : "activa(s)"}` : undefined}
      abiertoPorDefecto={!esHistorial}
      acciones={
        <>
          <button type="button" className="dsh-boton dsh-boton-mini" onClick={cargar}>
            <RefreshCw size={14} aria-hidden="true" /> Actualizar
          </button>
          {esHistorial && (
            <>
              <button type="button" className="dsh-boton dsh-boton-mini" onClick={exportar} disabled={!lista?.length}>
                <Download size={14} aria-hidden="true" /> Excel
              </button>
              <button type="button" className="dsh-boton dsh-boton-mini" onClick={limpiar} disabled={!lista?.length}>
                <Trash2 size={14} aria-hidden="true" /> Vaciar historial
              </button>
            </>
          )}
        </>
      }
    >
      <div className="cc-filtros">
        <label className="cc-select">
          <span>Agente</span>
          <select value={agente} onChange={(e) => setAgente(e.target.value)}>
            <option value="">Todos</option>
            {AGENTES.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        {empresas.length > 1 && (
          <label className="cc-select">
            <span>Empresa</span>
            <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}>
              <option value="">Todas</option>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
        )}
        <label className="cc-select cc-buscar">
          <span>Buscar</span>
          <input type="search" value={buscarTxt} onChange={(e) => setBuscarTxt(e.target.value)} placeholder="Avería, quién la reparó, nota…" />
        </label>
        {esHistorial && (
          <>
            <label className="cc-select">
              <span>Periodo</span>
              <select value={desde && hasta ? "rango" : dias} onChange={(e) => { if (e.target.value !== "rango") { setDesde(""); setHasta(""); setDias(Number(e.target.value)); } }}>
                {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
                {desde && hasta && <option value="rango">Fechas exactas</option>}
              </select>
            </label>
            <label className="cc-select">
              <span>Desde</span>
              <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="cc-select">
              <span>Hasta</span>
              <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </>
        )}
        {filtrando && (
          <button type="button" className="dsh-boton dsh-boton-mini" onClick={() => { setAgente(""); setEmpresa(""); setBuscarTxt(""); setBuscar(""); setDesde(""); setHasta(""); }}>
            Quitar filtros
          </button>
        )}
      </div>

      {error && <p role="alert" className="dsh-alerta dsh-alerta-error">{error}</p>}
      {lista === null ? (
        <p className="dsh-muted">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="cc-sin-averias">{esHistorial ? "No hay averías resueltas en este periodo." : "✅ No hay averías activas."}</p>
      ) : (
        <div className="cc-incidencias">
          {lista.map((i) => (
            <IncidenciaTarjeta key={i.clave} inc={i} onCambio={() => { window.dispatchEvent(new Event("cc-incidencias")); onCambio(); }} />
          ))}
        </div>
      )}
    </Desplegable>
  );
}

interface FilaIndicador {
  agente: string;
  total: number | string;
  resueltas: number | string;
  automaticas: number | string;
  abiertas: number | string;
  mediaSeg: number | string | null;
  criticas: number | string;
}
interface Recurrente {
  clave: string;
  titulo: string;
  agente: string | null;
  veces: number | string;
}

/** Indicadores del periodo: tiempo medio de reparación, % automático, agente con más fallos y averías recurrentes. */
function Indicadores() {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState<{ agentes: FilaIndicador[]; recurrentes: Recurrente[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDatos(null);
    setError(null);
    fetch(`/api/centro/indicadores?dias=${dias}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.agentes) throw new Error(d?.error || "No se pudieron cargar los indicadores.");
        setDatos(d);
      })
      .catch((e) => setError(e.message));
  }, [dias]);

  const filas = (datos?.agentes || []).map((f) => ({
    agente: f.agente,
    total: Number(f.total) || 0,
    resueltas: Number(f.resueltas) || 0,
    automaticas: Number(f.automaticas) || 0,
    abiertas: Number(f.abiertas) || 0,
    criticas: Number(f.criticas) || 0,
    media: f.mediaSeg === null || f.mediaSeg === undefined ? null : Math.round(Number(f.mediaSeg)),
  }));
  const total = filas.reduce((s, f) => s + f.total, 0);
  const resueltas = filas.reduce((s, f) => s + f.resueltas, 0);
  const auto = filas.reduce((s, f) => s + f.automaticas, 0);
  const conMedia = filas.filter((f) => f.media !== null && f.resueltas > 0);
  const mttr = conMedia.length ? Math.round(conMedia.reduce((s, f) => s + (f.media || 0) * f.resueltas, 0) / conMedia.reduce((s, f) => s + f.resueltas, 0)) : null;
  const peor = filas[0];

  return (
    <Desplegable
      id="cc-indicadores"
      titulo="📈 Indicadores de averías"
      subtitulo="Cuánto se tarda en reparar, cuánto se arregla solo y qué agente falla más."
      resumen={datos ? `${total} avería(s) en ${dias} días` : undefined}
      acciones={
        <label className="cc-select">
          <span className="sr-only">Periodo</span>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {[7, 30, 90, 365].map((d) => <option key={d} value={d}>Últimos {d} días</option>)}
          </select>
        </label>
      }
    >
      {error ? (
        <p role="alert" className="dsh-alerta dsh-alerta-error">{error}</p>
      ) : !datos ? (
        <p className="dsh-muted">Cargando…</p>
      ) : (
        <>
          <ul className="cr-kpis">
            <li className="cr-kpi"><span>Averías</span><strong>{total}</strong><small>{filas.reduce((s, f) => s + f.criticas, 0)} críticas · {filas.reduce((s, f) => s + f.abiertas, 0)} sin resolver</small></li>
            <li className="cr-kpi"><span>Tiempo medio de reparación</span><strong>{mttr !== null ? duracion(mttr) : "—"}</strong><small>desde que se detecta hasta que se resuelve</small></li>
            <li className={`cr-kpi${resueltas && auto / resueltas >= 0.5 ? " cr-kpi-sube" : ""}`}><span>Arregladas solas</span><strong>{resueltas ? `${Math.round((auto / resueltas) * 100)}%` : "—"}</strong><small>{auto} de {resueltas} resueltas, sin intervención</small></li>
            <li className={`cr-kpi${peor && peor.total > 0 ? " cr-kpi-baja" : ""}`}><span>Agente con más fallos</span><strong>{peor ? NOMBRE_AGENTE[peor.agente] || peor.agente : "—"}</strong><small>{peor ? `${peor.total} avería(s)` : "Sin averías 🎉"}</small></li>
          </ul>

          {datos.recurrentes.length > 0 && (
            <div className="cc-recurrentes" role="alert">
              <strong>♻️ Averías recurrentes — arregla la causa de fondo</strong>
              <ul>
                {datos.recurrentes.map((r) => {
                  const rep = reparacionDe(r.clave, r.agente);
                  return (
                    <li key={r.clave}>
                      <b>{r.titulo}</b> · {Number(r.veces)} veces · {NOMBRE_AGENTE[r.agente || ""] || "Sistema"} · se repara en <a href={rep.ruta}>{rep.lugar}</a> ({rep.quien})
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {filas.length > 0 && (
            <div className="cc-tabla-scroll">
              <table className="cc-tabla">
                <thead>
                  <tr>
                    <th scope="col">Agente</th>
                    <th scope="col">Averías</th>
                    <th scope="col">Críticas</th>
                    <th scope="col">Resueltas</th>
                    <th scope="col">Solas</th>
                    <th scope="col">Sin resolver</th>
                    <th scope="col">Tiempo medio</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.agente}>
                      <th scope="row">{NOMBRE_AGENTE[f.agente] || f.agente}</th>
                      <td>{f.total}</td>
                      <td>{f.criticas}</td>
                      <td>{f.resueltas}</td>
                      <td>{f.resueltas ? `${Math.round((f.automaticas / f.resueltas) * 100)}%` : "—"}</td>
                      <td className={f.abiertas ? "rs-mal" : undefined}>{f.abiertas}</td>
                      <td>{f.media !== null ? duracion(f.media) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Desplegable>
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
    <Desplegable id="cc-auto" titulo="🛠️ Correcciones automáticas y avisos generales" subtitulo="Últimos 7 días: lo que el vigilante arregló solo y los partes enviados." resumen={eventos ? `${eventos.length} evento(s)` : undefined}>
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
    </Desplegable>
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
    <Desplegable
      id="cc-disp"
      titulo={`📶 Disponibilidad · ${historial ? "historial" : "hoy"}`}
      subtitulo="% de revisiones en las que cada agente estaba operativo."
      acciones={
        <button type="button" className="dsh-boton dsh-boton-mini" aria-pressed={historial} onClick={() => setHistorial((v) => !v)}>
          {historial ? "Ver hoy" : "Ver historial"}
        </button>
      }
    >
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
    </Desplegable>
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
      <Plegable id="cc-panel" titulo="Centro de control"><PanelAgentes datos={datos} error={error} recargar={recargar} /></Plegable>
      <Incidencias vista="activas" onCambio={recargar} empresas={datos?.empresas || []} />
      <Indicadores />
      <Incidencias vista="historial" onCambio={recargar} empresas={datos?.empresas || []} />
      <div className="dsh-rejilla">
        <div className="dsh-columna-principal">
          <Autocorrecciones />
        </div>
        <div className="dsh-columna-lateral cc-col-disp">
          <Disponibilidad filas={datos?.disponibilidad || []} />
        </div>
      </div>
      <Desplegable
        id="cc-empresas"
        titulo="🏢 Empresas activas"
        resumen={datos?.empresas ? `${datos.empresas.filter((e) => e.activa).length}/${datos.empresas.length} activas` : undefined}
      >
        {datos ? <EmpresasActivas empresas={datos.empresas || []} onCambio={recargar} /> : <p className="dsh-muted">Cargando…</p>}
      </Desplegable>
      <Desplegable id="cc-telegram" titulo="📨 Avisos por Telegram" subtitulo="Quién recibe los avisos del vigilante. Vincula tu Telegram con un clic, sin tocar Vercel." abiertoPorDefecto={false}>
        <TelegramConexion onCambio={recargar} />
      </Desplegable>
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
