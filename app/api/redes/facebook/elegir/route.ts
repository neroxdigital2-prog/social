import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const cookie = req.cookies.get("fb_pag_pend")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "La selección expiró, vuelve a conectar Facebook" }, { status: 400 });
  }

  let empresaId: string;
  let paginas: PaginaFacebook[];
  try {
    const decoded = JSON.parse(Buffer.from(cookie, "base64url").toString("utf-8"));
    empresaId = decoded.empresaId;
    paginas = decoded.paginas;
  } catch {
    return NextResponse.json({ error: "Selección inválida, vuelve a conectar Facebook" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const pageId = String(body.pageId || "");
  const pagina = paginas.find((p) => p.id === pageId);
  if (!pagina) {
    return NextResponse.json({ error: "Página no encontrada en la selección" }, { status: 400 });
  }

  await guardarRed(empresaId, "FACEBOOK", pagina.access_token, pagina.id, pagina.name);

  const igRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pagina.id}?fields=instagram_business_account{id,username}&access_token=${pagina.access_token}`
  );
  const igData = await igRes.json().catch(() => ({}));
  const igAccount = igData?.instagram_business_account;
  if (igAccount?.id) {
    await guardarRed(empresaId, "INSTAGRAM", pagina.access_token, igAccount.id, igAccount.username);
  }

  const res = NextResponse.json({ ok: true, empresaId, instagramConectado: !!igAccount?.id });
  res.cookies.delete("fb_pag_pend");
  return res;
}
