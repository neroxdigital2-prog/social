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
  altText: string;
  hashtags: string[];
  imagenPrompt: string;
}

export interface ClavesApi {
  gemini?: string;
  groq?: string;
  cerebras?: string;
  openrouter?: string;
}

// Mapeo de cada tipo de publicacion a su PILAR del embudo de contenido
// (ATRAER -> EDUCAR -> DEMOSTRAR -> CONFIANZA -> CONVERTIR). Cada pilar tiene
// un enfoque de KPI y de SEO distinto, para que el prompt lo aplique.
const PILAR_POR_TIPO: Record<string, { pilar: string; enfoqueSeo: string; formula: string }> = {
  INFORMATIVA:         { pilar: "ATRAER",    enfoqueSeo: "gancho fuerte en el primer segundo, keyword de problema/dolor del cliente, hashtags de alcance amplio dentro del nicho", formula: "GANCHO → PROBLEMA → SOLUCIÓN → BENEFICIO → CTA" },
  CONSEJO:             { pilar: "EDUCAR",    enfoqueSeo: "keyword de 'como hacer X', formato lista/pasos que invite a guardar", formula: "PROBLEMA → CONSEJOS → SOLUCIÓN → CTA" },
  CASO_EXITO:          { pilar: "CONFIANZA", enfoqueSeo: "keyword de resultado medible (numeros, porcentajes), hashtags de prueba social", formula: "ANTES → PROBLEMA → SOLUCIÓN NEROX → RESULTADO → CTA" },
  ANTES_DESPUES:       { pilar: "CONFIANZA", enfoqueSeo: "keyword de transformacion, contraste antes/despues explicito en el texto", formula: "ANTES → PROBLEMA → SOLUCIÓN NEROX → RESULTADO → CTA" },
  PROMOCION:           { pilar: "CONVERTIR", enfoqueSeo: "keyword de servicio + ciudad, CTA directo y urgente", formula: "GANCHO → PROBLEMA → SOLUCIÓN → BENEFICIO → CTA" },
  PREGUNTA_FRECUENTE:  { pilar: "EDUCAR",    enfoqueSeo: "keyword en formato pregunta literal (asi la gente busca), responde en el propio texto", formula: "PROBLEMA → CONSEJOS → SOLUCIÓN → CTA" },
  NOTICIA_SECTOR:      { pilar: "ATRAER",    enfoqueSeo: "keyword de tendencia/actualidad del sector, hashtags de novedad", formula: "GANCHO → PROBLEMA → SOLUCIÓN → BENEFICIO → CTA" },
  CURIOSIDAD:          { pilar: "ATRAER",    enfoqueSeo: "keyword de dato sorprendente, maximiza guardados y compartidos", formula: "GANCHO → PROBLEMA → SOLUCIÓN → BENEFICIO → CTA" },
  MITO_REALIDAD:       { pilar: "EDUCAR",    enfoqueSeo: "keyword del mito mas comun del sector, formato mito vs realidad", formula: "PROBLEMA → CONSEJOS → SOLUCIÓN → CTA" },
  TESTIMONIO:          { pilar: "CONFIANZA", enfoqueSeo: "keyword de experiencia de cliente real, tono cercano", formula: "ANTES → PROBLEMA → SOLUCIÓN NEROX → RESULTADO → CTA" },
  ENCUESTA:            { pilar: "DEMOSTRAR", enfoqueSeo: "keyword de decision/comparacion, fomenta comentarios", formula: "PROBLEMA → NEROX FUNCIONANDO → RESULTADO → CTA" },
  LLAMADA_ACCION:      { pilar: "CONVERTIR", enfoqueSeo: "keyword de servicio + ciudad, CTA muy directo (escribe/llama/agenda ya)", formula: "GANCHO → PROBLEMA → SOLUCIÓN → BENEFICIO → CTA" },
};

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

  const systemPrompt = `Eres un director de marketing digital experto en redes sociales para pequeñas y medianas empresas locales, con dominio de SEO para Instagram/Meta. Escribes en español, con tono cercano y profesional, adaptado al sector del negocio. Nunca inventas datos falsos sobre la empresa; usas solo la información proporcionada.

REGLAS SEO OBLIGATORIAS para cada publicación:
1. La keyword principal (sector o servicio del negocio) debe aparecer dentro de los primeros 125 caracteres del "texto" — Instagram solo indexa y muestra esa parte antes de "ver más".
2. La primera línea del "texto" debe ser un gancho corto que incluya esa keyword de forma natural, no un emoji suelto.
3. "altText" debe describir la imagen de forma literal (qué se ve) e incluir la keyword principal de forma natural — se usa para accesibilidad y para que Instagram indexe la imagen. Máximo 100 caracteres.
4. "hashtags" deben ser 3-5 hashtags de nicho (long-tail, específicos del sector+ciudad, ej. #disenowebmadrid en vez de #disenoweb) más 1 hashtag de marca fijo: #${(perfil.nombre || "nerox").toLowerCase().replace(/[^a-z0-9]/g, "")}. Nunca hashtags genéricos masivos (#instagood, #viral, #love).
5. Si la empresa tiene ciudad definida, menciona esa ciudad de forma natural dentro del "texto" (ej. "en ${perfil.ciudad}", "para negocios en ${perfil.ciudad}") para reforzar el SEO local.

ANTES DE ESCRIBIR CADA PUBLICACIÓN, responde internamente estas 6 preguntas y que el texto refleje esas respuestas (no las escribas literalmente, úsalas para guiar el contenido):
1. ¿A quién le hablamos? (empresario, autónomo, comercio local, etc.)
2. ¿Qué problema tiene esa persona?
3. ¿Qué le enseñamos o mostramos?
4. ¿Cómo lo solucionamos (con qué servicio de Nerox)?
5. ¿Qué beneficio concreto obtiene?
6. ¿Qué queremos que haga después de leer/ver esto? (esto define el CTA)

Cada tipo de publicación tiene ademas una FÓRMULA MAESTRA de estructura obligatoria que debes seguir al escribir el "texto" (ver la lista de tipos más abajo).`;

  const userPrompt = `Genera ${cantidad} publicaciones para redes sociales de esta empresa:

Nombre: ${perfil.nombre}
Sector: ${perfil.sector}
Ciudad: ${perfil.ciudad}
Servicios: ${perfil.servicios.join(", ") || "no especificados"}
Web: ${perfil.web || "no disponible"}
WhatsApp: ${perfil.whatsapp || "no disponible"}
${tema ? `\nTema o instrucción específica para estas publicaciones (síguela con prioridad, adaptando cada tipo de publicación a este tema): ${tema}\n` : ""}
Tipos de publicación requeridos en este orden exacto, con su pilar de embudo (ATRAER→EDUCAR→DEMOSTRAR→CONFIANZA→CONVERTIR), su enfoque SEO y su FÓRMULA MAESTRA de estructura obligatoria:
${tipos.map((t) => `- ${t} [pilar: ${PILAR_POR_TIPO[t]?.pilar ?? "ATRAER"}] → SEO: ${PILAR_POR_TIPO[t]?.enfoqueSeo ?? "keyword del sector en el gancho inicial"} → ESTRUCTURA: ${PILAR_POR_TIPO[t]?.formula ?? "GANCHO → PROBLEMA → SOLUCIÓN → BENEFICIO → CTA"}`).join("\n")}

Para cada publicación entrega, aplicando siempre las REGLAS SEO del system prompt Y el enfoque SEO específico de su pilar:
- titulo: máximo 8 palabras
- texto: entre 40 y 90 palabras, listo para publicar, keyword en los primeros 125 caracteres
- altText: descripción literal de la imagen con la keyword, máximo 100 caracteres
- hashtags: 3-5 hashtags de nicho long-tail + 1 hashtag de marca, sin espacios
- imagenPrompt: descripción en inglés para generar una imagen con IA que acompañe la publicación

Responde ÚNICAMENTE con un JSON válido con esta forma exacta:
{"publicaciones": [{"tipo": "TIPO", "titulo": "...", "texto": "...", "altText": "...", "hashtags": ["...","..."], "imagenPrompt": "..."}]}`;

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
  claves: ClavesApi = {},
  tema?: string
): Promise<PublicacionGenerada[]> {
  const { systemPrompt, userPrompt } = construirPrompts(perfil, cantidad, tema);

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
  // Algunos modelos no respetan estrictamente la cantidad pedida en el prompt
  // (sobre todo si tema/instrucciones son largos). Recortamos aqui para
  // garantizar que nunca se devuelvan mas publicaciones de las solicitadas.
  return (parsed.publicaciones || []).slice(0, cantidad);
}
