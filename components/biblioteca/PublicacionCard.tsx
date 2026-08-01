"use client";

import { useState } from "react";

interface Publicacion {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  hashtags: string[];
  estado: string;
  imagenPrompt: string;
  imagenUrl: string | null;
}

export function PublicacionCard({ publicacion }: { publicacion: Publicacion }) {
  const [imagenUrl, setImagenUrl] = useState(publicacion.imagenUrl);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generarImagenIA() {
    setGenerando(true);
    setError(null);

    const res = await fetch(`/api/publicaciones/${publicacion.id}/imagen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagenPrompt: publicacion.imagenPrompt }),
    });

    const data = await res.json();
    setGenerando(false);

    if (!res.ok) {
      setError(data?.error || "No se pudo generar la imagen.");
      return;
    }

    setImagenUrl(data.imagenUrl);
  }

  return (
    <article className="pub-card">
      <span className="pub-tipo">{publicacion.tipo.replace(/_/g, " ")}</span>

      {imagenUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imagenUrl} alt={publicacion.titulo} className="pub-imagen" />
      ) : (
        <button type="button" onClick={generarImagenIA} disabled={generando} className="btn-generar-imagen">
          {generando ? "Generando imagen…" : "Generar con IA"}
        </button>
      )}

      {error && <p className="field-error" style={{ fontSize: "0.8rem" }}>{error}</p>}

      <h3>{publicacion.titulo}</h3>
      <p>{publicacion.texto}</p>
      <div className="pub-hashtags">
        {publicacion.hashtags.map((tag) => (
          <span key={tag} className="tag">#{tag}</span>
        ))}
      </div>
      <span className={`pub-estado estado-${publicacion.estado.toLowerCase()}`}>{publicacion.estado}</span>
    </article>
  );
}
