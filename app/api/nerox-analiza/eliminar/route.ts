import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ELIMINAR = process.env.IONOS_BRIDGE_URL_ANALISIS_ELIMINAR!;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!BRIDGE_ELIMINAR) {
    return NextResponse.json(
      { error: "Falta la variable de entorno IONOS_BRIDGE_URL_ANALISIS_ELIMINAR en Vercel." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  try {
    const res = await fetch(BRIDGE_ELIMINAR, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({ id }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({ error: "El bridge de IONOS no devolvió JSON válido." }));
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Fallo al conectar con el bridge: " + (error?.message || "error desconocido") }, { status: 502 });
  }
}
