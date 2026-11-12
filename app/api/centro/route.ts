import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { bridgeVigilante, configAvisos, diagnosticarBridgeVigilante, type DiagnosticoVigilante } from "@/lib/vigilante";
import { AGENTES, type EstadoAgente } from "@/lib/agentes";
import { esOperador } from "@/lib/operador";
import { telegramConfigurado } from "@/lib/telegram";
import { cargarColaPublicaciones } from "@/lib/colaPublicaciones";

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

const ddmm = (f: string | null) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}` : "");
const hhmm = (f: string | null) => (f ? f.slice(11, 16) : "");

/** Por qué el vigilante no revisa (nunca ejecutado, retrasado o detenido). */
function diagnosticoLatido(segundos: number | null, ultima: string | null): DiagnosticoVigilante | null {
  const sinCron = !process.env.CRON_SECRET;
  if (segundos === null) {
    return {
      titulo: "El vigilante nunca se ha ejecutado",
      causa: sinCron ? "Falta CRON_SECRET en Vercel: el cron no puede autenticarse." : "No hay ningún cron que lo llame cada 15 min.",
      pasos: [
        ...(sinCron ? ["Vercel → Environment Variables → crea CRON_SECRET y haz Redeploy."] : []),
        "cron-job.org → Create cronjob → URL https://social.nerox.es/api/cron/vigilante",
        "Cada 15 minutos · Headers: Authorization = Bearer TU_CRON_SECRET",
        "Guarda y pulsa «Test run»: debe responder 200.",
        "O pulsa «Revisar ahora» aquí para la primera revisión.",
      ],
    };
  }
  if (segundos > 25 * 60) {
    const parado = segundos > 60 * 60;
    return {
      titulo: parado ? "El vigilante está detenido" : "El vigilante va con retraso",
      causa: `La última revisión fue el ${ddmm(ultima)} a las ${hhmm(ultima)}. ${sinCron ? "Falta CRON_SECRET en Vercel." : "El job de cron-job.org no se está ejecutando o falla."}`,
      pasos: [
        "cron-job.org → job /api/cron/vigilante: ¿está activado?",
        "Mira el historial del job: 401 = CRON_SECRET distinto en Vercel y en la cabecera; 500/504 = error o tiempo agotado (mira Vercel → Logs).",
        "Si cron-job.org desactivó el job por fallos repetidos, actívalo de nuevo.",
        "Pulsa «Revisar ahora» para comprobar que responde.",
      ],
    };
  }
  return null;
}

/** Luces de todos los agentes + cola de publicaciones + disponibilidad de 7 días. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esOperador(session.user.email)) return NextResponse.json({ error: "Solo operadores" }, { status: 403 });

  const [lectura, disp, cola] = await Promise.all([
    bridgeVigilante<Lectura>("agentes_leer"),
    bridgeVigilante<FilaDisp[]>("disponibilidad", { dias: 7 }),
    cargarColaPublicaciones(session.user.id),
  ]);

  const instalado = !!lectura && Array.isArray(lectura.agentes);
  const diagnostico = instalado ? diagnosticoLatido(lectura!.latido.segundosDesde, lectura!.latido.ultimaEjecucion) : await diagnosticarBridgeVigilante();

  const porId = new Map((instalado ? lectura!.agentes : []).map((a) => [a.agente, a]));
  const inc = new Map((instalado ? lectura!.incidencias : []).map((i) => [i.agente, { abiertas: Number(i.abiertas) || 0, silenciadas: Number(i.silenciadas) || 0 }]));
  const latido = instalado ? lectura!.latido.segundosDesde : null;

  const agentes = AGENTES.map((def) => {
    const fila = porId.get(def.id);
    let estado: EstadoAgente = fila?.estado || "OFF";
    let mensaje = fila?.mensaje || (instalado ? "Aún sin revisar" : "Sin datos: el vigilante no responde");
    let detalle = fila?.detalle || [];

    if (def.id === "vigilante") {
      if (!instalado || diagnostico) {
        estado = !instalado || latido === null || (latido ?? 0) > 60 * 60 ? "ERROR" : "AVISO";
        mensaje = diagnostico?.titulo || "No responde";
        detalle = diagnostico ? [`Causa: ${diagnostico.causa}`, ...diagnostico.pasos.map((p, i) => `${i + 1}. ${p}`)] : [];
      }
    } else if (fila && latido !== null && latido > 2 * 60 * 60) {
      estado = "AVISO";
      mensaje = `Dato antiguo · ${fila.mensaje || ""}`;
    }

    // Publicador: siempre con la cola en vivo (aunque el vigilante esté caído)
    if (def.id === "publicador" && cola) {
      const resumenCola = cola.total
        ? `${cola.total} programada(s) hasta el ${ddmm(cola.hasta)} · próxima ${ddmm(cola.proximas[0]?.fecha || null)} ${hhmm(cola.proximas[0]?.fecha || null)}`
        : "No hay publicaciones programadas";
      if (cola.atrasadas) {
        estado = estado === "ERROR" ? "ERROR" : "AVISO";
        mensaje = `${cola.atrasadas} atrasada(s) · ${resumenCola}`;
      } else if (!fila || estado === "OK" || estado === "OFF") {
        estado = fila ? estado : cola.total ? "OK" : "OFF";
        mensaje = resumenCola;
      }
      detalle = [...cola.porEmpresa.map((e) => `${e.empresaNombre}: ${e.total} programada(s) hasta el ${ddmm(e.hasta)}`), ...detalle];
    }

    return {
      ...def,
      estado,
      mensaje,
      detalle,
      ultimaRevision: def.id === "vigilante" ? lectura?.latido.ultimaEjecucion || null : fila?.ultimaRevision || null,
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
    instalado,
    diagnostico,
    telegram: await telegramConfigurado(),
    config: configAvisos(),
    ahora: lectura?.ahora,
    latido: lectura?.latido || { ultimaEjecucion: null, segundosDesde: null },
    otrasIncidencias: inc.get("otros")?.abiertas || 0,
    cola,
    agentes,
    disponibilidad,
  });
}
