import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { bridgeAuto } from "@/lib/autopiloto/motor";
import { puedeEditarEmpresa } from "@/lib/autopiloto/acceso";

export const dynamic = "force-dynamic";

/** Aprobar una publicación del piloto que quedó pendiente (pasa a PROGRAMADA). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { empresaId, publicacionId } = (await req.json().catch(() => ({}))) as { empresaId?: string; publicacionId?: string };
  if (!empresaId || !publicacionId || !(await puedeEditarEmpresa(session.user.id, empresaId)).ok) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  const r = await bridgeAuto<{ ok?: boolean }>("aprobar", { publicacionId });
  return NextResponse.json({ ok: !!r?.ok, mensaje: r?.ok ? "Aprobada: se publicará a su hora." : "Ya estaba aprobada o no existe." });
}
