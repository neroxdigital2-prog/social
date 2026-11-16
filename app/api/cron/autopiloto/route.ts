import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ejecutarAutopiloto } from "@/lib/autopiloto/motor";
import { urlApp } from "@/lib/urlApp";

// Generar un Reel (guion + voz + vídeo + subida) tarda 1-2 min.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Piloto automático. Lo lanza el vigilante cada hora (y el botón «Planificar ahora»).
 * Authorization: Bearer CRON_SECRET. ?empresa=ID para una sola empresa. ?esperar=1 para ver el resultado.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const empresaId = req.nextUrl.searchParams.get("empresa") || undefined;
  const base = urlApp(req.nextUrl.origin);
  const tarea = ejecutarAutopiloto(base, { empresaId });

  if (req.nextUrl.searchParams.get("esperar") === "1") {
    const r = await tarea.catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    return NextResponse.json(r);
  }
  waitUntil(tarea.catch((e) => console.error("Piloto automático:", e)));
  return NextResponse.json({ ok: true, lanzado: true });
}
