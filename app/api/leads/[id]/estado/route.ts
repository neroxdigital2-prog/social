import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ACTUALIZAR = process.env.IONOS_BRIDGE_URL_LEAD_ACTUALIZAR_ESTADO!;

const BodySchema = z.object({
  estado: z.enum(["NUEVO", "CONTACTADO", "CALIFICADO", "PROPUESTA", "GANADO", "PERDIDO"]),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const res = await fetch(BRIDGE_ACTUALIZAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({
      userId: session.user.id,
      leadId: params.id,
      estado: parsed.data.estado,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data?.error || "No se pudo actualizar" }, { status: res.status });
  }

  return NextResponse.json(data, { status: 200 });
}
