import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_GBP_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_GBP_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_GBP_REDIRECT_URI!;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_GUARDAR = process.env.IONOS_BRIDGE_URL_REDES_GUARDAR!;

interface CuentaGoogle {
  name: string; // ej. "accounts/12345"
  accountName?: string;
}

interface UbicacionGoogle {
  name: string; // ej. "locations/67890"
  title?: string;
}

async function guardarRed(empresaId: string, accessToken: string, refreshToken: string, cuentaExterna: string, cuentaSecundaria?: string) {
  await fetch(BRIDGE_GUARDAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ empresaId, red: "GOOGLE", accessToken, refreshToken, cuentaExterna, cuentaSecundaria: cuentaSecundaria ?? "" }),
  });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL(`/configuracion?redes_error=${errorParam}`, req.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/configuracion?redes_error=faltan_parametros", req.url));
  }

  let empresaId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    empresaId = decoded.empresaId;
    if (!empresaId) throw new Error("sin empresaId");
  } catch {
    return NextResponse.redirect(new URL("/configuracion?redes_error=state_invalido", req.url));
  }

  try {
    // 1. Intercambia el codigo por access_token + refresh_token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No se obtuvo access_token: " + JSON.stringify(tokenData));

    const accessToken = tokenData.access_token as string;
    const refreshToken = (tokenData.refresh_token as string) || "";

    // 2. Obtiene la(s) cuenta(s) de Google Business que administra
    const cuentasRes = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const cuentasData = await cuentasRes.json();
    const cuentas: CuentaGoogle[] = cuentasData.accounts || [];

    if (cuentas.length === 0) {
      return NextResponse.redirect(new URL(`/configuracion?redes_error=sin_cuenta_google&empresa=${empresaId}`, req.url));
    }

    // Por ahora tomamos la primera cuenta (caso mas comun: un solo negocio).
    const cuenta = cuentas[0];

    // 3. Obtiene la(s) ubicacion(es) de esa cuenta
    const ubicacionesRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${cuenta.name}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const ubicacionesData = await ubicacionesRes.json();
    const ubicaciones: UbicacionGoogle[] = ubicacionesData.locations || [];

    if (ubicaciones.length === 0) {
      return NextResponse.redirect(new URL(`/configuracion?redes_error=sin_ubicacion_google&empresa=${empresaId}`, req.url));
    }

    // Por ahora tomamos la primera ubicacion (caso mas comun: un solo local).
    const ubicacion = ubicaciones[0];
    const recursoCompleto = `${cuenta.name}/${ubicacion.name}`; // ej. "accounts/12345/locations/67890"

    await guardarRed(empresaId, accessToken, refreshToken, recursoCompleto, ubicacion.title);

    return NextResponse.redirect(new URL(`/configuracion?redes_ok=1&empresa=${empresaId}`, req.url));
  } catch (error) {
    console.error("Error en callback de Google Business:", error instanceof Error ? error.stack : error);
    return NextResponse.redirect(new URL(`/configuracion?redes_error=fallo_interno&empresa=${empresaId}`, req.url));
  }
}
