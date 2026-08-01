import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { conRetry } from "@/lib/conRetry";

// Cliente creado de forma perezosa (no al importar el archivo) para que el build
// de Next.js no truene si SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY todavia no estan
// configuradas en Vercel. El error real (si faltan) aparece recien cuando alguien
// use la funcion, no durante la compilacion.
let supabase: SupabaseClient | null = null;

function obtenerSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel."
      );
    }
    supabase = createClient(url, key);
  }
  return supabase;
}

export async function subirImagenDesdeUrl(
  urlTemporal: string,
  nombreArchivo: string,
  contentType: string = "image/png"
): Promise<string> {
  return conRetry(async () => {
    const cliente = obtenerSupabase();
    const respuesta = await fetch(urlTemporal);
    if (!respuesta.ok) throw new Error("No se pudo descargar el archivo generado");
    const buffer = await respuesta.arrayBuffer();
    const { error } = await cliente.storage.from("publicaciones").upload(nombreArchivo, buffer, { contentType, upsert: true });
    if (error) throw new Error(`Error subiendo a Supabase Storage: ${error.message}`);
    const { data } = cliente.storage.from("publicaciones").getPublicUrl(nombreArchivo);
    return data.publicUrl;
  });
}
