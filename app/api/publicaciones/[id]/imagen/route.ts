import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generarImagen } from "@/lib/generadorImagen";
import { subirImagenDesdeUrl } from "@/lib/storage";
import { z } from "zod";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_CONFIG_LISTAR = process.env.IONOS_BRIDGE_URL_CONFIG_API_LISTAR!;
const BRIDGE_ACTUALIZAR_IMAGEN = process.env.IONOS_BRIDGE_URL_PUBLICACIONES_ACTUALIZAR_IMAGEN!;

const BodySchema = z.object({ imagenPrompt: z.string().min(3) });

async function bridgeFetch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Falta el imagenPrompt" }, { status: 400 });

  // Usa la clave de Gemini propia del usuario si la configuró; si no, la de plataforma
  // (definida dentro de lib/generadorImagen.ts vía GEMINI_API_KEY). Pollinations no
  // necesita clave, así que siempre queda como respaldo final.
  const configRes = await bridgeFetch(BRIDGE_CONFIG_LISTAR, { userId: session.user.id, completo: true });
  const clavesGuardadas: { proveedor: string; apiKey: string }[] = Array.isArray(configRes.data)
    ? configRes.data
    : [];
  const geminiKey = clavesGuardadas.find((c) => c.proveedor === "GEMINI")?.apiKey;

  try {
    const urlTemporal = await generarImagen(parsed.data.imagenPrompt, { gemini: geminiKey });

    const extension = urlTemporal.startsWith("data:image/jpeg") ? "jpg" : "png";
    const nombreArchivo = `publicaciones/${params.id}-${Date.now()}.${extension}`;
    const urlFinal = await subirImagenDesdeUrl(urlTemporal, nombreArchivo);

    const actualizar = await bridgeFetch(BRIDGE_ACTUALIZAR_IMAGEN, {
      userId: session.user.id,
      publicacionId: params.id,
      imagenUrl: urlFinal,
    });

    if (!actualizar.ok) {
      return NextResponse.json({ error: "No se pudo guardar la imagen" }, { status: 502 });
    }

    return NextResponse.json({ imagenUrl: urlFinal }, { status: 200 });
  } catch (error) {
    console.error("Error generando imagen:", error);
    return NextResponse.json({ error: "Fallo al generar la imagen con todos los proveedores disponibles" }, { status: 502 });
  }
}
