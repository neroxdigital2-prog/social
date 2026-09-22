import { NextRequest, NextResponse } from "next/server";
import { enviarAlertaWhatsApp, enviarAlertaWhatsAppPlantilla } from "@/lib/salud";

export const maxDuration = 45;

const CRON_SECRET = process.env.CRON_SECRET;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_REDES_TODAS = process.env.IONOS_BRIDGE_URL_REDES_TODAS_LIST!;
const GRAPH_VERSION = "v21.0";

interface RedParaVerificar {
  empresaNombre: string;
  red: "FACEBOOK" | "INSTAGRAM";
  accessToken: string;
  cuentaExterna: string;
}

/**
 * Comprueba si un access_token de Meta sigue siendo válido, con una
 * petición ligera de solo lectura (no publica nada). Los page tokens de
 * Meta no siempre tienen una fecha de caducidad fija: pueden invalidarse
 * antes por un cambio de contraseña o de sesión (ver error real que vimos
 * el 22/09/2026: "The session has been invalidated..."). Por eso se
 * verifica el token en sí, en vez de confiar en un contador de días.
 */
async function tokenSigueValido(cuentaExterna: string, accessToken: string): Promise<{ valido: boolean; motivo?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${cuentaExterna}?fields=id&access_token=${accessToken}`
    );
    const data = await res.json();
    if (!res.ok || data.error) {
      return { valido: false, motivo: data?.error?.message || `HTTP ${res.status}` };
    }
    return { valido: true };
  } catch (err) {
    // Un fallo de red no significa que el token esté mal; no lo contamos como caducado.
    return { valido: true, motivo: err instanceof Error ? err.message : String(err) };
  }
}

async function verificarTokens() {
  const res = await fetch(BRIDGE_REDES_TODAS, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({}),
    cache: "no-store",
  });
  const redes: RedParaVerificar[] = await res.json().catch(() => []);

  const invalidas: { empresaNombre: string; red: string; motivo?: string }[] = [];

  for (const item of Array.isArray(redes) ? redes : []) {
    const resultado = await tokenSigueValido(item.cuentaExterna, item.accessToken);
    if (!resultado.valido) {
      invalidas.push({ empresaNombre: item.empresaNombre, red: item.red, motivo: resultado.motivo });
    }
  }

  if (invalidas.length > 0) {
    await enviarAlertaWhatsAppPlantilla(invalidas.length, Array.isArray(redes) ? redes.length : 0);

    const listado = invalidas
      .map((i) => `• ${i.empresaNombre} (${i.red})${i.motivo ? `: ${i.motivo}` : ""}`)
      .join("\n");
    await enviarAlertaWhatsApp(
      `⚠️ Nerox: ${invalidas.length} cuenta(s) de red social necesitan reconectarse (token caducado o invalidado):\n\n${listado}\n\nVe a Configuración de cada empresa y reconecta Facebook/Instagram.`
    );
  }

  return { total: Array.isArray(redes) ? redes.length : 0, invalidas: invalidas.length, detalle: invalidas };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const tokenRecibido = authHeader?.replace("Bearer ", "");
  if (!CRON_SECRET || tokenRecibido !== CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const resultado = await verificarTokens();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("Error verificando tokens de Meta:", error);
    return NextResponse.json({ error: "Fallo al verificar tokens" }, { status: 502 });
  }
}
