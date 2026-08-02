import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_DETALLE = process.env.IONOS_BRIDGE_URL_LEAD_DETALLE;
const BRIDGE_LEADS_LIST = process.env.IONOS_BRIDGE_URL_LEADS_LIST;
const BRIDGE_EMPRESAS_LIST = process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Necesitas iniciar sesión" }, { status: 401 });
  }

  let leadId = req.nextUrl.searchParams.get("leadId");

  if (!leadId) {
    // Busca automáticamente el primer lead real de la primera empresa del usuario
    const empRes = await fetch(BRIDGE_EMPRESAS_LIST!, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({ userId: session.user.id }),
    });
    const empresas = await empRes.json().catch(() => []);
    const empresaId = Array.isArray(empresas) ? empresas[0]?.id : null;

    if (empresaId) {
      const leadsRes = await fetch(BRIDGE_LEADS_LIST!, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
        body: JSON.stringify({ userId: session.user.id, empresaId }),
      });
      const leads = await leadsRes.json().catch(() => []);
      leadId = Array.isArray(leads) && leads[0] ? leads[0].id : null;
    }
  }

  if (!BRIDGE_DETALLE) {
    return NextResponse.json({ error: "IONOS_BRIDGE_URL_LEAD_DETALLE no está definida" }, { status: 500 });
  }
  if (!leadId) {
    return NextResponse.json({ error: "No se encontró ningún lead real para probar" }, { status: 404 });
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
    respuesta_cruda: texto.slice(0, 1500),
  });
}
