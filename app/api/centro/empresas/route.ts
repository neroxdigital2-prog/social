import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { esOperador, nombreActor } from "@/lib/operador";
import { bridgeVigilante } from "@/lib/vigilante";
import { empresasDelUsuario, estadosEmpresas } from "@/lib/empresasActivas";

export const dynamic = "force-dynamic";

async function sesion() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  if (!esOperador(session.user.email)) return { error: NextResponse.json({ error: "Solo operadores" }, { status: 403 }) };
  return { session };
}

/** Empresas del usuario con su estado (activa / desactivada). */
export async function GET() {
  const { session, error } = await sesion();
  if (error) return error;
  const lista = await estadosEmpresas(session!.user!.id!);
  if (!lista) return NextResponse.json({ error: "No se pudieron cargar las empresas" }, { status: 502 });
  return NextResponse.json(lista);
}

const Cambio = z.object({ empresaId: z.string().min(1).max(64), activa: z.boolean() });

/** Activa o desactiva una empresa: desactivada no publica, no se vigila y no genera avisos. */
export async function POST(req: NextRequest) {
  const { session, error } = await sesion();
  if (error) return error;
  const parsed = Cambio.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const propias = await empresasDelUsuario(session!.user!.id!);
  if (!propias?.some((e) => e.id === parsed.data.empresaId)) {
    return NextResponse.json({ error: "No tienes acceso a esa empresa" }, { status: 403 });
  }
  const r = await bridgeVigilante<{ ok?: boolean; nombre?: string; incidenciasCerradas?: number; error?: string }>("empresa_activar", {
    empresaId: parsed.data.empresaId,
    activa: parsed.data.activa,
    actor: nombreActor(session!.user),
  });
  if (!r?.ok) {
    return NextResponse.json({ error: r?.error || "No se pudo guardar. ¿Ejecutaste el último vigilante.sql y subiste vigilante.php?" }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    mensaje: parsed.data.activa
      ? `${r.nombre} activada: vuelve a publicar y a vigilarse.`
      : `${r.nombre} desactivada: no publicará, no se vigila ni avisa${r.incidenciasCerradas ? ` · ${r.incidenciasCerradas} avería(s) cerrada(s)` : ""}.`,
  });
}
