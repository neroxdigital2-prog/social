// Vigilante automático: revisa cada agente del sistema, corrige lo que puede y
// avisa por Telegram de lo que necesita a una persona. Cada problema es una
// "incidencia" con clave estable y firma; solo se avisa cuando aparece, cambia
// o reaparece. Todo queda en el historial: cada aviso (canal, destino, fecha y
// hora, si se entregó), cada reintento y quién/cuándo/cómo se resolvió.
// Lo usan /api/cron/vigilante (cada 15 min), el Centro de control y el bot.

import { createHash } from "crypto";
import { urlBridge } from "@/lib/bridgeUrl";
import { revisarTodosLosBridges } from "@/lib/salud";
import { diagnosticarError } from "@/lib/diagnosticoRedes";
import { avisarOperador, chatsOperador, escaparHtml, llamarTelegram, tokenBot, telegramConfigurado, type BotonTelegram } from "@/lib/telegram";
import { NOMBRE_AGENTE, type EstadoAgente } from "@/lib/agentes";

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "";
const GRAPH = "https://graph.facebook.com/v21.0";
const MAX_REINTENTOS_TEMPORAL = 3;
const MAX_REINTENTOS_DESCONOCIDO = 1;
const MIN_ALERTA_CRON = 90; // minutos de retraso para avisar de que el cron de publicar no corre

const NOMBRE_RED: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  GOOGLE: "Google Business",
  LINKEDIN: "LinkedIn",
  TWITTER: "X",
};

interface Fallida {
  id: string;
  publicacionId: string;
  red: string;
  error: string;
  reintentos: number | string;
  titulo: string;
  empresaId: string;
  empresaNombre: string;
}

interface Atascada {
  id: string;
  titulo: string;
  empresaNombre: string;
  minutosRetraso: number | string;
}

interface RedCredencial {
  empresaId: string;
  empresaNombre: string;
  red: string;
  accessToken: string | null;
  refreshToken: string | null;
  cuentaExterna: string | null;
}

interface IncidenciaFila {
  clave: string;
  agente?: string | null;
  estado: "ABIERTA" | "SILENCIADA" | "RESUELTA";
  titulo: string;
}

interface Problema {
  clave: string;
  agente: string;
  firma: string;
  titulo: string;
  detalle: string;
  nivel: "CRITICO" | "AVISO";
  datos?: Record<string, unknown>;
  botones?: BotonTelegram[][];
}

export interface EventoNuevo {
  clave?: string | null;
  agente?: string | null;
  tipo: "AVISO" | "REINTENTO" | "AUTOCORRECCION" | "SILENCIADA" | "RESUELTA";
  canal?: string;
  destino?: string;
  entregado?: boolean | null;
  actor?: string;
  detalle?: string;
}

export interface AgenteRevisado {
  agente: string;
  estado: EstadoAgente;
  mensaje: string;
  detalle?: string[];
  ultimaActividad?: string | null;
}

export interface InformeVigilante {
  momento: string;
  revisado: string[];
  corregido: string[];
  problemas: { clave: string; titulo: string; avisado: boolean }[];
  resueltos: string[];
  agentes: AgenteRevisado[];
  telegram: boolean;
  error?: string;
}

export interface LatidoVigilante {
  ultimaEjecucion: string | null;
  segundosDesde: number | null;
  informe: InformeVigilante | null;
  abiertas: number;
  silenciadas: number;
}

// ───────────────────────── bridge ─────────────────────────

