import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { bridgeVigilante } from "@/lib/vigilante";
import { esOperador } from "@/lib/operador";

export const dynamic = "force-dynamic";

interface Fila { agente: string; dia: string; muestras: number | string; ok: number | string; avisos: number | string; errores: number | string }

/** Histórico de disponibilidad por rango de fechas: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esOperador(session.user.email)) return NextResponse.json({ error: "Solo operadores" }, { status: 403 });

  const u = new URL(req.url);
  const desde = u.searchParams.get("desde") || "";
  const hasta = u.searchParams.get("hasta") || "";
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(desde) || !re.test(hasta) || desde > hasta) return NextResponse.json({ error: "Rango no válido" }, { status: 400 });

  const filas = await bridgeVigilante<Fila[]>("disponibilidad", { desde, hasta });
  return NextResponse.json({
    filas: (Array.isArray(filas) ? filas : []).map((d) => ({
      agente: d.agente,
      dia: String(d.dia).slice(0, 10),
      muestras: Number(d.muestras) || 0,
      ok: Number(d.ok) || 0,
      avisos: Number(d.avisos) || 0,
      errores: Number(d.errores) || 0,
    })),
  });
}
