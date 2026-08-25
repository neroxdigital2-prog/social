import { NextRequest, NextResponse } from "next/server";
import { generarPublicaciones } from "@/lib/generador";

export const maxDuration = 60;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const CRON_SECRET = process.env.CRON_SECRET!;

const BRIDGE_ACCESO = process.env.IONOS_BRIDGE_URL_EMPRESA_ACCESO!;
const BRIDGE_CREAR = process.env.IONOS_BRIDGE_URL_PUBLICACIONES_CREAR!;
const BRIDGE_CONFIG_LISTAR = process.env.IONOS_BRIDGE_URL_CONFIG_API_LISTAR!;
const BRIDGE_ANALISIS_PENDIENTE = process.env.IONOS_BRIDGE_URL_ANALISIS_PENDIENTE!;
const BRIDGE_ANALISIS_MARCAR_USADO = process.env.IONOS_BRIDGE_URL_ANALISIS_MARCAR_USADO!;

// Empresa y usuario propios de Nerox Digital (agencia), no un cliente.
// Este cron genera el contenido del pilar "Nerox Analiza" para la propia
// cuenta @nerox_digital, no para empresas de clientes.
const NEROX_USER_ID = "c5730625666acc919f3e88667";
const NEROX_EMPRESA_ID = "cfdf21c6f22303f501abe580e";

async function bridgeFetch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const textoCrudo = await res.text();
  let data: any;
  try {
    data = JSON.parse(textoCrudo);
  } catch {
    data = { error: "Respuesta no es JSON válido", raw: textoCrudo.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, data };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const tokenRecibido = authHeader?.replace("Bearer ", "");
  if (tokenRecibido !== CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // 1) Buscar el negocio pendiente de mayor prioridad
  const pendiente = await bridgeFetch(BRIDGE_ANALISIS_PENDIENTE, {});
  if (!pendiente.ok || !pendiente.data?.found) {
    return NextResponse.json({ ok: true, mensaje: "No hay negocios analizados pendientes de convertir en contenido." });
  }
  const negocio = pendiente.data.negocio;

  // 2) Construir el "tema" para el Generador a partir del diagnostico + accion
  const tema =
    `Nerox Analiza: analizamos "${negocio.nombreNegocio}" (${negocio.sector} en ${negocio.ciudad}). ` +
    `Diagnóstico: ${negocio.diagnostico}. Acción recomendada: ${negocio.accion}. ` +
    `Usa este caso real (sin mencionar el nombre exacto del negocio) para mostrar cómo Nerox detecta oportunidades digitales.`;

  // 3) Obtener datos de la empresa Nerox Digital
  const acceso = await bridgeFetch(BRIDGE_ACCESO, {
    userId: NEROX_USER_ID,
    empresaId: NEROX_EMPRESA_ID,
    rolMinimo: "EDITOR",
  });
  if (!acceso.ok || !acceso.data.permitido) {
    return NextResponse.json({ error: "No se pudo acceder a la empresa Nerox Digital", detalle: acceso.data }, { status: 502 });
  }
  const empresa = acceso.data.empresa;

  // 4) Obtener las claves de IA guardadas para ese usuario (si hay)
  const configRes = await bridgeFetch(BRIDGE_CONFIG_LISTAR, { userId: NEROX_USER_ID, completo: true });
  const clavesGuardadas: { proveedor: string; apiKey: string }[] = Array.isArray(configRes.data) ? configRes.data : [];
  // Para este cron usamos solo Groq/OpenRouter directamente: Gemini y Cerebras
  // estan dando problemas conocidos (claves AQ., exigencia de tarjeta) y
  // reintentar con ellos primero solo consume tiempo y puede provocar timeout.
  const claves = {
    groq: clavesGuardadas.find((c) => c.proveedor === "GROQ")?.apiKey,
    openrouter: clavesGuardadas.find((c) => c.proveedor === "OPENROUTER")?.apiKey,
  };

  // 5) Generar 1 publicación con ese tema
  try {
    const generadas = await generarPublicaciones(
      {
        nombre: empresa.nombre,
        sector: empresa.sector,
        ciudad: empresa.ciudad,
        servicios: empresa.servicios as string[],
        web: empresa.web,
        whatsapp: empresa.whatsapp,
      },
      1,
      claves,
      tema
    );

    const crear = await bridgeFetch(BRIDGE_CREAR, { empresaId: empresa.id, publicaciones: generadas });
    if (!crear.ok) {
      return NextResponse.json({ error: "Fallo al guardar la publicación generada", detalle: crear.data }, { status: 502 });
    }

    const publicacionId = crear.data?.publicaciones?.[0]?.id ?? crear.data?.[0]?.id ?? null;

    // 6) Marcar el negocio como ya usado
    await bridgeFetch(BRIDGE_ANALISIS_MARCAR_USADO, { id: negocio.id, publicacionId });

    return NextResponse.json({
      ok: true,
      negocioUsado: negocio.nombreNegocio,
      loteId: negocio.loteId,
      publicacionId,
    });
  } catch (error) {
    console.error("Error generando contenido de Nerox Analiza:", error);
    return NextResponse.json({ error: "Fallo al generar contenido con IA" }, { status: 502 });
  }
}
