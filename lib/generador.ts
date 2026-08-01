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
  cerebras?: string;
  openrouter?: string;
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

function construirPrompts(perfil: PerfilEmpresa, cantidad: number) {
  const tipos = elegirTipos(cantidad);

  const systemPrompt = `Eres un director de marketing digital experto en redes sociales para pequeñas y medianas empresas locales. Escribes en español, con tono cercano y profesional, adaptado al sector del negocio. Nunca inventas datos falsos sobre la empresa; usas solo la información proporcionada.`;

  const userPrompt = `Genera ${cantidad} publicaciones para redes sociales de esta empresa:

Nombre: ${perfil.nombre}
Sector: ${perfil.sector}
Ciudad: ${perfil.ciudad}
Servicios: ${perfil.servicios.join(", ") || "no especificados"}
Web: ${perfil.web || "no disponible"}
WhatsApp: ${perfil.whatsapp || "no disponible"}

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

// Cerebras: API compatible con OpenAI, 1,000,000 tokens/día gratis (sin tarjeta).
// El catálogo de modelos gratis cambia con frecuencia; llama-3.3-70b es la opción
// más estable a la fecha. Si Cerebras retira ese modelo, este paso simplemente
// falla y el flujo sigue con OpenRouter.
async function generarConCerebras(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const respuesta = await conRetry(async () => {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
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
      throw new Error(`Cerebras API error ${res.status}: ${errorBody}`);
    }
    return res.json();
  });

  const contenido = respuesta?.choices?.[0]?.message?.content;
  if (!contenido) throw new Error("Cerebras no devolvió contenido");
  return contenido;
}

// OpenRouter: usamos el router automático "openrouter/free", que Openrouter
// mantiene apuntando a UN modelo gratis disponible en cada momento. Esto evita
// que el fallback se rompa cuando un modelo :free puntual es retirado del catálogo.
async function generarConOpenRouter(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const respuesta = await conRetry(async () => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://social.nerox.es",
        "X-Title": "Nerox Social IA",
      },
      body: JSON.stringify({
        model: "openrouter/free",
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
      throw new Error(`OpenRouter API error ${res.status}: ${errorBody}`);
    }
    return res.json();
  });

  const contenido = respuesta?.choices?.[0]?.message?.content;
  if (!contenido) throw new Error("OpenRouter no devolvió contenido");
  return contenido;
}

export async function generarPublicaciones(
  perfil: PerfilEmpresa,
  cantidad: number,
  claves: ClavesApi = {}
): Promise<PublicacionGenerada[]> {
  const { systemPrompt, userPrompt } = construirPrompts(perfil, cantidad);

  const geminiKey = claves.gemini || process.env.GEMINI_API_KEY;
  const groqKey = claves.groq || process.env.GROQ_API_KEY;
  const cerebrasKey = claves.cerebras || process.env.CEREBRAS_API_KEY;
  const openrouterKey = claves.openrouter || process.env.OPENROUTER_API_KEY;

  // Orden de la cadena: cada paso se intenta solo si hay clave disponible.
  // Si todos fallan (o no hay ninguna clave), se propaga el último error real.
  const pasos: Array<{ nombre: string; key?: string; fn: (s: string, u: string, k: string) => Promise<string> }> = [
    { nombre: "Gemini", key: geminiKey, fn: generarConGemini },
    { nombre: "Groq", key: groqKey, fn: generarConGroq },
    { nombre: "Cerebras", key: cerebrasKey, fn: generarConCerebras },
    { nombre: "OpenRouter", key: openrouterKey, fn: generarConOpenRouter },
  ];

  let contenido: string | null = null;
  let ultimoError: unknown = null;

  for (const paso of pasos) {
    if (!paso.key) continue;
    try {
      contenido = await paso.fn(systemPrompt, userPrompt, paso.key);
      break;
    } catch (error) {
      console.error(`Fallo ${paso.nombre}, probando siguiente proveedor:`, error);
      ultimoError = error;
    }
  }

  if (!contenido) {
    throw ultimoError ?? new Error("No hay ninguna clave de API configurada (Gemini, Groq, Cerebras u OpenRouter)");
  }

  const parsed = JSON.parse(contenido) as { publicaciones: PublicacionGenerada[] };
  return parsed.publicaciones;
}
