// Cola de publicaciones programadas (en vivo, sin depender del vigilante):
// cuántas hay, hasta qué fecha y cuáles salen a continuación.

interface PubRaw {
  id: string;
  titulo: string;
  estado: string;
  fechaProgramada: string | null;
  formato?: string | null;
  redes?: { red: string }[];
}

export interface PublicacionEnCola {
  id: string;
  titulo: string;
  empresaId: string;
  empresaNombre: string;
  fecha: string; // "YYYY-MM-DD HH:MM:SS" (Madrid)
  atrasada: boolean;
  redes: string[];
}

export interface ColaPublicaciones {
  total: number;
  atrasadas: number;
  desde: string | null;
  hasta: string | null;
  porEmpresa: { empresaId: string; empresaNombre: string; total: number; hasta: string | null }[];
  proximas: PublicacionEnCola[];
}

async function bridge<T>(url: string | undefined, body: unknown): Promise<T | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET || "" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function ahoraMadrid(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    .format(new Date())
    .replace("T", " ");
}

export async function cargarColaPublicaciones(userId: string): Promise<ColaPublicaciones | null> {
  const empresas = await bridge<{ id: string; nombre: string }[]>(process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST, { userId });
  if (!Array.isArray(empresas)) return null;
  const ahora = ahoraMadrid();

  const listas = await Promise.all(
    empresas.map(async (e) => {
      const pubs = (await bridge<PubRaw[]>(process.env.IONOS_BRIDGE_URL_PUBLICACIONES_LIST, { userId, empresaId: e.id })) || [];
      return (Array.isArray(pubs) ? pubs : [])
        .filter((p) => p.estado === "PROGRAMADA" && p.fechaProgramada)
        .map<PublicacionEnCola>((p) => ({
          id: p.id,
          titulo: p.titulo,
          empresaId: e.id,
          empresaNombre: e.nombre,
          fecha: p.fechaProgramada!,
          atrasada: p.fechaProgramada! < ahora,
          redes: (p.redes || []).map((r) => r.red),
        }));
    })
  );

  const todas = listas.flat().sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const porEmpresa = empresas
    .map((e) => {
      const suyas = todas.filter((p) => p.empresaId === e.id);
      return { empresaId: e.id, empresaNombre: e.nombre, total: suyas.length, hasta: suyas.at(-1)?.fecha || null };
    })
    .filter((e) => e.total > 0);

  return {
    total: todas.length,
    atrasadas: todas.filter((p) => p.atrasada).length,
    desde: todas[0]?.fecha || null,
    hasta: todas.at(-1)?.fecha || null,
    porEmpresa,
    proximas: todas.slice(0, 12),
  };
}
