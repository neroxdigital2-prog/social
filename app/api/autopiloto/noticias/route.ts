import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { bridgeAuto } from "@/lib/autopiloto/motor";
import { buscarNoticias } from "@/lib/autopiloto/noticias";
import { normalizarConfig, type ConfigAutoPiloto } from "@/lib/autopiloto/plantilla";
import { puedeEditarEmpresa } from "@/lib/autopiloto/acceso";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Vista previa del agente de noticias: lo que encontraría ahora mismo, marcando las ya usadas. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const empresaId = req.nextUrl.searchParams.get("empresa");
  if (!empresaId || !(await puedeEditarEmpresa(session.user.id, empresaId)).ok) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const [cfg, hist] = await Promise.all([
    bridgeAuto<{ config?: Partial<ConfigAutoPiloto> }>("config_leer", { empresaId }),
    bridgeAuto<{ noticias?: { noticiaUrl: string }[] }>("historial", { empresaId, dias: 120 }),
  ]);
  const config = normalizarConfig(cfg?.config);
  const usadas = new Set((hist?.noticias || []).map((n) => n.noticiaUrl));
  const noticias = await buscarNoticias(config.categorias);
  return NextResponse.json(noticias.slice(0, 60).map((n) => ({ ...n, usada: usadas.has(n.url) })));
}
