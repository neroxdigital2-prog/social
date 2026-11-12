import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { esOperador, nombreActor } from "@/lib/operador";
import { urlApp } from "@/lib/urlApp";
import { asegurarWebhook, avisarOperador, crearCodigoVinculo, desvincularChat, destinosOperador, tokenBot } from "@/lib/telegram";

export const dynamic = "force-dynamic";

async function sesion() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  if (!esOperador(session.user.email)) return { error: NextResponse.json({ error: "Solo operadores" }, { status: 403 }) };
  return { session };
}

/** Estado de la conexión con Telegram (bot, webhook y destinatarios). Repara el webhook si hace falta. */
export async function GET(req: NextRequest) {
  const { error } = await sesion();
  if (error) return error;
  if (!tokenBot()) {
    return NextResponse.json({ token: false, ok: false, error: "Falta TELEGRAM_BOT_TOKEN en Vercel", destinos: [] });
  }
  const wh = await asegurarWebhook(urlApp(req.nextUrl.origin));
  const destinos = await destinosOperador(true);
  return NextResponse.json({ token: true, ok: wh.ok, bot: wh.bot || null, webhookCambiado: wh.cambiado, error: wh.ok ? null : wh.error, destinos });
}

const ACCIONES = ["enlace", "prueba"] as const;

/** { accion: "enlace" } → enlace t.me para vincular; { accion: "prueba" } → mensaje de prueba. */
export async function POST(req: NextRequest) {
  const { session, error } = await sesion();
  if (error) return error;
  const { accion } = (await req.json().catch(() => ({}))) as { accion?: (typeof ACCIONES)[number] };
  if (!tokenBot()) return NextResponse.json({ error: "Falta TELEGRAM_BOT_TOKEN en Vercel" }, { status: 400 });

  const wh = await asegurarWebhook(urlApp(req.nextUrl.origin));
  if (!wh.bot) return NextResponse.json({ error: wh.error || "El bot no responde" }, { status: 502 });

  if (accion === "prueba") {
    const r = await avisarOperador(`🧪 <b>Mensaje de prueba</b>\nEnviado desde el Centro de control por ${nombreActor(session!.user)}. Si lo lees, los avisos funcionan.`);
    return NextResponse.json({ ok: r.enviados > 0, enviados: r.enviados, error: r.error || null });
  }
  const codigo = crearCodigoVinculo();
  return NextResponse.json({ ok: true, bot: wh.bot, enlace: `https://t.me/${wh.bot}?start=${codigo}`, caducaMin: 30 });
}

/** Desvincular un chat. */
export async function DELETE(req: NextRequest) {
  const { error } = await sesion();
  if (error) return error;
  const chatId = req.nextUrl.searchParams.get("chatId") || "";
  if (!/^-?\d+$/.test(chatId)) return NextResponse.json({ error: "chatId inválido" }, { status: 400 });
  const ok = await desvincularChat(chatId);
  return NextResponse.json({ ok, mensaje: ok ? "Desvinculado." : "Ese chat está en TELEGRAM_CHAT_ID de Vercel: quítalo allí." });
}