export async function bridgeVigilante<T>(accion: string, datos: Record<string, unknown> = {}): Promise<T | null> {
  const url = urlBridge("IONOS_BRIDGE_URL_VIGILANTE");
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({ accion, ...datos }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function registrarEventos(eventos: EventoNuevo[]) {
  if (!eventos.length) return;
  await bridgeVigilante("evento_registrar", { eventos });
}

const huella = (texto: string) => createHash("sha1").update(texto).digest("hex").slice(0, 16);
const enlace = (base: string, ruta: string) => `${base.replace(/\/+$/, "")}${ruta}`;

async function conTiempo<T>(promesa: Promise<T>, ms: number, porDefecto: T): Promise<T> {
  return Promise.race([promesa, new Promise<T>((r) => setTimeout(() => r(porDefecto), ms))]);
}

// Nombre legible de cada chat de Telegram ("Alejandro · chat 5812…"), cacheado por instancia
const nombresChat = new Map<string, string>();
async function destinoTelegram(chat: string): Promise<string> {
  if (chat === "—") return "sin destino";
  if (!nombresChat.has(chat)) {
    const r = await llamarTelegram<{ first_name?: string; last_name?: string; title?: string; username?: string }>("getChat", { chat_id: chat });
    const n = r.result ? r.result.title || [r.result.first_name, r.result.last_name].filter(Boolean).join(" ") || r.result.username || "" : "";
    nombresChat.set(chat, n ? `${n} · chat ${chat}` : `chat ${chat}`);
  }
  return nombresChat.get(chat)!;
}

/**
 * Envía un aviso por Telegram y deja constancia en el historial: un evento por
 * destino con canal, destino, fecha/hora (la pone la BD) y si se entregó.
 */
export async function avisarYRegistrar(
  html: string,
  ctx: { clave?: string | null; agente?: string | null; detalle: string; botones?: BotonTelegram[][]; actor?: string }
) {
  const r = await avisarOperador(html, ctx.botones);
  const eventos: EventoNuevo[] = await Promise.all(
    r.entregas.map(async (e) => ({
      clave: ctx.clave ?? null,
      agente: ctx.agente ?? null,
      tipo: "AVISO" as const,
      canal: "TELEGRAM",
      destino: await destinoTelegram(e.chat),
      entregado: e.ok,
      actor: ctx.actor || "Vigilante",
      detalle: e.ok ? ctx.detalle : `${ctx.detalle} — NO entregado: ${e.error}`,
    }))
  );
  await registrarEventos(eventos);
  return r;
}

/** Lanza el cron de publicar (responde al instante y procesa en segundo plano). */
export async function lanzarPublicador(base: string): Promise<boolean> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  try {
    const res = await fetch(enlace(base, "/api/cron/publicar"), {
      headers: { Authorization: `Bearer ${secreto}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Reintenta envíos fallidos concretos, lo registra y lanza el publicador. */
export async function reintentarEnvios(
  ids: string[],
  base: string,
  quien: { actor: string; via: string; clave?: string | null; agente?: string } = { actor: "Vigilante", via: "AUTOMATICO" }
): Promise<boolean> {
  if (!ids.length) return false;
  const r = await bridgeVigilante<{ ok?: boolean }>("reintentar", { ids });
  if (!r?.ok) return false;
  const lanzado = await lanzarPublicador(base);
  if (quien.clave) {
    await registrarEventos([
      {
        clave: quien.clave,
        agente: quien.agente || "envios",
        tipo: "REINTENTO",
        canal: quien.via,
        actor: quien.actor,
        detalle: lanzado ? "Reintento lanzado" : "Reintento programado (el publicador no respondió, saldrá en la próxima pasada)",
      },
    ]);
  }
  return true;
}

/** Resolver / silenciar desde Telegram o el Dashboard, dejando quién y cómo. */
export async function resolverIncidencia(clave: string, actor: string, via: string, motivo: string) {
  const r = await bridgeVigilante<{ resuelta?: boolean }>("incidencia_resolver", { clave, actor, via, motivo });
  return !!r?.resuelta;
}

export async function silenciarIncidencia(clave: string, actor: string, via: string) {
  const r = await bridgeVigilante<{ ok?: boolean }>("incidencia_silenciar", { clave, actor, via });
  return !!r?.ok;
}

// ───────────────────────── comprobaciones ─────────────────────────

async function tokenMetaValido(cuenta: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${cuenta}?fields=id&access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) return data?.error?.message || `HTTP ${res.status}`;
    return null;
  } catch {
    return null; // fallo de red ≠ token roto
  }
}

async function tokenGoogleValido(refreshToken: string | null): Promise<string | null> {
  if (!refreshToken) return "Falta el refresh_token de Google.";
  const id = process.env.GOOGLE_GBP_CLIENT_ID;
  const secreto = process.env.GOOGLE_GBP_CLIENT_SECRET;
  if (!id || !secreto) return "Faltan GOOGLE_GBP_CLIENT_ID / GOOGLE_GBP_CLIENT_SECRET en Vercel.";
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: id, client_secret: secreto, grant_type: "refresh_token" }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (data?.access_token) return null;
    return data?.error_description || data?.error || `HTTP ${res.status}`;
  } catch {
    return null;
  }
}

/** Petición ligera (sin consumir cuota de generación) para saber si una API responde con esa clave. */
async function sonda(url: string, init: RequestInit = {}): Promise<string | null> {
  try {
    const res = await conTiempo(fetch(url, { ...init, cache: "no-store" }), 8000, null as Response | null);
    if (!res) return "sin respuesta en 8 s";
    if (res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const msg = data?.error?.message || data?.error || data?.message || "";
    return `HTTP ${res.status}${msg ? ` · ${String(msg).slice(0, 120)}` : ""}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function revisarIATexto(): Promise<AgenteRevisado> {
  const proveedores: [string, string | undefined, () => Promise<string | null>][] = [
    ["Gemini", process.env.GEMINI_API_KEY, () => sonda(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${process.env.GEMINI_API_KEY}`)],
    ["Groq", process.env.GROQ_API_KEY, () => sonda("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } })],
    ["Cerebras", process.env.CEREBRAS_API_KEY, () => sonda("https://api.cerebras.ai/v1/models", { headers: { Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}` } })],
    ["OpenRouter", process.env.OPENROUTER_API_KEY, () => sonda("https://openrouter.ai/api/v1/auth/key", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } })],
  ];
  const configurados = proveedores.filter(([, clave]) => !!clave);
  if (!configurados.length) {
    return { agente: "ia_texto", estado: "AVISO", mensaje: "Sin claves globales en Vercel (solo funcionan las claves de cada empresa)" };
  }
  const res = await Promise.all(configurados.map(async ([n, , f]) => ({ n, error: await f() })));
  const ok = res.filter((r) => !r.error);
  const detalle = res.map((r) => (r.error ? `❌ ${r.n}: ${r.error}` : `✅ ${r.n}`));
  if (!ok.length) return { agente: "ia_texto", estado: "ERROR", mensaje: "Ningún proveedor de IA responde", detalle };
  if (ok.length < res.length) return { agente: "ia_texto", estado: "AVISO", mensaje: `${ok.length}/${res.length} proveedores operativos (rotación activa)`, detalle };
  return { agente: "ia_texto", estado: "OK", mensaje: `${ok.length}/${res.length} proveedores operativos`, detalle };
}

async function revisarIAImagen(geminiError: string | null | undefined): Promise<AgenteRevisado> {
  const tieneGemini = !!process.env.GEMINI_API_KEY;
  if (tieneGemini && !geminiError) return { agente: "ia_imagen", estado: "OK", mensaje: "Gemini imagen operativo", detalle: ["✅ Gemini", "Respaldo: Pollinations"] };
  const pollinations = await sonda("https://image.pollinations.ai/models");
  const detalle = [tieneGemini ? `❌ Gemini: ${geminiError}` : "— Gemini: sin clave global", pollinations ? `❌ Pollinations: ${pollinations}` : "✅ Pollinations (respaldo)"];
  if (!pollinations) return { agente: "ia_imagen", estado: "AVISO", mensaje: "Usando el respaldo Pollinations", detalle };
  return { agente: "ia_imagen", estado: "ERROR", mensaje: "No hay generador de imágenes disponible", detalle };
}

async function revisarReels(geminiError: string | null | undefined): Promise<AgenteRevisado> {
  const clave = process.env.PEXELS_API_KEY;
  if (!clave) return { agente: "reels", estado: "OFF", mensaje: "Falta PEXELS_API_KEY en Vercel" };
  const pexels = await sonda("https://api.pexels.com/videos/search?query=office&per_page=1", { headers: { Authorization: clave } });
  const voz = process.env.GEMINI_API_KEY ? geminiError : "sin GEMINI_API_KEY";
  const detalle = [pexels ? `❌ Pexels: ${pexels}` : "✅ Pexels (vídeo)", voz ? `❌ Voz Gemini: ${voz}` : "✅ Voz Gemini TTS"];
  if (pexels) return { agente: "reels", estado: "ERROR", mensaje: "Pexels no responde: no se pueden generar Reels", detalle };
  if (voz) return { agente: "reels", estado: "AVISO", mensaje: "Reels sin voz en off (Gemini no disponible)", detalle };
  return { agente: "reels", estado: "OK", mensaje: "Vídeo y voz operativos", detalle };
}

async function revisarWhatsApp(ultimaActividad: string | null): Promise<AgenteRevisado> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const numero = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !numero) return { agente: "whatsapp", estado: "OFF", mensaje: "WhatsApp Business no configurado", ultimaActividad };
  const error = await sonda(`${GRAPH}/${numero}?fields=display_phone_number,quality_rating&access_token=${encodeURIComponent(token)}`);
  if (error) return { agente: "whatsapp", estado: "ERROR", mensaje: "La API de WhatsApp rechaza el token", detalle: [error], ultimaActividad };
  return { agente: "whatsapp", estado: "OK", mensaje: "API de WhatsApp operativa", ultimaActividad };
}

