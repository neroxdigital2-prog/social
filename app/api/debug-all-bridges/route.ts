import { NextResponse } from "next/server";

// ⚠️ ARCHIVO TEMPORAL DE DIAGNÓSTICO — borrar después de la auditoría.
// Visita https://social.nerox.es/api/debug-all-bridges en el navegador.
// Lista TODAS las variables IONOS_BRIDGE_URL_* y marca cuáles están vacías,
// sin necesidad de abrir cada una a mano en Vercel.

const NOMBRES_ESPERADOS = [
  "IONOS_BRIDGE_URL_EMPRESA_ACCESO",
  "IONOS_BRIDGE_URL_EMPRESA_LISTAR",
  "IONOS_BRIDGE_URL_EMPRESAS_LIST",
  "IONOS_BRIDGE_URL_EMPRESAS_COUNT",
  "IONOS_BRIDGE_URL_EMPRESAS_CREATE",
  "IONOS_BRIDGE_URL_PUBLICACIONES_LIST",
  "IONOS_BRIDGE_URL_PUBLICACIONES_CONTAR",
  "IONOS_BRIDGE_URL_PUBLICACIONES_CREAR",
  "IONOS_BRIDGE_URL_PUBLICACIONES_ACTUALIZAR_IMAGEN",
  "IONOS_BRIDGE_URL_PUBLICACION_DETALLE",
  "IONOS_BRIDGE_URL_PUBLICACION_IMAGEN_GUARDAR",
  "IONOS_BRIDGE_URL_CONFIG_API_LISTAR",
  "IONOS_BRIDGE_URL_CONFIG_API_GUARDAR",
  "IONOS_BRIDGE_URL_CONFIG_API_ELIMINAR",
  "IONOS_BRIDGE_URL_LOGIN",
  "IONOS_BRIDGE_URL_LEADS_LIST",
  "IONOS_BRIDGE_URL_LEADS_CREATE",
  "IONOS_BRIDGE_URL_LEAD_ACTUALIZAR_ESTADO",
  "IONOS_BRIDGE_URL",
  "BRIDGE_SECRET",
];

export async function GET() {
  const resultado: Record<string, { valor: string; estado: string }> = {};

  for (const nombre of NOMBRES_ESPERADOS) {
    const valor = process.env[nombre];
    let estado = "OK";

    if (!valor || valor.trim() === "") {
      estado = "❌ VACÍA";
    } else if (!valor.startsWith("https://") && !valor.startsWith("http://")) {
      estado = "⚠️ SIN PROTOCOLO (falta https://)";
    } else if (valor.includes("vercel.app") || valor.includes("social.nerox.es")) {
      estado = "⚠️ APUNTA AL DOMINIO EQUIVOCADO (debería ser bridge.nerox.es)";
    }

    resultado[nombre] = {
      valor: valor ? (valor.length > 60 ? valor.slice(0, 60) + "..." : valor) : "(no definida)",
      estado,
    };
  }

  return NextResponse.json(resultado, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
