import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

export const maxDuration = 30;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_SUBIR_LOGO = process.env.IONOS_BRIDGE_URL_SUBIR_LOGO!;

const MIMES_PERMITIDOS = ["image/png", "image/jpeg", "image/webp"];
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

const BodySchema = z.object({
  empresaId: z.string().min(1),
  fileBase64: z.string().min(1),
  fileName: z.string().min(1),
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

  // El base64 pesa ~33% más que el binario original; validamos con margen.
  const tamanoAproximado = (parsed.data.fileBase64.length * 3) / 4;
  if (tamanoAproximado > TAMANO_MAXIMO_BYTES) {
    return NextResponse.json({ error: "El archivo supera el límite de 5 MB" }, { status: 400 });
  }

  const res = await fetch(BRIDGE_SUBIR_LOGO, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({
      empresaId: parsed.data.empresaId,
      fileBase64: parsed.data.fileBase64,
      mimeType: parsed.data.mimeType,
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json({ error: data?.error || "No se pudo subir el logo" }, { status: res.status });
  }

  return NextResponse.json({ url: data.url }, { status: 200 });
}
