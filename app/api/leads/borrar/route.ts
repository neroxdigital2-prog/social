import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { registrarActividad } from "@/lib/registroActividad";
import { urlBridge } from "@/lib/bridgeUrl";

const BRIDGE = urlBridge("IONOS_BRIDGE_URL_LEADS_BORRAR");
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;

const BodySchema = z.object({
  empresaId: z.string().min(1),
  ids: z.array(z.string().min(1)).max(2000).optional(),
  todo: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!BRIDGE) {
    return NextResponse.json({ error: "Falta la variable IONOS_BRIDGE_URL_LEADS_BORRAR en Vercel (bridge leads-borrar.php)." }, { status: 500 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || (!parsed.data.todo && !parsed.data.ids?.length)) {
    return NextResponse.json({ error: "Selecciona al menos un lead" }, { status: 400 });
  }
  const { empresaId, ids, todo } = parsed.data;

  const res = await fetch(BRIDGE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
    body: JSON.stringify({ userId: session.user.id, empresaId, ids: ids || [], todo: todo === true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json({ error: data?.error || "No se pudieron borrar los leads" }, { status: res.status });

  if (data.borrados > 0) {
    const nombres: string[] = Array.isArray(data.nombres) ? data.nombres : [];
    await registrarActividad({
      userId: session.user.id,
      empresaId,
      tipo: "LEADS_BORRADOS",
      descripcion: `${todo ? "Borrado total: " : ""}${data.borrados} lead${data.borrados > 1 ? "s" : ""} borrado${data.borrados > 1 ? "s" : ""}: ${nombres.slice(0, 20).join(", ")}${nombres.length > 20 ? ` y ${nombres.length - 20} más` : ""}`,
      detalle: { nombres },
    });
  }
  return NextResponse.json(data);
}
