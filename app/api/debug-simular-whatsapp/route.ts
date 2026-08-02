import { NextRequest, NextResponse } from "next/server";

// ⚠️ ARCHIVO TEMPORAL DE DIAGNÓSTICO — borrar cuando WhatsApp real ya esté propagado.
// Visita https://social.nerox.es/api/debug-simular-whatsapp?texto=Hola,%20que%20ofreceis
// Llama directamente a nuestro propio webhook con un payload idéntico al que mandaría Meta,
// para probar el flujo completo (IA + guardado + lead) sin depender de la red de WhatsApp.

export async function GET(req: NextRequest) {
  const texto = req.nextUrl.searchParams.get("texto") || "Hola, ¿qué servicios ofrecen?";
  const telefonoSimulado = "34600000001"; // número ficticio, no es real

  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1212209208648547" },
              contacts: [{ profile: { name: "Cliente de Prueba" } }],
              messages: [
                {
                  from: telefonoSimulado,
                  id: "wamid.SIMULADO" + Date.now(),
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: texto },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const base = req.nextUrl.origin;
  const res = await fetch(`${base}/api/whatsapp/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  return NextResponse.json({
    nota: "Esto simula un mensaje entrante, no usa WhatsApp real. Revisa /whatsapp y /crm para ver el resultado.",
    status_webhook: res.status,
    respuesta_webhook: data,
  });
}
