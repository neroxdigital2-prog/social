import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { bridgeVigilante } from "@/lib/vigilante";
import { AGENTES, type EstadoAgente } from "@/lib/agentes";
import { esOperador } from "@/lib/operador";
import { telegramConfigurado } from "@/lib/telegram";

export const dynamic = "force-dynamic";

interface FilaAgente {
  agente: string;
  estado: EstadoAgente;
  mensaje: string | null;
  detalle: string[] | null;
  ultimaRevision: string | null;
  ultimaActividad: string | null;
  desdeEstado: string | null;
  segundosRevision: number | null;
}

interface Lectura {
  agentes: FilaAgente[];
  incidencias: { agente: string; abiertas: string | number; silenciadas: string | number }[];
  latido: { ultimaEjecucion: string | null; segundosDesde: number | null };
  ahora: string;
}

interface FilaDisp {
  agente: string;
  dia: string;
  muestras: string | number;
  ok: string | number;
  avisos: string | number;
  errores: string | number;
}

/** Luces de todos los agentes + disponibilidad de 7 días. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esOperador(session.user.email)) return NextResponse.json({ error: "Solo operadores" }, { status: 403 });

  const [lectura, disp] = await Promise.all([
    bridgeVigilante<Lectura>("agentes_leer"),
    bridgeVigilante<FilaDisp[]>("disponibilidad", { dias: 7 }),
  ]);

  if (!lectura || !Array.isArray(lectura.agentes)) {
    return NextResponse.json({ instalado: false, telegram: telegramConfigurado(), agentes: [], disponibilidad: [] });
  }

  const porId = new Map(lectura.agentes.map((a) => [a.agente, a]));
  const inc = new Map(lectura.incidencias.map((i) => [i.agente, { abiertas: Number(i.abiertas) || 0, silenciadas: Number(i.silenciadas) || 0 }]));
  const latido = lectura.latido.segundosDesde;

  const agentes = AGENTES.map((def) => {
    const fila = porId.get(def.id);
    let estado: EstadoAgente = fila?.estado || "OFF";
    let mensaje = fila?.mensaje || "Aún sin revisar";

    if (def.id === "vigilante") {
      if (latido === null) {
        estado = "ERROR";
        mensaje = "Nunca se ha ejecutado";
      } else if (latido > 60 * 60) {
        estado = "ERROR";
        mensaje = "Detenido: no revisa desde hace más de 1 hora";
      } else if (latido > 25 * 60) {
        estado = "AVISO";
        mensaje = "Retrasado: más de 25 min sin revisar";
      }
    } else if (fila && fila.segundosRevision !== null && latido !== null && latido > 2 * 60 * 60) {
      // Si el vigilante lleva 2 h parado, la luz de los demás ya no es fiable
      estado = "AVISO";
      mensaje = `Dato antiguo · ${fila.mensaje || ""}`;
    }

    return {
      ...def,
      estado,
      mensaje,
      detalle: fila?.detalle || [],
      ultimaRevision: def.id === "vigilante" ? lectura.latido.ultimaEjecucion : fila?.ultimaRevision || null,
      segundosRevision: def.id === "vigilante" ? latido : fila?.segundosRevision ?? null,
      ultimaActividad: fila?.ultimaActividad || null,
      desdeEstado: fila?.desdeEstado || null,
      abiertas: inc.get(def.id)?.abiertas || 0,
      silenciadas: inc.get(def.id)?.silenciadas || 0,
    };
  });

  const disponibilidad = (Array.isArray(disp) ? disp : []).map((d) => ({
    agente: d.agente,
    dia: d.dia,
    muestras: Number(d.muestras) || 0,
    pct: Number(d.muestras) ? Math.round((Number(d.ok) / Number(d.muestras)) * 1000) / 10 : null,
    avisos: Number(d.avisos) || 0,
    errores: Number(d.errores) || 0,
  }));

  return NextResponse.json({
    instalado: true,
    telegram: telegramConfigurado(),
    ahora: lectura.ahora,
    latido: lectura.latido,
    otrasIncidencias: inc.get("otros")?.abiertas || 0,
    agentes,
    disponibilidad,
  });
}
