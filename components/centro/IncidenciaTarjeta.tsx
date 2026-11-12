"use client";

import { useState } from "react";
import { BellOff, CheckCircle2, ChevronDown, RotateCcw } from "lucide-react";
import { NOMBRE_AGENTE, TEXTO_VIA, duracion, fechaHoraBD } from "@/lib/agentes";
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

  return (
    <article className={`cc-inc cc-inc-${inc.estado.toLowerCase()} cc-inc-${inc.nivel.toLowerCase()}`} aria-labelledby={`${id}-t`}>
      <button type="button" className="cc-inc-cabecera" aria-expanded={abierta} aria-controls={id} onClick={() => setAbierta(!abierta)}>
        <span className={`cc-luz cc-luz-${inc.estado === "RESUELTA" ? "ok" : inc.estado === "SILENCIADA" ? "off" : inc.nivel === "CRITICO" ? "error" : "aviso"}`} aria-hidden="true" />
        <span className="cc-inc-texto">
          <strong id={`${id}-t`}>{inc.titulo}</strong>
          <span className="dsh-muted">
            {NOMBRE_AGENTE[inc.agente || ""] || "Sistema"} · detectada {fechaHoraBD(inc.primeraVez)} ·{" "}
            {inc.estado === "RESUELTA" ? `resuelta en ${duracion(inc.duracionSeg)}` : `abierta hace ${duracion(inc.duracionSeg)}`}
          </span>
          <span className="cc-inc-chips">
            <span className={`cc-chip cc-chip-${inc.estado.toLowerCase()}`}>{ETIQUETA_ESTADO[inc.estado]}</span>
            <span className={fallidos ? "cc-chip cc-chip-error" : "cc-chip"}>
              📨 {entregados} aviso(s) entregado(s){fallidos ? ` · ${fallidos} fallido(s)` : ""}
            </span>
            {ultimoAviso && <span className="cc-chip">Último: {CANAL[ultimoAviso.canal || ""] || ultimoAviso.canal} {fechaHoraBD(ultimoAviso.momento)}</span>}
          </span>
        </span>
        <ChevronDown size={16} aria-hidden="true" className="cc-chevron" />
      </button>

      {abierta && (
        <div id={id} className="cc-inc-cuerpo">
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
          {mensaje && <p role="status" className="dsh-muted">{mensaje}</p>}
        </div>
      )}
    </article>
  );
}
