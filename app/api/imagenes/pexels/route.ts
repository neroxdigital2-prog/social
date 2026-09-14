import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buscarFotosPexels } from "@/lib/pexels";
import { verificarRateLimit } from "@/lib/rateLimiter";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { permitido } = verificarRateLimit(`pexels:${session.user.id}`, 20, 60_000);
  if (!permitido) {
    return NextResponse.json({ error: "Demasiadas búsquedas. Espera un momento." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const pagina = Number(searchParams.get("pagina")) || 1;

  if (!query.trim()) {
    return NextResponse.json({ error: "Falta el parámetro q" }, { status: 400 });
  }

  try {
    const resultado = await buscarFotosPexels(query, pagina, 15);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Error buscando en Pexels:", error);
    return NextResponse.json({ error: "No se pudo buscar en Pexels" }, { status: 502 });
  }
}
