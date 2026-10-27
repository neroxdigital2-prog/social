"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Ficha {
  recurso: string;
  titulo: string;
  direccion: string;
  cuenta: string;
}

export function SelectorFichaGoogle({ fichas, empresaId }: { fichas: Ficha[]; empresaId: string }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");
  const [conectando, setConectando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return fichas;
    return fichas.filter((f) => `${f.titulo} ${f.direccion} ${f.cuenta}`.toLowerCase().includes(q));
  }, [fichas, filtro]);

  async function conectar(recurso: string) {
    setConectando(recurso);
    setError(null);
    const res = await fetch("/api/redes/google/elegir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recurso }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setConectando(null);
      setError(data?.error || "No se pudo conectar la ficha.");
      return;
    }
    router.push(`/configuracion?redes_ok=1&empresa=${data?.empresaId || empresaId}`);
  }

  return (
    <div>
      {error && (
        <p role="alert" className="cal-error">
          {error}
        </p>
      )}
      {fichas.length > 5 && (
        <label style={{ display: "block", marginBottom: 16 }}>
          <span className="text-muted">Buscar ficha</span>
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Nombre, dirección o cuenta…"
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
      )}
      <ul className="cal-sin-programar-lista" style={{ listStyle: "none", padding: 0 }}>
        {visibles.map((f) => (
          <li key={f.recurso} className="cal-sin-programar-item">
            <span>
              <strong className="cal-item-titulo">{f.titulo}</strong>
              {(f.direccion || f.cuenta) && (
                <small className="text-muted" style={{ display: "block" }}>
                  {[f.direccion, f.cuenta].filter(Boolean).join(" — ")}
                </small>
              )}
            </span>
            <button
              type="button"
              className="btn-primary"
              disabled={conectando !== null}
              aria-busy={conectando === f.recurso}
              onClick={() => conectar(f.recurso)}
            >
              {conectando === f.recurso ? "Conectando..." : "Conectar esta ficha"}
            </button>
          </li>
        ))}
        {visibles.length === 0 && <li className="text-muted">Ninguna ficha coincide con la búsqueda.</li>}
      </ul>
    </div>
  );
}
