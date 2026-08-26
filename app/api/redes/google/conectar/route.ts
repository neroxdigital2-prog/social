import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_GBP_CLIENT_ID!;
const REDIRECT_URI = process.env.GOOGLE_GBP_REDIRECT_URI!; // https://social.nerox.es/api/redes/google/callback

const SCOPES = ["https://www.googleapis.com/auth/business.manage"].join(" ");

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));

  const empresaId = req.nextUrl.searchParams.get("empresa");
  if (!empresaId) {
    return NextResponse.redirect(new URL("/configuracion?error=falta_empresa", req.url));
  }

  const state = Buffer.from(JSON.stringify({ empresaId, userId: session.user.id })).toString("base64url");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline"); // necesario para recibir refresh_token
  url.searchParams.set("prompt", "consent"); // fuerza a devolver refresh_token incluso si ya se conecto antes
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
