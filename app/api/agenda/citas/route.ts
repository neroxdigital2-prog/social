import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_LIST = process.env.IONOS_BRIDGE_URL_CITAS_LIST!;
const BRIDGE_CREAR = process.env.IONOS_BRIDGE_URL_CITAS_CREAR!;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const empresaId = req.nextUrl.searchParams.get("empresa");
  if (!empresaId) return NextResponse.json([], { status: 200 });

  const res = await fetch(BRIDGE_LIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, empresaId }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);
  return NextResponse.json(Array.isArray(data) ? data : []);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { empresaId, servicioId, nombreCliente, telefono, email, fechaHora, notas } = body;
  if (!empresaId || !servicioId || !nombreCliente || !fechaHora) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const res = await fetch(BRIDGE_CREAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({
      userId: session.user.id,
      empresaId,
      servicioId,
      nombreCliente,
      telefono: telefono ?? "",
      email: email ?? "",
      fechaHora,
      notas: notas ?? "",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data?.error || "No se pudo crear la cita" }, { status: res.status });
  return NextResponse.json(data);
}
