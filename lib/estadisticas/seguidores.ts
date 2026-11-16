// Seguidores reales de Instagram y Facebook (Graph API), guardados un valor por día.
// Fuente: tabla SeguidoresDiario (estadisticas.php) + histórico antiguo del snapshot de Instagram.
import { bridgeEstadisticas } from "@/lib/estadisticas/metricas";

const GRAPH = "https://graph.facebook.com/v21.0";

export type RedSeg = "INSTAGRAM" | "FACEBOOK";
export interface PuntoSeguidores {
  red: RedSeg;
  fecha: string;
  seguidores: number;
  publicaciones: number | null;
  actualizadoEn?: string | null;
}

interface Cuenta {
  empresaId: string;
  red: RedSeg;
  cuentaExterna: string;
  accessToken: string;
}

export function hoyMadrid(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

async function leerCuenta(c: Cuenta): Promise<{ seguidores: number; publicaciones: number | null } | { error: string }> {
  const campos = c.red === "INSTAGRAM" ? "followers_count,media_count" : "followers_count,fan_count";
  try {
    const res = await fetch(`${GRAPH}/${c.cuentaExterna}?fields=${campos}&access_token=${encodeURIComponent(c.accessToken)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || d?.error) return { error: d?.error?.message || `HTTP ${res.status}` };
    const seguidores = Number(d.followers_count ?? d.fan_count);
    if (!Number.isFinite(seguidores)) return { error: "Meta no devolvió el número de seguidores." };
    return { seguidores, publicaciones: c.red === "INSTAGRAM" && Number.isFinite(Number(d.media_count)) ? Number(d.media_count) : null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Lee ahora los seguidores reales y guarda el valor del día. Sin empresaId: todas las empresas activas. */
export async function actualizarSeguidores(empresaId?: string) {
  const r = await bridgeEstadisticas<{ cuentas?: Cuenta[] }>("cuentas_seguidores", empresaId ? { empresaId } : {});
  const cuentas = r?.cuentas || [];
  const leidas: { empresaId: string; red: RedSeg; seguidores: number; publicaciones: number | null }[] = [];
  const errores: { empresaId: string; red: RedSeg; error: string }[] = [];

  await Promise.all(
    cuentas.map(async (c) => {
      const v = await leerCuenta(c);
      if ("error" in v) errores.push({ empresaId: c.empresaId, red: c.red, error: v.error });
      else leidas.push({ empresaId: c.empresaId, red: c.red, ...v });
    })
  );

  let instalado = r !== null;
  if (leidas.length) {
    const g = await bridgeEstadisticas<{ instalado?: boolean; error?: string }>("guardar_seguidores", { fecha: hoyMadrid(), lista: leidas });
    instalado = g?.instalado !== false;
  }
  return { instalado, cuentas: cuentas.length, leidas, errores };
}

/** Serie diaria real (IG + FB). Completa Instagram con el histórico antiguo si existe. */
export async function serieSeguidores(empresaId: string, desde: string, hasta: string) {
  const [nueva, antigua] = await Promise.all([
    bridgeEstadisticas<{ instalado?: boolean; serie?: PuntoSeguidores[] }>("seguidores", { empresaId, desde, hasta }),
    (async () => {
      const url = process.env.IONOS_BRIDGE_URL_SNAPSHOT_LISTAR;
      if (!url) return [] as PuntoSeguidores[];
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET || "" },
          body: JSON.stringify({ empresaId, desde, hasta }),
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        const d = await res.json().catch(() => null);
        const l: { fecha: string; seguidores: number; publicaciones?: number | null }[] = Array.isArray(d?.snapshots) ? d.snapshots : [];
        return l.map((s) => ({ red: "INSTAGRAM" as const, fecha: String(s.fecha).slice(0, 10), seguidores: Number(s.seguidores) || 0, publicaciones: s.publicaciones ?? null }));
      } catch {
        return [] as PuntoSeguidores[];
      }
    })(),
  ]);

  const mapa = new Map<string, PuntoSeguidores>();
  for (const p of antigua) mapa.set(`${p.red}|${p.fecha}`, p);
  for (const p of nueva?.serie || []) mapa.set(`${p.red}|${p.fecha}`, { ...p, seguidores: Number(p.seguidores) || 0 });
  const serie = [...mapa.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.red.localeCompare(b.red)));
  const ultimaLectura = (nueva?.serie || []).reduce<string | null>((m, p) => (p.actualizadoEn && (!m || p.actualizadoEn > m) ? p.actualizadoEn : m), null);
  return { instalado: nueva?.instalado !== false && nueva !== null, serie, ultimaLectura };
}
