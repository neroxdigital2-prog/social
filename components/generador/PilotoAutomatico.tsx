"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Newspaper, RefreshCw, Save } from "lucide-react";
import { NOMBRE_DIA, type ConfigAutoPiloto, type DiaPlantilla, type FormatoAuto } from "@/lib/autopiloto/plantilla";

interface Proxima {
  id: number;
  slot: string;
  hueco: string;
  formato: string | null;
  estado: string;
  noticiaUrl: string | null;
  noticiaTitulo: string | null;
  noticiaFuente: string | null;
  error: string | null;
  publicacionId: string | null;
  titulo: string | null;
  imagenUrl: string | null;
  videoUrl: string | null;
  estadoPublicacion: string | null;
  reelPrueba: number | string | null;
}

interface Datos {
  instalado: boolean;
  error?: string;
  activo: boolean;
  config: ConfigAutoPiloto;
  actualizadoPor: string | null;
  ultimaEjecucion: string | null;
  ultimoResultado: { generadas?: number; errores?: number; pendientes?: number } | null;
  proximas: Proxima[];
  pendientes: { hueco: string; fecha: string; hora: string; formato: string }[];
  redesConectadas: string[];
}

interface NoticiaVista {
  titulo: string;
  url: string;
  fuente: string;
  fecha: string | null;
  categoriaNombre: string;
  usada: boolean;
}

const FORMATOS: { id: FormatoAuto; texto: string }[] = [
  { id: "REEL", texto: "🎬 Reel" },
  { id: "CARRUSEL", texto: "🗂️ Carrusel (vídeo 9:16)" },
  { id: "HISTORIAS", texto: "📱 Historias" },
  { id: "NADA", texto: "— Descanso" },
];
const RED: Record<string, string> = { FACEBOOK: "Facebook", INSTAGRAM: "Instagram", GOOGLE: "Google Business", LINKEDIN: "LinkedIn", TWITTER: "X" };
const HUECO: Record<string, string> = { PRINCIPAL: "Calendario", NOTICIA: "Noticia", HISTORIA: "Historia" };
const ESTADO: Record<string, string> = { GENERANDO: "⏳ Generando", LISTA: "✅ Programada", PENDIENTE_APROBACION: "🟡 Pendiente de aprobar", ERROR: "❌ Error" };

const fechaCorta = (s: string) => `${NOMBRE_DIA[String(((new Date(s.replace(" ", "T")).getDay() + 6) % 7) + 1)]?.slice(0, 3)} ${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}`;

