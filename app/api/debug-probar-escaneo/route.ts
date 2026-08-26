import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ENDPOINT TEMPORAL DE DIAGNOSTICO - BORRAR DESPUES DE USAR.
export async function GET() {
  const res = await fetch(process.env.IONOS_BRIDGE_URL_ANALISTA_ESCANEAR!, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET || "" },
    body: JSON.stringify({ sector: "restaurante", ciudad: "Madrid" }),
    cache: "no-store",
  });
  const texto = await res.text();
  return NextResponse.json({
    status: res.status,
    primeros3000Caracteres: texto.slice(0, 3000),
  });
}
