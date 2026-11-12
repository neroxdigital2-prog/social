import { NextRequest, NextResponse } from "next/server";
import { avisarOperador, chatsOperador, llamarTelegram, secretoWebhook, tokenBot } from "@/lib/telegram";
import { urlApp } from "@/lib/urlApp";

export const dynamic = "force-dynamic";

/**
 * Conecta el bot de Telegram con la app (registra el webhook).
 * Abrir UNA vez en el navegador: /api/telegram/configurar?clave=<CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.nextUrl.searchParams.get("clave") !== secreto) {
    return NextResponse.json({ error: "No autorizado: añade ?clave=<CRON_SECRET>" }, { status: 401 });
  }
  if (!tokenBot()) {
    return NextResponse.json({ error: "Falta TELEGRAM_BOT_TOKEN en Vercel (créalo con @BotFather) y haz Redeploy." }, { status: 500 });
  }

  const webhook = `${urlApp(req.nextUrl.origin)}/api/telegram/webhook`;
  const registro = await llamarTelegram("setWebhook", {
    url: webhook,
    secret_token: secretoWebhook(),
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await llamarTelegram("setMyCommands", {
    commands: [
      { command: "estado", description: "Revisar el sistema ahora" },
      { command: "incidencias", description: "Ver incidencias abiertas" },
      { command: "informe", description: "Informe de los últimos 7 días" },
      { command: "id", description: "Ver tu chat_id" },
      { command: "ayuda", description: "Qué hace este bot" },
    ],
  });
  const bot = await llamarTelegram<{ username: string }>("getMe", {});

  const chats = chatsOperador();
  const prueba = chats.length
    ? await avisarOperador("🛡️ <b>Vigilante de Nerox conectado.</b>\nTe avisaré aquí de averías y de lo que corrija solo. Escribe /estado para revisar ahora.")
    : null;

  return NextResponse.json({
    ok: registro.ok,
    webhook,
    bot: bot.result ? `@${bot.result.username}` : null,
    telegram: registro.description,
    chatsConfigurados: chats.length,
    siguientePaso: chats.length
      ? "Listo. Revisa Telegram: debe haberte llegado un mensaje de prueba."
      : "Abre el bot en Telegram, escribe /start, copia el número que te responde y guárdalo en Vercel como TELEGRAM_CHAT_ID. Luego Redeploy y vuelve a abrir esta URL.",
    prueba,
  });
}
