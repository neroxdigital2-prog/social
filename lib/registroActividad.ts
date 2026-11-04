// Registro de actividad del CRM (servidor). Nunca bloquea ni rompe la acción
// principal: si el bridge falla, solo se escribe en el log de Vercel.

export const TIPOS_ACTIVIDAD = {
  LEAD_CREADO: "Lead creado",
  LEAD_ESTADO: "Cambio de estado",
  LEADS_BORRADOS: "Leads borrados",
  BUSQUEDA_RADAR: "Búsqueda RADAR",
  RADAR_RESULTADO_BORRADO: "Resultado RADAR borrado",
  INFORME_DESCARGADO: "Informe descargado",
} as const;

export type TipoActividad = keyof typeof TIPOS_ACTIVIDAD;

export interface EntradaRegistro {
  userId: string;
  empresaId?: string | null;
  tipo: TipoActividad;
  descripcion: string;
  detalle?: Record<string, unknown>;
}

export async function registrarActividad(e: EntradaRegistro): Promise<void> {
  const url = process.env.IONOS_BRIDGE_URL_REGISTRO_ACTIVIDAD;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET! },
      body: JSON.stringify({ accion: "crear", ...e, empresaId: e.empresaId || "" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("registrarActividad:", res.status, await res.text().catch(() => ""));
  } catch (error) {
    console.error("registrarActividad: no se pudo guardar el registro", error);
  }
}
