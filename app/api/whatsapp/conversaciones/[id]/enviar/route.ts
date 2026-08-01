import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_DETALLE = process.env.IONOS_BRIDGE_URL_WHATSAPP_CONVERSACION_DETALLE!;
const BRIDGE_GUARDAR = process.env.IONOS_BRIDGE_URL_WHATSAPP_MENSAJE_GUARDAR!;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const WHATSAPP_API_VERSION = "v21.0";

const BodySchema = z.object({ mensaje: z.string().min(1) });

interface DetalleConversacion {
  id: string;
  empresaId: string;
  telefono: string;
  nombreContacto: string | null;
  whatsappPhoneNumberId: string | null;
}

async function bridgePost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Falta el mensaje" }, { status: 400 });

  const detalle = await bridgePost(BRIDGE_DETALLE, { userId: session.user.id, conversacionId: params.id });
  if (!detalle.ok || !detalle.data?.id) {
    return NextResponse.json({ error: "Sin acceso a esta conversación" }, { status: 403 });
  }
  const conv = detalle.data as DetalleConversacion;

  if (!conv.whatsappPhoneNumberId) {
    return NextResponse.json({ error: "Esta empresa no tiene número de WhatsApp configurado" }, { status: 400 });
  }

  const envio = await fetch(
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${conv.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conv.telefono,
        type: "text",
        text: { body: parsed.data.mensaje },
      }),
    }
  );

  if (!envio.ok) {
    const errorBody = await envio.text();
    console.error("Error enviando mensaje manual de WhatsApp:", errorBody);
    return NextResponse.json({ error: "No se pudo enviar el mensaje por WhatsApp" }, { status: 502 });
  }

  await bridgePost(BRIDGE_GUARDAR, {
    conversacionId: conv.id,
    empresaId: conv.empresaId,
    telefono: conv.telefono,
    nombreContacto: conv.nombreContacto,
    mensajesNuevos: [{ rol: "HUMANO", contenido: parsed.data.mensaje }],
  });

  return NextResponse.json({ ok: true });
}
