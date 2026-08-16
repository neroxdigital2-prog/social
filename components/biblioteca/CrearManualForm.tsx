"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TIPOS = ["INFORMATIVA", "CASO_EXITO", "PROMOCION", "CURIOSIDAD", "TESTIMONIO"];

function fileALeerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CrearManualForm({ empresaId }: { empresaId: string }) {
  const router = useRouter();
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const [modo, setModo] = useState<"cerrado" | "eleccion" | "manual">("cerrado");
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [hashtagsTexto, setHashtagsTexto] = useState("");
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const mimesPermitidos = ["image/png", "image/jpeg", "image/webp"];
    if (!mimesPermitidos.includes(file.type)) {
      setError("Solo se permiten imágenes PNG, JPG o WEBP.");
      return;
    }

    setSubiendo(true);
    setError(null);
    try {
      const fileBase64 = await fileALeerBase64(file);
      const res = await fetch("/api/publicaciones/imagen-subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType: file.type }),
      });
      const data = await res.json();
      setSubiendo(false);
      if (!res.ok) {
        setError(data?.error || "No se pudo subir la imagen.");
        return;
      }
      setImagenUrl(data.url);
    } catch {
      setSubiendo(false);
      setError("Error al procesar la imagen.");
    }
  }

  async function crear() {
    if (titulo.trim().length < 2 || texto.trim().length < 2) {
      setError("El título y el texto son obligatorios.");
      return;
    }

    setGuardando(true);
    setError(null);

    const hashtags = hashtagsTexto
      .split(",")
      .map((h) => h.trim().replace(/^#/, ""))
      .filter(Boolean);

    const res = await fetch("/api/publicaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId, tipo, titulo, texto, hashtags, imagenUrl: imagenUrl || "" }),
    });
    const data = await res.json();
    setGuardando(false);

    if (!res.ok) {
      setError(data?.error || "No se pudo crear la publicación.");
      return;
    }

    setTitulo("");
    setTexto("");
    setHashtagsTexto("");
    setImagenUrl(null);
    setModo("cerrado");
    router.refresh();
  }

  if (modo === "cerrado") {
    return (
      <button type="button" className="btn-primary" onClick={() => setModo("eleccion")}>
        + Crear publicación
      </button>
    );
  }

  if (modo === "eleccion") {
    return (
      <div className="form-card">
        <h3>¿Cómo quieres crear la publicación?</h3>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
          <button type="button" className="btn-primary" onClick={() => setModo("manual")}>
            ✍️ Manual
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => router.push(`/generador?empresa=${empresaId}`)}
          >
            🤖 Generar con IA
          </button>
          <button type="button" className="btn-secondary" onClick={() => setModo("cerrado")}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-card">
      <h3>Nueva publicación manual</h3>

      <div className="field">
        <label htmlFor="tipo-manual">Tipo</label>
        <select id="tipo-manual" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="titulo-manual">Título</label>
        <input
          id="titulo-manual"
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título de la publicación"
        />
      </div>

      <div className="field">
        <label htmlFor="texto-manual">Texto</label>
        <textarea
          id="texto-manual"
          rows={5}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe el contenido de la publicación"
        />
      </div>

      <div className="field">
        <label htmlFor="hashtags-manual">Hashtags (separados por coma, opcional)</label>
        <input
          id="hashtags-manual"
          type="text"
          value={hashtagsTexto}
          onChange={(e) => setHashtagsTexto(e.target.value)}
          placeholder="marketing, pymes, madrid"
        />
      </div>

      <div className="field">
        <label>Imagen (opcional)</label>
        {imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagenUrl} alt="Vista previa" className="pub-imagen" />
        ) : (
          <button
            type="button"
            className="btn-generar-imagen"
            onClick={() => inputArchivoRef.current?.click()}
            disabled={subiendo}
          >
            {subiendo ? "Subiendo…" : "Subir imagen"}
          </button>
        )}
        <input
          ref={inputArchivoRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={subirImagen}
        />
      </div>

      {error && <p className="field-error">{error}</p>}

      <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.75rem" }}>
        <button type="button" className="btn-primary" disabled={guardando} onClick={crear}>
          {guardando ? "Creando…" : "Crear publicación"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setModo("cerrado")}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