async function revisarTelegram(): Promise<AgenteRevisado> {
  if (!tokenBot()) return { agente: "telegram", estado: "AVISO", mensaje: "Falta TELEGRAM_BOT_TOKEN: los avisos solo se ven en el Dashboard" };
  const yo = await llamarTelegram<{ username: string }>("getMe", {});
  if (!yo.ok) return { agente: "telegram", estado: "ERROR", mensaje: "El token del bot no es válido", detalle: [yo.description || ""] };
  if (!chatsOperador().length) return { agente: "telegram", estado: "AVISO", mensaje: `@${yo.result?.username}: falta TELEGRAM_CHAT_ID` };
  const destinos = await Promise.all(chatsOperador().map(destinoTelegram));
  return { agente: "telegram", estado: "OK", mensaje: `@${yo.result?.username} → ${destinos.length} destinatario(s)`, detalle: destinos };
}

function tituloRed(empresa: string, red: string, titulo: string) {
  const nombre = NOMBRE_RED[red] || red;
  return titulo.toLowerCase().includes(nombre.toLowerCase().split(" ")[0]) ? `${empresa} · ${titulo}` : `${empresa} · ${nombre}: ${titulo}`;
}

function textoProblema(p: Problema): string {
  const icono = p.nivel === "CRITICO" ? "🚨" : "⚠️";
  return `${icono} <b>${escaparHtml(p.titulo)}</b>\n\n${p.detalle}`;
}

