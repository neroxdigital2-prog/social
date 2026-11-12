import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { registrarActividad, TIPOS_ACTIVIDAD } from "@/lib/registroActividad";
import { urlBridge } from "@/lib/bridgeUrl";

export const dynamic = "force-dynamic";

const BRIDGE = urlBridge("IONOS_BRIDGE_URL_REGISTRO_ACTIVIDAD");
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;

async function llamar(cuerpo: Record<string, unknown>) {
  const res = await fetch(BRIDGE!, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ error: "Respuesta no válida del bridge" }));
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}

function sinBridge() {
  return NextResponse.json(
    { error: "Falta la variable IONOS_BRIDGE_URL_REGISTRO_ACTIVIDAD en Vercel (bridge registro-actividad.php)." },
    { status: 500 }
  );
}

// Listar con filtros: ?empresa=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tipo=&q=
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!BRIDGE) return sinBridge();
  const p = req.nextUrl.searchParams;
  return llamar({
    accion: "listar",
    userId: session.user.id,
    empresaId: p.get("empresa") || "",
    desde: p.get("desde") || "",
    hasta: p.get("hasta") || "",
    tipo: p.get("tipo") || "",
    q: (p.get("q") || "").slice(0, 100),
  });
}

// Editar descripción o nota
const PatchSchema = z.object({
  id: z.string().min(1),
  descripcion: z.string().min(1).max(2000).optional(),
  nota: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!BRIDGE) return sinBridge();
  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  return llamar({ accion: "actualizar", userId: session.user.id, ...parsed.data });
}

// Borrar seleccionados o todo
const DeleteSchema = z.object({
  empresaId: z.string().optional(),
  ids: z.array(z.string().min(1)).max(2000).optional(),
  todo: z.boolean().optional(),
});

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!BRIDGE) return sinBridge();
  const parsed = DeleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || (!parsed.data.todo && !parsed.data.ids?.length)) {
    return NextResponse.json({ error: "Selecciona al menos un registro" }, { status: 400 });
  }
  return llamar({
    accion: "borrar",
    userId: session.user.id,
    empresaId: parsed.data.empresaId || "",
    ids: parsed.data.ids,
    todo: parsed.data.todo === true,
  });
}

// Anotar una acción hecha en el navegador (p. ej. descarga de informe)
const PostSchema = z.object({
  empresaId: z.string().optional(),
  tipo: z.enum(["INFORME_DESCARGADO"]),
  descripcion: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  await registrarActividad({ userId: session.user.id, ...parsed.data });
  return NextResponse.json({ ok: true, tipo: TIPOS_ACTIVIDAD[parsed.data.tipo] });
}
