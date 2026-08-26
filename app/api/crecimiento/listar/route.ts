import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_LISTAR = process.env.IONOS_BRIDGE_URL_SNAPSHOT_LISTAR!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!BRIDGE_LISTAR) {
    return NextResponse.json({ error: "Falta la variable IONOS_BRIDGE_URL_SNAPSHOT_LISTAR en Vercel." }, { status: 500 });
  }

  const empresaId = req.nextUrl.searchParams.get("empresa");
  if (!empresaId) return NextResponse.json({ error: "Falta el parámetro empresa." }, { status: 400 });

  const desde = req.nextUrl.searchParams.get("desde") || undefined;
  const hasta = req.nextUrl.searchParams.get("hasta") || undefined;

  try {
    const res = await fetch(BRIDGE_LISTAR, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({ empresaId, desde, hasta }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ error: "El bridge no devolvió JSON válido." }));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Fallo al conectar con el bridge: " + (error?.message || "error desconocido") }, { status: 502 });
  }
}
