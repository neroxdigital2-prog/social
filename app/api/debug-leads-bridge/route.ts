import { NextResponse } from "next/server";
import { auth } from "@/auth";

// ⚠️ ARCHIVO TEMPORAL DE DIAGNÓSTICO — borrar después de resolver el problema del CRM.
// Visita https://social.nerox.es/api/debug-leads-bridge en el navegador (con sesión iniciada).
// Llama de verdad a IONOS_BRIDGE_URL_LEADS_LIST y muestra la respuesta cruda del PHP,
// para ver el error real en vez de solo "no es un array".

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Necesitas iniciar sesión primero en social.nerox.es" }, { status: 401 });
  }

  const url = process.env.IONOS_BRIDGE_URL_LEADS_LIST;
  const empresasUrl = process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST;
  const secret = process.env.BRIDGE_SECRET;

  if (!url || !empresasUrl || !secret) {
    return NextResponse.json({
      error: "Faltan variables de entorno",
      IONOS_BRIDGE_URL_LEADS_LIST: !!url,
      IONOS_BRIDGE_URL_EMPRESAS_LIST: !!empresasUrl,
      BRIDGE_SECRET: !!secret,
    }, { status: 500 });
  }

  // Paso 1: obtener la primera empresa real del usuario (igual que hace /crm)
  let empresaId: string | undefined;
  let empresasRaw = "";
  let empresasStatus = 0;
  try {
    const resEmp = await fetch(empresasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": secret },
      body: JSON.stringify({ userId: session.user.id }),
      cache: "no-store",
    });
    empresasStatus = resEmp.status;
    empresasRaw = await resEmp.text();
    const parsed = JSON.parse(empresasRaw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      empresaId = parsed[0].id;
    }
  } catch (e) {
    empresasRaw = "ERROR AL LLAMAR/PARSEAR: " + String(e);
  }

  // Paso 2: llamar al bridge de leads con esa empresa
  let leadsRaw = "";
  let leadsStatus = 0;
  let leadsError: string | null = null;
  try {
    const resLeads = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": secret },
      body: JSON.stringify({ userId: session.user.id, empresaId }),
      cache: "no-store",
    });
    leadsStatus = resLeads.status;
    leadsRaw = await resLeads.text();
  } catch (e) {
    leadsError = String(e);
  }

  return NextResponse.json({
    userId: session.user.id,
    empresaId_usado: empresaId ?? "(no se encontró ninguna empresa)",
    paso1_empresas: {
      url: empresasUrl,
      status: empresasStatus,
      respuesta_cruda: empresasRaw.slice(0, 1000),
    },
    paso2_leads: {
      url,
      status: leadsStatus,
      respuesta_cruda: leadsRaw.slice(0, 1000),
      error_de_red: leadsError,
    },
  });
}
