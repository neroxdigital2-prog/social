import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_LISTAR = process.env.IONOS_BRIDGE_URL_CONFIG_API_LISTAR!;
const BRIDGE_GUARDAR = process.env.IONOS_BRIDGE_URL_CONFIG_API_GUARDAR!;
const BRIDGE_ELIMINAR = process.env.IONOS_BRIDGE_URL_CONFIG_API_ELIMINAR!;

async function bridgePost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const res = await bridgePost(BRIDGE_LISTAR, { userId: session.user.id });
  return NextResponse.json(res.data, { status: res.status });
}

const GuardarSchema = z.object({
  proveedor: z.enum(["GEMINI", "GROQ"]),
  apiKey: z.string().min(10),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = GuardarSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const res = await bridgePost(BRIDGE_GUARDAR, { userId: session.user.id, ...parsed.data });
  return NextResponse.json(res.data, { status: res.status });
}

const EliminarSchema = z.object({ proveedor: z.enum(["GEMINI", "GROQ"]) });

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = EliminarSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const res = await bridgePost(BRIDGE_ELIMINAR, { userId: session.user.id, ...parsed.data });
  return NextResponse.json(res.data, { status: res.status });
}
