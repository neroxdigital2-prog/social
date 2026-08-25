import { NextResponse } from "next/server";

// ENDPOINT TEMPORAL DE DIAGNOSTICO - BORRAR DESPUES DE USAR.
export async function GET() {
  const valor = process.env.BRIDGE_SECRET ?? "(no definida)";
  return NextResponse.json({
    BRIDGE_SECRET: valor,
    longitud_caracteres: valor.length,
  });
}
