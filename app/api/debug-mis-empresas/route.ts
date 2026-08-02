import { NextResponse } from "next/server";
import { auth } from "@/auth";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_EMPRESAS_LIST = process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST!;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Necesitas iniciar sesión" }, { status: 401 });
  }

  const res = await fetch(BRIDGE_EMPRESAS_LIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);

  return NextResponse.json({
    userId_actual: session.user.id,
    email_actual: session.user.email,
    empresas: Array.isArray(data)
      ? data.map((e: { id: string; nombre: string; whatsappPhoneNumberId?: string }) => ({
          id: e.id,
          nombre: e.nombre,
          whatsappPhoneNumberId: e.whatsappPhoneNumberId ?? null,
        }))
      : data,
  });
}
