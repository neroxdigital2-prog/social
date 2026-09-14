"use client";

import { useState } from "react";
import type { FotoPexels } from "@/lib/pexels";

export function PexelsImagePicker({
  terminoInicial = "",
  onSeleccionar,
  onCerrar,
}: {
  terminoInicial?: string;
  onSeleccionar: (foto: FotoPexels) => void;
  onCerrar?: () => void;
}) {
  const [termino, setTermino] = useState(terminoInicial);
  const [fotos, setFotos] = useState<FotoPexels[]>([]);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function buscar(nuevaPagina = 1) {
    if (!termino.trim()) return;
    setCargando(true);
    setError("");

    const res = await fetch(`/api/imagenes/pexels?q=${encodeURIComponent(termino)}&pagina=${nuevaPagina}`);
    const data = await res.json().catch(() => null);

    setCargando(false);

    if (!res.ok) {
      setError(data?.error || "No se pudo buscar imágenes.");
      return;
    }

    setFotos((prev) => (nuevaPagina === 1 ? data.fotos : [...prev, ...data.fotos]));
    setHayMas(data.hayMas);
    setPagina(nuevaPagina);
  }

  return (
    <div className="pexels-picker">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          buscar(1);
        }}
        className="pexels-picker-busqueda"
        style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
      >
        <input
          type="text"
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
          placeholder="Ej: peluquería moderna, oficina, comida..."
          aria-label="Buscar fotos en Pexels"
          style={{ flex: 1, minWidth: 160 }}
        />
        <button type="submit" className="btn-primary" disabled={cargando || !termino.trim()}>
          {cargando && fotos.length === 0 ? "Buscando..." : "Buscar"}
        </button>
        {onCerrar && (
          <button type="button" onClick={onCerrar} className="pub-btn-link">
            Cerrar
          </button>
        )}
      </form>

      {error && (
        <p role="alert" className="field-error" style={{ fontSize: "0.8rem" }}>
          {error}
        </p>
      )}

      <div
        className="pexels-picker-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "0.6rem",
          marginTop: "0.6rem",
        }}
      >
        {fotos.map((foto) => (
          <div key={foto.id} className="pexels-picker-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.src.mediana}
              alt={foto.alt}
              loading="lazy"
              style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 8 }}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%", marginTop: 4, fontSize: "0.78rem", padding: "0.35rem" }}
              onClick={() => onSeleccionar(foto)}
            >
              Usar esta imagen
            </button>
            <p style={{ fontSize: "0.65rem", margin: "2px 0 0" }}>
              Foto de{" "}
              <a href={foto.fotografoUrl} target="_blank" rel="noopener noreferrer">
                {foto.fotografo}
              </a>{" "}
              en{" "}
              <a href={foto.pexelsUrl} target="_blank" rel="noopener noreferrer">
                Pexels
              </a>
            </p>
          </div>
        ))}
      </div>

      {hayMas && !cargando && fotos.length > 0 && (
        <button type="button" className="pub-btn-link" onClick={() => buscar(pagina + 1)} style={{ marginTop: "0.6rem" }}>
          Cargar más
        </button>
      )}
    </div>
  );
}
