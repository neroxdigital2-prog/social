import type { PerfilEmpresa, PublicacionGenerada } from "@/lib/generador";

// Escribe una publicación a partir de una imagen (Gemini con visión, clave gratuita de AI Studio).
const MODELO_VISION = process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash";

export async function textoDesdeImagen(
  imagen: { base64: string; mimeType: string },
  perfil: PerfilEmpresa,
  instrucciones: string | undefined,
  apiKey: string | undefined
): Promise<PublicacionGenerada> {
  if (!apiKey) throw new Error("Falta la clave de Gemini (GEMINI_API_KEY) para analizar imágenes.");

  const marca = `#${(perfil.nombre || "marca").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const prompt = `Eres community manager experto en Instagram y Facebook para pymes en España. Mira la imagen adjunta y escribe UNA publicación en español de España para esta empresa:

Nombre: ${perfil.nombre}
Sector: ${perfil.sector}
Ciudad: ${perfil.ciudad}
Servicios: ${perfil.servicios.join(", ") || "no especificados"}
${perfil.whatsapp ? `WhatsApp: ${perfil.whatsapp}\n` : ""}${perfil.web ? `Web: ${perfil.web}\n` : ""}${perfil.diferenciador ? `Diferenciador: ${perfil.diferenciador}\n` : ""}${instrucciones ? `\nInstrucciones del usuario (prioridad): ${instrucciones}\n` : ""}
Reglas:
- Describe y aprovecha lo que REALMENTE se ve en la imagen; no inventes cifras, premios ni datos.
- Primera línea: gancho corto con la palabra clave del sector. Menciona ${perfil.ciudad || "la ciudad"} de forma natural.
- Texto de 40 a 90 palabras, tono cercano y profesional, estructura problema → solución → beneficio → llamada a la acción.
- 3 a 5 hashtags de nicho (sector + ciudad) más ${marca}. Nada de #viral ni #instagood.
- altText: descripción literal de la imagen, máximo 100 caracteres.

Responde SOLO con JSON válido:
{"titulo":"máx 8 palabras","texto":"...","altText":"...","hashtags":["#..."],"imagenPrompt":"descripción en inglés de la imagen"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_VISION}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: imagen.mimeType, data: imagen.base64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 900, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(45_000),
    }
  );
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const bruto: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
  const json = JSON.parse(bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1));

  return {
    tipo: "INFORMATIVA" as PublicacionGenerada["tipo"],
    titulo: String(json.titulo || "").slice(0, 120),
    texto: String(json.texto || "").trim(),
    altText: String(json.altText || "").slice(0, 100),
    hashtags: (Array.isArray(json.hashtags) ? json.hashtags : []).map((h: string) => String(h).trim()).filter(Boolean).slice(0, 6),
    imagenPrompt: String(json.imagenPrompt || ""),
  };
}
