// Filtro anti-repetición: compara títulos y textos con lo ya publicado
// (similitud de palabras, al estilo del "caption guard" de instagram-ai-agent).

const VACIAS = new Set(
  "a al algo como con de del el ella en es esta este esto hay la las lo los mas más mi muy no o para pero por que qué se si sin sobre su sus te tu tus un una uno y ya tu tú yo hoy ese esa eso cómo cuál cuánto".split(" ")
);

export function palabras(texto: string): Set<string> {
  return new Set(
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/#\S+/g, " ")
      .replace(/[^a-z0-9ñ ]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 2 && !VACIAS.has(p))
      .map((p) => p.replace(/(es|s)$/, "").slice(0, 5)) // raíz aproximada: web/webs, lenta/lentas, cliente/clientes
  );
}

export function similitud(a: string, b: string): number {
  const A = palabras(a);
  const B = palabras(b);
  if (!A.size || !B.size) return 0;
  let comunes = 0;
  for (const p of A) if (B.has(p)) comunes++;
  return comunes / Math.min(A.size, B.size) * 0.5 + (comunes / (A.size + B.size - comunes)) * 0.5;
}

export interface Previa {
  titulo: string;
  texto?: string | null;
}

/** ¿Se parece demasiado a algo ya publicado? Devuelve el parecido o null. */
export function buscarRepetida(titulo: string, texto: string, historial: Previa[]): { titulo: string; parecido: number } | null {
  let peor: { titulo: string; parecido: number } | null = null;
  for (const h of historial) {
    const st = similitud(titulo, h.titulo);
    const sx = h.texto ? similitud(texto.slice(0, 400), h.texto) : 0;
    const parecido = Math.max(st, sx * 0.95);
    if ((st >= 0.6 || sx >= 0.55) && (!peor || parecido > peor.parecido)) peor = { titulo: h.titulo, parecido };
  }
  return peor;
}

export function tituloYaUsado(titulo: string, titulos: string[]): boolean {
  return titulos.some((t) => similitud(titulo, t) >= 0.6);
}
