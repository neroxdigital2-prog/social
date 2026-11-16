import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { puedeEditarEmpresa } from "@/lib/autopiloto/acceso";
import { actualizarSeguidores } from "@/lib/estadisticas/seguidores";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/** Botón "Leer ahora": consulta a Meta los seguidores reales de la empresa y guarda el dato de hoy. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { empresaId } = await req.json().catch(() => ({}));
  if (!empresaId) return NextResponse.json({ error: "Falta la empresa." }, { status: 400 });
  const acceso = await puedeEditarEmpresa(session.user.id, String(empresaId));
  if (!acceso.ok) return NextResponse.json({ error: "No tienes acceso a esta empresa." }, { status: 403 });

  const r = await actualizarSeguidores(String(empresaId));
  if (!r.instalado) return NextResponse.json({ error: "Falta ejecutar estadisticas.sql y subir estadisticas.php a IONOS." }, { status: 503 });
  if (!r.cuentas) return NextResponse.json({ error: "No hay Instagram ni Facebook conectados en esta empresa (Redes sociales)." }, { status: 404 });
  const ok = r.leidas.map((l) => `${l.red === "INSTAGRAM" ? "Instagram" : "Facebook"}: ${l.seguidores.toLocaleString("es-ES")}`).join(" · ");
  const mal = r.errores.map((e) => `${e.red === "INSTAGRAM" ? "Instagram" : "Facebook"}: ${e.error}`).join(" · ");
  return NextResponse.json({ ok: r.leidas.length > 0, mensaje: [ok && `Leído de Meta → ${ok}`, mal && `Sin leer → ${mal}`].filter(Boolean).join(". ") }, { status: r.leidas.length ? 200 : 502 });
}
