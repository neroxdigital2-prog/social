import sharp from "sharp";

// Formato único de la Biblioteca: vertical 9:16 a 1080x1920 px.
// Todas las imágenes (IA, subidas manuales y Pexels) se normalizan a este tamaño.
export const FORMATO_BIBLIOTECA = {
  ancho: 1080,
  alto: 1920,
  ratio: "9:16",
} as const;

// El FEED de Instagram (API de Meta) solo acepta relaciones entre 4:5 y 1.91:1.
// Una 9:16 se rechaza, así que al publicar en Instagram se genera una copia 4:5.
export const FORMATO_FEED_INSTAGRAM = { ancho: 1080, alto: 1350 } as const;
const RATIO_MINIMO_FEED_IG = 4 / 5;

// Recorta (cover, centrado) y redimensiona cualquier imagen a 1080x1920 JPEG.
export async function normalizarA916(entrada: Buffer): Promise<Buffer> {
  return sharp(entrada)
    .rotate()
    .resize(FORMATO_BIBLIOTECA.ancho, FORMATO_BIBLIOTECA.alto, { fit: "cover", position: "attention" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

// Copia 4:5 (1080x1350) recortada al centro de interés, para el feed de Instagram.
export async function recortarParaFeedInstagram(entrada: Buffer): Promise<Buffer> {
  return sharp(entrada)
    .rotate()
    .resize(FORMATO_FEED_INSTAGRAM.ancho, FORMATO_FEED_INSTAGRAM.alto, { fit: "cover", position: "attention" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

export async function necesitaRecorteFeedInstagram(entrada: Buffer): Promise<boolean> {
  const { width, height } = await sharp(entrada).metadata();
  if (!width || !height) return false;
  return width / height < RATIO_MINIMO_FEED_IG;
}

// Descarga una URL (http o data:) a Buffer.
export async function descargarImagen(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// Sube un buffer JPEG al bridge de IONOS y devuelve la URL pública.
export async function subirBufferAlBridge(buffer: Buffer): Promise<string> {
  const bridgeUrl = process.env.IONOS_BRIDGE_URL_PUBLICACION_SUBIR_IMAGEN;
  const secret = process.env.BRIDGE_SECRET;
  if (!bridgeUrl || !secret) {
    throw new Error("Faltan IONOS_BRIDGE_URL_PUBLICACION_SUBIR_IMAGEN o BRIDGE_SECRET");
  }
  const res = await fetch(bridgeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": secret },
    body: JSON.stringify({ fileBase64: buffer.toString("base64"), mimeType: "image/jpeg" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) throw new Error(data?.error || "El bridge no devolvió la URL de la imagen");
  return data.url as string;
}
