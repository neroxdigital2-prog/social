import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_CREAR_MANUAL = process.env.IONOS_BRIDGE_URL_PUBLICACION_CREAR_MANUAL!;

const BodySchema = z.object({
  empresaId: z.string().min(1),
  tipo: z.string().default("INFORMATIVA"),
  titulo: z.string().min(2),
  texto: z.string().min(2),
  hashtags: z.array(z.string()).default([]),
  imagenUrl: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!BRIDGE_CREAR_MANUAL || !BRIDGE_SECRET) {
    console.error("POST /api/publicaciones: faltan variables de entorno");
    return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const res = await fetch(BRIDGE_CREAR_MANUAL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ ...parsed.data, userId: session.user.id }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json({ error: data?.error || "No se pudo crear la publicación" }, { status: res.status });
  }

  return NextResponse.json(data, { status: 201 });
}
