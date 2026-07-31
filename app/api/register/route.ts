import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RegisterSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const BRIDGE_URL = process.env.IONOS_BRIDGE_URL!;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bridge-Secret": BRIDGE_SECRET,
    },
    body: JSON.stringify({ nombre: name, email, password }),
  });

  if (res.status === 409) {
    return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: "No se pudo completar el registro" }, { status: res.status });
  }

  const data = await res.json();

  return NextResponse.json({ id: data.user.id, email: data.user.email }, { status: 201 });
}
