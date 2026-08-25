import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ESCANEAR = process.env.IONOS_BRIDGE_URL_ANALISTA_ESCANEAR!;

const BodySchema = z.object({
  sector: z.string().min(2).max(100),
  ciudad: z.string().min(2).max(100),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Faltan sector y/o ciudad válidos." }, { status: 400 });
  }

  const res = await fetch(BRIDGE_ESCANEAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(parsed.data),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({ error: "Respuesta no válida del bridge" }));
  if (!res.ok) return NextResponse.json(data, { status: res.status });

  return NextResponse.json(data);
}
