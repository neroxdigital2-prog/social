import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const EmpresaSchema = z.object({
  nombre: z.string().min(2),
  sector: z.string().min(2),
  ciudad: z.string().min(2),
  servicios: z.array(z.string()).default([]),
  web: z.string().url().optional(),
  whatsapp: z.string().optional(),
  agenciaId: z.string().optional(),
});

const BRIDGE_LIST = process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST!;
const BRIDGE_CREATE = process.env.IONOS_BRIDGE_URL_EMPRESAS_CREATE!;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const res = await fetch(BRIDGE_LIST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bridge-Secret": BRIDGE_SECRET,
    },
    body: JSON.stringify({ userId: session.user.id }),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = EmpresaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const res = await fetch(BRIDGE_CREATE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bridge-Secret": BRIDGE_SECRET,
    },
    body: JSON.stringify({ ...parsed.data, userId: session.user.id }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
