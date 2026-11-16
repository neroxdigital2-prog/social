import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { bridgeVigilante } from "@/lib/vigilante";
import { esOperador } from "@/lib/operador";

export const dynamic = "force-dynamic";

/** Indicadores del periodo: tiempo medio de reparación por agente, % automático, averías recurrentes. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esOperador(session.user.email)) return NextResponse.json({ error: "Solo operadores" }, { status: 403 });
  const dias = Math.max(1, Math.min(365, Number(req.nextUrl.searchParams.get("dias")) || 30));
  const r = await bridgeVigilante<{ agentes?: unknown[]; recurrentes?: unknown[] }>("indicadores", { dias });
  if (!r?.agentes) return NextResponse.json({ error: "vigilante.php no está actualizado (falta la acción indicadores)." }, { status: 502 });
  return NextResponse.json({ dias, agentes: r.agentes, recurrentes: r.recurrentes || [] });
}
