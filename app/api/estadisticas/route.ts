import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { puedeEditarEmpresa } from "@/lib/autopiloto/acceso";
import { bridgeEstadisticas } from "@/lib/estadisticas/metricas";
import { construirInforme, type PublicacionBruta } from "@/lib/estadisticas/analisis";

export const dynamic = "force-dynamic";

/** Resultados de todas las publicaciones con su criterio y métricas reales. ?empresa=&desde=&hasta= */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const empresaId = p.get("empresa");
  if (!empresaId || !(await puedeEditarEmpresa(session.user.id, empresaId)).ok) return NextResponse.json({ error: "Sin acceso a esta empresa" }, { status: 403 });
  const datos = await bridgeEstadisticas<PublicacionBruta[] | { error?: string }>("publicaciones", { empresaId, desde: p.get("desde") || undefined, hasta: p.get("hasta") || undefined });
  if (!Array.isArray(datos)) {
    return NextResponse.json({ error: "estadisticas.php no responde: ejecuta estadisticas.sql y sube estadisticas.php a IONOS." }, { status: 502 });
  }
  return NextResponse.json(construirInforme(datos));
}
