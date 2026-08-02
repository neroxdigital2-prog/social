import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ESTADO = process.env.IONOS_BRIDGE_URL_CITAS_ACTUALIZAR_ESTADO!;

const BodySchema = z.object({
  estado: z.enum(["PENDIENTE", "CONFIRMADA", "CANCELADA", "COMPLETADA", "NO_ASISTIO"]),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  const res = await fetch(BRIDGE_ESTADO, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, citaId: params.id, estado: parsed.data.estado }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data?.error || "No se pudo actualizar" }, { status: res.status });
  return NextResponse.json(data);
}
