import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ENDPOINT TEMPORAL DE PRUEBA - BORRAR DESPUES DE USAR.
// Dispara /api/cron/nerox-analiza usando el CRON_SECRET real del servidor,
// asi no hace falta exponerlo para probar manualmente.
export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const res = await fetch(`${base}/api/cron/nerox-analiza`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    cache: "no-store",
  });
  const datos = await res.json().catch(() => ({ error: "Respuesta no es JSON" }));
  return NextResponse.json({ status: res.status, datos });
}