export function PilotoAutomatico({ empresaId }: { empresaId: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [config, setConfig] = useState<ConfigAutoPiloto | null>(null);
  const [activo, setActivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ t: string; error?: boolean } | null>(null);
  const [noticias, setNoticias] = useState<NoticiaVista[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/autopiloto?empresa=${empresaId}`, { cache: "no-store" }).catch(() => null);
    const d = (await res?.json().catch(() => null)) as Datos | null;
    if (!d) return;
    setDatos(d);
    if (d.instalado) {
      setConfig((c) => c ?? d.config);
      setActivo(d.activo);
    }
  }, [empresaId]);

  useEffect(() => {
    setConfig(null);
    cargar();
    const t = setInterval(() => document.visibilityState === "visible" && cargar(), 30_000);
    return () => clearInterval(t);
  }, [cargar]);

  function cambiarDia(dia: string, cambios: Partial<DiaPlantilla>) {
    setConfig((c) => (c ? { ...c, plantilla: { ...c.plantilla, [dia]: { ...c.plantilla[dia], ...cambios } } } : c));
  }

  async function guardar(nuevoActivo = activo) {
    if (!config) return;
    setGuardando(true);
    setMensaje(null);
    const res = await fetch("/api/autopiloto", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId, activo: nuevoActivo, config }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setGuardando(false);
    if (!res?.ok) return setMensaje({ t: d?.error || "No se pudo guardar.", error: true });
    setActivo(nuevoActivo);
    setMensaje({ t: nuevoActivo ? `Guardado. ${d?.lanzado ? "Preparando las próximas publicaciones en segundo plano (los vídeos tardan 1-2 min)…" : ""}` : "Guardado. Piloto automático en pausa." });
    cargar();
  }

  async function planificar() {
    setMensaje(null);
    const res = await fetch("/api/autopiloto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empresaId }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setMensaje({ t: d?.mensaje || d?.error || "No se pudo lanzar.", error: !res?.ok });
    setTimeout(cargar, 8000);
  }

  async function verNoticias() {
    setBuscando(true);
    const res = await fetch(`/api/autopiloto/noticias?empresa=${empresaId}`, { cache: "no-store" }).catch(() => null);
    const d = await res?.json().catch(() => []);
    setNoticias(Array.isArray(d) ? d : []);
    setBuscando(false);
  }

  async function aprobar(publicacionId: string) {
    const res = await fetch("/api/autopiloto/aprobar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empresaId, publicacionId }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setMensaje({ t: d?.mensaje || "No se pudo aprobar.", error: !d?.ok });
    cargar();
  }

  if (!datos) return <p className="dsh-muted">Cargando piloto automático…</p>;
  if (!datos.instalado) return <p className="dsh-alerta dsh-alerta-error" role="alert">{datos.error}</p>;
  if (!config) return null;

  return (
    <div className="pa">
      <section className="pa-cabecera">
        <div>
          <h3>🤖 Piloto automático</h3>
          <p className="dsh-muted">
            Publica solo cada día siguiendo tu calendario semanal, una noticia del sector y una historia diaria. Todo en 9:16, sin repetir títulos ni noticias.
          </p>
        </div>
        <button type="button" role="switch" aria-checked={activo} aria-label={activo ? "Desactivar piloto automático" : "Activar piloto automático"} className="cc-switch" onClick={() => guardar(!activo)} disabled={guardando}>
          <span aria-hidden="true" />
        </button>
      </section>

      <p className="pa-estado" role="status">
        {activo ? "🟢 Activo" : "⚪ En pausa"}
        {datos.ultimaEjecucion && ` · última pasada ${datos.ultimaEjecucion.slice(8, 10)}/${datos.ultimaEjecucion.slice(5, 7)} ${datos.ultimaEjecucion.slice(11, 16)}`}
        {datos.ultimoResultado && ` · ${datos.ultimoResultado.generadas ?? 0} generada(s)${datos.ultimoResultado.errores ? `, ${datos.ultimoResultado.errores} error(es)` : ""}`}
        {activo && datos.pendientes.length > 0 && ` · ${datos.pendientes.length} hueco(s) por preparar`}
      </p>

      {/* Horarios */}
      <fieldset className="pa-bloque">
        <legend>Horario (hora de Madrid)</legend>
        <div className="pa-horas">
          <label>
            <span>📅 Publicación del calendario</span>
            <input type="time" value={config.horaPrincipal} onChange={(e) => setConfig({ ...config, horaPrincipal: e.target.value })} />
          </label>
          <label>
            <span>📰 Noticia (imagen 9:16)</span>
            <input type="time" value={config.horaNoticia} onChange={(e) => setConfig({ ...config, horaNoticia: e.target.value })} />
          </label>
          <label>
            <span>📱 Historia diaria</span>
            <input type="time" value={config.horaHistoria} onChange={(e) => setConfig({ ...config, horaHistoria: e.target.value })} disabled={!config.historiasDiarias} />
          </label>
        </div>
        <div className="pa-checks">
          <span className="pa-mini">Noticia los días:</span>
          {["1", "2", "3", "4", "5", "6", "7"].map((d) => (
            <label key={d} className="pa-chip">
              <input
                type="checkbox"
                checked={config.diasNoticia.includes(Number(d))}
                onChange={(e) =>
                  setConfig({ ...config, diasNoticia: e.target.checked ? [...config.diasNoticia, Number(d)].sort() : config.diasNoticia.filter((x) => x !== Number(d)) })
                }
              />
              {NOMBRE_DIA[d].slice(0, 3)}
            </label>
          ))}
        </div>
        <div className="pa-checks">
          <label className="pa-chip">
            <input type="checkbox" checked={config.historiasDiarias} onChange={(e) => setConfig({ ...config, historiasDiarias: e.target.checked })} /> Historias diarias (fidelizar y cerrar ventas)
          </label>
          <label className="pa-chip">
            <input type="checkbox" checked={config.aprobacion} onChange={(e) => setConfig({ ...config, aprobacion: e.target.checked })} /> Pedir mi aprobación antes de publicar (Telegram)
          </label>
          <label className="pa-chip">
            Preparar con
            <select value={config.diasAntelacion} onChange={(e) => setConfig({ ...config, diasAntelacion: Number(e.target.value) })}>
              {[1, 2, 3, 5, 7].map((n) => (
                <option key={n} value={n}>
                  {n} día(s)
                </option>
              ))}
            </select>
            de antelación
          </label>
        </div>
        <div className="pa-checks">
          <span className="pa-mini">Redes:</span>
          {datos.redesConectadas.length === 0 && <span className="dsh-muted">ninguna conectada</span>}
          {datos.redesConectadas.map((r) => (
            <label key={r} className="pa-chip">
              <input
                type="checkbox"
                checked={!config.redes.length || config.redes.includes(r)}
                onChange={(e) => {
                  const actuales = config.redes.length ? config.redes : datos.redesConectadas;
                  setConfig({ ...config, redes: e.target.checked ? [...new Set([...actuales, r])] : actuales.filter((x) => x !== r) });
                }}
              />
              {RED[r] || r}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Calendario semanal */}
      <fieldset className="pa-bloque">
        <legend>Calendario semanal (publicación de las {config.horaPrincipal})</legend>
        <div className="pa-semana">
          {["1", "2", "3", "4", "5", "6", "7"].map((d) => {
            const dia = config.plantilla[d];
            return (
              <article key={d} className={`pa-dia${dia.formato === "NADA" ? " pa-dia-off" : ""}`}>
                <header>
                  <strong>{NOMBRE_DIA[d]}</strong>
                  <select value={dia.formato} onChange={(e) => cambiarDia(d, { formato: e.target.value as FormatoAuto })} aria-label={`Formato del ${NOMBRE_DIA[d]}`}>
                    {FORMATOS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.texto}
                      </option>
                    ))}
                  </select>
                </header>
                {dia.formato !== "NADA" && (
                  <>
                    <label>
                      <span>Objetivo</span>
                      <input value={dia.objetivo} onChange={(e) => cambiarDia(d, { objetivo: e.target.value })} />
                    </label>
                    <label>
                      <span>Tema</span>
                      <textarea rows={3} value={dia.tema} onChange={(e) => cambiarDia(d, { tema: e.target.value })} />
                    </label>
                    <label>
                      <span>Llamada a la acción</span>
                      <input value={dia.cta} onChange={(e) => cambiarDia(d, { cta: e.target.value })} />
                    </label>
                    <div className="pa-fila">
                      <label>
                        <span>Palabra clave</span>
                        <input value={dia.palabraClave} placeholder="WEB" onChange={(e) => cambiarDia(d, { palabraClave: e.target.value.toUpperCase().replace(/\s+/g, "") })} />
                      </label>
                      {dia.formato === "REEL" || dia.formato === "CARRUSEL" ? (
                        <label>
                          <span>Segundos</span>
                          <input type="number" min={18} max={55} value={dia.segundos} onChange={(e) => cambiarDia(d, { segundos: Number(e.target.value) })} />
                        </label>
                      ) : null}
                      {dia.formato === "CARRUSEL" || dia.formato === "HISTORIAS" ? (
                        <label>
                          <span>{dia.formato === "CARRUSEL" ? "Diapositivas" : "Historias"}</span>
                          <input type="number" min={dia.formato === "CARRUSEL" ? 5 : 2} max={8} value={dia.diapositivas} onChange={(e) => cambiarDia(d, { diapositivas: Number(e.target.value) })} />
                        </label>
                      ) : null}
                    </div>
                    {dia.formato === "REEL" && (
                      <label className="pa-chip">
                        <input type="checkbox" checked={dia.reelPrueba} onChange={(e) => cambiarDia(d, { reelPrueba: e.target.checked })} /> Reel de prueba (solo a no seguidores)
                      </label>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </fieldset>

      {/* Agente de noticias */}
      <fieldset className="pa-bloque">
        <legend>📰 Agente de noticias (Google News, últimos 7 días)</legend>
        <div className="pa-checks">
          {config.categorias.map((c, i) => (
            <label key={c.id} className="pa-chip">
              <input
                type="checkbox"
                checked={c.activa}
                onChange={(e) => setConfig({ ...config, categorias: config.categorias.map((x, j) => (j === i ? { ...x, activa: e.target.checked } : x)) })}
              />
              {c.nombre}
            </label>
          ))}
        </div>
        <button type="button" className="crm-btn" onClick={verNoticias} disabled={buscando}>
          <Newspaper size={15} aria-hidden="true" /> {buscando ? "Buscando…" : "Ver qué noticias encontraría hoy"}
        </button>
        {noticias && (
          <ul className="pa-noticias">
            {noticias.length === 0 && <li className="dsh-muted">No se encontraron noticias.</li>}
            {noticias.slice(0, 20).map((n) => (
              <li key={n.url} className={n.usada ? "pa-usada" : undefined}>
                <span className="pa-cat">{n.categoriaNombre}</span>
                <a href={n.url} target="_blank" rel="noopener noreferrer">
                  {n.titulo}
                </a>
                <small>
                  {n.fuente}
                  {n.fecha ? ` · ${new Date(n.fecha).toLocaleDateString("es-ES")}` : ""}
                  {n.usada ? " · ya usada" : ""}
                </small>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div className="pa-acciones">
        <button type="button" className="btn-primary" onClick={() => guardar()} disabled={guardando}>
          <Save size={16} aria-hidden="true" /> {guardando ? "Guardando…" : "Guardar configuración"}
        </button>
        <button type="button" className="crm-btn" onClick={planificar} disabled={!activo}>
          <RefreshCw size={15} aria-hidden="true" /> Preparar ahora
        </button>
      </div>
      {mensaje && <p role="status" className={mensaje.error ? "field-error" : "crm-aviso"}>{mensaje.t}</p>}

      {/* Próximas */}
      <section className="pa-bloque">
        <h4>
          <CalendarClock size={16} aria-hidden="true" /> Próximas publicaciones automáticas
        </h4>
        {datos.proximas.length === 0 && datos.pendientes.length === 0 && <p className="dsh-muted">Aún no hay nada preparado.</p>}
        <ul className="pa-proximas">
          {datos.proximas.map((p) => (
            <li key={p.id} className={p.estado === "ERROR" ? "pa-error" : undefined}>
              {p.videoUrl ? (
                <video src={p.videoUrl} muted playsInline preload="none" poster={p.imagenUrl || undefined} />
              ) : p.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagenUrl} alt="" loading="lazy" />
              ) : (
                <span className="pa-miniatura" aria-hidden="true" />
              )}
              <div>
                <strong>
                  {fechaCorta(p.slot)} · {HUECO[p.hueco.split("_")[0]] || p.hueco} · {p.formato}
                  {Number(p.reelPrueba) === 1 && " · prueba"}
                </strong>
                <span>{p.titulo || (p.estado === "GENERANDO" ? "Generando…" : "—")}</span>
                {p.noticiaTitulo && (
                  <a href={p.noticiaUrl || "#"} target="_blank" rel="noopener noreferrer" className="pa-fuente">
                    📰 {p.noticiaTitulo} — {p.noticiaFuente}
                  </a>
                )}
                {p.error && <small className="field-error">{p.error}</small>}
              </div>
              <span className="pa-estado-item">
                {ESTADO[p.estado] || p.estado}
                {p.estado === "PENDIENTE_APROBACION" && p.publicacionId && (
                  <button type="button" className="crm-btn" onClick={() => aprobar(p.publicacionId!)}>
                    <CheckCircle2 size={14} aria-hidden="true" /> Aprobar
                  </button>
                )}
              </span>
            </li>
          ))}
          {activo &&
            datos.pendientes.map((h) => (
              <li key={`${h.fecha}${h.hora}${h.hueco}`} className="pa-pendiente">
                <span className="pa-miniatura" aria-hidden="true" />
                <div>
                  <strong>
                    {h.fecha.slice(8, 10)}/{h.fecha.slice(5, 7)} {h.hora} · {HUECO[h.hueco]} · {h.formato}
                  </strong>
                  <span className="dsh-muted">Se preparará en la próxima pasada (cada hora)</span>
                </div>
                <span className="pa-estado-item">⏱️ En cola</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
