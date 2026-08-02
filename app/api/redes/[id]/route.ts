import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ELIMINAR = process.env.IONOS_BRIDGE_URL_REDES_ELIMINAR!;

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const res = await fetch(BRIDGE_ELIMINAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, redConectadaId: params.id }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data?.error || "No se pudo desconectar" }, { status: res.status });
  return NextResponse.json(data);
}
