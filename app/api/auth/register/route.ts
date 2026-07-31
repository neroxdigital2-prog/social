import { NextRequest, NextResponse } from 'next/server';

const BRIDGE_URL = process.env.IONOS_BRIDGE_URL!;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Secret': BRIDGE_SECRET,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Error al registrar' }, { status: res.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('Error llamando al puente de IONOS:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
