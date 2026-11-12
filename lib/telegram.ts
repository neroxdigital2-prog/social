// Avisos del sistema por Telegram (gratis, push instantáneo).
// Variables en Vercel: TELEGRAM_BOT_TOKEN (de @BotFather) y TELEGRAM_CHAT_ID
// (uno o varios separados por comas; el bot responde /start con el tuyo).

import { createHash } from "crypto";

const API = "https://api.telegram.org";

export type BotonTelegram = { texto: string; datos?: string; url?: string };

export function tokenBot(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
}

export function chatsOperador(): string[] {
  return (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function telegramConfigurado(): boolean {
  return !!tokenBot() && chatsOperador().length > 0;
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

/** Envía el aviso a todos los operadores configurados. */
export async function avisarOperador(html: string, botones?: BotonTelegram[][]): Promise<{ enviados: number; error?: string }> {
  const chats = chatsOperador();
  if (!tokenBot() || chats.length === 0) return { enviados: 0, error: "Telegram sin configurar" };
  const resultados = await Promise.all(chats.map((c) => enviarMensaje(c, html, botones)));
  const ok = resultados.filter((r) => r.ok).length;
  return { enviados: ok, error: ok === chats.length ? undefined : resultados.find((r) => !r.ok)?.description };
}
