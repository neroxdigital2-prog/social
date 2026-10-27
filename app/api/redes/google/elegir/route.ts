import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  COOKIE_SELECCION_GOOGLE,
  descifrarSeleccion,
  guardarRedGoogle,
  listarFichasGoogle,
} from "@/lib/googleBusiness";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const seleccion = descifrarSeleccion(req.cookies.get(COOKIE_SELECCION_GOOGLE)?.value);
  if (!seleccion) {
    return NextResponse.json({ error: "La selección expiró. Vuelve a conectar Google Business." }, { status: 400 });
  }
  if (seleccion.userId && seleccion.userId !== session.user.id) {
    return NextResponse.json({ error: "Esta selección pertenece a otro usuario." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const recurso = String(body.recurso || "");
  if (!recurso) return NextResponse.json({ error: "Falta la ficha elegida" }, { status: 400 });

  try {
    // Se vuelve a listar para no confiar en lo que envía el navegador
    const fichas = await listarFichasGoogle(seleccion.accessToken);
    const ficha = fichas.find((f) => f.recurso === recurso);
    if (!ficha) return NextResponse.json({ error: "Esa ficha no pertenece a la cuenta conectada" }, { status: 400 });

    await guardarRedGoogle(seleccion.empresaId, seleccion, ficha);

    const respuesta = NextResponse.json({ ok: true, empresaId: seleccion.empresaId, titulo: ficha.titulo });
    respuesta.cookies.delete(COOKIE_SELECCION_GOOGLE);
    return respuesta;
  } catch (error) {
    console.error("POST /api/redes/google/elegir:", error);
    return NextResponse.json({ error: "No se pudo conectar la ficha. Inténtalo de nuevo." }, { status: 500 });
  }
}
