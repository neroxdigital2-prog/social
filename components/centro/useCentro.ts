"use client";

import { useCallback, useEffect, useState } from "react";
import type { DatosCentro } from "@/components/centro/tipos";

/** Carga el estado de los agentes y lo refresca cada minuto. */
export function useCentro() {
  const [datos, setDatos] = useState<DatosCentro | null>(null);
  const [sinAcceso, setSinAcceso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const res = await fetch("/api/centro", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) return setSinAcceso(true);
      if (!res.ok) throw new Error("No se pudo cargar el estado de los agentes.");
      setDatos(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    }
  }, []);

  useEffect(() => {
    recargar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") recargar();
    }, 60_000);
    return () => clearInterval(t);
  }, [recargar]);

  return { datos, sinAcceso, error, recargar };
}
