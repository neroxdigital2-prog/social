import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { generarPublicaciones, type PerfilEmpresa } from "@/lib/generador";
import { textoDesdeImagen } from "@/lib/textoDesdeImagen";
import { verificarRateLimit } from "@/lib/rateLimiter";

// Genera el texto de UNA publicación manual (no guarda nada): desde una imagen o desde un tema.
export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ACCESO = process.env.IONOS_BRIDGE_URL_EMPRESA_ACCESO!;
const BRIDGE_CONFIG_LISTAR = process.env.IONOS_BRIDGE_URL_CONFIG_API_LISTAR!;

const BodySchema = z.discriminatedUnion("modo", [
  z.object({
    modo: z.literal("imagen"),
    empresaId: z.string().min(1),
    imagenUrl: z.string().url().startsWith("https://"),
    instrucciones: z.string().max(400).optional(),
  }),
  z.object({
    modo: z.literal("tema"),
    empresaId: z.string().min(1),
    tema: z.string().min(3).max(400),
  }),
]);

async function bridgeFetch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { permitido } = verificarRateLimit(`texto-manual:${session.user.id}`, 10, 60_000);
  if (!permitido) return NextResponse.json({ error: "Demasiadas solicitudes. Espera un minuto." }, { status: 429 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  const datos = parsed.data;

  const acceso = await bridgeFetch(BRIDGE_ACCESO, { userId: session.user.id, empresaId: datos.empresaId, rolMinimo: "EDITOR" });
  if (!acceso.ok || !acceso.data?.permitido) return NextResponse.json({ error: "Sin acceso a esta empresa" }, { status: 403 });
  const e = acceso.data.empresa;
  const perfil: PerfilEmpresa = {
    nombre: e.nombre,
    sector: e.sector,
    ciudad: e.ciudad,
    servicios: (Array.isArray(e.servicios) ? e.servicios : []) as string[],
    web: e.web,
    whatsapp: e.whatsapp,
    datosVerificables: e.datosVerificables,
    tecnologiasMarcas: e.tecnologiasMarcas,
    diferenciador: e.diferenciador,
  };

  const config = await bridgeFetch(BRIDGE_CONFIG_LISTAR, { userId: session.user.id, completo: true });
  const guardadas: { proveedor: string; apiKey: string }[] = Array.isArray(config.data) ? config.data : [];
  const clave = (p: string) => guardadas.find((c) => c.proveedor === p)?.apiKey;

  try {
    if (datos.modo === "imagen") {
      const img = await fetch(datos.imagenUrl, { signal: AbortSignal.timeout(20_000) });
      if (!img.ok) return NextResponse.json({ error: "No se pudo leer la imagen subida" }, { status: 400 });
      const mimeType = img.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      if (!mimeType.startsWith("image/")) return NextResponse.json({ error: "El archivo no es una imagen" }, { status: 400 });
      const buffer = Buffer.from(await img.arrayBuffer());
      if (buffer.length > 10 * 1024 * 1024) return NextResponse.json({ error: "Imagen demasiado grande" }, { status: 400 });

      const pub = await textoDesdeImagen(
        { base64: buffer.toString("base64"), mimeType },
        perfil,
        datos.instrucciones,
        clave("GEMINI") || process.env.GEMINI_API_KEY
      );
      return NextResponse.json(pub);
    }

    const [pub] = await generarPublicaciones(
      perfil,
      1,
      { gemini: clave("GEMINI"), groq: clave("GROQ"), cerebras: clave("CEREBRAS"), openrouter: clave("OPENROUTER") },
      datos.tema
    );
    if (!pub) throw new Error("La IA no devolvió ninguna publicación");
    return NextResponse.json(pub);
  } catch (error) {
    console.error("POST /api/generador/texto:", error);
    return NextResponse.json(
      { error: datos.modo === "imagen" ? "No se pudo analizar la imagen con IA. Inténtalo de nuevo." : "No se pudo escribir el texto con IA. Inténtalo de nuevo." },
      { status: 502 }
    );
  }
}
