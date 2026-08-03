import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

const EmpresaSchema = z.object({
  nombre: z.string().min(2),
  sector: z.string().min(2),
  ciudad: z.string().min(2),
  servicios: z.array(z.string()).default([]),
  web: z.string().url().optional(),
  whatsapp: z.string().optional(),
  agenciaId: z.string().optional(),
  // --- Campos de estrategia y marca (nuevos) ---
  publicoObjetivo: z.string().max(200).optional(),
  tonoComunicacion: z.string().optional(),
  objetivoPrincipal: z.string().optional(),
  competidores: z.string().optional(),
  colorPrimario: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

const BRIDGE_LIST = process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST!;
const BRIDGE_CREATE = process.env.IONOS_BRIDGE_URL_EMPRESAS_CREATE!;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;

async function leerJsonSeguro(res: Response): Promise<{ ok: true; data: unknown } | { ok: false; texto: string }> {
  const texto = await res.text();
  try {
    return { ok: true, data: JSON.parse(texto) };
  } catch {
    return { ok: false, texto };
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const res = await fetch(BRIDGE_LIST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bridge-Secret": BRIDGE_SECRET,
    },
    body: JSON.stringify({ userId: session.user.id }),
    cache: "no-store",
  });

  const resultado = await leerJsonSeguro(res);
  if (!resultado.ok) {
    console.error("Respuesta no JSON del bridge en GET /api/empresas:", resultado.texto);
    return NextResponse.json({ error: "El servidor de datos no respondió correctamente" }, { status: 502 });
  }
  return NextResponse.json(resultado.data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = EmpresaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const res = await fetch(BRIDGE_CREATE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bridge-Secret": BRIDGE_SECRET,
    },
    body: JSON.stringify({ ...parsed.data, userId: session.user.id }),
  });

  const resultado = await leerJsonSeguro(res);
  if (!resultado.ok) {
    console.error("Respuesta no JSON del bridge en POST /api/empresas:", resultado.texto);
    return NextResponse.json({ error: "El servidor de datos no respondió correctamente al crear la empresa" }, { status: 502 });
  }
  return NextResponse.json(resultado.data, { status: res.status });
}
