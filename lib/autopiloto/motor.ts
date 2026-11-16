// Motor del piloto automático: cada hora rellena los huecos de los próximos días
// (publicación principal del calendario semanal, noticia del día e historia diaria),
// genera texto + imagen/vídeo 9:16 y deja todo programado (o pendiente de aprobar).
import { urlBridge } from "@/lib/bridgeUrl";
import { generarImagen } from "@/lib/generadorImagen";
import { descargarImagen, normalizarA916, subirBufferAlBridge } from "@/lib/imagenFormato";
import { generarReel } from "@/lib/reel";
import { renderizarTarjeta } from "@/lib/reel/tarjeta";
import { escaparHtml } from "@/lib/telegram";
import { avisarYRegistrar, bridgeVigilante, esModoNoche } from "@/lib/vigilante";
import { NOMBRE_DIA, fichaApp, normalizarConfig, type AppVenta, type ConfigAutoPiloto, type DiaPlantilla } from "@/lib/autopiloto/plantilla";
import { buscarNoticias, type Noticia } from "@/lib/autopiloto/noticias";
import { similitud, type Previa } from "@/lib/autopiloto/antiRepeticion";
import { redactarHistoriaDiaria, redactarNoticia, redactarPrincipal, type PerfilAuto, type PublicacionAuto } from "@/lib/autopiloto/redactor";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "";
const MARGEN_MIN = 40; // no se preparan huecos que salen en menos de 40 min
const PRESUPUESTO_MS = 170_000; // no se empieza un trabajo nuevo pasado este tiempo (límite Vercel 300 s)

export type Hueco = "PRINCIPAL" | "NOTICIA" | "HISTORIA" | "CAMPANA" | "APP";

export interface EmpresaAuto extends PerfilAuto {
  empresaId: string;
  config: ConfigAutoPiloto;
}

export interface HuecoPendiente {
  empresaId: string;
  hueco: Hueco;
  fecha: string; // "YYYY-MM-DD" (Madrid)
  hora: string; // "HH:MM"
  iso: string; // instante exacto
  diaSemana: string; // "1".."7"
  formato: string;
}

export interface ResultadoHueco {
  hueco: Hueco;
  cuando: string;
  formato: string;
  ok: boolean;
  titulo?: string;
  publicacionId?: string;
  noticia?: string;
  error?: string;
  pendienteAprobacion?: boolean;
}

// ───────────── bridge ─────────────

export async function bridgeAuto<T>(accion: string, datos: Record<string, unknown> = {}): Promise<T | null> {
  const url = urlBridge("IONOS_BRIDGE_URL_AUTOPILOTO");
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({ accion, ...datos }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return (data && typeof data === "object" ? data : null) as T | null;
    return data as T;
  } catch {
    return null;
  }
}

// ───────────── fechas (Madrid) ─────────────

