import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_GUARDAR = process.env.IONOS_BRIDGE_URL_REDES_GUARDAR!;
const BRIDGE_SELECCION_LEER = process.env.IONOS_BRIDGE_URL_FACEBOOK_SELECCION_LEER!;
const BRIDGE_SELECCION_BORRAR = process.env.IONOS_BRIDGE_URL_FACEBOOK_SELECCION_BORRAR!;
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

  const body = await req.json().catch(() => ({}));
  const seleccionId = String(body.seleccionId || "");
  const pageId = String(body.pageId || "");

  if (!seleccionId || !pageId) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const leerRes = await fetch(BRIDGE_SELECCION_LEER, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ id: seleccionId }),
    cache: "no-store",
  });
  const leerData = await leerRes.json().catch(() => null);
  if (!leerRes.ok || !leerData?.paginas) {
    return NextResponse.json({ error: "La selección expiró, vuelve a conectar Facebook" }, { status: 400 });
  }

  const empresaId: string = leerData.empresaId;
  const paginas: PaginaFacebook[] = leerData.paginas;
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

  fetch(BRIDGE_SELECCION_BORRAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ id: seleccionId }),
  }).catch(() => null);

  return NextResponse.json({ ok: true, empresaId, instagramConectado: !!igAccount?.id });
}
