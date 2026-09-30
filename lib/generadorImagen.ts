import { conRetry } from "@/lib/conRetry";
import { FORMATO_BIBLIOTECA, normalizarA916 } from "@/lib/imagenFormato";

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
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: FORMATO_BIBLIOTECA.ratio },
        },
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

  // Gemini devuelve 9:16 a menor resolución: se escala a 1080x1920 exactos.
  const normalizada = await normalizarA916(Buffer.from(parteImagen.inlineData.data, "base64"));
  return `data:image/jpeg;base64,${normalizada.toString("base64")}`;
}

// Pollinations.ai: sin API key, sin registro, sin límite práctico (modelo Flux).
// La imagen se genera "al vuelo" la primera vez que alguien visita la URL,
// así que no hace falta esperar nada aquí: devolvemos la URL directamente.
// El seed aleatorio evita que dos publicaciones con el mismo prompt compartan imagen.
function generarConPollinations(prompt: string): string {
  const promptCodificado = encodeURIComponent(prompt);
  const semilla = Math.floor(Math.random() * 1_000_000);
  return `https://image.pollinations.ai/prompt/${promptCodificado}?width=${FORMATO_BIBLIOTECA.ancho}&height=${FORMATO_BIBLIOTECA.alto}&nologo=true&seed=${semilla}`;
}

export async function generarImagen(prompt: string, claves: ClavesImagen = {}): Promise<string> {
  const promptCompleto = `${prompt}. Estilo fotográfico profesional, alta calidad, apto para redes sociales, sin texto superpuesto. Composición vertical 9:16 (1080x1920), sujeto principal centrado con margen arriba y abajo.`;
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
