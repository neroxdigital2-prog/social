"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Clapperboard, ImagePlus, Loader2, PenLine, Send, Sparkles, Upload } from "lucide-react";

type Modo = "imagen" | "texto";
type EstadoMedia = "pendiente" | "generando" | "listo" | "error";

interface Texto {
  titulo: string;
  texto: string;
  hashtags: string;
  imagenPrompt: string;
}

const REDES_ETIQUETA: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  GOOGLE: "Google Business",
  LINKEDIN: "LinkedIn",
  TWITTER: "X",
};

const VACIO: Texto = { titulo: "", texto: "", hashtags: "", imagenPrompt: "" };

function leerComoBase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(",")[1] || "");
    lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
    lector.readAsDataURL(archivo);
  });
}

function aHashtags(texto: string): string[] {
  return texto
    .split(/[\s,]+/)
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`));
}

export function CreadorManual({ empresaId }: { empresaId: string }) {
  const [modo, setModo] = useState<Modo>("imagen");
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Paso 1
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [instrucciones, setInstrucciones] = useState("");
  const [tema, setTema] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const [contenido, setContenido] = useState<Texto>(VACIO);
  const entradaArchivo = useRef<HTMLInputElement>(null);

  // Paso 2
  const [publicacionId, setPublicacionId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [quiereImagen, setQuiereImagen] = useState(true);
  const [quiereVideo, setQuiereVideo] = useState(false);
  const [estadoImagen, setEstadoImagen] = useState<EstadoMedia>("pendiente");
  const [estadoVideo, setEstadoVideo] = useState<EstadoMedia>("pendiente");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Paso 3
  const [redesDisponibles, setRedesDisponibles] = useState<string[]>([]);
  const [redes, setRedes] = useState<Set<string>>(new Set());
  const [fecha, setFecha] = useState("");
  const [publicando, setPublicando] = useState(false);

  useEffect(() => {
    fetch(`/api/redes?empresa=${empresaId}`)
      .then((r) => r.json())
      .then((d: { red: string }[]) => {
        const lista = Array.isArray(d) ? Array.from(new Set(d.map((r) => r.red))) : [];
        setRedesDisponibles(lista);
        setRedes(new Set(lista));
      })
      .catch(() => setRedesDisponibles([]));
  }, [empresaId]);

  function reiniciar(nuevoModo?: Modo) {
    if (nuevoModo) setModo(nuevoModo);
    setPaso(1);
    setError(null);
    setAviso(null);
    setImagenUrl(null);
    setInstrucciones("");
    setTema("");
    setContenido(VACIO);
    setPublicacionId(null);
    setEstadoImagen("pendiente");
    setEstadoVideo("pendiente");
    setVideoUrl(null);
    setQuiereImagen(true);
    setQuiereVideo(false);
    setFecha("");
  }

  async function subirImagen(archivo: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type)) {
      setError("Usa una imagen PNG, JPG o WEBP.");
      return;
    }
    if (archivo.size > 8 * 1024 * 1024) {
      setError("La imagen supera 8 MB.");
      return;
    }
    setSubiendo(true);
    setError(null);
    try {
      const res = await fetch("/api/publicaciones/imagen-subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: await leerComoBase64(archivo), mimeType: archivo.type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || "No se pudo subir la imagen.");
      setImagenUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  async function escribirConIA() {
    setEscribiendo(true);
    setError(null);
    const cuerpo =
      modo === "imagen"
        ? { modo: "imagen", empresaId, imagenUrl, instrucciones: instrucciones.trim() || undefined }
        : { modo: "tema", empresaId, tema: tema.trim() };
    const res = await fetch("/api/generador/texto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const data = await res.json().catch(() => ({}));
    setEscribiendo(false);
    if (!res.ok) {
      setError(data?.error || "No se pudo generar el texto.");
      return;
    }
    setContenido({
      titulo: data.titulo || "",
      texto: data.texto || "",
      hashtags: (data.hashtags || []).join(" "),
      imagenPrompt: data.imagenPrompt || "",
    });
  }

  async function guardarBorrador() {
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/publicaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        empresaId,
        tipo: "INFORMATIVA",
        titulo: contenido.titulo.trim(),
        texto: contenido.texto.trim(),
        hashtags: aHashtags(contenido.hashtags),
        imagenUrl: imagenUrl || "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(false);
    if (!res.ok || !data?.id) {
      setError(typeof data?.error === "string" ? data.error : "No se pudo guardar la publicación.");
      return;
    }
    setPublicacionId(data.id);
    if (modo === "imagen") {
      setEstadoImagen("listo");
      setQuiereImagen(false);
    }
    setPaso(2);
  }

  async function generarMedios() {
    if (!publicacionId) return;
    setError(null);
    const tareas: Promise<void>[] = [];

    if (quiereImagen && estadoImagen !== "listo") {
      setEstadoImagen("generando");
      const prompt =
        contenido.imagenPrompt ||
        `Professional vertical social media photo for a ${contenido.titulo}, realistic, bright, no text`;
      tareas.push(
        fetch(`/api/publicaciones/${publicacionId}/imagen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenPrompt: prompt }),
        }).then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (r.ok && d?.imagenUrl) {
            setImagenUrl(d.imagenUrl);
            setEstadoImagen("listo");
          } else {
            setEstadoImagen("error");
            setError(d?.error || "No se pudo generar la imagen.");
          }
        })
      );
    }

    if (quiereVideo && estadoVideo !== "listo") {
      setEstadoVideo("generando");
      tareas.push(
        fetch(`/api/publicaciones/${publicacionId}/video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresaId }),
        }).then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (r.ok && d?.videoUrl) {
            setVideoUrl(d.videoUrl);
            setEstadoVideo("listo");
          } else {
            setEstadoVideo("error");
            setError(d?.error || "No se pudo generar el vídeo.");
          }
        })
      );
    }

    await Promise.all(tareas);
  }

  async function finalizar(accion: "ahora" | "programar") {
    if (!publicacionId) return;
    if (redes.size === 0) {
      setError("Marca al menos una red social.");
      return;
    }
    if (accion === "programar" && !fecha) {
      setError("Elige fecha y hora.");
      return;
    }
    setPublicando(true);
    setError(null);
    setAviso(null);
    try {
      const r1 = await fetch(`/api/publicaciones/${publicacionId}/redes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redes: Array.from(redes) }),
      });
      if (!r1.ok) throw new Error((await r1.json().catch(() => ({})))?.error || "No se pudieron guardar las redes.");

      if (accion === "ahora") {
        const r2 = await fetch(`/api/publicaciones/${publicacionId}/publicar-ahora`, { method: "POST" });
        const d2 = await r2.json().catch(() => ({}));
        if (!r2.ok) throw new Error(d2?.error || "No se pudo publicar.");
        setAviso(d2.mensaje);
      } else {
        const r2 = await fetch(`/api/publicaciones/${publicacionId}/programar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fechaProgramada: new Date(fecha).toISOString() }),
        });
        const d2 = await r2.json().catch(() => ({}));
        if (!r2.ok) throw new Error(d2?.error || "No se pudo programar.");
        setAviso(`Programada para el ${new Date(fecha).toLocaleString("es-ES")}.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló.");
    } finally {
      setPublicando(false);
    }
  }

  const textoListo = contenido.titulo.trim().length >= 2 && contenido.texto.trim().length >= 2;
  const mediosGenerando = estadoImagen === "generando" || estadoVideo === "generando";
  const tieneMedio = estadoImagen === "listo" || estadoVideo === "listo";

  return (
    <div className="cm">
      <div className="cm-modos" role="radiogroup" aria-label="Cómo quieres crear la publicación">
        <button type="button" role="radio" aria-checked={modo === "imagen"} className="cm-modo" onClick={() => reiniciar("imagen")}>
          <ImagePlus size={22} aria-hidden="true" />
          <strong>Tengo una imagen</strong>
          <span>La subo y la IA escribe el texto</span>
        </button>
        <button type="button" role="radio" aria-checked={modo === "texto"} className="cm-modo" onClick={() => reiniciar("texto")}>
          <PenLine size={22} aria-hidden="true" />
          <strong>Tengo el texto</strong>
          <span>Lo escribo (o la IA) y se genera imagen y/o Reel</span>
        </button>
      </div>

      <ol className="cm-pasos" aria-label="Progreso">
        {["Contenido", "Imagen / vídeo", "Publicar"].map((t, i) => (
          <li key={t} className={paso === i + 1 ? "cm-paso-activo" : paso > i + 1 ? "cm-paso-hecho" : undefined}>
            <span>{i + 1}</span> {t}
          </li>
        ))}
      </ol>

      {error && <p role="alert" className="field-error">{error}</p>}
      {aviso && <p role="status" className="crm-aviso">{aviso}</p>}

      {/* ───── PASO 1 ───── */}
      {paso === 1 && (
        <div className="cm-rejilla">
          {modo === "imagen" && (
            <div className="cm-col-media">
              <input
                ref={entradaArchivo}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => e.target.files?.[0] && subirImagen(e.target.files[0])}
              />
              {imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagenUrl} alt="Imagen subida" className="cm-preview" />
              ) : (
                <button type="button" className="cm-subir" onClick={() => entradaArchivo.current?.click()} disabled={subiendo}>
                  {subiendo ? <Loader2 className="dsh-girando" size={26} aria-hidden="true" /> : <Upload size={26} aria-hidden="true" />}
                  <strong>{subiendo ? "Subiendo…" : "Subir imagen"}</strong>
                  <small>PNG, JPG o WEBP · máx. 8 MB · se ajusta a 9:16</small>
                </button>
              )}
              {imagenUrl && (
                <button type="button" className="crm-btn" onClick={() => entradaArchivo.current?.click()} disabled={subiendo}>
                  Cambiar imagen
                </button>
              )}
            </div>
          )}

          <div className="cm-col-texto">
            {modo === "imagen" ? (
              <div className="field">
                <label htmlFor="cm-instr">Instrucciones para la IA (opcional)</label>
                <input
                  id="cm-instr"
                  value={instrucciones}
                  onChange={(e) => setInstrucciones(e.target.value)}
                  placeholder="Ej: promoción del 20% esta semana, tono divertido"
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="cm-tema">¿De qué trata? (para que la IA escriba)</label>
                <input
                  id="cm-tema"
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  placeholder="Ej: auditoría web gratis para comercios de Leganés"
                />
              </div>
            )}

            <button
              type="button"
              className="crm-btn cm-btn-ia"
              onClick={escribirConIA}
              disabled={escribiendo || (modo === "imagen" ? !imagenUrl : tema.trim().length < 3)}
            >
              {escribiendo ? <Loader2 className="dsh-girando" size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
              {escribiendo ? "Escribiendo…" : modo === "imagen" ? "Escribir texto desde la imagen" : "Escribir texto con IA"}
            </button>

            <div className="field">
              <label htmlFor="cm-titulo">Título</label>
              <input id="cm-titulo" value={contenido.titulo} onChange={(e) => setContenido({ ...contenido, titulo: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="cm-texto">Texto de la publicación</label>
              <textarea id="cm-texto" rows={7} value={contenido.texto} onChange={(e) => setContenido({ ...contenido, texto: e.target.value })} />
              <small className="text-muted">{contenido.texto.length} caracteres</small>
            </div>
            <div className="field">
              <label htmlFor="cm-hash">Hashtags</label>
              <input
                id="cm-hash"
                value={contenido.hashtags}
                onChange={(e) => setContenido({ ...contenido, hashtags: e.target.value })}
                placeholder="#diseñowebmadrid #pymes"
              />
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={guardarBorrador}
              disabled={!textoListo || guardando || (modo === "imagen" && !imagenUrl)}
            >
              {guardando ? "Guardando…" : "Guardar y continuar →"}
            </button>
          </div>
        </div>
      )}

      {/* ───── PASO 2 ───── */}
      {paso === 2 && (
        <div className="cm-rejilla">
          <div className="cm-col-media">
            {videoUrl ? (
              <video src={videoUrl} className="cm-preview" controls playsInline poster={imagenUrl || undefined} />
            ) : imagenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagenUrl} alt="" className="cm-preview" />
            ) : (
              <div className="cm-preview cm-preview-vacio">
                {mediosGenerando ? <Loader2 className="dsh-girando" size={28} aria-hidden="true" /> : <ImagePlus size={28} aria-hidden="true" />}
                <span>{mediosGenerando ? "Generando…" : "Sin imagen todavía"}</span>
              </div>
            )}
          </div>

          <div className="cm-col-texto">
            <h3 className="cm-subtitulo">¿Qué quieres generar?</h3>
            <label className="cm-opcion">
              <input
                type="checkbox"
                checked={quiereImagen || estadoImagen === "listo"}
                disabled={estadoImagen === "listo" || mediosGenerando}
                onChange={(e) => setQuiereImagen(e.target.checked)}
              />
              <ImagePlus size={18} aria-hidden="true" />
              <span>
                <strong>Imagen IA 9:16</strong>
                <small>{estadoImagen === "listo" ? "✅ Lista" : estadoImagen === "generando" ? "Generando… (~20 s)" : estadoImagen === "error" ? "❌ Falló, vuelve a intentarlo" : "1080×1920, también se usa en Google Business"}</small>
              </span>
            </label>
            <label className="cm-opcion">
              <input
                type="checkbox"
                checked={quiereVideo || estadoVideo === "listo"}
                disabled={estadoVideo === "listo" || mediosGenerando}
                onChange={(e) => setQuiereVideo(e.target.checked)}
              />
              <Clapperboard size={18} aria-hidden="true" />
              <span>
                <strong>Vídeo Reel</strong>
                <small>{estadoVideo === "listo" ? "✅ Listo — se publicará como Reel" : estadoVideo === "generando" ? "Generando… (1-2 min)" : estadoVideo === "error" ? "❌ Falló, vuelve a intentarlo" : "25-30 s, voz en español, vídeo real y música"}</small>
              </span>
            </label>

            <div className="cm-acciones">
              <button
                type="button"
                className="btn-primary"
                onClick={generarMedios}
                disabled={mediosGenerando || ((!quiereImagen || estadoImagen === "listo") && (!quiereVideo || estadoVideo === "listo"))}
              >
                {mediosGenerando ? "Generando…" : "Generar"}
              </button>
              <button type="button" className="crm-btn" onClick={() => setPaso(3)} disabled={mediosGenerando}>
                {tieneMedio ? "Continuar →" : "Continuar sin imagen →"}
              </button>
            </div>
            {!tieneMedio && <small className="text-muted">Instagram necesita imagen o vídeo; sin ellos solo se publicará en Facebook y Google.</small>}
          </div>
        </div>
      )}

      {/* ───── PASO 3 ───── */}
      {paso === 3 && (
        <div className="cm-final">
          <fieldset className="cm-redes">
            <legend>Publicar en</legend>
            {redesDisponibles.length === 0 ? (
              <p className="text-muted">
                No hay redes conectadas. <a href={`/configuracion?empresa=${empresaId}`}>Conéctalas en Configuración</a>.
              </p>
            ) : (
              redesDisponibles.map((r) => (
                <label key={r} className="cm-red">
                  <input
                    type="checkbox"
                    checked={redes.has(r)}
                    onChange={() =>
                      setRedes((prev) => {
                        const n = new Set(prev);
                        if (n.has(r)) n.delete(r);
                        else n.add(r);
                        return n;
                      })
                    }
                  />
                  {REDES_ETIQUETA[r] || r}
                </label>
              ))
            )}
          </fieldset>

          <div className="cm-publicar">
            <button type="button" className="btn-primary" onClick={() => finalizar("ahora")} disabled={publicando || !!aviso}>
              <Send size={16} aria-hidden="true" /> {publicando ? "Publicando…" : "Publicar ahora"}
            </button>
            <span className="text-muted">o</span>
            <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha y hora de publicación" />
            <button type="button" className="crm-btn" onClick={() => finalizar("programar")} disabled={publicando || !fecha || !!aviso}>
              <CalendarClock size={16} aria-hidden="true" /> Programar
            </button>
          </div>

          <div className="cm-acciones">
            <a className="crm-btn" href={`/biblioteca?empresa=${empresaId}${publicacionId ? `#pub-${publicacionId}` : ""}`}>
              Ver en la Biblioteca
            </a>
            <button type="button" className="crm-btn" onClick={() => reiniciar()}>
              Crear otra publicación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
