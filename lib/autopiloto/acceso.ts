// Comprueba que el usuario puede editar la empresa (bridge EMPRESA_ACCESO).
export async function puedeEditarEmpresa(userId: string, empresaId: string): Promise<{ ok: boolean; nombre?: string }> {
  const url = process.env.IONOS_BRIDGE_URL_EMPRESA_ACCESO;
  if (!url) return { ok: false };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET || "" },
      body: JSON.stringify({ userId, empresaId, rolMinimo: "EDITOR" }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    return { ok: !!(res.ok && data?.permitido), nombre: data?.empresa?.nombre };
  } catch {
    return { ok: false };
  }
}

/** Lanza el piloto automático en segundo plano (misma ruta que usa el cron). */
export async function lanzarAutopiloto(base: string, empresaId?: string): Promise<boolean> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/cron/autopiloto${empresaId ? `?empresa=${encodeURIComponent(empresaId)}` : ""}`, {
      headers: { Authorization: `Bearer ${secreto}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
