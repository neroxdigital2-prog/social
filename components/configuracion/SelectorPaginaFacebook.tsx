"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SelectorPaginaFacebook({
  paginas,
  empresaId,
  seleccionId,
}: {
  paginas: { id: string; name: string }[];
  empresaId: string;
  seleccionId: string;
}) {
  const router = useRouter();
  const [conectandoId, setConectandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function conectar(pageId: string) {
    setConectandoId(pageId);
    setError(null);
    const res = await fetch("/api/redes/facebook/elegir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seleccionId, pageId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setConectandoId(null);
      setError(data?.error || "No se pudo conectar la página.");
      return;
    }
    router.push(`/configuracion?redes_ok=1&empresa=${empresaId}`);
  }

  return (
    <div>
      {error && (
        <p role="alert" className="cal-error">
          {error}
        </p>
      )}
      <div className="cal-sin-programar-lista">
        {paginas.map((pagina) => (
          <div key={pagina.id} className="cal-sin-programar-item">
            <strong className="cal-item-titulo">{pagina.name}</strong>
            <button
              type="button"
              className="btn-primary"
              disabled={conectandoId !== null}
              onClick={() => conectar(pagina.id)}
            >
              {conectandoId === pagina.id ? "Conectando..." : "Conectar esta página"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