function bloqueDiagnostico(red: string, mensaje: string) {
  const d = diagnosticarError(red, mensaje);
  const pasos = d.pasos.map((x, i) => `${i + 1}. ${escaparHtml(x)}`).join("\n");
  return {
    d,
    html: `<b>Causa:</b> ${escaparHtml(d.causa)}\n\n<b>Qué hacer:</b>\n${pasos}\n\n<i>Mensaje original:</i> <code>${escaparHtml(mensaje.slice(0, 300))}</code>`,
  };
}

// ───────────────────────── ejecución ─────────────────────────

export async function ejecutarVigilante(base: string, opciones: { revisarTokens?: boolean } = {}): Promise<InformeVigilante> {
  const informe: InformeVigilante = {
    momento: new Date().toISOString(),
    revisado: [],
    corregido: [],
    problemas: [],
    resueltos: [],
    agentes: [],
    telegram: telegramConfigurado(),
  };
  const problemas: Problema[] = [];
  const revisados = new Set<string>(); // prefijos de clave revisados en esta pasada (para dar por resueltas las que desaparecen)
  const autocorrecciones: EventoNuevo[] = [];
  const dashboard = enlace(base, "/dashboard");
  const centro = enlace(base, "/centro-control");

  // ── 1) IONOS ──
  const { resumen, resultados } = await revisarTodosLosBridges();
  informe.revisado.push(`Bridges IONOS: ${resumen.total - resumen.conProblemas}/${resumen.total} OK`);
  revisados.add("bridges");
  const rotos = resultados.filter((r) => r.estado !== "OK");
  const todosCaidos = rotos.length > 0 && rotos.length === resultados.length;
  informe.agentes.push({
    agente: "ionos",
    estado: !rotos.length ? "OK" : todosCaidos || rotos.length > 5 ? "ERROR" : "AVISO",
    mensaje: !rotos.length ? `${resumen.total}/${resumen.total} bridges OK` : todosCaidos ? "IONOS no responde" : `${rotos.length} bridge(s) con fallos`,
    detalle: rotos.slice(0, 20).map((r) => `${r.nombre.replace("IONOS_BRIDGE_URL_", "")}: ${r.estado}${r.detalle ? ` — ${r.detalle.slice(0, 80)}` : ""}`),
  });
  if (rotos.length) {
    const lista = rotos
      .slice(0, 15)
      .map((r) => `• <code>${escaparHtml(r.nombre.replace("IONOS_BRIDGE_URL_", ""))}</code>: ${r.estado}${r.detalle ? ` — ${escaparHtml(r.detalle.slice(0, 80))}` : ""}`)
      .join("\n");
    problemas.push({
      clave: "bridges",
      agente: "ionos",
      firma: huella(rotos.map((r) => `${r.nombre}:${r.estado}`).sort().join("|")),
      nivel: todosCaidos || rotos.length > 5 ? "CRITICO" : "AVISO",
      titulo: todosCaidos ? "IONOS no responde (todos los bridges caídos)" : `${rotos.length} bridge(s) de IONOS con fallos`,
      detalle:
        `${lista}\n\n<b>Qué hacer:</b>\n` +
        (todosCaidos
          ? "1. Abre https://bridge.nerox.es/api/status.php\n2. Si no carga, revisa IONOS (hosting/BD caída).\n3. Comprueba BRIDGE_SECRET en Vercel."
          : "1. SIN_VARIABLE → crea la variable en Vercel y redeploy.\n2. RESPUESTA_NO_JSON / ERROR_RED → sube de nuevo el .php a IONOS y revisa errores PHP.\n3. TIMEOUT → BD lenta o caída en IONOS."),
      botones: [[{ texto: "🧭 Centro de control", url: centro }]],
    });
  }

  // Sin el bridge del vigilante no hay historial ni deduplicación: avisar como mucho 1 vez por hora.
  const abiertas = await bridgeVigilante<IncidenciaFila[]>("incidencias");
  if (!Array.isArray(abiertas)) {
    informe.error = "vigilante.php no responde (¿subido a IONOS y ejecutado vigilante.sql?)";
    if (new Date().getUTCMinutes() < 15) {
      await avisarOperador(
        `🚨 <b>El vigilante no puede leer su base de datos</b>\n\nvigilante.php no responde.\n1. Sube <code>vigilante.php</code> a /public/apps/social/\n2. Ejecuta <code>vigilante.sql</code> en phpMyAdmin.` +
          (rotos.length ? `\n\nAdemás hay ${rotos.length} bridge(s) con fallos.` : "")
      );
    }
    return informe;
  }

  const actividad = (await bridgeVigilante<{ publicador: string | null; whatsapp: string | null }>("ultima_actividad")) || { publicador: null, whatsapp: null };

  // ── 2) Publicador: publicaciones atrasadas → lanzarlo ──
  const atascadas = (await bridgeVigilante<Atascada[]>("atascadas")) || [];
  revisados.add("cron-publicar");
  informe.revisado.push(`Publicaciones atrasadas: ${atascadas.length}`);
  let estadoPublicador: EstadoAgente = "OK";
  let mensajePublicador = "Al día";
  if (atascadas.length) {
    const ok = await lanzarPublicador(base);
    if (ok) {
      const texto = `Lanzado el publicador para ${atascadas.length} publicación(es) atrasada(s)`;
      informe.corregido.push(texto);
      autocorrecciones.push({ agente: "publicador", tipo: "AUTOCORRECCION", canal: "AUTOMATICO", actor: "Vigilante", detalle: `${texto}: ${atascadas.slice(0, 5).map((a) => a.titulo).join(" · ")}` });
    }
    const muyAtrasadas = atascadas.filter((a) => Number(a.minutosRetraso) >= MIN_ALERTA_CRON);
    estadoPublicador = muyAtrasadas.length || !ok ? "ERROR" : "AVISO";
    mensajePublicador = muyAtrasadas.length ? `${muyAtrasadas.length} sin salir (+${MIN_ALERTA_CRON} min)` : `${atascadas.length} atrasada(s), relanzado`;
    if (muyAtrasadas.length || !ok) {
      problemas.push({
        clave: "cron-publicar",
        agente: "publicador",
        firma: huella(muyAtrasadas.map((a) => a.id).sort().join("|") || "sin-lanzar"),
        nivel: "CRITICO",
        titulo: `${muyAtrasadas.length || atascadas.length} publicación(es) sin salir a su hora`,
        detalle:
          (muyAtrasadas.length ? muyAtrasadas : atascadas)
            .slice(0, 10)
            .map((a) => `• ${escaparHtml(a.empresaNombre)} — ${escaparHtml(a.titulo)} (${a.minutosRetraso} min de retraso)`)
            .join("\n") +
          `\n\n<b>Causa probable:</b> el cron de publicar no se ejecuta o falla al arrancar.\n<b>Qué hacer:</b>\n1. cron-job.org → job <code>/api/cron/publicar</code>: ¿activo y con respuesta 200?\n2. Revisa CRON_SECRET en Vercel y en cron-job.org.\n3. Vercel → Logs de <code>/api/cron/publicar</code>.`,
        botones: [[{ texto: "📅 Calendario", url: enlace(base, "/calendario") }, { texto: "🧭 Centro de control", url: centro }]],
      });
    }
  }
  informe.agentes.push({ agente: "publicador", estado: estadoPublicador, mensaje: mensajePublicador, ultimaActividad: actividad.publicador });

  // ── 3) Envíos fallidos → reintento automático o aviso con diagnóstico ──
  const fallidas = (await bridgeVigilante<Fallida[]>("fallidas")) || [];
  informe.revisado.push(`Envíos con error (3 días): ${fallidas.length}`);
  const aReintentar: Fallida[] = [];
  let enviosConexion = 0;
  let enviosOtros = 0;
  for (const f of fallidas) {
    const reintentos = Number(f.reintentos) || 0;
    const { d, html } = bloqueDiagnostico(f.red, f.error || "");
    const limite = d.ambito === "temporal" ? MAX_REINTENTOS_TEMPORAL : d.ambito === "desconocido" ? MAX_REINTENTOS_DESCONOCIDO : 0;
    if (reintentos < limite) {
      aReintentar.push(f);
      continue;
    }
    if (d.ambito === "conexion") enviosConexion++;
    else enviosOtros++;
    const clave = `pub:${f.id}`;
    problemas.push({
      clave,
      agente: "envios",
      firma: huella(f.error || ""),
      nivel: d.ambito === "conexion" ? "CRITICO" : "AVISO",
      titulo: tituloRed(f.empresaNombre, f.red, d.titulo),
      detalle: `📝 <b>${escaparHtml(f.titulo)}</b>${reintentos ? ` (ya reintentada ${reintentos} vez/veces)` : ""}\n\n${html}`,
      datos: { ids: [f.id], publicacionId: f.publicacionId, empresaId: f.empresaId },
      botones: [
        [
          { texto: "🔁 Reintentar", datos: `r:${clave}` },
          { texto: "✅ Resuelto", datos: `ok:${clave}` },
          { texto: "🔕 Silenciar", datos: `s:${clave}` },
        ],
        [{ texto: "Abrir en el Dashboard", url: `${dashboard}?empresa=${f.empresaId}` }],
      ],
    });
  }
  if (aReintentar.length) {
    const ok = await reintentarEnvios(aReintentar.map((f) => f.id), base);
    if (ok) {
      for (const f of aReintentar) {
        const texto = `Reintento ${Number(f.reintentos) + 1}: ${f.empresaNombre} · ${NOMBRE_RED[f.red] || f.red} · ${f.titulo}`;
        informe.corregido.push(texto);
        autocorrecciones.push({ clave: `pub:${f.id}`, agente: "envios", tipo: "REINTENTO", canal: "AUTOMATICO", actor: "Vigilante", detalle: `${texto} — error: ${(f.error || "").slice(0, 200)}` });
      }
    }
  }
  informe.agentes.push({
    agente: "envios",
    estado: enviosConexion ? "ERROR" : enviosOtros ? "AVISO" : "OK",
    mensaje:
      enviosConexion + enviosOtros
        ? `${enviosConexion + enviosOtros} envío(s) con error${aReintentar.length ? ` · ${aReintentar.length} reintentado(s)` : ""}`
        : aReintentar.length
          ? `${aReintentar.length} reintentado(s) automáticamente`
          : "Sin errores en 3 días",
  });

  // ── 4) Revisión horaria: conexiones, IA, Reels, WhatsApp, Telegram ──
  if (opciones.revisarTokens) {
    revisados.add("token");
    const redes = (await bridgeVigilante<RedCredencial[]>("redes")) || [];
    const comprobaciones = await Promise.all(
      redes.map(async (r) => {
        let motivo: string | null = null;
        if (r.red === "GOOGLE") motivo = await tokenGoogleValido(r.refreshToken);
        else if ((r.red === "FACEBOOK" || r.red === "INSTAGRAM") && r.accessToken && r.cuentaExterna) motivo = await tokenMetaValido(r.cuentaExterna, r.accessToken);
        return { r, motivo };
      })
    );
    const caidas = comprobaciones.filter((c) => c.motivo);
    informe.revisado.push(`Conexiones de redes: ${comprobaciones.length - caidas.length}/${comprobaciones.length} OK`);
    informe.agentes.push({
      agente: "redes",
      estado: !comprobaciones.length ? "OFF" : caidas.length ? "ERROR" : "OK",
      mensaje: !comprobaciones.length ? "Ninguna red conectada" : caidas.length ? `${caidas.length} conexión(es) caída(s)` : `${comprobaciones.length}/${comprobaciones.length} conexiones OK`,
      detalle: comprobaciones.map((c) => `${c.motivo ? "❌" : "✅"} ${c.r.empresaNombre} · ${NOMBRE_RED[c.r.red] || c.r.red}${c.motivo ? `: ${c.motivo.slice(0, 100)}` : ""}`),
    });
    for (const { r, motivo } of caidas) {
      const { html } = bloqueDiagnostico(r.red, motivo!);
      const clave = `token:${r.empresaId}:${r.red}`;
      problemas.push({
        clave,
        agente: "redes",
        firma: huella(motivo!),
        nivel: "CRITICO",
        titulo: `${r.empresaNombre} · ${NOMBRE_RED[r.red] || r.red}: conexión caída`,
        detalle: `Las publicaciones en esta red fallarán hasta reconectarla.\n\n${html}`,
        botones: [
          [{ texto: "🔌 Reconectar", url: enlace(base, `/configuracion?empresa=${r.empresaId}`) }],
          [{ texto: "✅ Resuelto", datos: `ok:${clave}` }, { texto: "🔕 Silenciar", datos: `s:${clave}` }],
        ],
      });
    }

    const iaTexto = await revisarIATexto();
    const geminiError = iaTexto.detalle?.find((d) => d.includes("Gemini"))?.startsWith("❌") ? iaTexto.detalle.find((d) => d.includes("Gemini"))!.replace("❌ Gemini: ", "") : null;
    const extra = await Promise.all([revisarIAImagen(geminiError), revisarReels(geminiError), revisarWhatsApp(actividad.whatsapp), revisarTelegram()]);
    for (const a of [iaTexto, ...extra]) {
      informe.agentes.push(a);
      revisados.add(`agente:${a.agente}`);
      if (a.estado === "ERROR") {
        const clave = `agente:${a.agente}`;
        problemas.push({
          clave,
          agente: a.agente,
          firma: huella(a.mensaje + (a.detalle || []).join("|")),
          nivel: "CRITICO",
          titulo: a.mensaje,
          detalle: (a.detalle || []).map((d) => `• ${escaparHtml(d)}`).join("\n") || escaparHtml(a.mensaje),
          botones: [[{ texto: "🧭 Centro de control", url: centro }], [{ texto: "✅ Resuelto", datos: `ok:${clave}` }, { texto: "🔕 Silenciar", datos: `s:${clave}` }]],
        });
      }
    }
  }

  // ── 5) Registrar incidencias, avisar y dejar constancia ──
  const clavesActuales = new Set(problemas.map((p) => p.clave));
  for (const p of problemas) {
    const r = await bridgeVigilante<{ avisar?: boolean; tipo?: string | null }>("incidencia_abrir", {
      clave: p.clave,
      agente: p.agente,
      firma: p.firma,
      titulo: p.titulo,
      detalle: p.detalle.replace(/<[^>]+>/g, ""),
      nivel: p.nivel,
      datos: p.datos,
    });
    const avisar = !!r?.avisar;
    if (avisar) {
      const motivo = r?.tipo === "REABIERTA" ? "Aviso: la avería ha vuelto" : r?.tipo === "CAMBIO" ? "Aviso: la avería ha cambiado" : "Aviso de nueva avería";
      await registrarEventos([{ clave: p.clave, agente: p.agente, tipo: "AVISO", canal: "DASHBOARD", destino: "Centro de control", entregado: true, actor: "Vigilante", detalle: motivo }]);
      await avisarYRegistrar(textoProblema(p), { clave: p.clave, agente: p.agente, detalle: motivo, botones: p.botones });
    }
    informe.problemas.push({ clave: p.clave, titulo: p.titulo, avisado: avisar });
  }

  // Incidencias abiertas que ya no aparecen → resueltas por el Vigilante
  const pendientesPub = abiertas.filter((i) => i.clave.startsWith("pub:") && !clavesActuales.has(i.clave));
  const estadoEnvios = pendientesPub.length
    ? (await bridgeVigilante<Record<string, { publicadoEn: string | null; error: string | null }>>("estado_envios", {
        ids: pendientesPub.map((i) => i.clave.slice(4)),
      })) || {}
    : {};

  for (const inc of abiertas) {
    if (clavesActuales.has(inc.clave)) continue;
    let motivo: string | null = null;
    if (inc.clave.startsWith("pub:")) {
      const env = estadoEnvios[inc.clave.slice(4)];
      if (!env) motivo = "El envío ya no existe (publicación borrada)";
      else if (env.publicadoEn) motivo = "Publicada correctamente";
    } else if ([...revisados].some((pref) => inc.clave === pref || inc.clave.startsWith(`${pref}:`))) {
      motivo = "Ya no se detecta el fallo en la revisión automática";
    }
    if (!motivo) continue;
    const resuelta = await resolverIncidencia(inc.clave, "Vigilante", "AUTOMATICO", motivo);
    if (resuelta) {
      informe.resueltos.push(inc.titulo);
      if (inc.estado === "ABIERTA") {
        await avisarYRegistrar(`✅ <b>Resuelto:</b> ${escaparHtml(inc.titulo)}\n<i>${escaparHtml(motivo)}</i>`, {
          clave: inc.clave,
          agente: inc.agente,
          detalle: "Aviso de resolución",
        });
      }
    }
  }

  // Correcciones automáticas: historial + un resumen por Telegram
  if (autocorrecciones.length) {
    await registrarEventos(autocorrecciones);
    await avisarYRegistrar(`🛠️ <b>Corregido automáticamente</b>\n\n${informe.corregido.map((c) => `• ${escaparHtml(c)}`).join("\n")}`, {
      agente: "vigilante",
      detalle: `Resumen de ${informe.corregido.length} corrección(es) automática(s)`,
    });
  }

  // Estado del propio vigilante + guardar luces de todos los agentes
  informe.agentes.push({
    agente: "vigilante",
    estado: informe.error ? "ERROR" : "OK",
    mensaje: `Revisión completa · ${problemas.length} incidencia(s) · ${informe.corregido.length} corrección(es)`,
  });
  await bridgeVigilante("agentes_guardar", { agentes: informe.agentes });
  await bridgeVigilante("latido_guardar", { informe });

  // Parte diario por Telegram (primera pasada desde las 09:00, hora de Madrid) para saber que sigue vivo
  const madrid = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const parte = (t: string) => madrid.find((x) => x.type === t)?.value || "";
  if (Number(parte("hour")) >= 9) {
    const diario = await bridgeVigilante<{ enviar?: boolean }>("diario_pendiente", { fecha: `${parte("year")}-${parte("month")}-${parte("day")}` });
    if (diario?.enviar) {
      await avisarYRegistrar(`☀️ <b>Buenos días.</b> El vigilante sigue activo.\n\n${resumenInforme(informe).split("\n").slice(2).join("\n")}`, {
        agente: "vigilante",
        detalle: "Parte diario",
        botones: [[{ texto: "🧭 Centro de control", url: centro }]],
      });
    }
  }

  return informe;
}

