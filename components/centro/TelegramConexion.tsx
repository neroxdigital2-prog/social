"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Unlink } from "lucide-react";
import { fechaHoraBD } from "@/lib/agentes";

interface Destino {
  chatId: string;
  nombre: string | null;
  usuario: string | null;
  vinculadoPor: string | null;
  creadoEn: string | null;
  origen: "VINCULADO" | "VERCEL";
}

interface Estado {
  token: boolean;
  ok: boolean;
  bot?: string | null;
  error?: string | null;
  webhookCambiado?: boolean;
  destinos: Destino[];
}

/** Conectar Telegram sin tocar Vercel: botón → enlace t.me → /start → vinculado. */
export function TelegramConexion({ onCambio }: { onCambio?: () => void }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [esperando, setEsperando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sondeo = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/telegram/vincular", { cache: "no-store" }).catch(() => null);
    if (!res || res.status === 401 || res.status === 403) return null;
    const data = (await res.json().catch(() => null)) as Estado | null;
    setEstado(data);
    return data;
  }, []);

  useEffect(() => {
    cargar();
    return () => {
      if (sondeo.current) clearInterval(sondeo.current);
    };
  }, [cargar]);

  async function vincular() {
    setOcupado(true);
    setMensaje(null);
    const res = await fetch("/api/telegram/vincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "enlace" }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setOcupado(false);
    if (!res?.ok || !data?.enlace) {
      setMensaje(data?.error || "No se pudo preparar el enlace.");
      return;
    }
    setEnlace(data.enlace);
    window.open(data.enlace, "_blank", "noopener");
    // Esperar a que pulses «Iniciar» en Telegram (hasta 3 min)
    const antes = estado?.destinos.length || 0;
    setEsperando(true);
    let vueltas = 0;
    if (sondeo.current) clearInterval(sondeo.current);
    sondeo.current = setInterval(async () => {
      vueltas++;
      const d = await cargar();
      if ((d?.destinos.length || 0) > antes || vueltas > 60) {
        if (sondeo.current) clearInterval(sondeo.current);
        setEsperando(false);
        if ((d?.destinos.length || 0) > antes) {
          setMensaje("✅ Telegram vinculado. Te ha llegado un mensaje de bienvenida.");
          setEnlace(null);
          onCambio?.();
        }
      }
    }, 3000);
  }

  async function prueba() {
    setOcupado(true);
    setMensaje(null);
    const res = await fetch("/api/telegram/vincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "prueba" }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setOcupado(false);
    setMensaje(data?.ok ? `✅ Prueba enviada a ${data.enviados} destinatario(s).` : `❌ ${data?.error || "No se pudo enviar."}`);
  }

  async function desvincular(chatId: string) {
    setOcupado(true);
    const res = await fetch(`/api/telegram/vincular?chatId=${encodeURIComponent(chatId)}`, { method: "DELETE" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setOcupado(false);
    setMensaje(data?.mensaje || null);
    await cargar();
    onCambio?.();
  }

  if (!estado) return <p className="dsh-muted">Comprobando Telegram…</p>;

  if (!estado.token) {
    return (
      <div className="cc-tg">
        <p className="cc-diag-titulo">🟡 <strong>Falta el token del bot</strong></p>
        <ol className="cc-diag-pasos">
          <li>Telegram → @BotFather → <code>/newbot</code> → copia el token.</li>
          <li>Vercel → Settings → Environment Variables → <code>TELEGRAM_BOT_TOKEN</code> = token → Save.</li>
          <li>Deployments → ⋯ → Redeploy. Vuelve aquí y pulsa «Vincular mi Telegram».</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="cc-tg">
      <p className="cc-tg-estado">
        {estado.ok ? "🟢" : "🔴"} Bot {estado.bot ? <strong>@{estado.bot}</strong> : "—"}
        {estado.ok ? " conectado" : ` · ${estado.error || "no responde"}`}
        {estado.webhookCambiado && <span className="cc-chip cc-chip-resuelta">webhook reparado</span>}
      </p>

      {estado.destinos.length > 0 ? (
        <ul className="cc-tg-destinos">
          {estado.destinos.map((d) => (
            <li key={d.chatId}>
              <span>
                📨 <strong>{d.nombre || "Chat"}</strong>
                {d.usuario ? ` @${d.usuario}` : ""} · <code>{d.chatId}</code>
                <small>{d.origen === "VERCEL" ? "desde Vercel (TELEGRAM_CHAT_ID)" : `vinculado el ${fechaHoraBD(d.creadoEn)}`}</small>
              </span>
              <button type="button" className="cc-cerrar" onClick={() => desvincular(d.chatId)} disabled={ocupado} aria-label={`Desvincular ${d.nombre || d.chatId}`} title="Desvincular">
                <Unlink size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dsh-muted">Nadie recibe avisos todavía. Pulsa «Vincular mi Telegram» y luego «Iniciar» en Telegram.</p>
      )}

      <div className="cc-acciones">
        <button type="button" className="btn-primary cc-tg-btn" onClick={vincular} disabled={ocupado || esperando || !estado.bot}>
          <Send size={15} aria-hidden="true" /> {estado.destinos.length ? "Vincular otro Telegram" : "Vincular mi Telegram"}
        </button>
        {estado.destinos.length > 0 && (
          <button type="button" className="dsh-boton dsh-boton-mini" onClick={prueba} disabled={ocupado}>
            🧪 Enviar prueba
          </button>
        )}
      </div>

      {esperando && (
        <p className="cc-tg-espera" role="status">
          ⏳ Esperando a que pulses <strong>Iniciar</strong> en Telegram…{" "}
          {enlace && (
            <a href={enlace} target="_blank" rel="noopener noreferrer">
              Abrir Telegram otra vez
            </a>
          )}
        </p>
      )}
      {mensaje && <p role="status" className="dsh-muted">{mensaje}</p>}
    </div>
  );
}
