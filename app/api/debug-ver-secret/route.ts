import { NextResponse } from "next/server";

// ENDPOINT TEMPORAL DE DIAGNOSTICO - BORRAR DESPUES DE USAR.
export async function GET() {
  return NextResponse.json({
    BRIDGE_SECRET: process.env.BRIDGE_SECRET ?? "(no definida)",
  });
}
