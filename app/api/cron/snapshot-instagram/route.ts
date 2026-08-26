import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const CRON_SECRET = process.env.CRON_SECRET!;
const BRIDGE_INSTAGRAM_TODAS = process.env.IONOS_BRIDGE_URL_REDES_INSTAGRAM_TODAS!;
const BRIDGE_SNAPSHOT_GUARDAR = process.env.IONOS_BRIDGE_URL_SNAPSHOT_GUARDAR!;
const GRAPH_VERSION = "v21.0";

interface CuentaInstagram {
  empresaId: string;
  cuentaExterna: string;
  accessToken: string;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const tokenRecibido = authHeader?.replace("Bearer ", "");
  if (tokenRecibido !== CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resCuentas = await fetch(BRIDGE_INSTAGRAM_TODAS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  const dataCuentas = await resCuentas.json().catch(() => ({ cuentas: [] }));
  const cuentas: CuentaInstagram[] = dataCuentas.cuentas || [];

  const resumen = [];

  for (const cuenta of cuentas) {
    try {
      const graphRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${cuenta.cuentaExterna}?fields=followers_count,media_count&access_token=${cuenta.accessToken}`
      );
      const graphData = await graphRes.json();

      if (!graphRes.ok || graphData.error) {
        resumen.push({ empresaId: cuenta.empresaId, error: graphData?.error?.message || "Error de Meta desconocido" });
        continue;
      }

      await fetch(BRIDGE_SNAPSHOT_GUARDAR, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
        body: JSON.stringify({
          empresaId: cuenta.empresaId,
          cuentaIg: cuenta.cuentaExterna,
          seguidores: graphData.followers_count,
          publicaciones: graphData.media_count,
        }),
      });

      resumen.push({ empresaId: cuenta.empresaId, seguidores: graphData.followers_count });
    } catch (error: any) {
      resumen.push({ empresaId: cuenta.empresaId, error: error?.message || "Error desconocido" });
    }
  }

  return NextResponse.json({ ok: true, procesadas: resumen.length, detalle: resumen });
}
