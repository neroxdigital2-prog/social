import { NextRequest, NextResponse } from "next/server";

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID!;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET!;
const REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI!;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_GUARDAR = process.env.IONOS_BRIDGE_URL_REDES_GUARDAR!;
const GRAPH_VERSION = "v21.0";

interface PaginaFacebook {
  id: string;
  name: string;
  access_token: string;
}

async function guardarRed(empresaId: string, red: string, accessToken: string, cuentaExterna: string, cuentaSecundaria?: string) {
  await fetch(BRIDGE_GUARDAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ empresaId, red, accessToken, cuentaExterna, cuentaSecundaria: cuentaSecundaria ?? "" }),
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
    // 1. Intercambia el código por un token de usuario de corta duración
    const shortRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${FACEBOOK_APP_SECRET}&code=${code}`
    );
    const shortData = await shortRes.json();
    if (!shortData.access_token) throw new Error("No se obtuvo token corto: " + JSON.stringify(shortData));

    // 2. Lo cambia por uno de larga duración (~60 días)
    const longRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FACEBOOK_APP_ID}&client_secret=${FACEBOOK_APP_SECRET}&fb_exchange_token=${shortData.access_token}`
    );
    const longData = await longRes.json();
    const userToken = longData.access_token || shortData.access_token;

    // 3. Obtiene las páginas de Facebook que administra
    const pagesRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?access_token=${userToken}`
    );
    const pagesData = await pagesRes.json();
    const paginas: PaginaFacebook[] = pagesData.data || [];

    if (paginas.length === 0) {
      return NextResponse.redirect(new URL("/configuracion?redes_error=sin_paginas", req.url));
    }

    if (paginas.length === 1) {
      // Solo hay una página disponible: no hace falta elegir, se conecta directamente
      const pagina = paginas[0];
      await guardarRed(empresaId, "FACEBOOK", pagina.access_token, pagina.id, pagina.name);

      const igRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${pagina.id}?fields=instagram_business_account{id,username}&access_token=${pagina.access_token}`
      );
      const igData = await igRes.json();
      const igAccount = igData.instagram_business_account;
      if (igAccount?.id) {
        await guardarRed(empresaId, "INSTAGRAM", pagina.access_token, igAccount.id, igAccount.username);
      }

      return NextResponse.redirect(new URL(`/configuracion?redes_ok=1&empresa=${empresaId}`, req.url));
    }

    // Varias páginas disponibles: guarda la lista temporalmente en la BD y deja elegir al usuario
    const guardarRes = await fetch(process.env.IONOS_BRIDGE_URL_FACEBOOK_SELECCION_GUARDAR!, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({ empresaId, paginas }),
    });
    const guardarData = await guardarRes.json().catch(() => null);
    if (!guardarData?.id) {
      return NextResponse.redirect(new URL("/configuracion?redes_error=fallo_interno", req.url));
    }

    return NextResponse.redirect(
      new URL(`/configuracion/elegir-pagina?empresa=${empresaId}&seleccion=${guardarData.id}`, req.url)
    );
  } catch (error) {
    console.error("Error en callback de Facebook:", error);
    return NextResponse.redirect(new URL("/configuracion?redes_error=fallo_interno", req.url));
  }
}
