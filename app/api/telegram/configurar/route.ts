import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { esOperador } from "@/lib/operador";
import { asegurarWebhook, avisarOperador, destinosOperador, tokenBot } from "@/lib/telegram";
import { urlApp } from "@/lib/urlApp";

export const dynamic = "force-dynamic";

/**
 * Conecta el bot de Telegram con la app (registra el webhook y los comandos).
 * Ya no hace falta abrirlo a mano: el Centro de control y el vigilante lo hacen solos.
 * Acceso: sesión de operador, o ?clave=<CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  const conClave = !!secreto && req.nextUrl.searchParams.get("clave") === secreto;
  if (!conClave) {
    const session = await auth();
    if (!session?.user?.id || !esOperador(session.user.email)) {
      return NextResponse.json({ error: "No autorizado: inicia sesión en social.nerox.es (o añade ?clave=<CRON_SECRET>)" }, { status: 401 });
    }
  }
  if (!tokenBot()) {
    return NextResponse.json({ error: "Falta TELEGRAM_BOT_TOKEN en Vercel (créalo con @BotFather) y haz Redeploy." }, { status: 500 });
  }

  const wh = await asegurarWebhook(urlApp(req.nextUrl.origin));
  const destinos = await destinosOperador(true);
  const prueba = destinos.length && wh.ok ? await avisarOperador("🛡️ <b>Vigilante de Nerox conectado.</b>\nTe avisaré aquí de averías y de lo que corrija solo. Escribe /estado para revisar ahora.") : null;

  return NextResponse.json({
    ok: wh.ok,
    bot: wh.bot ? `@${wh.bot}` : null,
    webhook: wh.webhook,
    error: wh.error || null,
    destinos: destinos.length,
    siguientePaso: destinos.length
      ? "Listo. Revisa Telegram: debe haberte llegado un mensaje de prueba."
      : "Entra en social.nerox.es → Centro de control → «Vincular mi Telegram».",
    prueba,
  });
}
