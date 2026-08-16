import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generarPublicaciones } from "@/lib/generador";
import { verificarRateLimit } from "@/lib/rateLimiter";
import { z } from "zod";

export const maxDuration = 60;

const BodySchema = z.object({
  cantidad: z.number().min(1).max(10).default(10),
  tema: z.string().max(300).optional(),
});

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ACCESO = process.env.IONOS_BRIDGE_URL_EMPRESA_ACCESO!;
const BRIDGE_CONTAR = process.env.IONOS_BRIDGE_URL_PUBLICACIONES_CONTAR!;
const BRIDGE_CREAR = process.env.IONOS_BRIDGE_URL_PUBLICACIONES_CREAR!;
const BRIDGE_CONFIG_LISTAR = process.env.IONOS_BRIDGE_URL_CONFIG_API_LISTAR!;

const LIMITES_PLAN: Record<string, number> = {
  GRATIS: 5,
  PRO: Infinity,
  AGENCIA: Infinity,
};

async function bridgeFetch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(body),
  });
  const textoCrudo = await res.text();
  let data: any;
  try {
    data = JSON.parse(textoCrudo);
  } catch {
    data = { error: "Respuesta no es JSON válido" };
  }
  return { ok: res.ok, status: res.status, data };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { permitido: permitidoRate } = verificarRateLimit(`generar:${session.user.id}`, 5, 60_000);
  if (!permitidoRate) {
    return NextResponse.json({ error: "Demasiadas solicitudes de generación. Espera un minuto." }, { status: 429 });
  }

  const acceso = await bridgeFetch(BRIDGE_ACCESO, {
    userId: session.user.id,
    empresaId: params.id,
    rolMinimo: "EDITOR",
  });

  if (!acceso.ok || !acceso.data.permitido) {
    return NextResponse.json({ error: "Sin acceso a esta empresa" }, { status: 403 });
  }
  const empresa = acceso.data.empresa;

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  const cantidad = parsed.success ? parsed.data.cantidad : 10;
  const tema = parsed.success ? parsed.data.tema : undefined;

  const limiteMensual = LIMITES_PLAN[empresa.userPlan] ?? 5;

  if (limiteMensual !== Infinity) {
    const contar = await bridgeFetch(BRIDGE_CONTAR, { empresaId: empresa.id });
    const generadasEsteMes = contar.data?.count ?? 0;

    if (generadasEsteMes + cantidad > limiteMensual) {
      const disponibles = Math.max(0, limiteMensual - generadasEsteMes);
      return NextResponse.json(
        {
          error: "limite_plan",
          mensaje:
            disponibles === 0
              ? `Ya usaste tus ${limiteMensual} publicaciones del mes en tu plan ${empresa.userPlan}.`
              : `Solo puedes generar ${disponibles} publicación(es) más este mes.`,
        },
        { status: 403 }
      );
    }
  }

  const configRes = await bridgeFetch(BRIDGE_CONFIG_LISTAR, { userId: session.user.id, completo: true });
  const clavesGuardadas: { proveedor: string; apiKey: string }[] = Array.isArray(configRes.data)
    ? configRes.data
    : [];

  const claves = {
    gemini: clavesGuardadas.find((c) => c.proveedor === "GEMINI")?.apiKey,
    groq: clavesGuardadas.find((c) => c.proveedor === "GROQ")?.apiKey,
    cerebras: clavesGuardadas.find((c) => c.proveedor === "CEREBRAS")?.apiKey,
    openrouter: clavesGuardadas.find((c) => c.proveedor === "OPENROUTER")?.apiKey,
  };

  try {
    const generadas = await generarPublicaciones(
      {
        nombre: empresa.nombre,
        sector: empresa.sector,
        ciudad: empresa.ciudad,
        servicios: empresa.servicios as string[],
        web: empresa.web,
        whatsapp: empresa.whatsapp,
      },
      cantidad,
      claves,
      tema
    );

    const crear = await bridgeFetch(BRIDGE_CREAR, { empresaId: empresa.id, publicaciones: generadas });

    if (!crear.ok) {
      console.error("Fallo al guardar publicaciones:", crear.data);
      return NextResponse.json({ error: "Fallo al guardar publicaciones" }, { status: 502 });
    }

    return NextResponse.json(crear.data, { status: 201 });
  } catch (error) {
    console.error("Error generando publicaciones:", error);
    return NextResponse.json({ error: "Fallo al generar contenido con IA" }, { status: 502 });
  }
}
