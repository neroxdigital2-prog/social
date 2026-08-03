import { NextRequest, NextResponse } from "next/server";

// ⚠️ ARCHIVO TEMPORAL DE DIAGNÓSTICO — borrar después de resolver el problema del envío de WhatsApp.
// Visita https://social.nerox.es/api/debug-whatsapp-send?para=34641801175 en el navegador
// (cambia el número por el tuyo, sin espacios, con prefijo de país, sin +).

export async function GET(req: NextRequest) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = "1212209208648547"; // el número real de Nerox Digital
  const para = req.nextUrl.searchParams.get("para");

  if (!token) {
    return NextResponse.json({ error: "WHATSAPP_ACCESS_TOKEN no está definido" }, { status: 500 });
  }
  if (!para) {
    return NextResponse.json({ error: "Falta ?para=34XXXXXXXXX en la URL" }, { status: 400 });
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "template",
      template: {
        name: "hello_world",
        language: { code: "en_US" },
      },
    }),
  });

  const data = await res.json().catch(() => null);

  return NextResponse.json({
    status_http: res.status,
    ok: res.ok,
    phoneNumberId_usado: phoneNumberId,
    destinatario_usado: para,
    respuesta_de_meta: data,
  });
}
