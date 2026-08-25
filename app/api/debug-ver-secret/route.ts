import { NextResponse } from "next/server";

// ENDPOINT TEMPORAL DE DIAGNOSTICO - BORRAR DESPUES DE USAR.
// Muestra el valor de BRIDGE_SECRET para copiarlo manualmente al bridge
// nuevo de PHP en IONOS (analista-escanear.php). No dejar esto en
// produccion mas tiempo del necesario.
export async function GET() {
  return NextResponse.json({
    BRIDGE_SECRET: process.env.BRIDGE_SECRET ?? "(no definida)",
  });
}
