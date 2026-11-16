import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { bridgeVigilante, reintentarEnvios, resolverIncidencia, silenciarIncidencia } from "@/lib/vigilante";
import { esOperador, nombreActor } from "@/lib/operador";
import { urlApp } from "@/lib/urlApp";
import { enviarMensaje } from "@/lib/telegram";

export const dynamic = "force-dynamic";

async function sesionOperador() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  if (!esOperador(session.user.email)) return { error: NextResponse.json({ error: "Solo operadores" }, { status: 403 }) };
  return { session };
}

/** Incidencias con su historial (avisos, reintentos, resolución). */
export async function GET(req: NextRequest) {
  const { error } = await sesionOperador();
  if (error) return error;
  const p = req.nextUrl.searchParams;
  const estado = ["abiertas", "silenciadas", "resueltas", "pendientes", "todas"].includes(p.get("estado") || "") ? p.get("estado") : "todas";
  const datos = await bridgeVigilante<unknown[]>("incidencias_lista", {
    estado,
    agente: p.get("agente") || undefined,
    dias: Number(p.get("dias")) || 30,
    empresaId: p.get("empresa") || undefined,
    buscar: p.get("buscar")?.slice(0, 100) || undefined,
    desde: /^\d{4}-\d{2}-\d{2}$/.test(p.get("desde") || "") ? p.get("desde") : undefined,
    hasta: /^\d{4}-\d{2}-\d{2}$/.test(p.get("hasta") || "") ? p.get("hasta") : undefined,
  });
  if (!Array.isArray(datos)) return NextResponse.json({ error: "vigilante.php no responde" }, { status: 502 });
  return NextResponse.json(datos);
}

const Accion = z.object({
  clave: z.string().min(1).max(191),
  accion: z.enum(["reintentar", "resolver", "silenciar", "pasos", "nota", "asignar"]),
  hechos: z.array(z.number().int().min(0).max(50)).max(50).optional(),
  paso: z.string().max(400).optional(),
  marcado: z.boolean().optional(),
  nota: z.string().max(2000).optional(),
  asignadaA: z.string().max(191).nullable().optional(),
  chat: z.string().max(40).nullable().optional(),
  titulo: z.string().max(255).optional(),
});

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Acciones desde el Dashboard / Centro de control, registrando quién las hizo. */
export async function POST(req: NextRequest) {
  const { session, error } = await sesionOperador();
  if (error) return error;
  const parsed = Accion.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { clave, accion } = parsed.data;
  const actor = nombreActor(session!.user);

  if (accion === "pasos") {
    const r = await bridgeVigilante<{ ok?: boolean }>("incidencia_pasos", { clave, hechos: parsed.data.hechos || [], paso: parsed.data.paso, marcado: parsed.data.marcado, actor });
    return NextResponse.json({ ok: !!r?.ok, mensaje: r?.ok ? "Guardado." : "vigilante.php no está actualizado." }, { status: r?.ok ? 200 : 502 });
  }
  if (accion === "nota") {
    const r = await bridgeVigilante<{ ok?: boolean }>("incidencia_nota", { clave, nota: parsed.data.nota?.trim() || null, actor });
    return NextResponse.json({ ok: !!r?.ok, mensaje: r?.ok ? "Nota guardada en el historial." : "vigilante.php no está actualizado." }, { status: r?.ok ? 200 : 502 });
  }
  if (accion === "asignar") {
    const a = parsed.data.asignadaA?.trim() || null;
    const r = await bridgeVigilante<{ ok?: boolean }>("incidencia_asignar", { clave, asignadaA: a, chat: parsed.data.chat || null, actor });
    if (!r?.ok) return NextResponse.json({ ok: false, mensaje: "vigilante.php no está actualizado." }, { status: 502 });
    let avisado = false;
    if (a && parsed.data.chat) {
      const enlace = `${urlApp(req.nextUrl.origin)}/centro-control#activas`;
      const res = await enviarMensaje(
        parsed.data.chat,
        `🧰 <b>Te han asignado una avería</b>\n${esc(parsed.data.titulo || clave)}\n\nAsignada por ${esc(actor)}. Revisa la guía de reparación en el Centro de control.`,
        [[{ texto: "Abrir Centro de control", url: enlace }]]
      ).catch(() => null);
      avisado = !!(res as { ok?: boolean } | null)?.ok;
    }
    return NextResponse.json({ ok: true, mensaje: a ? `Asignada a ${a}${parsed.data.chat ? (avisado ? " · avisado por Telegram ✅" : " · no se pudo avisar por Telegram") : ""}.` : "Sin asignar." });
  }

  if (accion === "resolver") {
    const nota = parsed.data.nota?.trim();
    const ok = await resolverIncidencia(clave, actor, "DASHBOARD", nota ? `Reparada: ${nota}`.slice(0, 255) : "Marcada como resuelta manualmente");
    return NextResponse.json({ ok, mensaje: ok ? "Marcada como resuelta." : "Ya estaba resuelta." });
  }
  if (accion === "silenciar") {
    const ok = await silenciarIncidencia(clave, actor, "DASHBOARD");
    return NextResponse.json({ ok, mensaje: ok ? "Silenciada hasta que se resuelva." : "No estaba abierta." });
  }
  const inc = await bridgeVigilante<{ datos?: { ids?: string[] }; agente?: string }>("incidencia_ver", { clave });
  const ids = inc?.datos?.ids || [];
  if (!ids.length) return NextResponse.json({ ok: false, mensaje: "Esta incidencia no se puede reintentar (no es un envío)." }, { status: 400 });
  const ok = await reintentarEnvios(ids, urlApp(req.nextUrl.origin), { actor, via: "DASHBOARD", clave, agente: inc?.agente || "envios" });
  return NextResponse.json({ ok, mensaje: ok ? "Reintento lanzado." : "No se pudo reintentar." });
}

const Borrar = z.object({
  claves: z.array(z.string().min(1).max(191)).max(200).optional(),
  limpiar: z.enum(["resueltas", "todas"]).optional(),
});

/** Borra reportes de averías: unos concretos (claves) o todas las resueltas / todas. */
export async function DELETE(req: NextRequest) {
  const { error } = await sesionOperador();
  if (error) return error;
  const parsed = Borrar.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || (!parsed.data.claves?.length && !parsed.data.limpiar)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const r = parsed.data.limpiar
    ? await bridgeVigilante<{ ok?: boolean; borradas?: number }>("incidencias_limpiar", { estado: parsed.data.limpiar === "todas" ? "TODAS" : "RESUELTA" })
    : await bridgeVigilante<{ ok?: boolean; borradas?: number }>("incidencia_borrar", { claves: parsed.data.claves });
  if (!r?.ok) return NextResponse.json({ error: "vigilante.php no responde o no está actualizado" }, { status: 502 });
  return NextResponse.json({ ok: true, borradas: r.borradas ?? 0, mensaje: `Borradas: ${r.borradas ?? 0}` });
}
