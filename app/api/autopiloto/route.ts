import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { bridgeAuto, huecosPendientes } from "@/lib/autopiloto/motor";
import { normalizarConfig, type ConfigAutoPiloto } from "@/lib/autopiloto/plantilla";
import { lanzarAutopiloto, puedeEditarEmpresa } from "@/lib/autopiloto/acceso";
import { nombreActor } from "@/lib/operador";
import { urlApp } from "@/lib/urlApp";

export const dynamic = "force-dynamic";

async function acceso(empresaId: string | null) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  if (!empresaId) return { error: NextResponse.json({ error: "Falta la empresa" }, { status: 400 }) };
  const a = await puedeEditarEmpresa(session.user.id, empresaId);
  if (!a.ok) return { error: NextResponse.json({ error: "Sin acceso a esta empresa" }, { status: 403 }) };
  return { session, nombre: a.nombre };
}

/** Configuración del piloto + próximas publicaciones automáticas. */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa");
  const { error, nombre } = await acceso(empresaId);
  if (error) return error;

  const [cfg, proximas, redes, hist] = await Promise.all([
    bridgeAuto<{ existe?: boolean; activo?: boolean; config?: Partial<ConfigAutoPiloto>; actualizadoPor?: string; ultimaEjecucion?: string; ultimoResultado?: unknown; error?: string }>("config_leer", { empresaId }),
    bridgeAuto<unknown[]>("proximas", { empresaId, dias: 8 }),
    bridgeAuto<string[]>("redes_empresa", { empresaId }),
    bridgeAuto<{ noticias?: { noticiaUrl: string; noticiaTitulo: string }[] }>("historial", { empresaId, dias: 365 }),
  ]);
  if (!cfg || cfg.error) {
    return NextResponse.json({ instalado: false, error: "autopiloto.php no responde: sube autopiloto.php y ejecuta autopiloto.sql en IONOS." }, { status: 200 });
  }
  const config = normalizarConfig(cfg.config);
  const pendientes = cfg.activo
    ? await huecosPendientes({ empresaId: empresaId!, nombre: nombre || "", sector: "", ciudad: "", servicios: [], config }).catch(() => [])
    : [];
  return NextResponse.json({
    instalado: true,
    activo: !!cfg.activo,
    config,
    actualizadoPor: cfg.actualizadoPor || null,
    ultimaEjecucion: cfg.ultimaEjecucion || null,
    ultimoResultado: cfg.ultimoResultado || null,
    proximas: Array.isArray(proximas) ? proximas : [],
    pendientes: pendientes.map((h) => ({ hueco: h.hueco, fecha: h.fecha, hora: h.hora, formato: h.formato })),
    redesConectadas: Array.isArray(redes) ? redes : [],
    ideasUsadas: (hist?.noticias || []).filter((n) => n.noticiaUrl?.startsWith("idea:")).map((n) => n.noticiaUrl),
  });
}

const Guardar = z.object({
  empresaId: z.string().min(1),
  activo: z.boolean(),
  config: z.record(z.unknown()),
});

/** Guardar configuración (y lanzar una primera planificación si se activa). */
export async function PUT(req: NextRequest) {
  const parsed = Guardar.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { session, error } = await acceso(parsed.data.empresaId);
  if (error) return error;
  const config = normalizarConfig(parsed.data.config as Partial<ConfigAutoPiloto>);
  const r = await bridgeAuto<{ ok?: boolean; error?: string }>("config_guardar", {
    empresaId: parsed.data.empresaId,
    activo: parsed.data.activo,
    config,
    actor: nombreActor(session!.user),
  });
  if (!r?.ok) return NextResponse.json({ error: r?.error || "No se pudo guardar (¿autopiloto.php subido?)" }, { status: 502 });
  const lanzado = parsed.data.activo ? await lanzarAutopiloto(urlApp(req.nextUrl.origin), parsed.data.empresaId) : false;
  return NextResponse.json({ ok: true, lanzado, config });
}

/** «Planificar ahora»: rellena los huecos pendientes en segundo plano. */
export async function POST(req: NextRequest) {
  const { empresaId } = (await req.json().catch(() => ({}))) as { empresaId?: string };
  const { error } = await acceso(empresaId || null);
  if (error) return error;
  const lanzado = await lanzarAutopiloto(urlApp(req.nextUrl.origin), empresaId);
  return NextResponse.json({ ok: lanzado, mensaje: lanzado ? "Generando en segundo plano: los vídeos tardan 1-2 min cada uno." : "No se pudo lanzar (revisa CRON_SECRET)." });
}
