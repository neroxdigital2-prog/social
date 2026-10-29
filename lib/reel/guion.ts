import { generarRespuestaChat } from "@/lib/generadorTexto";

export interface EscenaGuion {
  texto: string; // texto en pantalla, en español, máx. ~8 palabras
  busqueda: string; // palabras clave en inglés para buscar metraje real en Pexels
}

export interface GuionReel {
  locucion: string; // texto completo que lee la voz en off, en español
  escenas: EscenaGuion[];
  cta: string; // llamada a la acción final, en español
}

export interface DatosGuion {
  empresa: string;
  titulo: string;
  texto: string;
  imagenPrompt?: string;
}

const SISTEMA = `Eres guionista de Reels para Instagram y Facebook de pymes en España.
Escribe SIEMPRE en español de España, tono cercano, directo y profesional, sin emojis.
Devuelve SOLO un JSON válido con esta forma exacta:
{"locucion":"...","escenas":[{"texto":"...","busqueda":"..."}],"cta":"..."}
Reglas:
- "locucion": voz en off de 50 a 65 palabras (unos 22-25 segundos). Termina con una frase de cierre completa. Empieza con un gancho fuerte en la primera frase. No digas URLs ni hashtags.
- "escenas": entre 4 y 5. "texto" es lo que aparece en pantalla: máximo 7 palabras, sin punto final. Deben seguir el orden de la locución.
- "busqueda": 2-4 palabras EN INGLÉS para buscar vídeo de stock real y vertical que ilustre esa escena (personas reales, oficinas, comercios, móviles, clientes...). Nada abstracto.
- "cta": máximo 6 palabras, en imperativo (ej. "Escríbenos por WhatsApp hoy").
- No inventes cifras, premios ni datos que no estén en el texto original.`;

function limpiar(s: string, max: number): string {
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function guionDeRespaldo(d: DatosGuion): GuionReel {
  const frases = limpiar(d.texto, 600)
    .split(/(?<=[.!?¿¡])\s+/)
    .filter((f) => f.length > 10);
  const locucion = [d.titulo, ...frases].join(" ").split(" ").slice(0, 60).join(" ");
  const palabrasClave = (d.imagenPrompt || "small business office").split(" ").slice(0, 4).join(" ");
  return {
    locucion,
    escenas: [
      { texto: limpiar(d.titulo, 60), busqueda: palabrasClave },
      { texto: limpiar(frases[0] || d.titulo, 50).split(" ").slice(0, 7).join(" "), busqueda: "business owner smartphone" },
      { texto: limpiar(frases[1] || "Te ayudamos paso a paso", 50).split(" ").slice(0, 7).join(" "), busqueda: "happy customer shop" },
    ],
    cta: "Escríbenos por WhatsApp",
  };
}

export async function crearGuion(d: DatosGuion): Promise<GuionReel> {
  const usuario = `Empresa: ${d.empresa}
Título de la publicación: ${d.titulo}
Texto de la publicación: ${limpiar(d.texto, 1500)}
${d.imagenPrompt ? `Idea visual: ${d.imagenPrompt}` : ""}`;

  try {
    const bruto = await generarRespuestaChat(SISTEMA, usuario);
    const json = JSON.parse(bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1));
    const escenas: EscenaGuion[] = (Array.isArray(json.escenas) ? json.escenas : [])
      .map((e: { texto?: string; busqueda?: string }) => ({
        texto: limpiar(String(e.texto || ""), 60),
        busqueda: limpiar(String(e.busqueda || ""), 60) || "small business",
      }))
      .filter((e: EscenaGuion) => e.texto)
      .slice(0, 5);
    const locucion = limpiar(String(json.locucion || ""), 600);
    if (escenas.length < 2 || locucion.split(" ").length < 12) throw new Error("Guion incompleto");
    return { locucion, escenas, cta: limpiar(String(json.cta || "Escríbenos por WhatsApp"), 45) };
  } catch (error) {
    console.error("crearGuion: usando guion de respaldo:", error);
    return guionDeRespaldo(d);
  }
}
