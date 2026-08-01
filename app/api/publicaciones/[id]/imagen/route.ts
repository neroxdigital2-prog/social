import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generarImagen } from "@/lib/generadorImagen";
import { z } from "zod";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
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

  try {
    // Por ahora, sin Supabase Storage configurado, se usa directo la URL de
    // Pollinations (persistente y publica), sin re-subir el archivo a ningun lado.
    // Cuando se configure SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY en Vercel, se puede
    // pasar la clave de Gemini aqui tambien y usar subirImagenDesdeUrl() para
    // guardar una copia propia en vez de depender de un servicio externo.
    const urlFinal = await generarImagen(parsed.data.imagenPrompt);

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
    return NextResponse.json({ error: "Fallo al generar la imagen" }, { status: 502 });
  }
}
