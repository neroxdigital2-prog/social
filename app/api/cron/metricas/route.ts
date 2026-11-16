import { NextRequest, NextResponse } from "next/server";
import { actualizarMetricas } from "@/lib/estadisticas/metricas";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Lee las métricas reales de Instagram y Facebook. Lo lanza el vigilante cada hora (Bearer CRON_SECRET). */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const r = await actualizarMetricas(Number(req.nextUrl.searchParams.get("limite")) || 40);
  return NextResponse.json({ ok: true, ...r });
}
