// Alertas descartadas / marcadas como resueltas, guardadas en una cookie del
// navegador: { clave: firma }. Una alerta se oculta solo mientras su firma no
// cambie; si el problema vuelve (nuevo error, más leads…), la firma cambia y
// la alerta reaparece sola.

export const COOKIE_RESUELTAS = "nerox_dsh_resueltas";
const MAX_ENTRADAS = 60;

export type MapaResueltas = Record<string, string>;

export function leerResueltas(valor: string | undefined | null): MapaResueltas {
  if (!valor) return {};
  try {
    const datos = JSON.parse(decodeURIComponent(valor));
    return datos && typeof datos === "object" && !Array.isArray(datos) ? (datos as MapaResueltas) : {};
  } catch {
    return {};
  }
}

function escribirCookie(mapa: MapaResueltas) {
  const entradas = Object.entries(mapa).slice(-MAX_ENTRADAS);
  const valor = encodeURIComponent(JSON.stringify(Object.fromEntries(entradas)));
  document.cookie = `${COOKIE_RESUELTAS}=${valor}; path=/; max-age=31536000; samesite=lax`;
}

function cookieActual(): MapaResueltas {
  const par = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_RESUELTAS}=`));
  return leerResueltas(par ? par.slice(COOKIE_RESUELTAS.length + 1) : null);
}

export function marcarResueltaEnNavegador(clave: string, firma: string) {
  const mapa = cookieActual();
  delete mapa[clave]; // reinsertar al final para que no se pierda al recortar
  mapa[clave] = firma;
  escribirCookie(mapa);
}

export function restaurarResueltasEnNavegador(prefijo: string) {
  const mapa = cookieActual();
  for (const clave of Object.keys(mapa)) if (clave.startsWith(prefijo)) delete mapa[clave];
  escribirCookie(mapa);
}
