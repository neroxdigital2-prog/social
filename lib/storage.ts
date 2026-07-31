import { createClient } from "@supabase/supabase-js";
import { conRetry } from "@/lib/conRetry";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function subirImagenDesdeUrl(
  urlTemporal: string,
  nombreArchivo: string,
  contentType: string = "image/png"
): Promise<string> {
  return conRetry(async () => {
    const respuesta = await fetch(urlTemporal);
    if (!respuesta.ok) throw new Error("No se pudo descargar el archivo generado");
    const buffer = await respuesta.arrayBuffer();
    const { error } = await supabase.storage.from("publicaciones").upload(nombreArchivo, buffer, { contentType, upsert: true });
    if (error) throw new Error(`Error subiendo a Supabase Storage: ${error.message}`);
    const { data } = supabase.storage.from("publicaciones").getPublicUrl(nombreArchivo);
    return data.publicUrl;
  });
}
