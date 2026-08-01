import { NextRequest, NextResponse } from "next/server";
import { generarRespuestaChat } from "@/lib/generadorTexto";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_EMPRESA_POR_NUMERO = process.env.IONOS_BRIDGE_URL_WHATSAPP_EMPRESA_POR_NUMERO!;
const BRIDGE_CONVERSACION_OBTENER = process.env.IONOS_BRIDGE_URL_WHATSAPP_CONVERSACION_OBTENER!;
const BRIDGE_MENSAJE_GUARDAR = process.env.IONOS_BRIDGE_URL_WHATSAPP_MENSAJE_GUARDAR!;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const WHATSAPP_API_VERSION = "v21.0";

interface Empresa {
  id: string;
  nombre: string;
  sector: string;
  ciudad: string;
  servicios: string[];
  web: string | null;
  whatsapp: string | null;
}

interface Mensaje {
  rol: "USUARIO" | "BOT" | "HUMANO";
  contenido: string;
}

interface Conversacion {
  id: string;
  modoHumano: boolean;
  mensajes: Mensaje[];
}

async function bridgePost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

async function enviarMensajeWhatsApp(phoneNumberId: string, para: string, texto: string) {
  await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { body: texto },
    }),
  });
}

function construirSystemPrompt(empresa: Empresa): string {
  return `Eres el asistente de atención al cliente por WhatsApp de "${empresa.nombre}", un negocio de ${empresa.sector} en ${empresa.ciudad}.
Servicios que ofrece: ${empresa.servicios.join(", ") || "no especificados"}.
${empresa.web ? `Web: ${empresa.web}` : ""}

Reglas:
- Responde SIEMPRE en español, de forma breve (máximo 3-4 frases), cercana y profesional, como lo haría un empleado real por WhatsApp.
- Nunca inventes precios, horarios o datos que no tengas. Si te preguntan algo que no sabes, dile que un miembro del equipo le contactará para darle esa información.
- Si el cliente pide hablar con una persona, o parece molesto/urgente, dile que ahora mismo le pasas con el equipo.
- No uses markdown ni emojis en exceso (máximo 1 si aporta calidez).
- El objetivo es informar bien y, si hay interés real, invitar amablemente a dejar sus datos o avanzar hacia una cita/compra.`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Verificación fallida", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const mensaje = value?.messages?.[0];

    // Los webhooks de "estado" (entregado/leído) no traen "messages"; los ignoramos.
    if (!mensaje) {
      return NextResponse.json({ ok: true });
    }

    const phoneNumberId: string = value.metadata?.phone_number_id;
    const telefono: string = mensaje.from;
    const textoUsuario: string = mensaje.text?.body ?? "";
    const nombreContacto: string | undefined = value.contacts?.[0]?.profile?.name;

    if (!phoneNumberId || !telefono || !textoUsuario) {
      return NextResponse.json({ ok: true });
    }

    // 1. Buscar a qué empresa pertenece este número
    const empresaRes = await bridgePost(BRIDGE_EMPRESA_POR_NUMERO, { phoneNumberId });
    const empresa: Empresa | null = empresaRes.ok && empresaRes.data?.id ? empresaRes.data : null;
    if (!empresa) {
      console.error("WhatsApp: ningún empresa tiene configurado phoneNumberId", phoneNumberId);
      return NextResponse.json({ ok: true });
    }

    // 2. Obtener (o crear) la conversación + historial reciente
    const convRes = await bridgePost(BRIDGE_CONVERSACION_OBTENER, {
      empresaId: empresa.id,
      telefono,
      nombreContacto,
    });
    const conversacion: Conversacion | null = convRes.ok && convRes.data?.id ? convRes.data : null;
    if (!conversacion) {
      console.error("WhatsApp: no se pudo obtener/crear la conversación");
      return NextResponse.json({ ok: true });
    }

    // 3. Si está en modo humano (alguien tomó el control manual), solo guardamos, sin responder con IA
    if (conversacion.modoHumano) {
      await bridgePost(BRIDGE_MENSAJE_GUARDAR, {
        conversacionId: conversacion.id,
        empresaId: empresa.id,
        telefono,
        nombreContacto,
        mensajesNuevos: [{ rol: "USUARIO", contenido: textoUsuario }],
      });
      return NextResponse.json({ ok: true });
    }

    // 4. Generar respuesta con IA usando el historial reciente (máx. últimos 12 mensajes)
    const historial = conversacion.mensajes.slice(-12);
    const systemPrompt = construirSystemPrompt(empresa);
    const userPrompt = `Historial reciente de la conversación (más antiguo primero):
${historial.map((m) => `${m.rol === "USUARIO" ? "Cliente" : "Tú"}: ${m.contenido}`).join("\n") || "(sin mensajes previos)"}

Nuevo mensaje del cliente: "${textoUsuario}"

Responde solo con el mensaje que le enviarías por WhatsApp, sin comillas ni etiquetas.`;

    let respuestaIA: string;
    try {
      respuestaIA = await generarRespuestaChat(systemPrompt, userPrompt);
    } catch (error) {
      console.error("Error generando respuesta IA para WhatsApp:", error);
      respuestaIA = "¡Gracias por tu mensaje! En breve alguien de nuestro equipo te responderá.";
    }

    // 5. Enviar la respuesta por WhatsApp
    await enviarMensajeWhatsApp(phoneNumberId, telefono, respuestaIA);

    // 6. Guardar ambos mensajes (usuario + bot) y dejar que el bridge cree/actualice el Lead
    await bridgePost(BRIDGE_MENSAJE_GUARDAR, {
      conversacionId: conversacion.id,
      empresaId: empresa.id,
      telefono,
      nombreContacto,
      mensajesNuevos: [
        { rol: "USUARIO", contenido: textoUsuario },
        { rol: "BOT", contenido: respuestaIA },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error en webhook de WhatsApp:", error);
    // Siempre respondemos 200 para que Meta no reintente en bucle
    return NextResponse.json({ ok: true });
  }
}
