import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ENDPOINT TEMPORAL DE DIAGNOSTICO - BORRAR DESPUES DE USAR.
export async function GET() {
  return NextResponse.json({
    CRON_SECRET: process.env.CRON_SECRET ?? "(no definida)",
  });
}
