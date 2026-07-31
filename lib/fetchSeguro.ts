export interface ResultadoFetch<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

export async function fetchSeguro<T = unknown>(
  input: RequestInfo,
  init?: RequestInit
): Promise<ResultadoFetch<T>> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, data: null, error: data?.mensaje || data?.error || `Error del servidor (${res.status})` };
    }
    const data = await res.json().catch(() => null);
    return { ok: true, data: data as T, error: null };
  } catch (error) {
    return { ok: false, data: null, error: "No se pudo conectar. Revisa tu conexión a internet e inténtalo de nuevo." };
  }
}
