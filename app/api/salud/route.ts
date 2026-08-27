import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { revisarTodosLosBridges } from "@/lib/salud";

export const maxDuration = 30;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { resumen, resultados } = await revisarTodosLosBridges();

  return NextResponse.json({ resumen, resultados });
}
