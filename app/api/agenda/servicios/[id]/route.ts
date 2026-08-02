import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_GUARDAR = process.env.IONOS_BRIDGE_URL_SERVICIOS_GUARDAR!;
const BRIDGE_ELIMINAR = process.env.IONOS_BRIDGE_URL_SERVICIOS_ELIMINAR!;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { empresaId, nombre, duracionMin, precio, activo } = body;
  if (!empresaId || !nombre) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  const res = await fetch(BRIDGE_GUARDAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({
      userId: session.user.id,
      empresaId,
      id: params.id,
      nombre,
      duracionMin,
      precio,
      activo,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data?.error || "No se pudo actualizar" }, { status: res.status });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const res = await fetch(BRIDGE_ELIMINAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, servicioId: params.id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data?.error || "No se pudo eliminar" }, { status: res.status });
  return NextResponse.json(data);
}
