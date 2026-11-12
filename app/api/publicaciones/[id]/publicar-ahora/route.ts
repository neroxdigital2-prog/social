import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Programa la publicación para "ya" y lanza el proceso de publicación al instante
// (el mismo que usa el cron), sin esperar al siguiente ciclo.
export const maxDuration = 30;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_REPROGRAMAR = process.env.IONOS_BRIDGE_URL_PUBLICACION_REPROGRAMAR!;
const CRON_SECRET = process.env.CRON_SECRET!;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const ahora = new Date(Date.now() - 60_000).toISOString(); // 1 min atrás: ya "vencida" para el cron
  const res = await fetch(BRIDGE_REPROGRAMAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, publicacionId: params.id, fechaProgramada: ahora }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data?.error || "No se pudo preparar la publicación" }, { status: res.status });

  // Dispara el publicador (responde al momento y sigue en segundo plano)
  const lanzado = await fetch(new URL("/api/cron/publicar", req.nextUrl.origin), {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
    cache: "no-store",
  })
    .then((r) => r.ok)
    .catch(() => false);

  return NextResponse.json({
    ok: true,
    lanzado,
    mensaje: lanzado
      ? "Publicando ahora. En 1-2 minutos verás el resultado en la Biblioteca."
      : "Quedó lista para publicarse en el próximo ciclo automático (máx. 15 min).",
  });
}
