import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_ACCESO = process.env.IONOS_BRIDGE_URL_EMPRESA_ACCESO!;
const BRIDGE_GUARDAR = process.env.IONOS_BRIDGE_URL_REDES_GUARDAR!;

// Credenciales fijas de la cuenta de X de Nerox (no hay OAuth por cliente, es una sola cuenta propia)
const X_API_KEY = process.env.X_API_KEY!;
const X_API_SECRET = process.env.X_API_SECRET!;
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN!;
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET!;
const X_CUENTA = process.env.X_CUENTA_HANDLE || "nerox"; // sin @, solo para mostrar en UI

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const empresaId = body?.empresaId as string | undefined;
  if (!empresaId) return NextResponse.json({ error: "Falta empresaId" }, { status: 400 });

  const acceso = await fetch(BRIDGE_ACCESO, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, empresaId, rolMinimo: "EDITOR" }),
  }).then((r) => r.json());

  if (!acceso.permitido) {
    return NextResponse.json({ error: "Sin acceso a esta empresa" }, { status: 403 });
  }

  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
    return NextResponse.json(
      { error: "Faltan credenciales de X en el servidor. Configura las variables de entorno X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN y X_ACCESS_TOKEN_SECRET." },
      { status: 500 }
    );
  }

  const accessTokenPack = JSON.stringify({
    apiKey: X_API_KEY,
    apiSecret: X_API_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessTokenSecret: X_ACCESS_TOKEN_SECRET,
  });

  const res = await fetch(BRIDGE_GUARDAR, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({
      empresaId,
      red: "TWITTER",
      accessToken: accessTokenPack,
      cuentaExterna: X_CUENTA,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data?.error || "No se pudo conectar X" }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
