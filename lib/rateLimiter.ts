interface RegistroLimite {
  conteo: number;
  reinicioEn: number;
}

const almacen = new Map<string, RegistroLimite>();

setInterval(() => {
  const ahora = Date.now();
  for (const [clave, registro] of almacen.entries()) {
    if (registro.reinicioEn < ahora) almacen.delete(clave);
  }
}, 60_000);

export function verificarRateLimit(
  clave: string,
  maxSolicitudes: number,
  ventanaMs: number
): { permitido: boolean; restante: number } {
  const ahora = Date.now();
  const registro = almacen.get(clave);

  if (!registro || registro.reinicioEn < ahora) {
    almacen.set(clave, { conteo: 1, reinicioEn: ahora + ventanaMs });
    return { permitido: true, restante: maxSolicitudes - 1 };
  }

  if (registro.conteo >= maxSolicitudes) {
    return { permitido: false, restante: 0 };
  }

  registro.conteo++;
  return { permitido: true, restante: maxSolicitudes - registro.conteo };
}

export function obtenerIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "desconocida";
}
