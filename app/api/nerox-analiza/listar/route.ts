import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_LISTAR = process.env.IONOS_BRIDGE_URL_ANALISIS_LISTAR!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined;

  const res = await fetch(BRIDGE_LISTAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ limite: 100, status }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({ error: "Respuesta no válida del bridge" }));
  if (!res.ok) return NextResponse.json(data, { status: res.status });

  return NextResponse.json(data);
}
