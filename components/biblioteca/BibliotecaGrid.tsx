"use client";

import { useMemo, useState } from "react";
import { PublicacionCard } from "@/components/biblioteca/PublicacionCard";

interface ResultadoRed {
  red: string;
  postIdExterno: string | null;
  publicadoEn: string | null;
  error: string | null;
}

interface Publicacion {
  id: string;
  empresaId: string;
  tipo: string;
  titulo: string;
  texto: string;
  hashtags: string[];
  estado: string;
  imagenPrompt: string;
  imagenUrl: string | null;
  fechaProgramada: string | null;
  redes: ResultadoRed[];
}

const ESTADOS = ["Todos", "BORRADOR", "PROGRAMADA", "PUBLICADA", "RECHAZADA"] as const;

const ETIQUETAS: Record<string, string> = {
  Todos: "Todos",
  BORRADOR: "Borrador",
  PROGRAMADA: "Programada",
  PUBLICADA: "Publicada",
  RECHAZADA: "Rechazada",
};

export function BibliotecaGrid({ publicaciones }: { publicaciones: Publicacion[] }) {
  const [filtro, setFiltro] = useState<(typeof ESTADOS)[number]>("Todos");

  const conteos = useMemo(() => {
    const base: Record<string, number> = { Todos: publicaciones.length };
    for (const p of publicaciones) {
      base[p.estado] = (base[p.estado] || 0) + 1;
    }
    return base;
  }, [publicaciones]);

  const filtradas = filtro === "Todos" ? publicaciones : publicaciones.filter((p) => p.estado === filtro);

  return (
    <div>
      <div className="cal-estado-filtros" role="group" aria-label="Filtrar por estado">
        {ESTADOS.filter((e) => e === "Todos" || conteos[e] > 0).map((estado) => (
          <button
            key={estado}
            type="button"
            className={`chip-filtro${filtro === estado ? " chip-filtro-activo" : ""}`}
            onClick={() => setFiltro(estado)}
          >
            {ETIQUETAS[estado]} ({conteos[estado] || 0})
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <p className="text-muted">No hay publicaciones con este estado.</p>
      ) : (
        <section className="publicaciones-grid">
          {filtradas.map((pub) => (
            <PublicacionCard key={pub.id} publicacion={pub} />
          ))}
        </section>
      )}
    </div>
  );
}
