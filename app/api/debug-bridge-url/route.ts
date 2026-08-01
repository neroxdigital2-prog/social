import { NextResponse } from "next/server";

// ⚠️ ARCHIVO TEMPORAL DE DIAGNÓSTICO — borrar después de resolver el problema.
// Visita https://social.nerox.es/api/debug-bridge-url en el navegador
// para ver qué valor tiene realmente la variable en Vercel ahora mismo.

export async function GET() {
  const valor = process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST ?? "NO_DEFINIDA";
  const secretoDefinido = !!process.env.BRIDGE_SECRET;

  return NextResponse.json({
    IONOS_BRIDGE_URL_EMPRESAS_LIST: valor,
    BRIDGE_SECRET_definido: secretoDefinido,
    BRIDGE_SECRET_longitud: process.env.BRIDGE_SECRET?.length ?? 0,
  });
}
