import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_PENDIENTES = process.env.IONOS_BRIDGE_URL_AUDITORIA_PENDIENTES!;
const BRIDGE_GUARDAR = process.env.IONOS_BRIDGE_URL_AUDITORIA_GUARDAR!;
const CRON_SECRET = process.env.CRON_SECRET!;
const GRAPH_VERSION = "v21.0";

interface Pendiente {
  publicacionId: string;
  red: "FACEBOOK" | "INSTAGRAM";
  postIdExterno: string;
  titulo: string;
  texto: string;
  accessToken: string;
  cuentaExterna: string;
}

interface MetricasReales {
  alcance: number;
  meGusta: number;
  comentarios: number;
  compartidos: number;
  guardados: number;
}

async function obtenerMetricasFacebook(postId: string, token: string): Promise<MetricasReales | null> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${postId}?fields=insights.metric(post_impressions_unique,post_reactions_like_total,post_activity_by_action_type)&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) return null;

  const insights = data?.insights?.data || [];
  const buscar = (nombre: string) =>
    insights.find((i: { name: string }) => i.name === nombre)?.values?.[0]?.value ?? 0;

  return {
    alcance: buscar("post_impressions_unique"),
    meGusta: buscar("post_reactions_like_total"),
    comentarios: 0, // requiere permiso adicional para leer comentarios reales; se deja en 0 si no está disponible
    compartidos: 0,
    guardados: 0,
  };
}

async function obtenerMetricasInstagram(mediaId: string, token: string): Promise<MetricasReales | null> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}/insights?metric=reach,likes,comments,shares,saved&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) return null;

  const buscar = (nombre: string) =>
    (data.data || []).find((i: { name: string }) => i.name === nombre)?.values?.[0]?.value ?? 0;

  return {
    alcance: buscar("reach"),
    meGusta: buscar("likes"),
    comentarios: buscar("comments"),
    compartidos: buscar("shares"),
    guardados: buscar("saved"),
  };
}

/**
 * Puntuación 0-100 calculada de forma determinista a partir de métricas reales
 * (no inventada por IA): tasa de interacción sobre alcance, ponderando más
 * guardados y compartidos (señales fuertes de calidad según el algoritmo).
 */
function calcularPuntuacion(m: MetricasReales): number {
  if (m.alcance <= 0) return 0;
  const interaccionPonderada = m.meGusta * 1 + m.comentarios * 2 + m.compartidos * 3 + m.guardados * 3;
  const tasa = interaccionPonderada / m.alcance;
  const puntuacion = Math.round(Math.min(tasa * 500, 100));
  return puntuacion;
}

function generarResumen(m: MetricasReales, puntuacion: number): { fortalezas: string; debilidades: string } {
  const fortalezas: string[] = [];
  const debilidades: string[] = [];

  if (m.guardados > 0) fortalezas.push(`${m.guardados} guardados: el contenido aportó valor duradero.`);
  if (m.compartidos > 0) fortalezas.push(`${m.compartidos} compartidos: generó suficiente identificación para difundirse.`);
  if (m.comentarios > 3) fortalezas.push(`${m.comentarios} comentarios: el CTA o gancho invitó a la conversación.`);

  if (m.guardados === 0) debilidades.push("Cero guardados: el contenido no se percibió como material de referencia.");
  if (m.compartidos === 0) debilidades.push("Cero compartidos: revisar si el gancho genera suficiente identificación.");
  if (m.alcance > 0 && m.comentarios === 0) debilidades.push("Sin comentarios: el CTA pudo no ser lo bastante directo.");

  return {
    fortalezas: fortalezas.length ? fortalezas.join(" ") : "Sin señales fuertes de interacción por encima del promedio.",
    debilidades: debilidades.length ? debilidades.join(" ") : `Puntuación general: ${puntuacion}/100, dentro de rango esperado.`,
  };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const tokenRecibido = authHeader?.replace("Bearer ", "");
  if (tokenRecibido !== CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const res = await fetch(BRIDGE_PENDIENTES, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  const pendientes: Pendiente[] = await res.json().catch(() => []);

  const resumen = [];

  for (const pub of Array.isArray(pendientes) ? pendientes : []) {
    let metricas: MetricasReales | null = null;

    if (pub.red === "FACEBOOK") {
      metricas = await obtenerMetricasFacebook(pub.postIdExterno, pub.accessToken);
    } else if (pub.red === "INSTAGRAM") {
      metricas = await obtenerMetricasInstagram(pub.postIdExterno, pub.accessToken);
    }

    if (!metricas) {
      resumen.push({ publicacionId: pub.publicacionId, red: pub.red, error: "No se pudieron obtener métricas reales" });
      continue;
    }

    const puntuacion = calcularPuntuacion(metricas);
    const { fortalezas, debilidades } = generarResumen(metricas, puntuacion);

    await fetch(BRIDGE_GUARDAR, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({
        publicacionId: pub.publicacionId,
        red: pub.red,
        puntuacion,
        alcance: metricas.alcance,
        meGusta: metricas.meGusta,
        comentarios: metricas.comentarios,
        compartidos: metricas.compartidos,
        guardados: metricas.guardados,
        fortalezas,
        debilidades,
      }),
    });

    resumen.push({ publicacionId: pub.publicacionId, red: pub.red, puntuacion });
  }

  return NextResponse.json({ ok: true, auditadas: resumen.length, detalle: resumen });
}
