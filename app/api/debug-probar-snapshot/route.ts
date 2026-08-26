import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ENDPOINT TEMPORAL DE PRUEBA - BORRAR DESPUES DE USAR.
export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const res = await fetch(`${base}/api/cron/snapshot-instagram`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    cache: "no-store",
  });
  const texto = await res.text();
  let datos: any;
  try {
    datos = JSON.parse(texto);
  } catch {
    datos = { noEsJson: true, primeros2000Caracteres: texto.slice(0, 2000) };
  }
  return NextResponse.json({ status: res.status, datos });
}
