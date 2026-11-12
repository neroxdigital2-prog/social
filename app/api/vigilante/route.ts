import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { bridgeVigilante, ejecutarVigilante, type LatidoVigilante } from "@/lib/vigilante";
import { telegramConfigurado } from "@/lib/telegram";
import { urlApp } from "@/lib/urlApp";
import { esOperador } from "@/lib/operador";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Estado del vigilante para el Dashboard. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esOperador(session.user.email)) return NextResponse.json({ error: "Solo operadores" }, { status: 403 });
  const latido = await bridgeVigilante<LatidoVigilante>("latido_leer");
  return NextResponse.json({
    instalado: !!latido && !("error" in (latido as object)),
    telegram: telegramConfigurado(),
    ...(latido || {}),
  });
}

/** "Revisar ahora" desde el Dashboard. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esOperador(session.user.email)) return NextResponse.json({ error: "Solo operadores" }, { status: 403 });
  try {
    const informe = await ejecutarVigilante(urlApp(req.nextUrl.origin), { revisarTokens: true });
    return NextResponse.json({ ok: true, informe });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo revisar" }, { status: 500 });
  }
}
