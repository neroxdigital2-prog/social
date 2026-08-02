import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_DETALLE = process.env.IONOS_BRIDGE_URL_LEAD_DETALLE;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Necesitas iniciar sesión" }, { status: 401 });
  }

  const leadId = req.nextUrl.searchParams.get("leadId") || "cualquier-id-de-prueba";

  if (!BRIDGE_DETALLE) {
    return NextResponse.json({ error: "IONOS_BRIDGE_URL_LEAD_DETALLE no está definida" }, { status: 500 });
  }

  const res = await fetch(BRIDGE_DETALLE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, leadId }),
    cache: "no-store",
  });
  const texto = await res.text();

  return NextResponse.json({
    url_usada: BRIDGE_DETALLE,
    leadId_usado: leadId,
    status_http: res.status,
    respuesta_cruda: texto.slice(0, 1000),
  });
}
