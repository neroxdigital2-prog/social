import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_PROGRAMADAS = process.env.IONOS_BRIDGE_URL_PUBLICACIONES_PROGRAMADAS_LIST!;
const BRIDGE_MARCAR = process.env.IONOS_BRIDGE_URL_PUBLICACION_MARCAR_RESULTADO!;
const CRON_SECRET = process.env.CRON_SECRET!;
const GRAPH_VERSION = "v21.0";

interface RedConectadaResumen {
  red: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "TIKTOK" | "GOOGLE";
  accessToken: string;
  cuentaExterna: string;
}

interface PublicacionProgramada {
  id: string;
  texto: string;
  hashtags: string[];
  imagenUrl: string | null;
  redesConectadas: RedConectadaResumen[];
}

async function publicarEnFacebook(pageId: string, token: string, texto: string, imagenUrl: string | null) {
  const url = imagenUrl
    ? `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`
    : `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`;

  const body = new URLSearchParams({ access_token: token });
  if (imagenUrl) {
    body.set("url", imagenUrl);
    body.set("caption", texto);
  } else {
    body.set("message", texto);
  }

  const res = await fetch(url, { method: "POST", body });
  const data = await res.json();
  if (!res.ok || data.error) {
    return { error: data?.error?.message || "Error desconocido publicando en Facebook" };
  }
  return { postIdExterno: data.post_id || data.id };
}

async function publicarEnInstagram(igId: string, token: string, texto: string, imagenUrl: string | null) {
  if (!imagenUrl) {
    return { error: "Instagram requiere una imagen; esta publicación no tenía ninguna generada." };
  }

  const crearRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media`, {
    method: "POST",
    body: new URLSearchParams({ image_url: imagenUrl, caption: texto, access_token: token }),
  });
  const crearData = await crearRes.json();
  if (!crearRes.ok || crearData.error || !crearData.id) {
    return { error: crearData?.error?.message || "Error creando el contenedor de Instagram" };
  }

  const publicarRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: crearData.id, access_token: token }),
  });
  const publicarData = await publicarRes.json();
  if (!publicarRes.ok || publicarData.error) {
    return { error: publicarData?.error?.message || "Error publicando el contenedor en Instagram" };
  }
  return { postIdExterno: publicarData.id };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const tokenRecibido = authHeader?.replace("Bearer ", "");
  if (tokenRecibido !== CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const res = await fetch(BRIDGE_PROGRAMADAS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  const publicaciones: PublicacionProgramada[] = await res.json().catch(() => []);

  const resumen = [];

  for (const pub of Array.isArray(publicaciones) ? publicaciones : []) {
    const textoCompleto = `${pub.texto}\n\n${(pub.hashtags || []).join(" ")}`.trim();
    const resultadosPorRed = [];

    for (const red of pub.redesConectadas || []) {
      let resultado: { postIdExterno?: string; error?: string };
      if (red.red === "FACEBOOK") {
        resultado = await publicarEnFacebook(red.cuentaExterna, red.accessToken, textoCompleto, pub.imagenUrl);
      } else if (red.red === "INSTAGRAM") {
        resultado = await publicarEnInstagram(red.cuentaExterna, red.accessToken, textoCompleto, pub.imagenUrl);
      } else {
        continue; // LinkedIn/TikTok/Google: no implementado todavía
      }
      resultadosPorRed.push({ red: red.red, ...resultado });
    }

    if (resultadosPorRed.length > 0) {
      await fetch(BRIDGE_MARCAR, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
        body: JSON.stringify({ publicacionId: pub.id, resultadosPorRed }),
      });
    }

    resumen.push({ publicacionId: pub.id, resultadosPorRed });
  }

  return NextResponse.json({ ok: true, procesadas: resumen.length, detalle: resumen });
}
