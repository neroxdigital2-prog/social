import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { bridgeVigilante } from "@/lib/vigilante";
import { esOperador } from "@/lib/operador";

export const dynamic = "force-dynamic";

/** Correcciones automáticas y avisos generales (partes diarios, resúmenes). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esOperador(session.user.email)) return NextResponse.json({ error: "Solo operadores" }, { status: 403 });
  const datos = await bridgeVigilante<unknown[]>("autocorrecciones", { dias: Number(req.nextUrl.searchParams.get("dias")) || 7 });
  return NextResponse.json(Array.isArray(datos) ? datos : []);
}
