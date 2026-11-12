// "Cortacircuitos" de proveedores de IA: si uno falla, se aparta unos minutos y
// se usan primero los demás (sin perder la petición). Nunca se descarta del
// todo: pasa al final de la cola, por si es el único disponible.
// Vive en la memoria de cada instancia de Vercel (se reinicia sola).

const enPausa = new Map<string, { hasta: number; motivo: string }>();

function minutosPausa(error: unknown): number {
  const m = String(error instanceof Error ? error.message : error).toLowerCase();
  if (/\b429\b|quota|resource_exhausted|rate limit|limit reached/.test(m)) return 30;
  if (/\b401\b|\b403\b|api key|invalid|unauthori/.test(m)) return 60;
  return 10;
}

export function marcarFalloIA(nombre: string, error: unknown) {
  const min = minutosPausa(error);
  enPausa.set(nombre, { hasta: Date.now() + min * 60_000, motivo: String(error instanceof Error ? error.message : error).slice(0, 160) });
}

export function marcarExitoIA(nombre: string) {
  enPausa.delete(nombre);
}

/** Ordena los proveedores: primero los disponibles (en su orden), después los que están en pausa. */
export function ordenarPorDisponibilidad<T extends { nombre: string }>(pasos: T[]): T[] {
  const ahora = Date.now();
  const enPausaAhora = (p: T) => (enPausa.get(p.nombre)?.hasta || 0) > ahora;
  return [...pasos.filter((p) => !enPausaAhora(p)), ...pasos.filter(enPausaAhora)];
}

export function estadoCircuitoIA() {
  const ahora = Date.now();
  return [...enPausa.entries()].filter(([, v]) => v.hasta > ahora).map(([nombre, v]) => ({ nombre, minutosRestantes: Math.ceil((v.hasta - ahora) / 60_000), motivo: v.motivo }));
}