function partesMadrid(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value || "";
  const dias: Record<string, string> = { Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6", Sun: "7" };
  return { fecha: `${v("year")}-${v("month")}-${v("day")}`, diaSemana: dias[v("weekday")] || "1" };
}

/** "2026-11-17" + "10:00" en Madrid → ISO UTC exacto (respeta horario de verano). */
export function madridAIso(fecha: string, hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const guess = new Date(`${fecha}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00Z`);
  for (let i = 0; i < 2; i++) {
    const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .format(guess)
      .replace(" ", "T");
    const desfase = Date.parse(`${local}:00Z`) - guess.getTime();
    guess.setTime(Date.parse(`${fecha}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00Z`) - desfase);
  }
  return guess.toISOString();
}

const etiquetaFecha = (h: HuecoPendiente) => `${NOMBRE_DIA[h.diaSemana]} ${h.fecha.slice(8, 10)}/${h.fecha.slice(5, 7)} ${h.hora}`;

/** Huecos del calendario en los próximos días que aún no están cubiertos. */
export async function huecosPendientes(e: EmpresaAuto, ahora = new Date()): Promise<HuecoPendiente[]> {
  const c = e.config;
  const candidatos: HuecoPendiente[] = [];
  for (let d = 0; d <= c.diasAntelacion; d++) {
    const { fecha, diaSemana } = partesMadrid(new Date(ahora.getTime() + d * 86400_000));
    const dia = c.plantilla[diaSemana];
    const add = (hueco: Hueco, hora: string, formato: string) => candidatos.push({ empresaId: e.empresaId, hueco, fecha, hora, iso: madridAIso(fecha, hora), diaSemana, formato });
    if (dia && dia.formato !== "NADA") add("PRINCIPAL", c.horaPrincipal, dia.formato);
    if (c.diasNoticia.includes(Number(diaSemana))) add("NOTICIA", c.horaNoticia, "IMAGEN");
    if (c.historiasDiarias && dia?.formato !== "HISTORIAS") add("HISTORIA", c.horaHistoria, "HISTORIA");
    if (c.promoApps.activa && c.promoApps.dias.includes(Number(diaSemana))) add("APP", c.promoApps.hora, c.promoApps.formato);
    if (c.campana.activa && c.campana.ideas.length && c.campana.dias.includes(Number(diaSemana))) add("CAMPANA", c.campana.hora, c.campana.formato);
  }
  const limite = ahora.getTime() + MARGEN_MIN * 60_000;
  const futuros = candidatos.filter((h) => Date.parse(h.iso) > limite);
  if (!futuros.length) return [];
  const ocupados = (await bridgeAuto<{ slot: string; hueco: string }[]>("ocupados", { empresaId: e.empresaId, desde: futuros[0].iso, hasta: futuros[futuros.length - 1].iso })) || [];
  const set = new Set((Array.isArray(ocupados) ? ocupados : []).map((o) => `${o.slot.slice(0, 16)}|${o.hueco}`));
  return futuros.filter((h) => !set.has(`${h.fecha} ${h.hora}|${h.hueco}`)).sort((a, b) => a.iso.localeCompare(b.iso));
}

// ───────────── medios ─────────────

async function imagen916(prompt: string): Promise<string> {
  const url = await generarImagen(prompt);
  try {
    return await subirBufferAlBridge(await normalizarA916(await descargarImagen(url)));
  } catch {
    return url; // si no se puede normalizar/subir, se usa la URL original
  }
}

async function subirVideo(mp4: Buffer): Promise<string> {
  const url = urlBridge("IONOS_BRIDGE_URL_PUBLICACION_SUBIR_VIDEO");
  if (!url) throw new Error("Falta el bridge de subida de vídeo");
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "video/mp4", "X-Bridge-Secret": BRIDGE_SECRET }, body: new Uint8Array(mp4) });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) throw new Error(data?.error || "No se pudo subir el vídeo a IONOS");
  return data.url;
}

async function tarjeta(op: Parameters<typeof renderizarTarjeta>[0]): Promise<string> {
  return subirBufferAlBridge(await renderizarTarjeta(op));
}

// ───────────── generación de un hueco ─────────────

/** Identificador estable de una idea de campaña (se guarda como "noticia" usada para no repetirla). */
export function claveIdea(idea: string): string {
  return `idea:${idea.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 120)}`;
}

interface Contexto {
  historial: Previa[];
  noticiasUsadas: { url: string; titulo: string }[];
  noticias: Noticia[] | null;
  redesConectadas: string[];
}

async function cargarContexto(e: EmpresaAuto): Promise<Contexto> {
  const [hist, redes] = await Promise.all([
    bridgeAuto<{ publicaciones: { titulo: string; texto: string }[]; noticias: { noticiaUrl: string; noticiaTitulo: string }[] }>("historial", { empresaId: e.empresaId, dias: 120 }),
    bridgeAuto<string[]>("redes_empresa", { empresaId: e.empresaId }),
  ]);
  return {
    historial: (hist?.publicaciones || []).map((p) => ({ titulo: p.titulo, texto: p.texto })),
    noticiasUsadas: (hist?.noticias || []).map((n) => ({ url: n.noticiaUrl, titulo: n.noticiaTitulo })),
    noticias: null,
    redesConectadas: Array.isArray(redes) ? redes : [],
  };
}

