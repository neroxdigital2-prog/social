import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { puedeEditarEmpresa } from "@/lib/autopiloto/acceso";
import { serieSeguidores } from "@/lib/estadisticas/seguidores";

export const dynamic = "force-dynamic";

/** Serie diaria real de seguidores (Instagram + Facebook) de una empresa. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const empresaId = req.nextUrl.searchParams.get("empresa");
  if (!empresaId) return NextResponse.json({ error: "Falta el parámetro empresa." }, { status: 400 });
  const acceso = await puedeEditarEmpresa(session.user.id, empresaId);
  if (!acceso.ok) return NextResponse.json({ error: "No tienes acceso a esta empresa." }, { status: 403 });

  const hoy = new Date().toISOString().slice(0, 10);
  const desde = req.nextUrl.searchParams.get("desde") || new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const hasta = req.nextUrl.searchParams.get("hasta") || hoy;
  const { instalado, serie, ultimaLectura } = await serieSeguidores(empresaId, desde, hasta);

  const ig = serie.filter((p) => p.red === "INSTAGRAM");
  const crecimientoAbsoluto = ig.length >= 2 ? ig[ig.length - 1].seguidores - ig[0].seguidores : null;
  return NextResponse.json({
    instalado,
    desde,
    hasta,
    ultimaLectura,
    serie,
    snapshots: ig.map((p) => ({ fecha: p.fecha, seguidores: p.seguidores, publicaciones: p.publicaciones })),
    crecimientoAbsoluto,
  });
}
