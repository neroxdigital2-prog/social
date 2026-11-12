// Vigilante automático: revisa el sistema, corrige lo que puede y avisa por
// Telegram de lo que necesita a una persona. Cada problema es una "incidencia"
// con clave estable y firma; solo se avisa cuando aparece, cambia o reaparece,
// y se manda "✅ Resuelto" cuando desaparece. Lo usan /api/cron/vigilante
// (cada 15 min) y el comando /estado del bot.

import { createHash } from "crypto";
import { urlBridge } from "@/lib/bridgeUrl";
import { revisarTodosLosBridges } from "@/lib/salud";
import { diagnosticarError } from "@/lib/diagnosticoRedes";
import { avisarOperador, escaparHtml, telegramConfigurado, type BotonTelegram } from "@/lib/telegram";

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
  estado: "ABIERTA" | "SILENCIADA" | "RESUELTA";
  titulo: string;
  datos?: unknown;
}

interface Problema {
  clave: string;
  firma: string;
  titulo: string;
  detalle: string;
  nivel: "CRITICO" | "AVISO";
  datos?: Record<string, unknown>;
  botones?: BotonTelegram[][];
}

export interface InformeVigilante {
  momento: string;
  revisado: string[];
  corregido: string[];
  problemas: { clave: string; titulo: string; avisado: boolean }[];
  resueltos: string[];
  telegram: boolean;
  error?: string;
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

const huella = (texto: string) => createHash("sha1").update(texto).digest("hex").slice(0, 16);

function enlace(base: string, ruta: string) {
  return `${base.replace(/\/+$/, "")}${ruta}`;
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

/** Reintenta envíos fallidos concretos y lanza el publicador. */
export async function reintentarEnvios(ids: string[], base: string): Promise<boolean> {
  if (!ids.length) return false;
  const r = await bridgeVigilante<{ ok?: boolean }>("reintentar", { ids });
  if (!r?.ok) return false;
  await lanzarPublicador(base);
  return true;
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
    telegram: telegramConfigurado(),
  };
  const problemas: Problema[] = [];
  const ambitosRevisados = new Set<string>(); // prefijos de clave revisados en esta pasada
  const dashboard = enlace(base, "/dashboard");

  // 1) Bridges de IONOS
  const { resumen, resultados } = await revisarTodosLosBridges();
  informe.revisado.push(`Bridges IONOS: ${resumen.total - resumen.conProblemas}/${resumen.total} OK`);
  ambitosRevisados.add("bridges");
  const rotos = resultados.filter((r) => r.estado !== "OK");
  if (rotos.length) {
    const lista = rotos
      .slice(0, 15)
      .map((r) => `• <code>${escaparHtml(r.nombre.replace("IONOS_BRIDGE_URL_", ""))}</code>: ${r.estado}${r.detalle ? ` — ${escaparHtml(r.detalle.slice(0, 80))}` : ""}`)
      .join("\n");
    const todosCaidos = rotos.length === resultados.length;
    problemas.push({
      clave: "bridges",
      firma: huella(rotos.map((r) => `${r.nombre}:${r.estado}`).sort().join("|")),
      nivel: todosCaidos || rotos.length > 5 ? "CRITICO" : "AVISO",
      titulo: todosCaidos ? "IONOS no responde (todos los bridges caídos)" : `${rotos.length} bridge(s) de IONOS con fallos`,
      detalle:
        `${lista}\n\n<b>Qué hacer:</b>\n` +
        (todosCaidos
          ? "1. Abre https://bridge.nerox.es/api/status.php\n2. Si no carga, revisa IONOS (hosting/BD caída).\n3. Comprueba BRIDGE_SECRET en Vercel."
          : "1. SIN_VARIABLE → crea la variable en Vercel y redeploy.\n2. RESPUESTA_NO_JSON / ERROR_RED → sube de nuevo el .php a IONOS y revisa errores PHP.\n3. TIMEOUT → BD lenta o caída en IONOS."),
      botones: [[{ texto: "🩺 Ver Salud", url: enlace(base, "/salud") }]],
    });
  }

  // Si el bridge del vigilante no responde no hay deduplicación: avisar como mucho 1 vez por hora.
  const abiertas = await bridgeVigilante<IncidenciaFila[]>("incidencias");
  if (!Array.isArray(abiertas)) {
    informe.error = "vigilante.php no responde (¿subido a IONOS y ejecutado vigilante.sql?)";
    if (new Date().getUTCMinutes() < 15) {
      await avisarOperador(
        `🚨 <b>El vigilante no puede leer su base de datos</b>\n\nvigilante.php no responde.\n1. Sube <code>vigilante.php</code> a /public/apps/social/\n2. Ejecuta <code>vigilante.sql</code> en phpMyAdmin.` +
          (rotos.length ? `\n\nAdemás hay ${rotos.length} bridge(s) con fallos.` : ""),
        [[{ texto: "🩺 Ver Salud", url: enlace(base, "/salud") }]]
      );
    }
    return informe;
  }

  // 2) Publicaciones atascadas → lanzar el publicador
  const atascadas = (await bridgeVigilante<Atascada[]>("atascadas")) || [];
  ambitosRevisados.add("cron-publicar");
  informe.revisado.push(`Publicaciones atrasadas: ${atascadas.length}`);
  if (atascadas.length) {
    const ok = await lanzarPublicador(base);
    if (ok) informe.corregido.push(`Lanzado el publicador para ${atascadas.length} publicación(es) atrasada(s)`);
    const muyAtrasadas = atascadas.filter((a) => Number(a.minutosRetraso) >= MIN_ALERTA_CRON);
    if (muyAtrasadas.length || !ok) {
      problemas.push({
        clave: "cron-publicar",
        firma: huella(muyAtrasadas.map((a) => a.id).sort().join("|") || "sin-lanzar"),
        nivel: "CRITICO",
        titulo: `${muyAtrasadas.length || atascadas.length} publicación(es) sin salir a su hora`,
        detalle:
          (muyAtrasadas.length ? muyAtrasadas : atascadas)
            .slice(0, 10)
            .map((a) => `• ${escaparHtml(a.empresaNombre)} — ${escaparHtml(a.titulo)} (${a.minutosRetraso} min de retraso)`)
            .join("\n") +
          `\n\n<b>Causa probable:</b> el cron de publicar no se ejecuta o falla al arrancar.\n<b>Qué hacer:</b>\n1. cron-job.org → job <code>/api/cron/publicar</code>: ¿activo y con respuesta 200?\n2. Revisa CRON_SECRET en Vercel y en cron-job.org.\n3. Vercel → Logs de <code>/api/cron/publicar</code>.`,
        botones: [[{ texto: "📅 Calendario", url: enlace(base, "/calendario") }]],
      });
    }
  }

  // 3) Envíos fallidos → reintento automático o aviso con diagnóstico
  const fallidas = (await bridgeVigilante<Fallida[]>("fallidas")) || [];
  informe.revisado.push(`Envíos con error (3 días): ${fallidas.length}`);
  const aReintentar: Fallida[] = [];
  for (const f of fallidas) {
    const reintentos = Number(f.reintentos) || 0;
    const { d, html } = bloqueDiagnostico(f.red, f.error || "");
    const limite = d.ambito === "temporal" ? MAX_REINTENTOS_TEMPORAL : d.ambito === "desconocido" ? MAX_REINTENTOS_DESCONOCIDO : 0;
    if (reintentos < limite) {
      aReintentar.push(f);
      continue;
    }
    const clave = `pub:${f.id}`;
    problemas.push({
      clave,
      firma: huella(f.error || ""),
      nivel: d.ambito === "conexion" ? "CRITICO" : "AVISO",
      titulo: tituloRed(f.empresaNombre, f.red, d.titulo),
      detalle:
        `📝 <b>${escaparHtml(f.titulo)}</b>${reintentos ? ` (ya reintentada ${reintentos} vez/veces)` : ""}\n\n${html}`,
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
      informe.corregido.push(
        ...aReintentar.map((f) => `Reintento ${Number(f.reintentos) + 1}: ${f.empresaNombre} · ${NOMBRE_RED[f.red] || f.red} · ${f.titulo}`)
      );
    }
  }

  // 4) Tokens de redes (solo en la primera pasada de cada hora: evita llamadas de más a Meta/Google)
  if (opciones.revisarTokens) {
    ambitosRevisados.add("token");
    const redes = (await bridgeVigilante<RedCredencial[]>("redes")) || [];
    const comprobaciones = await Promise.all(
      redes.map(async (r) => {
        let motivo: string | null = null;
        if (r.red === "GOOGLE") motivo = await tokenGoogleValido(r.refreshToken);
        else if ((r.red === "FACEBOOK" || r.red === "INSTAGRAM") && r.accessToken && r.cuentaExterna) motivo = await tokenMetaValido(r.cuentaExterna, r.accessToken);
        return { r, motivo };
      })
    );
    informe.revisado.push(`Conexiones de redes: ${comprobaciones.filter((c) => !c.motivo).length}/${comprobaciones.length} OK`);
    for (const { r, motivo } of comprobaciones) {
      if (!motivo) continue;
      const { html } = bloqueDiagnostico(r.red, motivo);
      const clave = `token:${r.empresaId}:${r.red}`;
      problemas.push({
        clave,
        firma: huella(motivo),
        nivel: "CRITICO",
        titulo: `${r.empresaNombre} · ${NOMBRE_RED[r.red] || r.red}: conexión caída`,
        detalle: `Las publicaciones en esta red fallarán hasta reconectarla.\n\n${html}`,
        botones: [
          [{ texto: "🔌 Reconectar", url: enlace(base, `/configuracion?empresa=${r.empresaId}`) }],
          [{ texto: "🔕 Silenciar", datos: `s:${clave}` }],
        ],
      });
    }
  }

  // 5) Registrar, avisar y resolver
  const clavesActuales = new Set(problemas.map((p) => p.clave));
  for (const p of problemas) {
    const r = await bridgeVigilante<{ avisar?: boolean }>("incidencia_abrir", {
      clave: p.clave,
      firma: p.firma,
      titulo: p.titulo,
      detalle: p.detalle.replace(/<[^>]+>/g, ""),
      nivel: p.nivel,
      datos: p.datos,
    });
    const avisar = !!r?.avisar;
    if (avisar) await avisarOperador(textoProblema(p), p.botones);
    informe.problemas.push({ clave: p.clave, titulo: p.titulo, avisado: avisar });
  }

  // Incidencias abiertas que ya no aparecen → resueltas
  const pendientesPub = abiertas.filter((i) => i.clave.startsWith("pub:") && !clavesActuales.has(i.clave));
  const estadoEnvios = pendientesPub.length
    ? (await bridgeVigilante<Record<string, { publicadoEn: string | null; error: string | null }>>("estado_envios", {
        ids: pendientesPub.map((i) => i.clave.slice(4)),
      })) || {}
    : {};

  for (const inc of abiertas) {
    if (clavesActuales.has(inc.clave)) continue;
    const prefijo = inc.clave.split(":")[0];
    let resuelta = false;
    if (prefijo === "pub") {
      const env = estadoEnvios[inc.clave.slice(4)];
      resuelta = !env || !!env.publicadoEn; // publicada, o borrada
    } else {
      resuelta = ambitosRevisados.has(prefijo);
    }
    if (!resuelta) continue;
    const r = await bridgeVigilante<{ resuelta?: boolean }>("incidencia_resolver", { clave: inc.clave });
    if (r?.resuelta) {
      informe.resueltos.push(inc.titulo);
      if (inc.estado === "ABIERTA") await avisarOperador(`✅ <b>Resuelto:</b> ${escaparHtml(inc.titulo)}`);
    }
  }

  // Resumen de correcciones automáticas (solo si hubo alguna)
  if (informe.corregido.length) {
    await avisarOperador(`🛠️ <b>Corregido automáticamente</b>\n\n${informe.corregido.map((c) => `• ${escaparHtml(c)}`).join("\n")}`);
  }

  return informe;
}

export function resumenInforme(i: InformeVigilante): string {
  const lineas = [
    `🛡️ <b>Estado de Nerox Social IA</b>`,
    "",
    ...i.revisado.map((r) => `• ${escaparHtml(r)}`),
  ];
  if (i.error) lineas.push("", `🚨 ${escaparHtml(i.error)}`);
  if (i.corregido.length) lineas.push("", "<b>Corregido ahora:</b>", ...i.corregido.map((c) => `• ${escaparHtml(c)}`));
  if (i.problemas.length) lineas.push("", "<b>Pendiente de revisar:</b>", ...i.problemas.map((p) => `• ${escaparHtml(p.titulo)}`));
  else if (!i.error) lineas.push("", "✅ Todo en orden.");
  if (i.resueltos.length) lineas.push("", "<b>Resueltos:</b>", ...i.resueltos.map((r) => `• ${escaparHtml(r)}`));
  return lineas.join("\n");
}