function redesPara(e: EmpresaAuto, ctx: Contexto, formato: string): string[] {
  const base = e.config.redes.length ? ctx.redesConectadas.filter((r) => e.config.redes.includes(r)) : ctx.redesConectadas;
  if (formato === "HISTORIA") return base.filter((r) => r === "INSTAGRAM" || r === "FACEBOOK"); // historias: solo Meta
  return base;
}

function ctaCorta(dia: DiaPlantilla): string {
  if (dia.palabraClave) return `Comenta ${dia.palabraClave}`;
  return dia.cta.split(/[.!]/)[0].split(" ").slice(0, 6).join(" ");
}

async function crearPub(
  reservaId: number,
  e: EmpresaAuto,
  h: HuecoPendiente,
  pub: PublicacionAuto,
  formato: "IMAGEN" | "VIDEO" | "HISTORIA",
  redes: string[],
  extra: { imagenUrl?: string; reelPrueba?: boolean; noticia?: Noticia; fechaProgramada?: string; criterio?: Record<string, unknown> } = {}
): Promise<string> {
  const r = await bridgeAuto<{ ok?: boolean; publicacionId?: string; error?: string }>("crear", {
    reservaId,
    empresaId: e.empresaId,
    slot: h.iso,
    fechaProgramada: extra.fechaProgramada || h.iso,
    redes,
    pub: { ...pub, formato, imagenUrl: extra.imagenUrl || null, reelPrueba: !!extra.reelPrueba },
    noticia: extra.noticia ? { url: extra.noticia.url, titulo: extra.noticia.titulo, fuente: extra.noticia.fuente } : null,
    // Criterio con el que se creó (para evaluar en Resultados qué funciona)
    criterio: {
      origen: h.hueco,
      formato,
      tipo: pub.tipo,
      dia: NOMBRE_DIA[h.diaSemana],
      hora: h.hora,
      reelPrueba: !!extra.reelPrueba,
      hashtags: pub.hashtags.length,
      ...(extra.noticia && !extra.noticia.url.startsWith("idea:") ? { categoria: extra.noticia.categoriaNombre, fuente: extra.noticia.fuente } : {}),
      ...(extra.noticia?.url.startsWith("idea:") ? { idea: extra.noticia.titulo } : {}),
      ...(extra.criterio || {}),
    },
  });
  if (!r?.publicacionId) throw new Error(r?.error || "No se pudo crear la publicación en IONOS");
  return r.publicacionId;
}

async function completar(reservaId: number, publicacionId: string, aprobacion: boolean, cambios: Record<string, unknown>) {
  const r = await bridgeAuto<{ ok?: boolean; error?: string }>("completar", { reservaId, publicacionId, estado: aprobacion ? "BORRADOR" : "PROGRAMADA", ...cambios });
  if (!r?.ok) throw new Error(r?.error || "No se pudo completar la publicación");
}

async function reservar(e: EmpresaAuto, h: HuecoPendiente, hueco: string): Promise<number | null> {
  const r = await bridgeAuto<{ ok?: boolean; id?: number; duplicado?: boolean; error?: string }>("reservar", { empresaId: e.empresaId, slot: h.iso, hueco, formato: h.formato });
  if (r?.duplicado) return null;
  if (!r?.ok || !r.id) throw new Error(r?.error || "autopiloto.php no responde (¿subido y ejecutado autopiloto.sql?)");
  return r.id;
}

