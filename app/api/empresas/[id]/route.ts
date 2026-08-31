import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ACTUALIZAR = process.env.IONOS_BRIDGE_URL_EMPRESA_ACTUALIZAR!;
const BRIDGE_BORRAR = process.env.IONOS_BRIDGE_URL_EMPRESA_BORRAR!;

const BodySchema = z.object({
  nombre: z.string().min(2).optional(),
  sector: z.string().min(2).optional(),
  ciudad: z.string().min(2).optional(),
  servicios: z.array(z.string()).optional(),
  web: z.string().optional(),
  whatsapp: z.string().optional(),
  colorPrimario: z.string().optional(),
  publicoObjetivo: z.string().optional(),
  tonoComunicacion: z.string().optional(),
  objetivoPrincipal: z.string().optional(),
  competidores: z.string().optional(),
  datosVerificables: z.string().max(500).optional(),
  tecnologiasMarcas: z.string().max(300).optional(),
  diferenciador: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!BRIDGE_ACTUALIZAR || !BRIDGE_SECRET) {
    console.error("PATCH /api/empresas/[id]: faltan variables de entorno");
    return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const res = await fetch(BRIDGE_ACTUALIZAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ ...parsed.data, userId: session.user.id, empresaId: params.id }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json({ error: data?.error || "No se pudo actualizar la empresa" }, { status: res.status });
  }

  return NextResponse.json(data, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!BRIDGE_BORRAR || !BRIDGE_SECRET) {
    console.error("DELETE /api/empresas/[id]: faltan variables de entorno");
    return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
  }

  const res = await fetch(BRIDGE_BORRAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, empresaId: params.id }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json({ error: data?.error || "No se pudo borrar la empresa" }, { status: res.status });
  }

  return NextResponse.json(data, { status: 200 });
}
