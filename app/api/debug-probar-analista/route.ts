import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ENDPOINT TEMPORAL DE PRUEBA - BORRAR DESPUES DE USAR.
// Llama al bridge del Agente Analista desde el servidor (no desde el navegador),
// asi evitamos el tema de CORS mientras probamos.
export async function GET() {
  const res = await fetch("https://bridge.nerox.es/analista-escanear.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bridge-Secret": "e756637de1d11e3cd21a6a98ffa94541373d3dd8ab939c117f692b279b49d2d6",
    },
    body: JSON.stringify({ sector: "dentista", ciudad: "Madrid" }),
    cache: "no-store",
  });

  const texto = await res.text();
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    datos = { error: "Respuesta no es JSON valido", raw: texto.slice(0, 2000) };
  }

  return NextResponse.json({ status_bridge: res.status, respuesta: datos });
}
