"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Pencil, Play, Plus, Trash2, Upload, X } from "lucide-react";
import type { AppVenta } from "@/lib/autopiloto/plantilla";

type Borrador = {
  id?: string;
  nombre: string;
  resumen: string;
  problema: string;
  publico: string;
  funciones: string;
  precio: string;
  entrega: string;
  demoUrl: string;
  palabraClave: string;
  imagenes: string[];
};

const VACIA: Borrador = { nombre: "", resumen: "", problema: "", publico: "", funciones: "", precio: "", entrega: "", demoUrl: "", palabraClave: "APP", imagenes: [] };

function leerBase64(f: File): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => mal(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(f);
  });
}

/** Catálogo de apps listas para vender: añadir, editar, pausar y borrar. El piloto automático las promociona en Reels e historias 9:16. */
export function AppsVenta({ empresaId }: { empresaId: string }) {
  const [apps, setApps] = useState<AppVenta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [borrar, setBorrar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/apps-venta?empresa=${empresaId}`, { cache: "no-store" }).catch(() => null);
    const d = await res?.json().catch(() => null);
    if (!res?.ok || !Array.isArray(d)) {
      setError(d?.error || "No se pudo cargar el catálogo.");
      setApps([]);
      return;
    }
    setError(null);
    setApps(d);
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function subirCapturas(files: FileList) {
    if (!form) return;
    setSubiendo(true);
    setError(null);
    const nuevas: string[] = [];
    for (const f of Array.from(files).slice(0, 10 - form.imagenes.length)) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > 8 * 1024 * 1024) continue;
      const res = await fetch("/api/publicaciones/imagen-subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: await leerBase64(f), mimeType: f.type }),
      }).catch(() => null);
      const d = await res?.json().catch(() => null);
      if (res?.ok && d?.url) nuevas.push(d.url);
    }
    setForm((fm) => (fm ? { ...fm, imagenes: [...fm.imagenes, ...nuevas] } : fm));
    setSubiendo(false);
    if (!nuevas.length) setError("No se pudo subir ninguna captura (PNG, JPG o WEBP, máx. 8 MB).");
  }

  async function guardar() {
    if (!form) return;
    setGuardando(true);
    setError(null);
    const res = await fetch("/api/apps-venta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empresaId, app: form }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setGuardando(false);
    if (!res?.ok) return setError(d?.error || "No se pudo guardar.");
    setAviso(form.id ? "App actualizada." : "App añadida: el piloto automático la incluirá en la rotación.");
    setForm(null);
    cargar();
  }

  async function cambiarEstado(a: AppVenta) {
    const estado = a.estado === "ACTIVA" ? "PAUSADA" : "ACTIVA";
    await fetch("/api/apps-venta", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empresaId, id: a.id, estado }) }).catch(() => null);
    setAviso(estado === "PAUSADA" ? `«${a.nombre}» en pausa: no se promocionará.` : `«${a.nombre}» activa de nuevo.`);
    cargar();
  }

  async function confirmarBorrar(a: AppVenta) {
    await fetch(`/api/apps-venta?empresa=${empresaId}&id=${encodeURIComponent(a.id)}`, { method: "DELETE" }).catch(() => null);
    setBorrar(null);
    setAviso(`«${a.nombre}» borrada.`);
    cargar();
  }

  const campo = (k: keyof Borrador, etiqueta: string, opciones: { area?: number; placeholder?: string } = {}) =>
    form && (
      <label className="av-campo">
        <span>{etiqueta}</span>
        {opciones.area ? (
          <textarea rows={opciones.area} value={String(form[k] ?? "")} placeholder={opciones.placeholder} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        ) : (
          <input value={String(form[k] ?? "")} placeholder={opciones.placeholder} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        )}
      </label>
    );

  return (
    <div className="av">
      <header className="av-cabecera">
        <div>
          <h3>🛍️ Apps en venta</h3>
          <p className="dsh-muted">Tus aplicaciones listas para entregar. El piloto automático las promociona por turnos en Reels e historias 9:16 (la que lleva más tiempo sin salir va primero). Las pausadas no se publican.</p>
        </div>
        {!form && (
          <button type="button" className="btn-primary av-nueva" onClick={() => setForm({ ...VACIA })}>
            <Plus size={16} aria-hidden="true" /> Añadir app
          </button>
        )}
      </header>

      {error && <p role="alert" className="field-error">{error}</p>}
      {aviso && <p role="status" className="crm-aviso">{aviso}</p>}

      {form && (
        <section className="av-form" aria-label={form.id ? "Editar app" : "Nueva app"}>
          <div className="av-rejilla">
            {campo("nombre", "Nombre de la app *", { placeholder: "Ej: ReservaFácil" })}
            {campo("resumen", "Qué es (una frase)", { placeholder: "App de reservas online con recordatorios por WhatsApp" })}
            {campo("publico", "Para quién", { placeholder: "Peluquerías, clínicas, centros de estética" })}
            {campo("palabraClave", "Palabra clave del CTA", { placeholder: "APP" })}
            {campo("precio", "Precio (opcional)", { placeholder: "Desde 990 €" })}
            {campo("entrega", "Plazo de entrega", { placeholder: "Lista en 48 horas" })}
          </div>
          {campo("problema", "Problema que resuelve", { area: 2, placeholder: "Pierden citas por no contestar el teléfono…" })}
          {campo("funciones", "Funciones (una por línea)", { area: 4, placeholder: "Reservas 24/7\nRecordatorios automáticos\nPanel de gestión" })}
          {campo("demoUrl", "Enlace de la demo (para enviarlo por privado)", { placeholder: "https://…" })}

          <div className="av-capturas">
            <span className="av-mini">Capturas reales 9:16 ({form.imagenes.length}/10) — el contenido original rinde más que el de banco de imágenes</span>
            <ul>
              {form.imagenes.map((u) => (
                <li key={u}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="Captura de la app" />
                  <button type="button" aria-label="Quitar captura" onClick={() => setForm({ ...form, imagenes: form.imagenes.filter((x) => x !== u) })}>
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {form.imagenes.length < 10 && (
                <li>
                  <button type="button" className="av-subir" onClick={() => archivo.current?.click()} disabled={subiendo}>
                    <Upload size={18} aria-hidden="true" />
                    {subiendo ? "Subiendo…" : "Subir"}
                  </button>
                </li>
              )}
            </ul>
            <input ref={archivo} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => e.target.files && subirCapturas(e.target.files)} />
          </div>

          <div className="pa-acciones">
            <button type="button" className="btn-primary" onClick={guardar} disabled={guardando || form.nombre.trim().length < 2}>
              {guardando ? "Guardando…" : form.id ? "Guardar cambios" : "Añadir al catálogo"}
            </button>
            <button type="button" className="crm-btn" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </section>
      )}

      {apps === null ? (
        <p className="dsh-muted">Cargando catálogo…</p>
      ) : apps.length === 0 && !form ? (
        <p className="dsh-muted">Todavía no hay apps. Añade la primera para que el piloto automático empiece a promocionarla.</p>
      ) : (
        <ul className="av-lista">
          {apps.map((a) => (
            <li key={a.id} className={a.estado === "PAUSADA" ? "av-pausada" : undefined}>
              {a.imagenes[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.imagenes[0]} alt="" loading="lazy" />
              ) : (
                <span className="pa-miniatura" aria-hidden="true" />
              )}
              <div className="av-info">
                <strong>{a.nombre}</strong>
                <span>{a.resumen || "—"}</span>
                <small>
                  {a.estado === "ACTIVA" ? "🟢 Activa" : "⏸️ En pausa"} · promocionada {a.vecesPromocionada} vez/veces
                  {a.ultimaPromocion ? ` · última ${a.ultimaPromocion.slice(8, 10)}/${a.ultimaPromocion.slice(5, 7)}` : ""} · {a.imagenes.length} captura(s) · CTA «{a.palabraClave || "APP"}»
                </small>
                {borrar === a.id && (
                  <span className="cc-emp-confirmar" role="alert">
                    ¿Borrar «{a.nombre}»? No se puede deshacer.
                    <button type="button" className="dsh-boton dsh-boton-mini" onClick={() => confirmarBorrar(a)}>
                      Borrar
                    </button>
                    <button type="button" className="dsh-enlace cc-emp-cancelar" onClick={() => setBorrar(null)}>
                      Cancelar
                    </button>
                  </span>
                )}
              </div>
              <div className="av-botones">
                <button
                  type="button"
                  className="crm-btn"
                  aria-label={`Editar ${a.nombre}`}
                  onClick={() =>
                    setForm({
                      id: a.id,
                      nombre: a.nombre,
                      resumen: a.resumen || "",
                      problema: a.problema || "",
                      publico: a.publico || "",
                      funciones: a.funciones || "",
                      precio: a.precio || "",
                      entrega: a.entrega || "",
                      demoUrl: a.demoUrl || "",
                      palabraClave: a.palabraClave || "APP",
                      imagenes: a.imagenes,
                    })
                  }
                >
                  <Pencil size={14} aria-hidden="true" /> Editar
                </button>
                <button type="button" className="crm-btn" onClick={() => cambiarEstado(a)} aria-label={`${a.estado === "ACTIVA" ? "Pausar" : "Activar"} ${a.nombre}`}>
                  {a.estado === "ACTIVA" ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} {a.estado === "ACTIVA" ? "Pausar" : "Activar"}
                </button>
                <button type="button" className="crm-btn av-borrar" onClick={() => setBorrar(a.id)} aria-label={`Borrar ${a.nombre}`}>
                  <Trash2 size={14} aria-hidden="true" /> Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