export async function generarHueco(e: EmpresaAuto, h: HuecoPendiente, ctx: Contexto): Promise<ResultadoHueco | null> {
  const cuando = etiquetaFecha(h);
  const reservaId = await reservar(e, h, h.hueco);
  if (reservaId === null) return null; // otro proceso ya lo está preparando
  const aprobacion = e.config.aprobacion;
  try {
    if (h.hueco === "APP") {
      const app = (await bridgeAuto<{ app: AppVenta | null }>("app_siguiente", { empresaId: e.empresaId }))?.app;
      if (!app) throw new Error("No hay apps activas en el catálogo (Generador → 🛍️ Apps en venta).");
      const promo = e.config.promoApps;
      const formato = promo.formato === "ALTERNAR" ? (app.vecesPromocionada % 2 === 0 ? "REEL" : "HISTORIAS") : promo.formato;
      const clave = app.palabraClave || "APP";
      const dia: DiaPlantilla = {
        formato,
        objetivo: "Vender una app lista para entregar",
        tema: `Promociona esta app lista para vender. Enfoque de ahorro de tiempo: el comprador se ahorra meses de desarrollo y problemas técnicos; la compra hoy y mañana sale al mercado. Empieza mostrando el resultado (la app funcionando) o el problema que resuelve. Usa SOLO estos datos, no inventes funciones ni precios:\n${fichaApp(app)}`,
        cta: `Comenta ${clave} y te enseño la demo${app.precio ? " y el precio" : ""} por privado.`,
        palabraClave: clave,
        segundos: promo.segundos || 35,
        diapositivas: formato === "HISTORIAS" ? 3 : 0,
        reelPrueba: false,
      };
      const pub = await redactarPrincipal(e, dia, ctx.historial);
      ctx.historial.unshift({ titulo: pub.titulo, texto: pub.texto });
      const capturas = app.imagenes || [];
      const criterioActual = { objetivo: dia.objetivo, palabraClave: clave, app: app.nombre, capturasReales: capturas.length > 0, segundos: dia.segundos, formatoPlan: formato };
      if (formato === "HISTORIAS") {
        const fondoIA = capturas.length ? null : await imagen916(pub.imagenPrompt).catch(() => null);
        const slides = pub.diapositivas.length ? pub.diapositivas : [{ titulo: app.nombre, texto: app.resumen || "" }];
        const redes = redesPara(e, ctx, "HISTORIA");
        let primeraId = "";
        for (let i = 0; i < slides.length; i++) {
          const ultima = i === slides.length - 1;
          const url = await tarjeta({ fondoUrl: capturas[i % Math.max(1, capturas.length)] || fondoIA, titulo: slides[i].titulo, texto: slides[i].texto, marca: e.nombre, pie: ultima ? `Responde ${clave} y te paso la demo` : undefined, numero: `${i + 1}/${slides.length}` });
          const rid = i === 0 ? reservaId : await reservar(e, h, `APP_${i + 1}`);
          if (rid === null) continue;
          const fechaProgramada = new Date(Date.parse(h.iso) + i * 2 * 60_000).toISOString();
          const id = await crearPub(rid, e, h, { ...pub, titulo: `${pub.titulo} (${i + 1}/${slides.length})` }, "HISTORIA", redes, { imagenUrl: url, fechaProgramada, criterio: criterioActual });
          await completar(rid, id, aprobacion, { imagenUrl: url, formato: "HISTORIA" });
          if (i === 0) primeraId = id;
        }
        await bridgeAuto("app_promocionada", { id: app.id });
        return { hueco: h.hueco, cuando, formato: `${slides.length} historias · ${app.nombre}`, ok: true, titulo: pub.titulo, publicacionId: primeraId, pendienteAprobacion: aprobacion };
      }
      const imagenUrl = capturas[0] || (await imagen916(pub.imagenPrompt));
      const id = await crearPub(reservaId, e, h, pub, "VIDEO", redesPara(e, ctx, "VIDEO"), { imagenUrl, criterio: criterioActual });
      const reel = await generarReel({ empresa: e.nombre, titulo: pub.titulo, texto: pub.texto, imagenPrompt: pub.imagenPrompt, imagenUrl, segundos: dia.segundos, cta: `Comenta ${clave}`, imagenesPropias: capturas });
      const videoUrl = await subirVideo(reel.mp4);
      await completar(reservaId, id, aprobacion, { videoUrl, imagenUrl, formato: "VIDEO" });
      await bridgeAuto("app_promocionada", { id: app.id });
      return { hueco: h.hueco, cuando, formato: `Reel ${Math.round(reel.segundos)} s · ${app.nombre}`, ok: true, titulo: pub.titulo, publicacionId: id, pendienteAprobacion: aprobacion };
    }

    if (h.hueco === "PRINCIPAL") {
      const diaBase = e.config.plantilla[h.diaSemana];
      // Días de apps del calendario (APP / CATALOGO): se usan las apps reales del catálogo
      let dia = diaBase;
      let capturasApp: string[] = [];
      let appPromocionada: string | null = null;
      if (["APP", "CATALOGO"].includes((diaBase.palabraClave || "").toUpperCase())) {
        const apps = (await bridgeAuto<AppVenta[]>("apps_listar", { empresaId: e.empresaId, soloActivas: true })) || [];
        if (Array.isArray(apps) && apps.length) {
          if (diaBase.palabraClave.toUpperCase() === "CATALOGO") {
            const elegidas = [...apps].sort((a, b) => (a.ultimaPromocion || "").localeCompare(b.ultimaPromocion || "")).slice(0, 3);
            dia = { ...diaBase, tema: `${diaBase.tema}\nApps reales del catálogo (usa solo estos datos):\n${elegidas.map(fichaApp).join("\n---\n")}` };
            capturasApp = elegidas.flatMap((a) => a.imagenes.slice(0, 2));
          } else {
            const app = (await bridgeAuto<{ app: AppVenta | null }>("app_siguiente", { empresaId: e.empresaId }))?.app;
            if (app) {
              dia = { ...diaBase, tema: `${diaBase.tema}\nApp concreta a mostrar (usa solo estos datos):\n${fichaApp(app)}` };
              capturasApp = app.imagenes;
              appPromocionada = app.id;
            }
          }
        }
      }
      const pub = await redactarPrincipal(e, dia, ctx.historial);
      ctx.historial.unshift({ titulo: pub.titulo, texto: pub.texto });
      const criterioActual = {
        objetivo: dia.objetivo,
        tema: dia.tema.slice(0, 200),
        cta: dia.cta,
        palabraClave: dia.palabraClave,
        segundos: dia.segundos,
        formatoPlan: dia.formato,
        capturasReales: capturasApp.length > 0,
      };

      if (dia.formato === "HISTORIAS") {
        const fondo = await imagen916(pub.imagenPrompt).catch(() => null);
        const slides = pub.diapositivas.length ? pub.diapositivas : [{ titulo: pub.titulo, texto: dia.cta }];
        const redes = redesPara(e, ctx, "HISTORIA");
        let primeraId = "";
        for (let i = 0; i < slides.length; i++) {
          const ultima = i === slides.length - 1;
          const url = await tarjeta({ fondoUrl: fondo, titulo: slides[i].titulo, texto: slides[i].texto, marca: e.nombre, pie: ultima ? dia.cta.slice(0, 60) : undefined, numero: `${i + 1}/${slides.length}` });
          const rid = i === 0 ? reservaId : await reservar(e, h, `PRINCIPAL_${i + 1}`);
          if (rid === null) continue;
          const fechaProgramada = new Date(Date.parse(h.iso) + i * 2 * 60_000).toISOString();
          const id = await crearPub(rid, e, h, { ...pub, titulo: `${pub.titulo} (${i + 1}/${slides.length})` }, "HISTORIA", redes, { imagenUrl: url, fechaProgramada, criterio: criterioActual });
          await completar(rid, id, aprobacion, { imagenUrl: url, formato: "HISTORIA" });
          if (i === 0) primeraId = id;
        }
        return { hueco: h.hueco, cuando, formato: `${slides.length} historias`, ok: true, titulo: pub.titulo, publicacionId: primeraId, pendienteAprobacion: aprobacion };
      }

      // REEL o CARRUSEL (carrusel = vídeo 9:16 diapositiva a diapositiva)
      const imagenUrl = await imagen916(pub.imagenPrompt);
      const redes = redesPara(e, ctx, "VIDEO");
      const id = await crearPub(reservaId, e, h, pub, "VIDEO", redes, { imagenUrl, reelPrueba: dia.reelPrueba, criterio: criterioActual });
      const reel = await generarReel({
        empresa: e.nombre,
        titulo: pub.titulo,
        texto: pub.texto,
        imagenPrompt: pub.imagenPrompt,
        imagenUrl,
        segundos: dia.segundos || 30,
        cta: ctaCorta(dia),
        diapositivas: dia.formato === "CARRUSEL" ? pub.diapositivas : undefined,
        imagenesPropias: capturasApp.length ? capturasApp : undefined,
      });
      const videoUrl = await subirVideo(reel.mp4);
      await completar(reservaId, id, aprobacion, { videoUrl, imagenUrl, formato: "VIDEO" });
      if (appPromocionada) await bridgeAuto("app_promocionada", { id: appPromocionada });
      return {
        hueco: h.hueco,
        cuando,
        formato: dia.formato === "CARRUSEL" ? `Carrusel en vídeo (${pub.diapositivas.length} diap.)` : `Reel ${Math.round(reel.segundos)} s${dia.reelPrueba ? " · de prueba" : ""}`,
        ok: true,
        titulo: pub.titulo,
        publicacionId: id,
        pendienteAprobacion: aprobacion,
      };
    }

    if (h.hueco === "CAMPANA") {
      const camp = e.config.campana;
      const usadas = new Set(ctx.noticiasUsadas.filter((n) => n.url.startsWith("idea:")).map((n) => n.url));
      const idea = camp.ideas.map((t) => t.trim()).find((t) => t && !usadas.has(claveIdea(t)));
      if (!idea) throw new Error(`Campaña «${camp.nombre}» terminada: todas las ideas ya se han usado. Añade más en el panel o con /idea en Telegram.`);
      const dia: DiaPlantilla = {
        formato: camp.formato === "IMAGEN" ? "IMAGEN" : "REEL",
        objetivo: `Captar clientes: ${idea}`,
        tema: camp.plantillaTema.includes("{idea}") ? camp.plantillaTema.replaceAll("{idea}", idea) : `${camp.plantillaTema} — ${idea}`,
        cta: camp.cta,
        palabraClave: camp.palabraClave,
        segundos: camp.segundos || 30,
        diapositivas: 0,
        reelPrueba: false,
      };
      const pub = await redactarPrincipal(e, dia, ctx.historial);
      ctx.historial.unshift({ titulo: pub.titulo, texto: pub.texto });
      const noticiaIdea: Noticia = { titulo: idea, url: claveIdea(idea), fuente: `Campaña: ${camp.nombre}`, fecha: null, categoria: "campana", categoriaNombre: camp.nombre };
      ctx.noticiasUsadas.push({ url: noticiaIdea.url, titulo: idea });
      const criterioActual = { objetivo: dia.objetivo, palabraClave: camp.palabraClave, campana: camp.nombre, segundos: dia.segundos, formatoPlan: dia.formato };
      const imagenUrl = await imagen916(pub.imagenPrompt);
      if (dia.formato === "IMAGEN") {
        const id = await crearPub(reservaId, e, h, pub, "IMAGEN", redesPara(e, ctx, "IMAGEN"), { imagenUrl, noticia: noticiaIdea, criterio: criterioActual });
        await completar(reservaId, id, aprobacion, { imagenUrl, formato: "IMAGEN" });
        return { hueco: h.hueco, cuando, formato: `Imagen 9:16 · ${idea}`, ok: true, titulo: pub.titulo, publicacionId: id, pendienteAprobacion: aprobacion };
      }
      const id = await crearPub(reservaId, e, h, pub, "VIDEO", redesPara(e, ctx, "VIDEO"), { imagenUrl, noticia: noticiaIdea, criterio: criterioActual });
      const reel = await generarReel({ empresa: e.nombre, titulo: pub.titulo, texto: pub.texto, imagenPrompt: pub.imagenPrompt, imagenUrl, segundos: dia.segundos, cta: ctaCorta(dia) });
      const videoUrl = await subirVideo(reel.mp4);
      await completar(reservaId, id, aprobacion, { videoUrl, imagenUrl, formato: "VIDEO" });
      return { hueco: h.hueco, cuando, formato: `Reel ${Math.round(reel.segundos)} s · ${idea}`, ok: true, titulo: pub.titulo, publicacionId: id, pendienteAprobacion: aprobacion };
    }

    if (h.hueco === "NOTICIA") {
      if (!ctx.noticias) ctx.noticias = await buscarNoticias(e.config.categorias);
      const usadas = new Set(ctx.noticiasUsadas.map((n) => n.url));
      const disponibles = ctx.noticias.filter(
        (n) => !usadas.has(n.url) && !ctx.noticiasUsadas.some((u) => u.titulo && similitud(u.titulo, n.titulo) >= 0.6) && !ctx.historial.some((p) => similitud(p.titulo, n.titulo) >= 0.6)
      );
      const { noticia, pub } = await redactarNoticia(e, disponibles, ctx.historial);
      ctx.noticiasUsadas.push({ url: noticia.url, titulo: noticia.titulo });
      ctx.historial.unshift({ titulo: pub.titulo, texto: pub.texto });
      const imagenUrl = await imagen916(pub.imagenPrompt);
      const id = await crearPub(reservaId, e, h, pub, "IMAGEN", redesPara(e, ctx, "IMAGEN"), { imagenUrl, noticia });
      await completar(reservaId, id, aprobacion, { imagenUrl, formato: "IMAGEN" });
      return { hueco: h.hueco, cuando, formato: "Imagen 9:16 (noticia)", ok: true, titulo: pub.titulo, publicacionId: id, noticia: `${noticia.titulo} — ${noticia.fuente}`, pendienteAprobacion: aprobacion };
    }

    // Historia diaria
    const semilla = Number(h.fecha.replace(/-/g, "")) % 97;
    const pub = await redactarHistoriaDiaria(e, ctx.historial, semilla);
    ctx.historial.unshift({ titulo: pub.titulo, texto: pub.texto });
    const fondo = await imagen916(pub.imagenPrompt).catch(() => null);
    const slide = pub.diapositivas[0] || { titulo: pub.titulo, texto: "Respóndeme por privado" };
    const url = await tarjeta({ fondoUrl: fondo, titulo: slide.titulo, texto: slide.texto, marca: e.nombre, pie: "Responde a esta historia" });
    const id = await crearPub(reservaId, e, h, pub, "HISTORIA", redesPara(e, ctx, "HISTORIA"), { imagenUrl: url });
    await completar(reservaId, id, aprobacion, { imagenUrl: url, formato: "HISTORIA" });
    return { hueco: h.hueco, cuando, formato: "Historia 9:16", ok: true, titulo: slide.titulo, publicacionId: id, pendienteAprobacion: aprobacion };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    await bridgeAuto("fallo", { reservaId, error: mensaje });
    return { hueco: h.hueco, cuando, formato: h.formato, ok: false, error: mensaje.slice(0, 300) };
  }
}

