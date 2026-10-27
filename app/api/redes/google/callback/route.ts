import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_SELECCION_GOOGLE,
  DURACION_SELECCION_SEG,
  cifrarSeleccion,
  guardarRedGoogle,
  listarFichasGoogle,
  type SeleccionGoogle,
} from "@/lib/googleBusiness";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_GBP_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_GBP_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_GBP_REDIRECT_URI!;

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
  let userId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    empresaId = decoded.empresaId;
    userId = decoded.userId || "";
    if (!empresaId) throw new Error("sin empresaId");
  } catch {
    return NextResponse.redirect(new URL("/configuracion?redes_error=state_invalido", req.url));
  }

  try {
    // 1. Intercambia el código por access_token + refresh_token
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

    const seleccion: SeleccionGoogle = {
      empresaId,
      userId,
      accessToken: tokenData.access_token as string,
      refreshToken: (tokenData.refresh_token as string) || "",
      exp: Date.now() + DURACION_SELECCION_SEG * 1000,
    };

    // 2. Lista todas las fichas de todas las cuentas que administra
    const fichas = await listarFichasGoogle(seleccion.accessToken);
    if (fichas.length === 0) {
      return NextResponse.redirect(new URL(`/configuracion?redes_error=sin_ubicacion_google&empresa=${empresaId}`, req.url));
    }

    // 3a. Una sola ficha: se conecta directamente
    if (fichas.length === 1) {
      await guardarRedGoogle(empresaId, seleccion, fichas[0]);
      return NextResponse.redirect(new URL(`/configuracion?redes_ok=1&empresa=${empresaId}`, req.url));
    }

    // 3b. Varias fichas: el usuario elige cuál va con esta empresa
    const respuesta = NextResponse.redirect(new URL(`/configuracion/elegir-ficha-google?empresa=${empresaId}`, req.url));
    respuesta.cookies.set(COOKIE_SELECCION_GOOGLE, cifrarSeleccion(seleccion), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: DURACION_SELECCION_SEG,
    });
    return respuesta;
  } catch (error) {
    console.error("Error en callback de Google Business:", error instanceof Error ? error.stack : error);
    return NextResponse.redirect(new URL(`/configuracion?redes_error=fallo_interno&empresa=${empresaId}`, req.url));
  }
}
