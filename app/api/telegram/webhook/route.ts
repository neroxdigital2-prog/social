import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { chatsOperador, enviarMensaje, escaparHtml, llamarTelegram, secretoWebhook } from "@/lib/telegram";
import { bridgeVigilante, ejecutarVigilante, reintentarEnvios, resolverIncidencia, resumenInforme, silenciarIncidencia } from "@/lib/vigilante";
import { urlApp } from "@/lib/urlApp";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface Actualizacion {
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; from?: { first_name?: string; last_name?: string; username?: string }; message?: { chat: { id: number }; message_id: number; text?: string } };
}

const AYUDA =
  "🛡️ <b>Vigilante de Nerox Social IA</b>\n\nCada 15 min reviso IONOS, publicaciones, envíos a redes y conexiones.\n• Lo que puedo arreglar (reintentos, publicaciones atrasadas) lo arreglo solo y te lo cuento.\n• Lo que necesita una persona te lo aviso con la causa y los pasos.\n\n/estado — revisar ahora\n/incidencias — ver abiertas\n/id — tu chat_id";

function autorizado(chatId: number | string) {
  return chatsOperador().includes(String(chatId));
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secretoWebhook()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const upd = (await req.json().catch(() => ({}))) as Actualizacion;
  const base = urlApp(req.nextUrl.origin);

  // ── Botones de los avisos ──
  if (upd.callback_query) {
    const cq = upd.callback_query;
    const chatId = cq.message?.chat.id;
    if (!chatId || !autorizado(chatId)) {
      await llamarTelegram("answerCallbackQuery", { callback_query_id: cq.id, text: "No autorizado" });
      return NextResponse.json({ ok: true });
    }
    const quien = [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" ") || cq.from?.username || "Operador";
    const actor = `${quien}${cq.from?.username ? ` (@${cq.from.username})` : ""}`;
    const [accion, ...resto] = (cq.data || "").split(":");
    const clave = resto.join(":");
    let respuesta = "Acción no reconocida";
    let estado = "";

    if (accion === "r") {
      const inc = await bridgeVigilante<{ datos?: { ids?: string[] }; agente?: string }>("incidencia_ver", { clave });
      const ok = await reintentarEnvios(inc?.datos?.ids || [], base, { actor, via: "TELEGRAM", clave, agente: inc?.agente || "envios" });
      respuesta = ok ? "Reintentando…" : "No se pudo reintentar";
      estado = ok ? "🔁 Reintento lanzado. Te aviso si vuelve a fallar." : "❌ No se pudo reintentar.";
    } else if (accion === "ok") {
      const ok = await resolverIncidencia(clave, actor, "TELEGRAM", "Marcada como resuelta manualmente");
      respuesta = ok ? "Marcada como resuelta" : "Ya estaba resuelta";
      estado = ok ? `✅ Resuelta por ${escaparHtml(actor)} (si el fallo vuelve, te aviso).` : "ℹ️ Esta incidencia ya estaba resuelta.";
    } else if (accion === "s") {
      const ok = await silenciarIncidencia(clave, actor, "TELEGRAM");
      respuesta = ok ? "Silenciada" : "No estaba abierta";
      estado = ok ? `🔕 Silenciada por ${escaparHtml(actor)} hasta que se resuelva.` : "ℹ️ La incidencia no estaba abierta.";
    }

    await llamarTelegram("answerCallbackQuery", { callback_query_id: cq.id, text: respuesta });
    if (estado && cq.message) {
      await llamarTelegram("editMessageReplyMarkup", { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
      await enviarMensaje(chatId, estado);
    }
    return NextResponse.json({ ok: true });
  }

  // ── Comandos ──
  const msg = upd.message;
  if (!msg?.text) return NextResponse.json({ ok: true });
  const chatId = msg.chat.id;
  const comando = msg.text.trim().split(/[\s@]/)[0].toLowerCase();

  if (comando === "/start" || comando === "/id") {
    await enviarMensaje(
      chatId,
      autorizado(chatId)
        ? `✅ Conectado. Tu chat_id es <code>${chatId}</code>.\n\n${AYUDA}`
        : `Tu chat_id es <code>${chatId}</code>\n\nGuárdalo en Vercel como <b>TELEGRAM_CHAT_ID</b>, haz Redeploy y vuelve a abrir /api/telegram/configurar.`
    );
    return NextResponse.json({ ok: true });
  }
  if (!autorizado(chatId)) return NextResponse.json({ ok: true });

  if (comando === "/estado") {
    await enviarMensaje(chatId, "🔎 Revisando el sistema…");
    waitUntil(
      ejecutarVigilante(base, { revisarTokens: true })
        .then((i) => enviarMensaje(chatId, resumenInforme(i)))
        .catch((e) => enviarMensaje(chatId, `❌ Error revisando: ${escaparHtml(String(e))}`))
    );
  } else if (comando === "/incidencias") {
    const lista = (await bridgeVigilante<{ clave: string; titulo: string; estado: string; ultimaVez: string }[]>("incidencias")) || [];
    await enviarMensaje(
      chatId,
      lista.length
        ? `<b>Incidencias abiertas (${lista.length})</b>\n\n${lista
            .map((i) => `${i.estado === "SILENCIADA" ? "🔕" : "⚠️"} ${escaparHtml(i.titulo)}`)
            .join("\n")}`
        : "✅ No hay incidencias abiertas."
    );
  } else {
    await enviarMensaje(chatId, AYUDA);
  }
  return NextResponse.json({ ok: true });
}