// ───────────── ejecución completa ─────────────

export async function empresasConPiloto(): Promise<EmpresaAuto[]> {
  const filas = (await bridgeAuto<(PerfilAuto & { empresaId: string; config: unknown })[]>("activos")) || [];
  return (Array.isArray(filas) ? filas : []).map((f) => ({ ...f, config: normalizarConfig(f.config as Partial<ConfigAutoPiloto>) }));
}

export async function ejecutarAutopiloto(base: string, opciones: { empresaId?: string; maxTrabajos?: number } = {}) {
  const inicio = Date.now();
  const empresas = (await empresasConPiloto()).filter((e) => !opciones.empresaId || e.empresaId === opciones.empresaId);
  const resultados: (ResultadoHueco & { empresa: string })[] = [];
  let pendientesTotal = 0;
  let trabajos = 0;

  for (const e of empresas) {
    const huecos = await huecosPendientes(e);
    pendientesTotal += huecos.length;
    if (!huecos.length) {
      await bridgeAuto("marcar_ejecucion", { empresaId: e.empresaId, resultado: { cuando: new Date().toISOString(), generadas: 0, pendientes: 0 } });
      continue;
    }
    const ctx = await cargarContexto(e);
    const propios: ResultadoHueco[] = [];
    for (const h of huecos) {
      if (Date.now() - inicio > PRESUPUESTO_MS || trabajos >= (opciones.maxTrabajos ?? 6)) break;
      // Un vídeo tarda 1-2 min: si no queda margen, se deja para la siguiente pasada
      if (((h.hueco === "PRINCIPAL" && h.formato !== "HISTORIAS") || ((h.hueco === "CAMPANA" || h.hueco === "APP") && h.formato !== "IMAGEN" && h.formato !== "HISTORIAS")) && Date.now() - inicio > 60_000) continue;
      trabajos++;
      const r = await generarHueco(e, h, ctx);
      if (r) propios.push(r);
    }
    resultados.push(...propios.map((r) => ({ ...r, empresa: e.nombre })));
    await bridgeAuto("marcar_ejecucion", {
      empresaId: e.empresaId,
      resultado: { cuando: new Date().toISOString(), generadas: propios.filter((r) => r.ok).length, errores: propios.filter((r) => !r.ok).length, pendientes: huecos.length - propios.length },
    });
    if (propios.length) await avisarResultados(base, e, propios);
  }

  const errores = resultados.filter((r) => !r.ok);
  const restantes = Math.max(0, pendientesTotal - resultados.filter((r) => r.ok).length);
  await bridgeVigilante("agentes_guardar", {
    agentes: [
      {
        agente: "autopiloto",
        estado: !empresas.length ? "OFF" : errores.length ? (errores.length === resultados.length ? "ERROR" : "AVISO") : "OK",
        mensaje: !empresas.length
          ? "Piloto automático desactivado"
          : `${resultados.filter((r) => r.ok).length} generada(s) ahora · ${restantes} hueco(s) pendientes${errores.length ? ` · ${errores.length} error(es)` : ""}`,
        detalle: resultados.map((r) => `${r.ok ? "✅" : "❌"} ${r.empresa} · ${r.cuando} · ${r.formato}${r.titulo ? ` · ${r.titulo}` : ""}${r.error ? ` · ${r.error}` : ""}`).slice(0, 15),
      },
    ],
  });

  return { empresas: empresas.length, resultados, pendientes: restantes, segundos: Math.round((Date.now() - inicio) / 1000) };
}

