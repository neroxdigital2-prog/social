import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

export const maxDuration = 30;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_SUBIR_IMAGEN = process.env.IONOS_BRIDGE_URL_PUBLICACION_SUBIR_IMAGEN!;

const MIMES_PERMITIDOS = ["image/png", "image/jpeg", "image/webp"];
const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024; // 8 MB

const BodySchema = z.object({
  fileBase64: z.string().min(1),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Archivo inválido. Usa PNG, JPG o WEBP." }, { status: 400 });
  }

  if (!MIMES_PERMITIDOS.includes(parsed.data.mimeType)) {
    return NextResponse.json({ error: "Tipo de archivo no permitido" }, { status: 400 });
  }

  const tamanoAproximado = (parsed.data.fileBase64.length * 3) / 4;
  if (tamanoAproximado > TAMANO_MAXIMO_BYTES) {
    return NextResponse.json({ error: "El archivo supera el límite de 8 MB" }, { status: 400 });
  }

  if (!BRIDGE_SUBIR_IMAGEN || !BRIDGE_SECRET) {
    console.error("POST /api/publicaciones/imagen-subir: faltan variables de entorno");
    return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
  }

  const res = await fetch(BRIDGE_SUBIR_IMAGEN, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ fileBase64: parsed.data.fileBase64, mimeType: parsed.data.mimeType }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json({ error: data?.error || "No se pudo subir la imagen" }, { status: res.status });
  }

  return NextResponse.json({ url: data.url }, { status: 200 });
}
