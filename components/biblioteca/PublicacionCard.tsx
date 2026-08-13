"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
}

function fileALeerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultado = reader.result as string;
      // Quita el prefijo "data:image/png;base64," dejando solo el contenido
      resolve(resultado.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PublicacionCard({ publicacion }: { publicacion: Publicacion }) {
  const router = useRouter();
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const [imagenUrl, setImagenUrl] = useState(publicacion.imagenUrl);
  const [generando, setGenerando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(publicacion.titulo);
  const [texto, setTexto] = useState(publicacion.texto);
  const [guardando, setGuardando] = useState(false);

  const [borrando, setBorrando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

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

  async function subirImagenManual(e: React.ChangeEvent<HTMLInputElement>) {
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
      const resSubida = await fetch("/api/publicaciones/imagen-subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType: file.type }),
      });
      const dataSubida = await resSubida.json();
      if (!resSubida.ok) {
        setError(dataSubida?.error || "No se pudo subir la imagen.");
        setSubiendo(false);
        return;
      }

      const resGuardar = await fetch(`/api/publicaciones/${publicacion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenUrl: dataSubida.url }),
      });
      const dataGuardar = await resGuardar.json();
      setSubiendo(false);

      if (!resGuardar.ok) {
        setError(dataGuardar?.error || "No se pudo guardar la imagen en la publicación.");
        return;
      }

      setImagenUrl(dataSubida.url);
    } catch {
      setSubiendo(false);
      setError("Error al procesar la imagen.");
    }
  }

  async function quitarImagen() {
    setSubiendo(true);
    setError(null);

    const res = await fetch(`/api/publicaciones/${publicacion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagenUrl: "" }),
    });
    const data = await res.json().catch(() => ({}));
    setSubiendo(false);

    if (!res.ok) {
      setError(data?.error || "No se pudo quitar la imagen.");
      return;
    }

    setImagenUrl(null);
  }

  async function guardarEdicion() {
    setGuardando(true);
    setError(null);

    const res = await fetch(`/api/publicaciones/${publicacion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, texto }),
    });
    const data = await res.json();
    setGuardando(false);

    if (!res.ok) {
      setError(data?.error || "No se pudo guardar la publicación.");
      return;
    }

    setEditando(false);
    router.refresh();
  }

  const [duplicando, setDuplicando] = useState(false);

  async function duplicarPublicacion() {
    setDuplicando(true);
    setError(null);

    const res = await fetch("/api/publicaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresaId: publicacion.empresaId,
        tipo: publicacion.tipo,
        titulo: `${titulo} (copia)`,
        texto,
        hashtags: publicacion.hashtags,
        imagenUrl: imagenUrl || "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setDuplicando(false);

    if (!res.ok) {
      setError(data?.error || "No se pudo duplicar la publicación.");
      return;
    }

    router.refresh();
  }

  async function borrarPublicacion() {
    setBorrando(true);
    setError(null);

    const res = await fetch(`/api/publicaciones/${publicacion.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBorrando(false);
      setError(data?.error || "No se pudo borrar la publicación.");
      return;
    }

    router.refresh();
  }

  return (
    <article className="pub-card">
      <div className="pub-card-top">
        <span className="pub-tipo">{publicacion.tipo.replace(/_/g, " ")}</span>
        <div className="pub-card-acciones">
          <button type="button" className="pub-btn-link" onClick={() => setEditando((v) => !v)}>
            {editando ? "Cancelar" : "Editar"}
          </button>
          <button type="button" className="pub-btn-link" disabled={duplicando} onClick={duplicarPublicacion}>
            {duplicando ? "Duplicando…" : "Duplicar"}
          </button>
          {confirmandoBorrado ? (
            <>
              <button type="button" className="pub-btn-link pub-btn-danger" disabled={borrando} onClick={borrarPublicacion}>
                {borrando ? "Borrando…" : "Confirmar"}
              </button>
              <button type="button" className="pub-btn-link" onClick={() => setConfirmandoBorrado(false)}>
                No
              </button>
            </>
          ) : (
            <button type="button" className="pub-btn-link pub-btn-danger" onClick={() => setConfirmandoBorrado(true)}>
              Borrar
            </button>
          )}
        </div>
      </div>

      {imagenUrl ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagenUrl} alt={titulo} className="pub-imagen" />
          <div className="pub-imagen-acciones">
            <button
              type="button"
              onClick={() => inputArchivoRef.current?.click()}
              disabled={subiendo}
              className="pub-btn-link"
            >
              {subiendo ? "Subiendo…" : "Cambiar imagen"}
            </button>
            <button type="button" onClick={quitarImagen} disabled={subiendo} className="pub-btn-link pub-btn-danger">
              Quitar imagen
            </button>
          </div>
          <input
            ref={inputArchivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={subirImagenManual}
          />
        </div>
      ) : (
        <div className="pub-imagen-acciones">
          <button type="button" onClick={generarImagenIA} disabled={generando} className="btn-generar-imagen">
            {generando ? "Generando imagen…" : "Generar con IA"}
          </button>
          <button
            type="button"
            onClick={() => inputArchivoRef.current?.click()}
            disabled={subiendo}
            className="btn-generar-imagen"
          >
            {subiendo ? "Subiendo…" : "Subir mi imagen"}
          </button>
          <input
            ref={inputArchivoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={subirImagenManual}
          />
        </div>
      )}

      {error && <p className="field-error" style={{ fontSize: "0.8rem" }}>{error}</p>}

      {editando ? (
        <div className="pub-edicion">
          <input
            type="text"
            className="pub-edicion-input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título"
          />
          <textarea
            className="pub-edicion-textarea"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            placeholder="Texto"
          />
          <button type="button" className="btn-primary" disabled={guardando} onClick={guardarEdicion}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      ) : (
        <>
          <h3>{titulo}</h3>
          <p>{texto}</p>
        </>
      )}

      <div className="pub-hashtags">
        {publicacion.hashtags.map((tag) => (
          <span key={tag} className="tag">#{tag}</span>
        ))}
      </div>
      <span className={`pub-estado estado-${publicacion.estado.toLowerCase()}`}>{publicacion.estado}</span>
    </article>
  );
}
