import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ENDPOINT TEMPORAL DE DIAGNOSTICO - BORRAR DESPUES DE USAR.
export async function GET() {
  try {
    const url = process.env.IONOS_BRIDGE_URL_ANALISTA_ESCANEAR;
    if (!url) {
      return NextResponse.json({ error: "Falta la variable IONOS_BRIDGE_URL_ANALISTA_ESCANEAR en Vercel." });
    }

    const res = await fetch(url, {
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
  } catch (error: any) {
    return NextResponse.json({
      errorAtrapado: true,
      mensaje: error?.message || "error desconocido",
      stack: error?.stack?.slice(0, 1500) || null,
    });
  }
}
