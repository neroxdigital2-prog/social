import { NextRequest, NextResponse } from "next/server";
import { ejecutarVigilante } from "@/lib/vigilante";
import { urlApp } from "@/lib/urlApp";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Vigilante automático. Lo dispara cron-job.org cada 15 min con
 * Authorization: Bearer CRON_SECRET. Revisa bridges, publicaciones atrasadas,
 * envíos fallidos y (1 vez por hora) las conexiones de redes. Corrige lo que
 * puede y avisa por Telegram de lo demás. ?tokens=1 fuerza revisar conexiones.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const revisarTokens = req.nextUrl.searchParams.get("tokens") === "1" || new Date().getUTCMinutes() < 15;
  try {
    const informe = await ejecutarVigilante(urlApp(req.nextUrl.origin), { revisarTokens });
    return NextResponse.json({ ok: true, ...informe });
  } catch (error) {
    console.error("Vigilante:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
