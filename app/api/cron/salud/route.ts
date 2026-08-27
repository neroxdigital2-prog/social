import { NextRequest, NextResponse } from "next/server";
import { revisarTodosLosBridges, enviarAlertaWhatsAppPlantilla } from "@/lib/salud";

export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Disparado periódicamente por cron-job.org (cada 15 min). Revisa todos los
 * bridges de IONOS y, si alguno falla, manda un aviso por WhatsApp usando la
 * plantilla aprobada "nerox_alerta_salud" (funciona siempre, sin depender de
 * la ventana de 24h de conversación). Si todo está bien, no manda nada.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { resumen } = await revisarTodosLosBridges();
  const esPrueba = req.nextUrl.searchParams.get("prueba") === "1";

  let whatsapp = null;
  if (resumen.conProblemas > 0 || esPrueba) {
    whatsapp = await enviarAlertaWhatsAppPlantilla(resumen.conProblemas, resumen.total);
  }

  return NextResponse.json({ ok: true, resumen, whatsapp });
}
