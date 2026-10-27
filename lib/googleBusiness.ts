import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Selección de ficha de Google Business tras el OAuth.
// Los tokens se guardan cifrados (AES-256-GCM) en una cookie httpOnly de 30 min,
// así no hace falta ningún bridge ni tabla nueva para la selección temporal.

export const COOKIE_SELECCION_GOOGLE = "gbp_seleccion";
export const DURACION_SELECCION_SEG = 30 * 60;

export interface SeleccionGoogle {
  empresaId: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  exp: number; // epoch ms
}

export interface FichaGoogle {
  recurso: string; // "accounts/123/locations/456"
  titulo: string;
  direccion: string;
  cuenta: string;
}

function clave(): Buffer {
  const base = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.BRIDGE_SECRET;
  if (!base) throw new Error("Falta AUTH_SECRET/BRIDGE_SECRET para cifrar la selección de Google");
  return createHash("sha256").update(`gbp-seleccion:${base}`).digest();
}

export function cifrarSeleccion(datos: SeleccionGoogle): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave(), iv);
  const cifrado = Buffer.concat([cipher.update(JSON.stringify(datos), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString("base64url");
}

export function descifrarSeleccion(valor: string | undefined): SeleccionGoogle | null {
  if (!valor) return null;
  try {
    const buf = Buffer.from(valor, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", clave(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const plano = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
    const datos = JSON.parse(plano) as SeleccionGoogle;
    if (!datos.empresaId || !datos.accessToken || Date.now() > datos.exp) return null;
    return datos;
  } catch {
    return null;
  }
}

interface CuentaApi {
  name: string;
  accountName?: string;
}

interface UbicacionApi {
  name: string;
  title?: string;
  storefrontAddress?: { addressLines?: string[]; locality?: string };
}

// Devuelve TODAS las fichas de TODAS las cuentas que administra el usuario.
export async function listarFichasGoogle(accessToken: string): Promise<FichaGoogle[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const cuentas: CuentaApi[] = [];
  let pageToken = "";
  do {
    const url = new URL("https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
    url.searchParams.set("pageSize", "20");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers, cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Error listando cuentas de Google (${res.status})`);
    cuentas.push(...(data.accounts || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  const fichas: FichaGoogle[] = [];
  for (const cuenta of cuentas) {
    let token = "";
    do {
      const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${cuenta.name}/locations`);
      url.searchParams.set("readMask", "name,title,storefrontAddress");
      url.searchParams.set("pageSize", "100");
      if (token) url.searchParams.set("pageToken", token);
      const res = await fetch(url, { headers, cache: "no-store" });
      const data = await res.json();
      if (!res.ok) break; // una cuenta sin permisos no bloquea al resto
      for (const u of (data.locations || []) as UbicacionApi[]) {
        const dir = u.storefrontAddress;
        fichas.push({
          recurso: `${cuenta.name}/${u.name}`,
          titulo: u.title || "Ficha sin nombre",
          direccion: [dir?.addressLines?.join(", "), dir?.locality].filter(Boolean).join(" · "),
          cuenta: cuenta.accountName || cuenta.name,
        });
      }
      token = data.nextPageToken || "";
    } while (token);
  }

  return fichas.sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
}

export async function guardarRedGoogle(empresaId: string, sel: SeleccionGoogle, ficha: FichaGoogle) {
  const res = await fetch(process.env.IONOS_BRIDGE_URL_REDES_GUARDAR!, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET! },
    body: JSON.stringify({
      empresaId,
      red: "GOOGLE",
      accessToken: sel.accessToken,
      refreshToken: sel.refreshToken,
      cuentaExterna: ficha.recurso,
      cuentaSecundaria: ficha.titulo,
    }),
  });
  if (!res.ok) throw new Error(`El bridge no guardó la red (${res.status})`);
}
