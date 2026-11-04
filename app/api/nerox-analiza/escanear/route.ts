import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { registrarActividad } from "@/lib/registroActividad";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ESCANEAR = process.env.IONOS_BRIDGE_URL_ANALISTA_ESCANEAR!;

const BodySchema = z.object({
  sector: z.string().min(2).max(100),
  ciudad: z.string().min(2).max(100),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Faltan sector y/o ciudad válidos." }, { status: 400 });
  }

  const res = await fetch(BRIDGE_ESCANEAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(parsed.data),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({ error: "Respuesta no válida del bridge" }));
  if (!res.ok) {
    await registrarActividad({
      userId: session.user.id,
      tipo: "BUSQUEDA_RADAR",
      descripcion: `Búsqueda RADAR fallida: "${parsed.data.sector}" en ${parsed.data.ciudad} (${data?.error || res.status})`,
      detalle: { ...parsed.data, ok: false },
    });
    return NextResponse.json(data, { status: res.status });
  }

  // Guarda los números que devuelva el escaneo (total, leads creados, calientes…)
  const numeros = Object.fromEntries(Object.entries(data || {}).filter(([, v]) => typeof v === "number"));
  const extras = Object.entries(numeros)
    .filter(([k]) => k !== "total")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  await registrarActividad({
    userId: session.user.id,
    tipo: "BUSQUEDA_RADAR",
    descripcion: `Búsqueda RADAR: "${parsed.data.sector}" en ${parsed.data.ciudad} — ${data?.total ?? "?"} negocios analizados${extras ? ` (${extras})` : ""}`,
    detalle: { ...parsed.data, ...numeros },
  });

  return NextResponse.json(data);
}
