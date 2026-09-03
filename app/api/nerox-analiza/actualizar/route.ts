import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ACTUALIZAR = process.env.IONOS_BRIDGE_URL_ANALISIS_ACTUALIZAR!;

const BodySchema = z.object({
  id: z.string().min(1),
  nombreNegocio: z.string().optional(),
  web: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
  direccion: z.string().optional(),
  diagnostico: z.string().optional(),
  accion: z.string().optional(),
  propuestaVenta: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!BRIDGE_ACTUALIZAR) {
    return NextResponse.json(
      { error: "Falta la variable de entorno IONOS_BRIDGE_URL_ANALISIS_ACTUALIZAR en Vercel." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const res = await fetch(BRIDGE_ACTUALIZAR, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({ error: "El bridge de IONOS no devolvió JSON válido." }));
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: "Fallo al conectar con el bridge: " + (error?.message || "error desconocido") }, { status: 502 });
  }
}
