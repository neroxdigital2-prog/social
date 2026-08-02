import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID!;
const REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI!; // https://social.nerox.es/api/redes/facebook/callback

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));

  const empresaId = req.nextUrl.searchParams.get("empresa");
  if (!empresaId) {
    return NextResponse.redirect(new URL("/configuracion?error=falta_empresa", req.url));
  }

  const state = Buffer.from(JSON.stringify({ empresaId, userId: session.user.id })).toString("base64url");

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", FACEBOOK_APP_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
