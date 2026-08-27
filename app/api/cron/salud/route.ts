import { NextRequest, NextResponse } from "next/server";
import { revisarTodosLosBridges, enviarAlertaWhatsApp } from "@/lib/salud";

export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Disparado periódicamente por cron-job.org (recomendado: cada 30-60 min).
 * Revisa todos los bridges de IONOS y, si alguno falla, manda un aviso por
 * WhatsApp al número de alertas (mismo canal que ya usa el QA de Marca).
 * Si todo está bien, no manda nada — solo avisa cuando hay un problema real.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { resumen, resultados } = await revisarTodosLosBridges();
  const esPrueba = req.nextUrl.searchParams.get("prueba") === "1";

  let whatsapp = null;
  if (resumen.conProblemas > 0 || esPrueba) {
    const conProblemas = resultados.filter((r) => r.estado !== "OK");
    const listado = conProblemas
      .slice(0, 10)
      .map((r) => `• ${r.nombre.replace("IONOS_BRIDGE_URL_", "")}: ${r.estado}`)
      .join("\n");
    const extra = conProblemas.length > 10 ? `\n…y ${conProblemas.length - 10} más.` : "";

    const mensaje = esPrueba
      ? `🧪 Nerox Salud: mensaje de prueba forzado. Estado real: ${resumen.ok}/${resumen.total} bridges OK.${conProblemas.length ? "\n\n" + listado + extra : ""}`
      : `🔴 Nerox Salud: ${resumen.conProblemas} de ${resumen.total} bridges con problemas.\n\n${listado}${extra}`;

    whatsapp = await enviarAlertaWhatsApp(mensaje);
  }

  return NextResponse.json({ ok: true, resumen, whatsapp });
}
