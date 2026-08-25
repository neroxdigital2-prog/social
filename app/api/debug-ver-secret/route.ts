import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ENDPOINT TEMPORAL DE DIAGNOSTICO - BORRAR DESPUES DE USAR.
export async function GET() {
  const valor = process.env.BRIDGE_SECRET ?? "(no definida)";
  return NextResponse.json(
    { BRIDGE_SECRET: valor, longitud_caracteres: valor.length },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
