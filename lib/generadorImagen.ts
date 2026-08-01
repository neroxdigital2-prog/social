import { conRetry } from "@/lib/conRetry";

export interface ClavesImagen {
  gemini?: string;
}

// Gemini 2.5 Flash Image ("Nano Banana"): genera la imagen y la devuelve en base64.
// La convertimos a data URL para reutilizar el mismo flujo de subida a Storage
// que ya existe en lib/storage.ts (subirImagenDesdeUrl acepta cualquier URL,
// incluidas las data: URL).
async function generarConGeminiImagen(prompt: string, apiKey: string): Promise<string> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=" +
    apiKey;

  const respuesta = await conRetry(async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Gemini Image API error ${res.status}: ${errorBody}`);
    }
    return res.json();
  });

  interface ParteRespuesta {
    inlineData?: { data: string; mimeType?: string };
  }
  const partes: ParteRespuesta[] = respuesta?.candidates?.[0]?.content?.parts ?? [];
  const parteImagen = partes.find((p) => p.inlineData?.data);

  if (!parteImagen?.inlineData?.data) {
    throw new Error("Gemini no devolvió una imagen");
  }

  const mime = parteImagen.inlineData.mimeType || "image/png";
  return `data:${mime};base64,${parteImagen.inlineData.data}`;
}

// Pollinations.ai: sin API key, sin registro, sin límite práctico (modelo Flux).
// La imagen se genera "al vuelo" la primera vez que alguien visita la URL,
// así que no hace falta esperar nada aquí: devolvemos la URL directamente.
// El seed aleatorio evita que dos publicaciones con el mismo prompt compartan imagen.
function generarConPollinations(prompt: string): string {
  const promptCodificado = encodeURIComponent(prompt);
  const semilla = Math.floor(Math.random() * 1_000_000);
  return `https://image.pollinations.ai/prompt/${promptCodificado}?width=1024&height=1024&nologo=true&seed=${semilla}`;
}

export async function generarImagen(prompt: string, claves: ClavesImagen = {}): Promise<string> {
  const promptCompleto = `${prompt}. Estilo fotográfico profesional, alta calidad, apto para redes sociales, sin texto superpuesto.`;
  const geminiKey = claves.gemini || process.env.GEMINI_API_KEY;

  if (geminiKey) {
    try {
      return await generarConGeminiImagen(promptCompleto, geminiKey);
    } catch (error) {
      console.error("Fallo Gemini Image, usando Pollinations:", error);
    }
  }

  return generarConPollinations(promptCompleto);
}
