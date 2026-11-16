// Lectura de métricas reales de cada publicación en Instagram y Facebook
// (Graph API) para las estadísticas de Resultados.
import { urlBridge } from "@/lib/bridgeUrl";

const GRAPH = "https://graph.facebook.com/v21.0";

export interface Pendiente {
  publicacionRedId: string;
  publicacionId: string;
  red: "INSTAGRAM" | "FACEBOOK";
  postIdExterno: string;
  formato: string | null;
  accessToken: string;
}

export interface Metrica {
  publicacionRedId: string;
  publicacionId: string;
  red: string;
  alcance: number;
  reproducciones: number;
  meGusta: number;
  comentarios: number;
  compartidos: number;
  guardados: number;
  interacciones: number;
  error?: string;
}

export async function bridgeEstadisticas<T>(accion: string, datos: Record<string, unknown> = {}): Promise<T | null> {
  const url = urlBridge("IONOS_BRIDGE_URL_ESTADISTICAS");
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET || "" },
      body: JSON.stringify({ accion, ...datos }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    return (data ?? null) as T | null;
  } catch {
    return null;
  }
}

async function graph(ruta: string, token: string): Promise<{ data?: unknown; error?: string; [k: string]: unknown }> {
  try {
    const sep = ruta.includes("?") ? "&" : "?";
    const res = await fetch(`${GRAPH}/${ruta}${sep}access_token=${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d?.error) return { error: d?.error?.message || `HTTP ${res.status}` };
    return d;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function valor(lista: unknown, nombre: string): number {
  const item = (Array.isArray(lista) ? lista : []).find((i: { name?: string }) => i?.name === nombre) as { values?: { value?: number }[]; total_value?: { value?: number } } | undefined;
  return Number(item?.total_value?.value ?? item?.values?.[0]?.value ?? 0) || 0;
}

async function instagram(p: Pendiente): Promise<Omit<Metrica, "publicacionRedId" | "publicacionId" | "red">> {
  const historia = p.formato === "HISTORIA";
  const intentos = historia
    ? ["reach,replies,shares,total_interactions,views", "reach,replies"]
    : ["reach,likes,comments,shares,saved,total_interactions,views", "reach,likes,comments,shares,saved,total_interactions", "reach,likes,comments,saved"];
  let ultimoError = "";
  for (const metricas of intentos) {
    const d = await graph(`${p.postIdExterno}/insights?metric=${metricas}`, p.accessToken);
    if (d.error) {
      ultimoError = String(d.error);
      continue;
    }
    const l = d.data;
    const meGusta = valor(l, "likes");
    const comentarios = valor(l, "comments") + valor(l, "replies");
    const compartidos = valor(l, "shares");
    const guardados = valor(l, "saved");
    return {
      alcance: valor(l, "reach"),
      reproducciones: valor(l, "views"),
      meGusta,
      comentarios,
      compartidos,
      guardados,
      interacciones: valor(l, "total_interactions") || meGusta + comentarios + compartidos + guardados,
    };
  }
  return { alcance: 0, reproducciones: 0, meGusta: 0, comentarios: 0, compartidos: 0, guardados: 0, interacciones: 0, error: ultimoError || "Sin métricas" };
}

async function facebook(p: Pendiente): Promise<Omit<Metrica, "publicacionRedId" | "publicacionId" | "red">> {
  if (p.formato === "VIDEO") {
    const v = await graph(`${p.postIdExterno}?fields=views,video_insights.metric(total_video_impressions_unique,total_video_views)`, p.accessToken);
    if (!v.error) {
      const vi = (v.video_insights as { data?: unknown })?.data;
      return {
        alcance: valor(vi, "total_video_impressions_unique"),
        reproducciones: valor(vi, "total_video_views") || Number(v.views) || 0,
        meGusta: 0,
        comentarios: 0,
        compartidos: 0,
        guardados: 0,
        interacciones: 0,
      };
    }
  }
  const d = await graph(`${p.postIdExterno}?fields=shares,comments.summary(true).limit(0),reactions.summary(true).limit(0),insights.metric(post_impressions_unique)`, p.accessToken);
  if (d.error) return { alcance: 0, reproducciones: 0, meGusta: 0, comentarios: 0, compartidos: 0, guardados: 0, interacciones: 0, error: String(d.error) };
  const meGusta = Number((d.reactions as { summary?: { total_count?: number } })?.summary?.total_count) || 0;
  const comentarios = Number((d.comments as { summary?: { total_count?: number } })?.summary?.total_count) || 0;
  const compartidos = Number((d.shares as { count?: number })?.count) || 0;
  return {
    alcance: valor((d.insights as { data?: unknown })?.data, "post_impressions_unique"),
    reproducciones: 0,
    meGusta,
    comentarios,
    compartidos,
    guardados: 0,
    interacciones: meGusta + comentarios + compartidos,
  };
}

/** Lee y guarda las métricas pendientes (lo lanza el vigilante cada hora). */
export async function actualizarMetricas(limite = 40): Promise<{ leidas: number; errores: number; instalado: boolean }> {
  const pendientes = await bridgeEstadisticas<Pendiente[]>("pendientes_metricas", { limite });
  if (!Array.isArray(pendientes)) return { leidas: 0, errores: 0, instalado: false };
  const metricas: Metrica[] = [];
  for (let i = 0; i < pendientes.length; i += 5) {
    const lote = await Promise.all(
      pendientes.slice(i, i + 5).map(async (p) => ({
        publicacionRedId: p.publicacionRedId,
        publicacionId: p.publicacionId,
        red: p.red,
        ...(p.red === "INSTAGRAM" ? await instagram(p) : await facebook(p)),
      }))
    );
    metricas.push(...lote);
  }
  if (metricas.length) await bridgeEstadisticas("guardar_metricas", { metricas });
  return { leidas: metricas.filter((m) => !m.error).length, errores: metricas.filter((m) => m.error).length, instalado: true };
}
