// Avisos del sistema por Telegram (gratis, push instantáneo).
// Única variable obligatoria en Vercel: TELEGRAM_BOT_TOKEN (de @BotFather).
// Los destinatarios se vinculan desde el Centro de control (botón «Vincular mi
// Telegram») y se guardan en IONOS; TELEGRAM_CHAT_ID sigue valiendo como extra.

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { urlBridge } from "@/lib/bridgeUrl";

const API = "https://api.telegram.org";

export type BotonTelegram = { texto: string; datos?: string; url?: string };

export interface DestinoTelegram {
  chatId: string;
  nombre: string | null;
  usuario: string | null;
  vinculadoPor: string | null;
  creadoEn: string | null;
  origen: "VINCULADO" | "VERCEL";
}

export function tokenBot(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
}

/** Chats definidos en Vercel (TELEGRAM_CHAT_ID). */
export function chatsEntorno(): string[] {
  return (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

async function bridgeTelegram<T>(accion: string, datos: Record<string, unknown> = {}): Promise<T | null> {
  const url = urlBridge("IONOS_BRIDGE_URL_VIGILANTE");
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET || "" },
      body: JSON.stringify({ accion, ...datos }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

let cache: { hasta: number; destinos: DestinoTelegram[] } | null = null;

/** Todos los destinatarios: vinculados desde la app (IONOS) + TELEGRAM_CHAT_ID. */
export async function destinosOperador(forzar = false): Promise<DestinoTelegram[]> {
  if (!forzar && cache && cache.hasta > Date.now()) return cache.destinos;
  const filas = (await bridgeTelegram<Omit<DestinoTelegram, "origen">[]>("telegram_destinos")) || [];
  const vinculados: DestinoTelegram[] = (Array.isArray(filas) ? filas : []).map((f) => ({ ...f, chatId: String(f.chatId), origen: "VINCULADO" }));
  const extra: DestinoTelegram[] = chatsEntorno()
    .filter((c) => !vinculados.some((v) => v.chatId === c))
    .map((chatId) => ({ chatId, nombre: null, usuario: null, vinculadoPor: "Vercel (TELEGRAM_CHAT_ID)", creadoEn: null, origen: "VERCEL" }));
  const destinos = [...vinculados, ...extra];
  cache = { hasta: Date.now() + 60_000, destinos };
  return destinos;
}

export async function chatsOperador(): Promise<string[]> {
  return (await destinosOperador()).map((d) => d.chatId);
}

export async function esChatOperador(chatId: string | number): Promise<boolean> {
  const id = String(chatId);
  if (chatsEntorno().includes(id)) return true;
  return (await destinosOperador(true)).some((d) => d.chatId === id);
}

export async function vincularChat(d: { chatId: string; nombre?: string; usuario?: string; vinculadoPor?: string }) {
  const r = await bridgeTelegram<{ ok?: boolean }>("telegram_vincular", d);
  cache = null;
  return !!r?.ok;
}

export async function desvincularChat(chatId: string) {
  const r = await bridgeTelegram<{ ok?: boolean }>("telegram_desvincular", { chatId });
  cache = null;
  return !!r?.ok;
}

export async function telegramConfigurado(): Promise<boolean> {
  return !!tokenBot() && (await chatsOperador()).length > 0;
}

// ── Código de vinculación (enlace t.me/bot?start=CODIGO, válido 30 min) ──

function firmaCodigo(caduca: string): string {
  return createHmac("sha256", `${process.env.CRON_SECRET || ""}|${tokenBot() || ""}|vincular`).update(caduca).digest("hex").slice(0, 32);
}

export function crearCodigoVinculo(): string {
  const caduca = Math.floor(Date.now() / 1000 + 30 * 60).toString(36);
  return `v${caduca}_${firmaCodigo(caduca)}`;
}

export function codigoVinculoValido(codigo: string): boolean {
  const m = /^v([0-9a-z]+)_([0-9a-f]{32})$/.exec(codigo.trim());
  if (!m) return false;
  if (parseInt(m[1], 36) * 1000 < Date.now()) return false;
  const esperado = Buffer.from(firmaCodigo(m[1]));
  const recibido = Buffer.from(m[2]);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

/** Secreto que Telegram envía en cada webhook (derivado, sin variable extra). */
export function secretoWebhook(): string {
  return createHash("sha256")
    .update(`${tokenBot() || ""}|${process.env.CRON_SECRET || ""}|nerox-telegram`)
    .digest("hex")
    .slice(0, 48);
}

export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function teclado(botones?: BotonTelegram[][]) {
  if (!botones?.length) return undefined;
  return {
    inline_keyboard: botones.map((fila) =>
      fila.map((b) => (b.url ? { text: b.texto, url: b.url } : { text: b.texto, callback_data: (b.datos || "").slice(0, 64) }))
    ),
  };
}

export async function llamarTelegram<T = unknown>(metodo: string, cuerpo: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string }> {
  const token = tokenBot();
  if (!token) return { ok: false, description: "Falta TELEGRAM_BOT_TOKEN" };
  try {
    const res = await fetch(`${API}/bot${token}/${metodo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
    });
    return await res.json();
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : String(e) };
  }
}

export async function enviarMensaje(chatId: string | number, html: string, botones?: BotonTelegram[][]) {
  return llamarTelegram("sendMessage", {
    chat_id: chatId,
    text: html.length > 4000 ? `${html.slice(0, 3990)}…` : html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: teclado(botones),
  });
}

export interface EntregaTelegram {
  chat: string;
  ok: boolean;
  error?: string;
}

/** Envía el aviso a todos los operadores configurados y devuelve la entrega por chat. */
export async function avisarOperador(
  html: string,
  botones?: BotonTelegram[][]
): Promise<{ enviados: number; error?: string; entregas: EntregaTelegram[] }> {
  const chats = await chatsOperador();
  if (!tokenBot() || chats.length === 0) {
    return { enviados: 0, error: "Telegram sin configurar", entregas: [{ chat: "—", ok: false, error: !tokenBot() ? "Falta TELEGRAM_BOT_TOKEN" : "Ningún Telegram vinculado (Centro de control → Vincular mi Telegram)" }] };
  }
  const resultados = await Promise.all(chats.map((c) => enviarMensaje(c, html, botones)));
  const entregas = resultados.map((r, i) => ({ chat: chats[i], ok: !!r.ok, error: r.ok ? undefined : r.description || "Error desconocido" }));
  const ok = entregas.filter((e) => e.ok).length;
  return { enviados: ok, error: ok === chats.length ? undefined : entregas.find((e) => !e.ok)?.error, entregas };
}

const COMANDOS = [
  { command: "estado", description: "Revisar el sistema ahora" },
  { command: "incidencias", description: "Ver incidencias abiertas" },
  { command: "informe", description: "Informe de los últimos 7 días" },
  { command: "id", description: "Ver tu chat_id" },
  { command: "ayuda", description: "Qué hace este bot" },
];

/**
 * Comprueba que el bot existe y que su webhook apunta a esta app; si no, lo
 * registra (y los comandos). Así no hace falta ninguna URL manual.
 */
export async function asegurarWebhook(base: string): Promise<{ ok: boolean; bot?: string; cambiado: boolean; error?: string; webhook: string }> {
  const webhook = `${base.replace(/\/+$/, "")}/api/telegram/webhook`;
  if (!tokenBot()) return { ok: false, cambiado: false, error: "Falta TELEGRAM_BOT_TOKEN en Vercel", webhook };
  const yo = await llamarTelegram<{ username: string }>("getMe", {});
  if (!yo.ok) return { ok: false, cambiado: false, error: `Token del bot no válido: ${yo.description || "sin respuesta"}`, webhook };
  const info = await llamarTelegram<{ url: string; last_error_message?: string }>("getWebhookInfo", {});
  if (info.ok && info.result?.url === webhook) return { ok: true, bot: yo.result?.username, cambiado: false, webhook, error: info.result?.last_error_message };
  const r = await llamarTelegram("setWebhook", {
    url: webhook,
    secret_token: secretoWebhook(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  if (r.ok) await llamarTelegram("setMyCommands", { commands: COMANDOS });
  return { ok: !!r.ok, bot: yo.result?.username, cambiado: !!r.ok, error: r.ok ? undefined : r.description, webhook };
}
