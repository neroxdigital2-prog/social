interface OpcionesRetry {
  intentos?: number;
  esperaBaseMs?: number;
}

export async function conRetry<T>(
  fn: () => Promise<T>,
  opciones: OpcionesRetry = {}
): Promise<T> {
  const intentos = opciones.intentos ?? 3;
  const esperaBaseMs = opciones.esperaBaseMs ?? 1000;

  let ultimoError: unknown;

  for (let intento = 0; intento < intentos; intento++) {
    try {
      return await fn();
    } catch (error) {
      ultimoError = error;
      const esReintentable = esErrorReintentable(error);
      if (!esReintentable || intento === intentos - 1) throw error;
      const espera = esperaBaseMs * Math.pow(2, intento) + Math.random() * 300;
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
  }

  throw ultimoError;
}

function esErrorReintentable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const mensaje = error.message.toLowerCase();
  return (
    mensaje.includes("rate limit") ||
    mensaje.includes("429") ||
    mensaje.includes("timeout") ||
    mensaje.includes("econnreset") ||
    mensaje.includes("fetch failed") ||
    mensaje.includes("503") ||
    mensaje.includes("502")
  );
}