export function resumenInforme(i: InformeVigilante): string {
  const luz: Record<EstadoAgente, string> = { OK: "🟢", AVISO: "🟡", ERROR: "🔴", OFF: "⚪" };
  const lineas = [`🛡️ <b>Estado de Nerox Social IA</b>`, ""];
  if (i.agentes.length) lineas.push(...i.agentes.map((a) => `${luz[a.estado]} ${escaparHtml(NOMBRE_AGENTE[a.agente] || a.agente)}: ${escaparHtml(a.mensaje)}`));
  else lineas.push(...i.revisado.map((r) => `• ${escaparHtml(r)}`));
  if (i.error) lineas.push("", `🚨 ${escaparHtml(i.error)}`);
  if (i.corregido.length) lineas.push("", "<b>Corregido ahora:</b>", ...i.corregido.map((c) => `• ${escaparHtml(c)}`));
  if (i.problemas.length) lineas.push("", "<b>Pendiente de revisar:</b>", ...i.problemas.map((p) => `• ${escaparHtml(p.titulo)}`));
  else if (!i.error) lineas.push("", "✅ Todo en orden.");
  if (i.resueltos.length) lineas.push("", "<b>Resueltos:</b>", ...i.resueltos.map((r) => `• ${escaparHtml(r)}`));
  return lineas.join("\n");
}
