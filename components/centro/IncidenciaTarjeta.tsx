"use client";

import { useEffect, useMemo, useState } from "react";
import { BellOff, CheckCircle2, ChevronDown, RotateCcw, Save, Trash2, UserPlus } from "lucide-react";
import { NOMBRE_AGENTE, TEXTO_VIA, duracion, fechaHoraBD, reparacionDe } from "@/lib/agentes";
import type { EventoIncidencia, IncidenciaVista } from "@/components/centro/tipos";

const ICONO_EVENTO: Record<EventoIncidencia["tipo"], string> = {
  ABIERTA: "🔴",
  REABIERTA: "♻️",
  CAMBIO: "✏️",
  AVISO: "📨",
  REINTENTO: "🔁",
  AUTOCORRECCION: "🛠️",
  SILENCIADA: "🔕",
  RESUELTA: "✅",
  CONFIG: "⚙️",
  NOTA: "📝",
  ASIGNADA: "🧰",
};

const CANAL: Record<string, string> = {
  TELEGRAM: "Telegram",
  DASHBOARD: "Centro de control",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  AUTOMATICO: "automático",
};

function entregado(v: EventoIncidencia["entregado"]): boolean | null {
  if (v === null || v === undefined) return null;
  return Number(v) === 1;
}

export function textoEvento(e: EventoIncidencia): { titulo: string; nota?: string; estado?: "ok" | "error" } {
  const canal = e.canal ? CANAL[e.canal] || e.canal : "";
  const via = e.canal ? TEXTO_VIA[e.canal] || e.canal : "";
  switch (e.tipo) {
    case "ABIERTA":
      return { titulo: "Avería detectada", nota: e.detalle || undefined };
    case "REABIERTA":
      return { titulo: "La avería ha vuelto a aparecer", nota: e.detalle || undefined };
    case "CAMBIO":
      return { titulo: "La avería ha cambiado", nota: e.detalle || undefined };
    case "AVISO": {
      const ok = entregado(e.entregado);
      return {
        titulo: e.canal === "DASHBOARD" ? "Aviso visible en el Centro de control" : `Aviso por ${canal}${e.destino ? ` → ${e.destino}` : ""}`,
        nota: e.detalle || undefined,
        estado: ok === null ? undefined : ok ? "ok" : "error",
      };
    }
    case "REINTENTO":
      return { titulo: `Reintento ${e.canal === "AUTOMATICO" ? "automático" : `pulsado por ${e.actor || "operador"} (${via})`}`, nota: e.detalle || undefined };
    case "AUTOCORRECCION":
      return { titulo: "Corregido automáticamente", nota: e.detalle || undefined };
    case "SILENCIADA":
      return { titulo: `Silenciada por ${e.actor || "operador"}${via ? ` (${via})` : ""}`, nota: e.detalle || undefined };
    case "RESUELTA":
      return { titulo: `Resuelta por ${e.actor || "—"}${via ? ` (${via})` : ""}`, nota: e.detalle || undefined, estado: "ok" };
    case "NOTA":
      return { titulo: `${e.actor || "Operador"}`, nota: e.detalle || undefined };
    case "ASIGNADA":
      return { titulo: `${e.destino ? `Asignada a ${e.destino}` : "Asignación quitada"} por ${e.actor || "operador"}` };
    case "CONFIG":
    default:
      return { titulo: e.detalle || "Cambio de configuración" };
  }
}

