import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_GUARDAR_REDES = process.env.IONOS_BRIDGE_URL_PUBLICACION_GUARDAR_REDES!;

const BodySchema = z.object({
  redes: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!BRIDGE_GUARDAR_REDES || !BRIDGE_SECRET) {
    console.error("POST /api/publicaciones/[id]/redes: faltan variables de entorno", {
      BRIDGE_GUARDAR_REDES: !!BRIDGE_GUARDAR_REDES,
      BRIDGE_SECRET: !!BRIDGE_SECRET,
    });
    return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "redes inválidas" }, { status: 400 });
  }

  const res = await fetch(BRIDGE_GUARDAR_REDES, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({
      userId: session.user.id,
      publicacionId: params.id,
      redes: parsed.data.redes,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json({ error: data?.error || "No se pudieron guardar las redes" }, { status: res.status });
  }

  return NextResponse.json(data, { status: 200 });
}
