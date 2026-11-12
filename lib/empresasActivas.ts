// Empresas activas / desactivadas (Centro de control). Desactivada = no publica,
// no se vigila y no genera avisos. Solo se listan las empresas del usuario.
import { bridgeVigilante } from "@/lib/vigilante";

interface EmpresaEstado {
  id: string;
  nombre: string;
  activa: number | string | boolean;
  programadas: number | string;
  redes: number | string;
}

export async function empresasDelUsuario(userId: string): Promise<{ id: string; nombre: string }[] | null> {
  const url = process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET || "" },
      body: JSON.stringify({ userId }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function estadosEmpresas(userId: string) {
  const propias = await empresasDelUsuario(userId);
  if (!propias) return null;
  const estados = await bridgeVigilante<EmpresaEstado[]>("empresas_estado", { ids: propias.map((e) => e.id) });
  const mapa = new Map((Array.isArray(estados) ? estados : []).map((e) => [e.id, e]));
  return propias.map((e) => {
    const est = mapa.get(e.id);
    return {
      id: e.id,
      nombre: e.nombre,
      activa: est ? Number(est.activa) === 1 || est.activa === true : true,
      programadas: Number(est?.programadas) || 0,
      redes: Number(est?.redes) || 0,
      sinDatos: !est,
    };
  });
}

