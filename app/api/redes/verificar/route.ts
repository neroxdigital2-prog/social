import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { diagnosticarError, type Diagnostico } from "@/lib/diagnosticoRedes";

// Comprueba EN VIVO cada red conectada de una empresa (solo lectura, no publica nada)
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_CREDENCIALES = process.env.IONOS_BRIDGE_URL_REDES_CREDENCIALES;

interface Credencial {
  red: string;
  accessToken: string;
  refreshToken: string | null;
  cuentaExterna: string;
  cuentaSecundaria: string | null;
}

export interface ResultadoVerificacion {
  red: string;
  ok: boolean | null; // null = esta red no tiene comprobación automática
  mensaje: string;
  diagnostico?: Diagnostico;
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data?.error, data };
}

function fallo(red: string, mensaje: string): ResultadoVerificacion {
  return { red, ok: false, mensaje, diagnostico: diagnosticarError(red, mensaje) };
}

async function verificarFacebook(c: Credencial): Promise<ResultadoVerificacion> {
  const r = await getJson(`${GRAPH}/${c.cuentaExterna}?fields=id,name&access_token=${encodeURIComponent(c.accessToken)}`);
  if (!r.ok) return fallo("FACEBOOK", r.data?.error?.message || "No se pudo leer la página");
  return { red: "FACEBOOK", ok: true, mensaje: `Conexión correcta con la página «${r.data.name}».` };
}

async function verificarInstagram(c: Credencial): Promise<ResultadoVerificacion> {
  const t = encodeURIComponent(c.accessToken);
  const cuenta = await getJson(`${GRAPH}/${c.cuentaExterna}?fields=id,username&access_token=${t}`);
  if (!cuenta.ok) return fallo("INSTAGRAM", cuenta.data?.error?.message || "No se pudo leer la cuenta de Instagram");
  // Este endpoint exige instagram_content_publish: si responde, se puede publicar
  const limite = await getJson(`${GRAPH}/${c.cuentaExterna}/content_publishing_limit?fields=quota_usage,config&access_token=${t}`);
  if (!limite.ok) return fallo("INSTAGRAM", limite.data?.error?.message || "Sin permiso para publicar");
  const usado = limite.data?.data?.[0]?.quota_usage;
  const total = limite.data?.data?.[0]?.config?.quota_total;
  return {
    red: "INSTAGRAM",
    ok: true,
    mensaje: `Conexión correcta con @${cuenta.data.username} y permiso de publicación activo${
      typeof usado === "number" && total ? ` (${usado}/${total} publicaciones en 24 h)` : ""
    }.`,
  };
}

async function verificarGoogle(c: Credencial): Promise<ResultadoVerificacion> {
  if (!c.refreshToken) return fallo("GOOGLE", "Falta el refresh_token de Google.");
  const token = await getJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_GBP_CLIENT_ID!,
      client_secret: process.env.GOOGLE_GBP_CLIENT_SECRET!,
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!token.data?.access_token) {
    const motivo = token.data?.error === "invalid_grant" ? "invalid_grant: token has been expired or revoked" : token.data?.error_description || token.data?.error;
    return fallo("GOOGLE", `No se pudo renovar el token de acceso de Google (${motivo || "sin detalle"}).`);
  }
  const ubicacion = c.cuentaExterna.split("/").slice(-2).join("/"); // "locations/123"
  const ficha = await getJson(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${ubicacion}?readMask=name,title`,
    { headers: { Authorization: `Bearer ${token.data.access_token}` } }
  );
  if (!ficha.ok) return fallo("GOOGLE", ficha.data?.error?.message || ficha.data?.error?.status || "Sin acceso a la ficha");
  return { red: "GOOGLE", ok: true, mensaje: `Conexión correcta con la ficha «${ficha.data.title || c.cuentaSecundaria}».` };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const empresaId = req.nextUrl.searchParams.get("empresa");
  if (!empresaId) return NextResponse.json({ error: "Falta el parámetro empresa" }, { status: 400 });
  if (!BRIDGE_CREDENCIALES) {
    return NextResponse.json(
      { error: "Falta la variable IONOS_BRIDGE_URL_REDES_CREDENCIALES en Vercel (bridge redes-credenciales.php)." },
      { status: 500 }
    );
  }

  const res = await fetch(BRIDGE_CREDENCIALES, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, empresaId }),
    cache: "no-store",
  });
  const credenciales: Credencial[] | { error?: string } = await res.json().catch(() => ({ error: "Respuesta no válida del bridge" }));
  if (!res.ok || !Array.isArray(credenciales)) {
    const error = (credenciales as { error?: string })?.error || `Bridge respondió ${res.status}`;
    return NextResponse.json({ error }, { status: res.status === 403 ? 403 : 502 });
  }

  const resultados = await Promise.all(
    credenciales.map(async (c): Promise<ResultadoVerificacion> => {
      try {
        if (c.red === "FACEBOOK") return await verificarFacebook(c);
        if (c.red === "INSTAGRAM") return await verificarInstagram(c);
        if (c.red === "GOOGLE") return await verificarGoogle(c);
        return { red: c.red, ok: null, mensaje: "Esta red no tiene comprobación automática todavía." };
      } catch (error) {
        const esTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
        return {
          red: c.red,
          ok: null,
          mensaje: esTimeout ? "La red tardó demasiado en responder. Inténtalo de nuevo." : "No se pudo contactar con la red.",
        };
      }
    })
  );

  return NextResponse.json({ resultados, comprobadoEn: new Date().toISOString() });
}
