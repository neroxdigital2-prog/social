import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 30;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET;

const VARIABLES_BRIDGE = [
  "IONOS_BRIDGE_URL_AUDITORIA_GUARDAR",
  "IONOS_BRIDGE_URL_AUDITORIA_PENDIENTES",
  "IONOS_BRIDGE_URL_CITAS_ACTUALIZAR_ESTADO",
  "IONOS_BRIDGE_URL_CITAS_CREAR",
  "IONOS_BRIDGE_URL_CITAS_LIST",
  "IONOS_BRIDGE_URL_CONFIG_API_ELIMINAR",
  "IONOS_BRIDGE_URL_CONFIG_API_GUARDAR",
  "IONOS_BRIDGE_URL_CONFIG_API_LISTAR",
  "IONOS_BRIDGE_URL_DISPONIBILIDAD_GUARDAR",
  "IONOS_BRIDGE_URL_DISPONIBILIDAD_LIST",
  "IONOS_BRIDGE_URL_EMPRESAS_COUNT",
  "IONOS_BRIDGE_URL_EMPRESAS_CREATE",
  "IONOS_BRIDGE_URL_EMPRESAS_LIST",
  "IONOS_BRIDGE_URL_EMPRESA_ACCESO",
  "IONOS_BRIDGE_URL_EMPRESA_ACTUALIZAR",
  "IONOS_BRIDGE_URL_EMPRESA_BORRAR",
  "IONOS_BRIDGE_URL_FACEBOOK_SELECCION_BORRAR",
  "IONOS_BRIDGE_URL_FACEBOOK_SELECCION_GUARDAR",
  "IONOS_BRIDGE_URL_FACEBOOK_SELECCION_LEER",
  "IONOS_BRIDGE_URL_LEADS_CREATE",
  "IONOS_BRIDGE_URL_LEADS_LIST",
  "IONOS_BRIDGE_URL_LEAD_ACTUALIZAR_ESTADO",
  "IONOS_BRIDGE_URL_LEAD_DETALLE",
  "IONOS_BRIDGE_URL_PUBLICACIONES_ACTUALIZAR_IMAGEN",
  "IONOS_BRIDGE_URL_PUBLICACIONES_CONTAR",
  "IONOS_BRIDGE_URL_PUBLICACIONES_CREAR",
  "IONOS_BRIDGE_URL_PUBLICACIONES_LIST",
  "IONOS_BRIDGE_URL_PUBLICACIONES_PROGRAMADAS_LIST",
  "IONOS_BRIDGE_URL_PUBLICACION_ACTUALIZAR",
  "IONOS_BRIDGE_URL_PUBLICACION_BORRAR",
  "IONOS_BRIDGE_URL_PUBLICACION_CREAR_MANUAL",
  "IONOS_BRIDGE_URL_PUBLICACION_GUARDAR_REDES",
  "IONOS_BRIDGE_URL_PUBLICACION_MARCAR_RESULTADO",
  "IONOS_BRIDGE_URL_PUBLICACION_REPROGRAMAR",
  "IONOS_BRIDGE_URL_PUBLICACION_SUBIR_IMAGEN",
  "IONOS_BRIDGE_URL_REDES_ELIMINAR",
  "IONOS_BRIDGE_URL_REDES_GUARDAR",
  "IONOS_BRIDGE_URL_REDES_LIST",
  "IONOS_BRIDGE_URL_SERVICIOS_ELIMINAR",
  "IONOS_BRIDGE_URL_SERVICIOS_GUARDAR",
  "IONOS_BRIDGE_URL_SERVICIOS_LIST",
  "IONOS_BRIDGE_URL_SUBIR_LOGO",
  "IONOS_BRIDGE_URL_WHATSAPP_CONVERSACIONES_LIST",
  "IONOS_BRIDGE_URL_WHATSAPP_CONVERSACION_DETALLE",
  "IONOS_BRIDGE_URL_WHATSAPP_CONVERSACION_MODO",
  "IONOS_BRIDGE_URL_WHATSAPP_CONVERSACION_OBTENER",
  "IONOS_BRIDGE_URL_WHATSAPP_EMPRESA_POR_NUMERO",
  "IONOS_BRIDGE_URL_WHATSAPP_MENSAJE_GUARDAR",
] as const;

interface ResultadoBridge {
  nombre: string;
  url: string | null;
  estado: "OK" | "SIN_VARIABLE" | "SIN_SECRETO" | "RESPUESTA_NO_JSON" | "ERROR_RED" | "TIMEOUT";
  statusHttp: number | null;
  tiempoMs: number | null;
  detalle?: string;
}

async function revisarBridge(nombreVariable: string): Promise<ResultadoBridge> {
  const url = process.env[nombreVariable];

  if (!url) {
    return { nombre: nombreVariable, url: null, estado: "SIN_VARIABLE", statusHttp: null, tiempoMs: null };
  }
  if (!BRIDGE_SECRET) {
    return { nombre: nombreVariable, url, estado: "SIN_SECRETO", statusHttp: null, tiempoMs: null };
  }

  const inicio = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({}),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    const tiempoMs = Date.now() - inicio;

    const textoCrudo = await res.text();
    try {
      JSON.parse(textoCrudo);
      // Cualquier respuesta JSON válida (incluso un error de validación 400) confirma que el PHP corre bien
      return { nombre: nombreVariable, url, estado: "OK", statusHttp: res.status, tiempoMs };
    } catch {
      return {
        nombre: nombreVariable,
        url,
        estado: "RESPUESTA_NO_JSON",
        statusHttp: res.status,
        tiempoMs,
        detalle: textoCrudo.slice(0, 200),
      };
    }
  } catch (error) {
    const tiempoMs = Date.now() - inicio;
    const esTimeout = error instanceof Error && error.name === "AbortError";
    return {
      nombre: nombreVariable,
      url,
      estado: esTimeout ? "TIMEOUT" : "ERROR_RED",
      statusHttp: null,
      tiempoMs,
      detalle: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const resultados = await Promise.all(VARIABLES_BRIDGE.map((v) => revisarBridge(v)));

  const resumen = {
    total: resultados.length,
    ok: resultados.filter((r) => r.estado === "OK").length,
    conProblemas: resultados.filter((r) => r.estado !== "OK").length,
  };

  return NextResponse.json({ resumen, resultados });
}