async function avisarResultados(base: string, e: EmpresaAuto, res: ResultadoHueco[]) {
  const ok = res.filter((r) => r.ok);
  const mal = res.filter((r) => !r.ok);
  const lineas = [
    `🤖 <b>Piloto automático · ${escaparHtml(e.nombre)}</b>`,
    "",
    ...ok.map((r) => `✅ ${escaparHtml(r.cuando)} · ${escaparHtml(r.formato)}\n   «${escaparHtml(r.titulo || "")}»${r.noticia ? `\n   📰 ${escaparHtml(r.noticia)}` : ""}${r.pendienteAprobacion ? "\n   ⏳ Pendiente de tu aprobación" : ""}`),
    ...mal.map((r) => `❌ ${escaparHtml(r.cuando)} · ${escaparHtml(r.formato)}: ${escaparHtml(r.error || "error")} (se reintenta en la próxima pasada)`),
  ];
  const aprobar = ok.filter((r) => r.pendienteAprobacion && r.publicacionId).slice(0, 4);
  await avisarYRegistrar(lineas.join("\n"), {
    agente: "autopiloto",
    detalle: `Piloto automático: ${ok.length} generada(s), ${mal.length} error(es)`,
    aplazar: esModoNoche() && !mal.length && !aprobar.length,
    botones: [
      ...aprobar.map((r) => [{ texto: `✅ Aprobar ${r.cuando}`, datos: `ap:${r.publicacionId}` }]),
      [{ texto: "📚 Ver en la Biblioteca", url: `${base.replace(/\/+$/, "")}/biblioteca?empresa=${e.empresaId}` }],
    ],
  });
}