export function LineaTiempo({ eventos }: { eventos: EventoIncidencia[] }) {
  if (!eventos.length) return <p className="dsh-muted">Sin eventos registrados.</p>;
  return (
    <ol className="cc-tiempo">
      {eventos.map((e) => {
        const t = textoEvento(e);
        return (
          <li key={e.id} className={`cc-evento cc-evento-${e.tipo.toLowerCase()}`}>
            <span className="cc-evento-icono" aria-hidden="true">{ICONO_EVENTO[e.tipo]}</span>
            <div className="cc-evento-cuerpo">
              <p className="cc-evento-titulo">
                <time dateTime={e.momento.replace(" ", "T")}>{fechaHoraBD(e.momento)}</time> — {t.titulo}
                {t.estado === "ok" && e.tipo === "AVISO" && <span className="cc-entrega cc-entrega-ok">✅ entregado</span>}
                {t.estado === "error" && <span className="cc-entrega cc-entrega-error">❌ no entregado</span>}
                {e.tipo === "AVISO" && e.entregado === null && e.detalle?.startsWith("Aplazado") && <span className="cc-entrega cc-entrega-noche">🌙 aplazado</span>}
              </p>
              {t.nota && <p className="cc-evento-nota">{t.nota}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Saca los pasos numerados («1. …», «2) …», «- …») del diagnóstico. */
function pasosDe(detalle: string | null): string[] {
  if (!detalle) return [];
  const lineas = detalle.split(/\r?\n/).map((l) => l.trim());
  const numeradas = lineas.filter((l) => /^\d{1,2}[.)]\s+/.test(l)).map((l) => l.replace(/^\d{1,2}[.)]\s+/, ""));
  if (numeradas.length) return numeradas.slice(0, 15);
  return lineas.filter((l) => /^[-•·]\s+/.test(l)).map((l) => l.replace(/^[-•·]\s+/, "")).slice(0, 15);
}

interface Destino {
  chatId: string;
  nombre: string | null;
  usuario: string | null;
}

let destinosCache: Promise<Destino[]> | null = null;
function cargarDestinos(): Promise<Destino[]> {
  destinosCache ??= fetch("/api/telegram/vincular", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => (Array.isArray(d?.destinos) ? d.destinos : []))
    .catch(() => []);
  return destinosCache;
}

async function enviarAccion(cuerpo: Record<string, unknown>): Promise<{ ok: boolean; mensaje: string }> {
  const res = await fetch("/api/centro/incidencias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  }).catch(() => null);
  const d = await res?.json().catch(() => null);
  return { ok: !!res?.ok, mensaje: d?.mensaje || d?.error || (res?.ok ? "Hecho." : "No se pudo guardar.") };
}

function GuiaReparacion({ inc, onCambio }: { inc: IncidenciaVista; onCambio?: () => void }) {
  const pasos = useMemo(() => pasosDe(inc.detalle), [inc.detalle]);
  const [hechos, setHechos] = useState<number[]>(Array.isArray(inc.pasosHechos) ? inc.pasosHechos : []);
  const [nota, setNota] = useState(inc.nota || "");
  const [asignada, setAsignada] = useState(inc.asignadaA || "");
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const resuelta = inc.estado === "RESUELTA";

  useEffect(() => {
    if (!resuelta) cargarDestinos().then(setDestinos);
  }, [resuelta]);

  async function marcar(i: number, marcado: boolean) {
    const nuevos = marcado ? [...new Set([...hechos, i])] : hechos.filter((x) => x !== i);
    setHechos(nuevos);
    const r = await enviarAccion({ clave: inc.clave, accion: "pasos", hechos: nuevos, paso: `${i + 1}. ${pasos[i]}`, marcado });
    if (!r.ok) setMsg(r.mensaje);
  }

  async function guardarNota(resolver = false) {
    setOcupado(true);
    const r = await enviarAccion({ clave: inc.clave, accion: "nota", nota });
    let texto = r.mensaje;
    if (r.ok && resolver) {
      const r2 = await enviarAccion({ clave: inc.clave, accion: "resolver", nota });
      texto = r2.mensaje;
    }
    setMsg(texto);
    setOcupado(false);
    onCambio?.();
  }

  async function asignar(valor: string) {
    setAsignada(valor);
    const d = destinos.find((x) => x.chatId === valor);
    const nombre = d ? d.nombre || (d.usuario ? `@${d.usuario}` : d.chatId) : valor || null;
    const r = await enviarAccion({ clave: inc.clave, accion: "asignar", asignadaA: nombre, chat: d?.chatId || null, titulo: inc.titulo });
    setMsg(r.mensaje);
    onCambio?.();
  }

  const valorAsignada = destinos.find((d) => (d.nombre || (d.usuario ? `@${d.usuario}` : d.chatId)) === asignada)?.chatId || "";

  return (
    <section className="cc-guia" aria-label="Guía de reparación">
      <h4 className="cc-subtitulo">🧭 Guía de reparación {pasos.length > 0 && <span className="dsh-muted">· {hechos.length}/{pasos.length} pasos</span>}</h4>
      {pasos.length > 0 ? (
        <ol className="cc-pasos">
          {pasos.map((p, i) => (
            <li key={i}>
              <label>
                <input type="checkbox" checked={hechos.includes(i)} disabled={resuelta} onChange={(e) => marcar(i, e.target.checked)} />
                <span className={hechos.includes(i) ? "cc-paso-hecho" : undefined}>{p}</span>
              </label>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dsh-muted">Esta avería no trae pasos numerados: describe en la nota qué hiciste.</p>
      )}

      {!resuelta && (
        <label className="cc-select cc-asignar">
          <span><UserPlus size={13} aria-hidden="true" /> Asignada a</span>
          <select value={valorAsignada || (asignada ? "__otro" : "")} onChange={(e) => e.target.value !== "__otro" && asignar(e.target.value)}>
            <option value="">Sin asignar</option>
            {destinos.map((d) => (
              <option key={d.chatId} value={d.chatId}>
                {d.nombre || (d.usuario ? `@${d.usuario}` : d.chatId)} (Telegram)
              </option>
            ))}
            {asignada && !valorAsignada && <option value="__otro">{asignada}</option>}
          </select>
        </label>
      )}

      <label className="cc-nota">
        <span>📝 Nota de reparación: quién la reparó y qué hizo</span>
        <textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: Renové el token de Instagram en Redes sociales y reintenté el envío." disabled={ocupado} />
      </label>
      {inc.nota && inc.notaPor && <small className="dsh-muted">Última nota de {inc.notaPor}</small>}
      <div className="cc-acciones">
        <button type="button" className="dsh-boton dsh-boton-mini" onClick={() => guardarNota(false)} disabled={ocupado || nota === (inc.nota || "")}>
          <Save size={14} aria-hidden="true" /> Guardar nota
        </button>
        {!resuelta && (
          <button type="button" className="dsh-boton dsh-boton-mini dsh-boton-primario" onClick={() => guardarNota(true)} disabled={ocupado || !nota.trim()}>
            <CheckCircle2 size={14} aria-hidden="true" /> Guardar y marcar reparada
          </button>
        )}
      </div>
      {msg && <p role="status" className="dsh-muted">{msg}</p>}
    </section>
  );
}

const ETIQUETA_ESTADO = { ABIERTA: "Abierta", SILENCIADA: "Silenciada", RESUELTA: "Resuelta" } as const;

export function IncidenciaTarjeta({ inc, onCambio, abiertaInicial = false }: { inc: IncidenciaVista; onCambio?: () => void; abiertaInicial?: boolean }) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const avisos = inc.eventos.filter((e) => e.tipo === "AVISO");
  const entregados = avisos.filter((e) => entregado(e.entregado) === true).length;
  const fallidos = avisos.filter((e) => entregado(e.entregado) === false).length;
  const ultimoAviso = [...avisos].reverse().find((e) => e.canal !== "DASHBOARD");
  const esEnvio = inc.clave.startsWith("pub:");
  const reparacion = reparacionDe(inc.clave, inc.agente);
  const id = `cc-inc-${inc.clave.replace(/[^a-z0-9]/gi, "-")}`;

  async function accion(tipo: "reintentar" | "resolver" | "silenciar") {
    setOcupado(tipo);
    setMensaje(null);
    const res = await fetch("/api/centro/incidencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave: inc.clave, accion: tipo }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setMensaje(data?.mensaje || data?.error || (res?.ok ? "Hecho." : "No se pudo completar."));
    setOcupado(null);
    onCambio?.();
  }

  async function borrar() {
    if (!window.confirm("¿Borrar este reporte y todo su historial? No se puede deshacer.")) return;
    setOcupado("borrar");
    const res = await fetch("/api/centro/incidencias", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claves: [inc.clave] }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setMensaje(data?.mensaje || data?.error || (res?.ok ? "Borrado." : "No se pudo borrar."));
    setOcupado(null);
    onCambio?.();
  }

  return (
    <article className={`cc-inc cc-inc-${inc.estado.toLowerCase()} cc-inc-${inc.nivel.toLowerCase()}`} aria-labelledby={`${id}-t`}>
      <button type="button" className="cc-inc-cabecera" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta(!abierta)}>
        <span className={`cc-luz cc-luz-${inc.estado === "RESUELTA" ? "ok" : inc.estado === "SILENCIADA" ? "off" : inc.nivel === "CRITICO" ? "error" : "aviso"}`} aria-hidden="true" />
        <span className="cc-inc-texto">
          <strong id={`${id}-t`}>{inc.titulo}</strong>
          <span className="dsh-muted">
            {NOMBRE_AGENTE[inc.agente || ""] || "Sistema"} · detectada {fechaHoraBD(inc.primeraVez)} ·{" "}
            {inc.estado === "RESUELTA"
              ? `resuelta el ${fechaHoraBD(inc.resueltaEn)} por ${inc.resueltaPor || "—"} (${duracion(inc.duracionSeg)})`
              : `abierta hace ${duracion(inc.duracionSeg)}`}
          </span>
          <span className="cc-inc-chips">
            <span className={`cc-chip cc-chip-${inc.estado.toLowerCase()}`}>{ETIQUETA_ESTADO[inc.estado]}</span>
            <span className={fallidos ? "cc-chip cc-chip-error" : "cc-chip"}>
              📨 {entregados} aviso(s) entregado(s){fallidos ? ` · ${fallidos} fallido(s)` : ""}
            </span>
            {ultimoAviso && <span className="cc-chip">Último: {CANAL[ultimoAviso.canal || ""] || ultimoAviso.canal} {fechaHoraBD(ultimoAviso.momento)}</span>}
            {(inc.repeticiones7d || 0) >= 3 && (
              <span className="cc-chip cc-chip-error" title="Ha vuelto a aparecer 3 o más veces en 7 días: arregla la causa de fondo">
                ♻️ Recurrente · {inc.repeticiones7d}× en 7 días
              </span>
            )}
            {inc.asignadaA && <span className="cc-chip">🧰 {inc.asignadaA}</span>}
          </span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className="cc-chevron" />
      </button>

      {abierta && (
        <div id={id} className="cc-inc-cuerpo">
          <dl className="cc-reparar">
            <div>
              <dt>🔎 Qué es</dt>
              <dd>{inc.titulo}</dd>
            </div>
            <div>
              <dt>🕒 Detectada</dt>
              <dd>{fechaHoraBD(inc.primeraVez)}</dd>
            </div>
            <div>
              <dt>🛠️ Dónde se repara</dt>
              <dd>
                <a href={reparacion.ruta}>{reparacion.lugar}</a>
              </dd>
            </div>
            <div>
              <dt>👤 {inc.estado === "RESUELTA" ? "Quién la reparó" : "Quién la repara"}</dt>
              <dd>
                {inc.estado === "RESUELTA"
                  ? `${inc.resueltaPor || "—"}${inc.resueltaVia ? ` (${TEXTO_VIA[inc.resueltaVia] || inc.resueltaVia})` : ""}`
                  : reparacion.quien}
              </dd>
            </div>
            {inc.estado === "RESUELTA" && (
              <div>
                <dt>✅ Resuelta</dt>
                <dd>{fechaHoraBD(inc.resueltaEn)}</dd>
              </div>
            )}
          </dl>
          {inc.estado === "RESUELTA" && (
            <p className="cc-resolucion">
              ✅ <strong>Resuelta el {fechaHoraBD(inc.resueltaEn)}</strong> por <strong>{inc.resueltaPor || "—"}</strong>
              {inc.resueltaVia ? ` (${TEXTO_VIA[inc.resueltaVia] || inc.resueltaVia})` : ""}
              {inc.motivoResolucion ? ` — ${inc.motivoResolucion}` : ""}. Estuvo abierta {duracion(inc.duracionSeg)}.
            </p>
          )}

          {inc.detalle && (
            <details className="cc-diagnostico">
              <summary>Qué es y cómo arreglarlo</summary>
              <pre>{inc.detalle}</pre>
            </details>
          )}

          {(inc.repeticiones7d || 0) >= 3 && inc.estado !== "RESUELTA" && (
            <p className="dsh-alerta dsh-alerta-error">♻️ Esta avería ha aparecido {inc.repeticiones7d} veces en 7 días. Reintentar no basta: arregla la causa de fondo en <a href={reparacion.ruta}>{reparacion.lugar}</a>.</p>
          )}
          <GuiaReparacion inc={inc} onCambio={onCambio} />

          <h4 className="cc-subtitulo">Historial</h4>
          <LineaTiempo eventos={inc.eventos} />

          {inc.estado !== "RESUELTA" && (
            <div className="cc-acciones">
              {esEnvio && (
                <button type="button" className="dsh-boton dsh-boton-mini" onClick={() => accion("reintentar")} disabled={!!ocupado}>
                  <RotateCcw size={14} aria-hidden="true" /> {ocupado === "reintentar" ? "Reintentando…" : "Reintentar"}
                </button>
              )}
              <button type="button" className="dsh-boton dsh-boton-mini" onClick={() => accion("resolver")} disabled={!!ocupado}>
                <CheckCircle2 size={14} aria-hidden="true" /> {ocupado === "resolver" ? "Guardando…" : "Marcar resuelta"}
              </button>
              {inc.estado === "ABIERTA" && (
                <button type="button" className="dsh-boton dsh-boton-mini" onClick={() => accion("silenciar")} disabled={!!ocupado}>
                  <BellOff size={14} aria-hidden="true" /> Silenciar
                </button>
              )}
            </div>
          )}
          <div className="cc-acciones">
            <button type="button" className="dsh-boton dsh-boton-mini" onClick={borrar} disabled={!!ocupado}>
              <Trash2 size={14} aria-hidden="true" /> {ocupado === "borrar" ? "Borrando…" : "Borrar reporte"}
            </button>
          </div>
          {mensaje && <p role="status" className="dsh-muted">{mensaje}</p>}
        </div>
      )}
    </article>
  );
}
