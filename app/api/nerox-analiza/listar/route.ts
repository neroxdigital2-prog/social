import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_LISTAR = process.env.IONOS_BRIDGE_URL_ANALISIS_LISTAR!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!BRIDGE_LISTAR) {
    return NextResponse.json(
      { error: "Falta la variable de entorno IONOS_BRIDGE_URL_ANALISIS_LISTAR en Vercel." },
      { status: 500 }
    );
  }

  const status = req.nextUrl.searchParams.get("status") || undefined;

  try {
    const res = await fetch(BRIDGE_LISTAR, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({ limite: 100, status }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({ error: "El bridge de IONOS no devolvió JSON válido." }));
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Fallo al conectar con el bridge: " + (error?.message || "error desconocido") }, { status: 502 });
  }
}
