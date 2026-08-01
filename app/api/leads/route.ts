import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_CREAR = process.env.IONOS_BRIDGE_URL_LEADS_CREATE!;

const BodySchema = z.object({
  empresaId: z.string().min(1),
  nombre: z.string().min(2),
  telefono: z.string().optional(),
  email: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nombre requerido (mínimo 2 caracteres)" }, { status: 400 });
  }

  const res = await fetch(BRIDGE_CREAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({
      userId: session.user.id,
      empresaId: parsed.data.empresaId,
      nombre: parsed.data.nombre,
      telefono: parsed.data.telefono || "",
      email: parsed.data.email || "",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data?.error || "No se pudo crear el lead" }, { status: res.status });
  }

  return NextResponse.json(data, { status: 201 });
}
