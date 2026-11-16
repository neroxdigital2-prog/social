import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { bridgeAuto } from "@/lib/autopiloto/motor";
import { puedeEditarEmpresa } from "@/lib/autopiloto/acceso";

export const dynamic = "force-dynamic";

async function acceso(empresaId: string | null | undefined) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!empresaId || !(await puedeEditarEmpresa(session.user.id, empresaId)).ok) return NextResponse.json({ error: "Sin acceso a esta empresa" }, { status: 403 });
  return null;
}

const ERROR_BRIDGE = "autopiloto.php no responde: ejecuta autopiloto.sql y sube autopiloto.php a IONOS.";

/** Catálogo de apps listas para vender. */
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa");
  const err = await acceso(empresaId);
  if (err) return err;
  const apps = await bridgeAuto<unknown[]>("apps_listar", { empresaId });
  if (!Array.isArray(apps)) return NextResponse.json({ error: ERROR_BRIDGE }, { status: 502 });
  return NextResponse.json(apps);
}

const App = z.object({
  id: z.string().max(191).optional(),
  nombre: z.string().trim().min(2).max(191),
  resumen: z.string().max(500).optional().default(""),
  problema: z.string().max(3000).optional().default(""),
  publico: z.string().max(500).optional().default(""),
  funciones: z.string().max(4000).optional().default(""),
  precio: z.string().max(191).optional().default(""),
  entrega: z.string().max(191).optional().default(""),
  demoUrl: z.string().max(700).optional().default(""),
  palabraClave: z.string().max(40).optional().default("APP"),
  imagenes: z.array(z.string().url().startsWith("https://")).max(10).optional().default([]),
});

/** Crear o editar una app. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { empresaId?: string; app?: unknown };
  const err = await acceso(body.empresaId);
  if (err) return err;
  const parsed = App.safeParse(body.app);
  if (!parsed.success) return NextResponse.json({ error: "Revisa los datos: el nombre es obligatorio y las capturas deben ser URLs https." }, { status: 400 });
  const r = await bridgeAuto<{ ok?: boolean; id?: string; error?: string }>("app_guardar", { empresaId: body.empresaId, app: parsed.data });
  if (!r?.ok) return NextResponse.json({ error: r?.error || ERROR_BRIDGE }, { status: 502 });
  return NextResponse.json({ ok: true, id: r.id });
}

/** Pausar / reactivar. */
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { empresaId?: string; id?: string; estado?: string };
  const err = await acceso(body.empresaId);
  if (err) return err;
  const r = await bridgeAuto<{ ok?: boolean; estado?: string }>("app_estado", { empresaId: body.empresaId, id: body.id, estado: body.estado === "PAUSADA" ? "PAUSADA" : "ACTIVA" });
  if (!r?.ok) return NextResponse.json({ error: "No se pudo cambiar el estado." }, { status: 502 });
  return NextResponse.json({ ok: true, estado: r.estado });
}

/** Borrar. */
export async function DELETE(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresa");
  const err = await acceso(empresaId);
  if (err) return err;
  const r = await bridgeAuto<{ ok?: boolean }>("app_borrar", { empresaId, id: req.nextUrl.searchParams.get("id") });
  if (!r?.ok) return NextResponse.json({ error: "No se pudo borrar." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
