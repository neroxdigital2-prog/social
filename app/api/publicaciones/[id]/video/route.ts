import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { generarReel } from "@/lib/reel";

// Render de vídeo: guion IA + voz + metraje Pexels + FFmpeg. Necesita tiempo.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_LIST = process.env.IONOS_BRIDGE_URL_PUBLICACIONES_LIST!;
const BRIDGE_EMPRESAS = process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST!;
const BRIDGE_SUBIR_VIDEO = process.env.IONOS_BRIDGE_URL_PUBLICACION_SUBIR_VIDEO!;
const BRIDGE_VIDEO_GUARDAR = process.env.IONOS_BRIDGE_URL_PUBLICACION_VIDEO_GUARDAR!;

interface PublicacionBridge {
  id: string;
  titulo: string;
  texto: string;
  imagenPrompt: string | null;
  imagenUrl: string | null;
}

async function bridgeJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}

async function guardarVideo(userId: string, publicacionId: string, cambios: { videoUrl?: string | null; formato?: "IMAGEN" | "VIDEO" }) {
  return bridgeJson(BRIDGE_VIDEO_GUARDAR, { userId, publicacionId, ...cambios });
}

function faltanVariables(): boolean {
  return !BRIDGE_SECRET || !BRIDGE_LIST || !BRIDGE_EMPRESAS || !BRIDGE_SUBIR_VIDEO || !BRIDGE_VIDEO_GUARDAR;
}

// POST: genera el Reel 9:16 y lo deja como formato de la publicación
const PostSchema = z.object({ empresaId: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (faltanVariables()) {
    console.error("POST video: faltan variables IONOS_BRIDGE_URL_PUBLICACION_SUBIR_VIDEO / _VIDEO_GUARDAR");
    return NextResponse.json({ error: "Configuración del servidor incompleta (bridges de vídeo)." }, { status: 500 });
  }

  const parsed = PostSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Falta empresaId" }, { status: 400 });
  const userId = session.user.id;
  const { empresaId } = parsed.data;

  // El bridge solo devuelve publicaciones de empresas a las que el usuario tiene acceso
  const [lista, empresas] = await Promise.all([
    bridgeJson(BRIDGE_LIST, { userId, empresaId }),
    bridgeJson(BRIDGE_EMPRESAS, { userId }),
  ]);
  const pub = (Array.isArray(lista.data) ? (lista.data as PublicacionBridge[]) : []).find((p) => p.id === params.id);
  if (!pub) return NextResponse.json({ error: "Publicación no encontrada" }, { status: 404 });
  const empresa = (Array.isArray(empresas.data) ? empresas.data : []).find((e: { id: string }) => e.id === empresaId);

  try {
    const reel = await generarReel({
      empresa: empresa?.nombre || "",
      titulo: pub.titulo,
      texto: pub.texto,
      imagenPrompt: pub.imagenPrompt || undefined,
      imagenUrl: pub.imagenUrl,
    });

    const subida = await fetch(BRIDGE_SUBIR_VIDEO, {
      method: "POST",
      headers: { "Content-Type": "video/mp4", "X-Bridge-Secret": BRIDGE_SECRET },
      body: new Uint8Array(reel.mp4),
    });
    const datosSubida = await subida.json().catch(() => null);
    if (!subida.ok || !datosSubida?.url) {
      return NextResponse.json({ error: datosSubida?.error || "No se pudo subir el vídeo a IONOS" }, { status: 502 });
    }

    const guardado = await guardarVideo(userId, params.id, { videoUrl: datosSubida.url, formato: "VIDEO" });
    if (!guardado.ok) {
      return NextResponse.json({ error: guardado.data?.error || "No se pudo guardar el vídeo" }, { status: guardado.status });
    }

    return NextResponse.json({
      videoUrl: datosSubida.url,
      formato: "VIDEO",
      segundos: Math.round(reel.segundos),
      conVoz: reel.conVoz,
      conMusica: reel.conMusica,
      guion: reel.guion,
    });
  } catch (error) {
    console.error("POST /api/publicaciones/[id]/video:", error);
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: `No se pudo generar el vídeo: ${mensaje.slice(0, 200)}` }, { status: 500 });
  }
}

// PATCH: elegir formato (IMAGEN / VIDEO) sin regenerar
const PatchSchema = z.object({ formato: z.enum(["IMAGEN", "VIDEO"]) });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (faltanVariables()) return NextResponse.json({ error: "Configuración del servidor incompleta (bridges de vídeo)." }, { status: 500 });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Formato inválido" }, { status: 400 });

  const r = await guardarVideo(session.user.id, params.id, { formato: parsed.data.formato });
  if (!r.ok) return NextResponse.json({ error: r.data?.error || "No se pudo cambiar el formato" }, { status: r.status });
  return NextResponse.json({ formato: parsed.data.formato });
}

// DELETE: quitar el vídeo y volver a imagen
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (faltanVariables()) return NextResponse.json({ error: "Configuración del servidor incompleta (bridges de vídeo)." }, { status: 500 });

  const r = await guardarVideo(session.user.id, params.id, { videoUrl: null, formato: "IMAGEN" });
  if (!r.ok) return NextResponse.json({ error: r.data?.error || "No se pudo quitar el vídeo" }, { status: r.status });
  return NextResponse.json({ ok: true });
}
