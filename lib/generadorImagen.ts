import { openai } from "@/lib/openai";
import { conRetry } from "@/lib/conRetry";

export async function generarImagen(prompt: string): Promise<string> {
  return conRetry(async () => {
    const respuesta = await openai.images.generate({
      model: "dall-e-3",
      prompt: `${prompt}. Estilo fotográfico profesional, alta calidad, apto para redes sociales, sin texto superpuesto.`,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });
    const url = respuesta.data[0]?.url;
    if (!url) throw new Error("La API de imágenes no devolvió una URL");
    return url;
  });
}
