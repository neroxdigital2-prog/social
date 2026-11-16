// Agente de noticias: busca en Google News (RSS, gratis y sin clave) las
// últimas noticias de las categorías activas, en español y de España.
import type { CategoriaNoticias } from "@/lib/autopiloto/plantilla";

export interface Noticia {
  titulo: string;
  url: string;
  fuente: string;
  fecha: string | null; // ISO
  categoria: string; // id
  categoriaNombre: string;
}

function decodificar(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, "")
    .trim();
}

function etiqueta(xml: string, nombre: string): string {
  const m = new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`, "i").exec(xml);
  return m ? decodificar(m[1]) : "";
}

export function parsearRss(xml: string, categoria: CategoriaNoticias): Noticia[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return items
    .map((it) => {
      const tituloCompleto = etiqueta(it, "title");
      const fuente = etiqueta(it, "source") || tituloCompleto.split(" - ").slice(-1)[0] || "";
      const titulo = fuente && tituloCompleto.endsWith(` - ${fuente}`) ? tituloCompleto.slice(0, -(fuente.length + 3)) : tituloCompleto;
      const fechaTexto = etiqueta(it, "pubDate");
      const fecha = fechaTexto && !Number.isNaN(Date.parse(fechaTexto)) ? new Date(fechaTexto).toISOString() : null;
      return { titulo: titulo.trim(), url: etiqueta(it, "link"), fuente: fuente.trim(), fecha, categoria: categoria.id, categoriaNombre: categoria.nombre };
    })
    .filter((n) => n.titulo && n.url.startsWith("http"));
}

async function buscarUna(q: string, categoria: CategoriaNoticias, dias: number): Promise<Noticia[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:${dias}d`)}&hl=es&gl=ES&ceid=ES:es`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NeroxSocialIA/1.0)" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return parsearRss(await res.text(), categoria).slice(0, 8);
  } catch {
    return [];
  }
}

/** Noticias recientes de todas las categorías activas, sin duplicados, de la más nueva a la más antigua. */
export async function buscarNoticias(categorias: CategoriaNoticias[], dias = 7): Promise<Noticia[]> {
  const activas = categorias.filter((c) => c.activa);
  const resultados = await Promise.all(activas.flatMap((c) => c.busquedas.map((q) => buscarUna(q, c, dias))));
  const vistos = new Set<string>();
  const salida: Noticia[] = [];
  for (const n of resultados.flat()) {
    const clave = n.titulo.toLowerCase().replace(/[^a-z0-9áéíóúñ ]/gi, "").slice(0, 80);
    if (vistos.has(n.url) || vistos.has(clave)) continue;
    vistos.add(n.url);
    vistos.add(clave);
    salida.push(n);
  }
  return salida.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
}
