import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_LIST = process.env.IONOS_BRIDGE_URL_REDES_LIST!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const empresaId = req.nextUrl.searchParams.get("empresa");
  if (!empresaId) return NextResponse.json([], { status: 200 });

  const res = await fetch(BRIDGE_LIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, empresaId }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);
  return NextResponse.json(Array.isArray(data) ? data : []);
}
