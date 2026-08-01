import { conRetry } from "@/lib/conRetry";

export interface ClavesApiChat {
  gemini?: string;
  groq?: string;
  cerebras?: string;
  openrouter?: string;
}

async function chatGemini(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey;

  const respuesta = await conRetry(async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
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
  return contenido.trim();
}

async function chatGroq(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const respuesta = await conRetry(async () => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 400,
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
  return contenido.trim();
}

async function chatCerebras(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const respuesta = await conRetry(async () => {
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        temperature: 0.7,
        max_tokens: 400,
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
  return contenido.trim();
}

async function chatOpenRouter(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
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
        temperature: 0.7,
        max_tokens: 400,
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
  return contenido.trim();
}

/**
 * Genera una respuesta de chat en texto libre (no JSON), probando los
 * proveedores en cadena (Gemini → Groq → Cerebras → OpenRouter).
 */
export async function generarRespuestaChat(
  systemPrompt: string,
  userPrompt: string,
  claves: ClavesApiChat = {}
): Promise<string> {
  const geminiKey = claves.gemini || process.env.GEMINI_API_KEY;
  const groqKey = claves.groq || process.env.GROQ_API_KEY;
  const cerebrasKey = claves.cerebras || process.env.CEREBRAS_API_KEY;
  const openrouterKey = claves.openrouter || process.env.OPENROUTER_API_KEY;

  const pasos: Array<{ nombre: string; key?: string; fn: (s: string, u: string, k: string) => Promise<string> }> = [
    { nombre: "Gemini", key: geminiKey, fn: chatGemini },
    { nombre: "Groq", key: groqKey, fn: chatGroq },
    { nombre: "Cerebras", key: cerebrasKey, fn: chatCerebras },
    { nombre: "OpenRouter", key: openrouterKey, fn: chatOpenRouter },
  ];

  let ultimoError: unknown = null;
  for (const paso of pasos) {
    if (!paso.key) continue;
    try {
      return await paso.fn(systemPrompt, userPrompt, paso.key);
    } catch (error) {
      console.error(`Fallo ${paso.nombre} en chat, probando siguiente proveedor:`, error);
      ultimoError = error;
    }
  }

  throw ultimoError ?? new Error("No hay ninguna clave de API configurada para el chat");
}
