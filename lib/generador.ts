import { conRetry } from "@/lib/conRetry";
import { TipoPublicacion } from "@prisma/client";

export interface PerfilEmpresa {
  nombre: string;
  sector: string;
  ciudad: string;
  servicios: string[];
  web?: string | null;
  whatsapp?: string | null;
}

export interface PublicacionGenerada {
  tipo: TipoPublicacion;
  titulo: string;
  texto: string;
  hashtags: string[];
  imagenPrompt: string;
}

export interface ClavesApi {
  gemini?: string;
  groq?: string;
}

const TIPOS_ROTACION: TipoPublicacion[] = [
  "INFORMATIVA", "CONSEJO", "CASO_EXITO", "ANTES_DESPUES", "PROMOCION",
  "PREGUNTA_FRECUENTE", "NOTICIA_SECTOR", "CURIOSIDAD", "MITO_REALIDAD",
  "TESTIMONIO", "ENCUESTA", "LLAMADA_ACCION",
];

function elegirTipos(cantidad: number): TipoPublicacion[] {
  const tipos: TipoPublicacion[] = [];
  for (let i = 0; i < cantidad; i++) tipos.push(TIPOS_ROTACION[i % TIPOS_ROTACION.length]);
  return tipos;
}

function construirPrompts(perfil: PerfilEmpresa, cantidad: number, tema?: string) {
  const tipos = elegirTipos(cantidad);

  const systemPrompt = `Eres un director de marketing digital experto en redes sociales para pequeñas y medianas empresas locales. Escribes en español, con tono cercano y profesional, adaptado al sector del negocio. Nunca inventas datos falsos sobre la empresa; usas solo la información proporcionada.`;

  const instruccionTema = tema?.trim()
    ? `\nInstrucción específica del usuario (PRIORIDAD MÁXIMA, todas las publicaciones deben girar en torno a esto): ${tema.trim()}\n`
    : "";

  const userPrompt = `Genera ${cantidad} publicaciones para redes sociales de esta empresa:

Nombre: ${perfil.nombre}
Sector: ${perfil.sector}
Ciudad: ${perfil.ciudad}
Servicios: ${perfil.servicios.join(", ") || "no especificados"}
Web: ${perfil.web || "no disponible"}
WhatsApp: ${perfil.whatsapp || "no disponible"}
${instruccionTema}
Tipos de publicación requeridos en este orden exacto: ${tipos.join(", ")}.

Para cada publicación entrega:
- titulo: máximo 8 palabras
- texto: entre 40 y 90 palabras, listo para publicar
- hashtags: 5 hashtags relevantes en español, sin espacios
- imagenPrompt: descripción en inglés para generar una imagen con IA que acompañe la publicación

Responde ÚNICAMENTE con un JSON válido con esta forma exacta:
{"publicaciones": [{"tipo": "TIPO", "titulo": "...", "texto": "...", "hashtags": ["...","..."], "imagenPrompt": "..."}]}`;

  return { systemPrompt, userPrompt };
}

async function generarConGemini(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey;

  const respuesta = await conRetry(async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errorBody}`);
    }
    return res.json();
  });

  const contenido = respuesta?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!contenido) throw new Error("Gemini no devolvió contenido");
  return contenido;
}

async function generarConGroq(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const respuesta = await conRetry(async () => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.8,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Groq API error ${res.status}: ${errorBody}`);
    }
    return res.json();
  });

  const contenido = respuesta?.choices?.[0]?.message?.content;
  if (!contenido) throw new Error("Groq no devolvió contenido");
  return contenido;
}

export async function generarPublicaciones(
  perfil: PerfilEmpresa,
  cantidad: number,
  claves: ClavesApi = {},
  tema?: string
): Promise<PublicacionGenerada[]> {
  const { systemPrompt, userPrompt } = construirPrompts(perfil, cantidad, tema);

  const geminiKey = claves.gemini || process.env.GEMINI_API_KEY!;
  const groqKey = claves.groq || process.env.GROQ_API_KEY;

  let contenido: string;

  try {
    contenido = await generarConGemini(systemPrompt, userPrompt, geminiKey);
  } catch (errorGemini) {
    console.error("Fallo Gemini, probando con Groq:", errorGemini);

    if (!groqKey) {
      throw errorGemini;
    }

    contenido = await generarConGroq(systemPrompt, userPrompt, groqKey);
  }

  const parsed = JSON.parse(contenido) as { publicaciones: PublicacionGenerada[] };
  return parsed.publicaciones;
}
