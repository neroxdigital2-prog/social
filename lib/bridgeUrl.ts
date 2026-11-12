// URL de un bridge PHP de IONOS. Si la variable no existe en Vercel, usa la
// URL estándar https://bridge.nerox.es/<archivo>.php, así un bridge nuevo
// funciona en cuanto se sube a IONOS, sin tener que crear la variable.

const BASE_BRIDGE = (process.env.IONOS_BRIDGE_BASE_URL || "https://bridge.nerox.es").replace(/\/+$/, "");

export const ARCHIVOS_POR_DEFECTO: Record<string, string> = {
  IONOS_BRIDGE_URL_LEADS_BORRAR: "leads-borrar.php",
  IONOS_BRIDGE_URL_REGISTRO_ACTIVIDAD: "registro-actividad.php",
  IONOS_BRIDGE_URL_REDES_CREDENCIALES: "redes-credenciales.php",
  IONOS_BRIDGE_URL_PUBLICACION_SUBIR_VIDEO: "publicacion-subir-video.php",
  IONOS_BRIDGE_URL_PUBLICACION_VIDEO_GUARDAR: "publicacion-video-guardar.php",
  IONOS_BRIDGE_URL_VIGILANTE: "vigilante.php",
};

export function urlBridge(variable: string): string | undefined {
  const valor = process.env[variable]?.trim();
  if (valor) return valor;
  const archivo = ARCHIVOS_POR_DEFECTO[variable];
  return archivo ? `${BASE_BRIDGE}/${archivo}` : undefined;
}

export function usaUrlPorDefecto(variable: string): boolean {
  return !process.env[variable]?.trim() && !!ARCHIVOS_POR_DEFECTO[variable];
}
