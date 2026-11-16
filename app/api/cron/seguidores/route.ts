import { NextRequest, NextResponse } from "next/server";
import { actualizarSeguidores } from "@/lib/estadisticas/seguidores";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Lee los seguidores reales de IG/FB de todas las empresas activas. Lo lanza el vigilante cada hora. */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const r = await actualizarSeguidores();
  return NextResponse.json({ ok: true, instalado: r.instalado, cuentas: r.cuentas, leidas: r.leidas.length, errores: r.errores });
}
