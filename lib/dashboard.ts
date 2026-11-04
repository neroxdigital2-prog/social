// Agrega en el servidor todos los datos del Dashboard a partir de los bridges
// que ya existen. Cada bloque falla de forma aislada: si un bridge no responde,
// ese bloque sale vacío y el resto se pinta.

import { diagnosticarError, type Diagnostico } from "@/lib/diagnosticoRedes";
import type { MapaResueltas } from "@/lib/alertasResueltas";

export type RedSocial = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "TIKTOK" | "GOOGLE" | "TWITTER";

interface PublicacionRedRaw {
  red: RedSocial;
  publicadoEn: string | null;
  error: string | null;
  createdAt?: string | null;
}

interface PublicacionRaw {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  imagenUrl: string | null;
  fechaProgramada: string | null;
  createdAt: string;
  redes?: PublicacionRedRaw[];
}

interface LeadRaw {
  id: string;
  nombre: string;
  estado: string;
  origen?: string;
  valorEstimado?: number | string | null;
  createdAt: string;
}

interface RedConectadaRaw {
  red: RedSocial;
  cuentaSecundaria?: string | null;
}

interface SnapshotRaw {
  fecha: string;
  seguidores: number;
}

export interface Kpi {
  etiqueta: string;
  valor: string;
  detalle: string;
  tendencia?: "sube" | "baja" | "igual";
  href: string;
}

export interface PuntoActividad {
  dia: string; // "27/10"
  publicadas: number;
  leads: number;
}

export interface ProximaPublicacion {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string;
  imagenUrl: string | null;
  redes: RedSocial[];
}

export interface PublicacionAfectada {
  id: string;
  titulo: string;
  fecha: string; // MySQL "YYYY-MM-DD HH:MM:SS" (Madrid)
  mensaje: string;
}

export interface Incidencia {
  red: RedSocial;
  nombreRed: string;
  mensaje: string; // error original de la red
  fecha: string;
  afectadas: PublicacionAfectada[]; // fallos seguidos desde el último éxito (máx. 5)
  diagnostico: Diagnostico;
}

export interface Alerta {
  clave: string; // identifica la alerta para poder descartarla
  firma: string; // si cambia, la alerta descartada vuelve a aparecer
  nivel: "error" | "aviso";
  texto: string;
  href: string;
  incidencia?: Incidencia;
  detalle?: string;
}

export interface EstadoRed {
  red: RedSocial;
  nombre: string;
  conectada: boolean;
  cuenta: string | null;
  estado: "ok" | "error" | "aviso" | "off";
  ultimoExito: string | null;
  incidencia: Incidencia | null;
  claveAlerta: string | null;
  firmaAlerta: string | null;
}

export interface DatosDashboard {
  empresaId: string | null;
  empresaNombre: string | null;
  kpis: Kpi[];
  actividad: PuntoActividad[];
  proximas: ProximaPublicacion[];
  alertas: Alerta[];
  alertasOcultas: number;
  redes: EstadoRed[];
}

export const NOMBRES_RED: Record<RedSocial, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  GOOGLE: "Google Business",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
  TWITTER: "X",
};

const REDES_PRINCIPALES: RedSocial[] = ["FACEBOOK", "INSTAGRAM", "GOOGLE"];
const DIAS_ACTIVIDAD = 30;

async function bridge<T>(url: string | undefined, body: unknown): Promise<T | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET! },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// MySQL devuelve "YYYY-MM-DD HH:MM:SS(.fff)" en hora de Madrid: el día son los 10 primeros caracteres.
const diaDe = (f: string | null | undefined) => (f ? f.slice(0, 10) : "");

function isoDia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d); // YYYY-MM-DD
}

function formatearNumero(n: number): string {
  return new Intl.NumberFormat("es-ES").format(n);
}

function tendencia(actual: number, anterior: number): Kpi["tendencia"] {
  if (actual > anterior) return "sube";
  if (actual < anterior) return "baja";
  return "igual";
}

interface Envio extends PublicacionRedRaw {
  pub: PublicacionRaw;
  momento: string; // cuándo se intentó publicar (para ordenar)
}

function momentoEnvio(r: PublicacionRedRaw, p: PublicacionRaw): string {
  // El intento ocurre en la fecha programada; si no hay, la más reciente conocida
  return [r.publicadoEn, p.fechaProgramada, r.createdAt, p.createdAt].filter(Boolean).sort().reverse()[0] || "";
}

export async function cargarDashboard(
  userId: string,
  empresaParam?: string,
  resueltas: MapaResueltas = {}
): Promise<DatosDashboard> {
  const empresas = (await bridge<{ id: string; nombre: string }[]>(process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST, { userId })) || [];
  const empresa = empresas.find((e) => e.id === empresaParam) || empresas[0];

  if (!empresa) {
    return { empresaId: null, empresaNombre: null, kpis: [], actividad: [], proximas: [], alertas: [], alertasOcultas: 0, redes: [] };
  }

  const hoy = new Date();
  const desde = new Date(hoy.getTime() - (DIAS_ACTIVIDAD - 1) * 86400000);

  const [pubsRaw, leadsRaw, redesRaw, snapRaw] = await Promise.all([
    bridge<PublicacionRaw[]>(process.env.IONOS_BRIDGE_URL_PUBLICACIONES_LIST, { userId, empresaId: empresa.id }),
    bridge<LeadRaw[]>(process.env.IONOS_BRIDGE_URL_LEADS_LIST, { userId, empresaId: empresa.id }),
    bridge<RedConectadaRaw[]>(process.env.IONOS_BRIDGE_URL_REDES_LIST, { userId, empresaId: empresa.id }),
    bridge<{ snapshots?: SnapshotRaw[] }>(process.env.IONOS_BRIDGE_URL_SNAPSHOT_LISTAR, {
      empresaId: empresa.id,
      desde: isoDia(desde),
      hasta: isoDia(hoy),
    }),
  ]);

  const publicaciones = Array.isArray(pubsRaw) ? pubsRaw : [];
  const leads = Array.isArray(leadsRaw) ? leadsRaw : [];
  const redesConectadas = Array.isArray(redesRaw) ? redesRaw : [];
  const snapshots = Array.isArray(snapRaw?.snapshots) ? snapRaw!.snapshots! : [];

  const hoyIso = isoDia(hoy);
  const mesActual = hoyIso.slice(0, 7);
  const mesAnterior = isoDia(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 15)).slice(0, 7);
  const hace7 = isoDia(new Date(hoy.getTime() - 7 * 86400000));

  // ── Envíos a redes: cada (publicación, red) con resultado ──
  const envios: Envio[] = publicaciones.flatMap((p) =>
    (p.redes || [])
      .filter((r) => r.publicadoEn || r.error)
      .map((r) => ({ ...r, pub: p, momento: momentoEnvio(r, p) }))
  );
  const enviosOk = envios.filter((e) => e.publicadoEn);
  const enviosMes = enviosOk.filter((e) => diaDe(e.publicadoEn).startsWith(mesActual)).length;
  const enviosMesAnt = enviosOk.filter((e) => diaDe(e.publicadoEn).startsWith(mesAnterior)).length;

  // ── Leads ──
  const leadsMes = leads.filter((l) => diaDe(l.createdAt).startsWith(mesActual)).length;
  const leadsMesAnt = leads.filter((l) => diaDe(l.createdAt).startsWith(mesAnterior)).length;
  const leadsAbiertos = leads.filter((l) => !["GANADO", "PERDIDO"].includes(l.estado));
  const valorPipeline = leadsAbiertos.reduce((s, l) => s + (Number(l.valorEstimado) || 0), 0);

  // ── Programadas ──
  const programadas = publicaciones
    .filter((p) => p.estado === "PROGRAMADA" && p.fechaProgramada && diaDe(p.fechaProgramada) >= hoyIso)
    .sort((a, b) => (a.fechaProgramada! < b.fechaProgramada! ? -1 : 1));
  const borradores = publicaciones.filter((p) => p.estado === "BORRADOR").length;

  // ── Seguidores Instagram ──
  const snapsOrden = [...snapshots].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const segActual = snapsOrden.at(-1)?.seguidores ?? null;
  const segInicial = snapsOrden[0]?.seguidores ?? null;
  const difSeg = segActual !== null && segInicial !== null ? segActual - segInicial : null;

  const q = `?empresa=${empresa.id}`;
  const kpis: Kpi[] = [
    {
      etiqueta: "Publicaciones este mes",
      valor: formatearNumero(enviosMes),
      detalle: `${formatearNumero(enviosMesAnt)} el mes pasado`,
      tendencia: tendencia(enviosMes, enviosMesAnt),
      href: `/biblioteca${q}`,
    },
    {
      etiqueta: "Leads nuevos este mes",
      valor: formatearNumero(leadsMes),
      detalle: `${formatearNumero(leadsAbiertos.length)} abiertos${valorPipeline ? ` · ${formatearNumero(Math.round(valorPipeline))} € en juego` : ""}`,
      tendencia: tendencia(leadsMes, leadsMesAnt),
      href: `/crm${q}`,
    },
    {
      etiqueta: "Seguidores Instagram",
      valor: segActual !== null ? formatearNumero(segActual) : "—",
      detalle:
        difSeg === null ? "Sin datos todavía" : `${difSeg >= 0 ? "+" : ""}${formatearNumero(difSeg)} en ${DIAS_ACTIVIDAD} días`,
      tendencia: difSeg === null ? undefined : difSeg > 0 ? "sube" : difSeg < 0 ? "baja" : "igual",
      href: `/crecimiento${q}`,
    },
    {
      etiqueta: "Programadas",
      valor: formatearNumero(programadas.length),
      detalle: `${formatearNumero(borradores)} borradores pendientes`,
      href: `/calendario${q}`,
    },
  ];

  // ── Actividad diaria (últimos 30 días) ──
  const porDia = new Map<string, PuntoActividad>();
  for (let i = 0; i < DIAS_ACTIVIDAD; i++) {
    const iso = isoDia(new Date(desde.getTime() + i * 86400000));
    porDia.set(iso, { dia: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, publicadas: 0, leads: 0 });
  }
  enviosOk.forEach((e) => {
    const p = porDia.get(diaDe(e.publicadoEn));
    if (p) p.publicadas++;
  });
  leads.forEach((l) => {
    const p = porDia.get(diaDe(l.createdAt));
    if (p) p.leads++;
  });

  // ── Estado de cada red según su ÚLTIMO intento ──
  // Si después de un error hubo una publicación correcta, la red vuelve sola a "Activa".
  const conectadas = new Map(redesConectadas.map((r) => [r.red, r]));
  const redesMostrar = Array.from(new Set<RedSocial>([...REDES_PRINCIPALES, ...redesConectadas.map((r) => r.red)]));

  const redes: EstadoRed[] = redesMostrar.map((red) => {
    const intentos = envios.filter((e) => e.red === red).sort((a, b) => (a.momento < b.momento ? 1 : -1));
    const ultimoExito = intentos.find((e) => e.publicadoEn)?.publicadoEn || null;
    const fallosSeguidos: Envio[] = [];
    for (const e of intentos) {
      if (e.publicadoEn) break;
      fallosSeguidos.push(e);
    }

    let incidencia: Incidencia | null = null;
    if (conectadas.has(red) && fallosSeguidos.length > 0) {
      const ultimo = fallosSeguidos[0];
      incidencia = {
        red,
        nombreRed: NOMBRES_RED[red] || red,
        mensaje: ultimo.error || "Error desconocido",
        fecha: ultimo.momento,
        afectadas: fallosSeguidos.slice(0, 5).map((e) => ({
          id: e.pub.id,
          titulo: e.pub.titulo || "Sin título",
          fecha: e.momento,
          mensaje: e.error || "",
        })),
        diagnostico: diagnosticarError(red, ultimo.error || ""),
      };
    }

    const claveAlerta = incidencia ? `${empresa.id}|red|${red}` : null;
    const firmaAlerta = incidencia ? incidencia.fecha : null;
    const resuelta = !!claveAlerta && resueltas[claveAlerta] === firmaAlerta;

    let estado: EstadoRed["estado"] = "ok";
    if (!conectadas.has(red)) estado = "off";
    else if (incidencia && !resuelta) estado = incidencia.diagnostico.ambito === "conexion" ? "error" : "aviso";

    return {
      red,
      nombre: NOMBRES_RED[red] || red,
      conectada: conectadas.has(red),
      cuenta: conectadas.get(red)?.cuentaSecundaria || null,
      estado,
      ultimoExito,
      incidencia: resuelta ? null : incidencia,
      claveAlerta,
      firmaAlerta,
    };
  });

  // ── Alertas ──
  const todas: Alerta[] = [];
  redes.forEach((r) => {
    if (r.incidencia) {
      todas.push({
        clave: r.claveAlerta!,
        firma: r.firmaAlerta!,
        nivel: r.incidencia.diagnostico.ambito === "conexion" ? "error" : "aviso",
        texto: `${r.nombre}: ${r.incidencia.diagnostico.titulo}`,
        href: `/configuracion${q}`,
        incidencia: r.incidencia,
      });
    }
  });
  redes
    .filter((r) => !r.conectada && REDES_PRINCIPALES.includes(r.red))
    .forEach((r) =>
      todas.push({
        clave: `${empresa.id}|off|${r.red}`,
        firma: "1",
        nivel: "aviso",
        texto: `${r.nombre} no está conectado`,
        href: `/configuracion${q}`,
        detalle: `Sin conexión, Nerox no puede publicar en ${r.nombre}. Ve a Configuración y pulsa «Conectar».`,
      })
    );
  if (programadas.length === 0) {
    todas.push({
      clave: `${empresa.id}|sinprog`,
      firma: hoyIso, // vuelve a avisar al día siguiente
      nivel: "aviso",
      texto: "No hay publicaciones programadas para los próximos días",
      href: `/generador${q}`,
      detalle: "Genera contenido con IA y prográmalo en el Calendario para no dejar de publicar.",
    });
  }
  const leadsSinAtender = leads.filter((l) => l.estado === "NUEVO" && diaDe(l.createdAt) < hace7).length;
  if (leadsSinAtender > 0) {
    todas.push({
      clave: `${empresa.id}|leads`,
      firma: String(leadsSinAtender), // si entran más leads sin atender, vuelve a aparecer
      nivel: "aviso",
      texto: `${leadsSinAtender} lead${leadsSinAtender > 1 ? "s" : ""} en estado NUEVO desde hace más de 7 días`,
      href: `/crm${q}`,
      detalle:
        "Son contactos que nadie ha atendido en una semana. Ábrelos en el CRM y cámbialos a «Contactado», «Calificado» o «Perdido» para limpiar el embudo.",
    });
  }

  const alertas = todas.filter((a) => resueltas[a.clave] !== a.firma);
  const prefijo = `${empresa.id}|`;
  const alertasOcultas = Object.keys(resueltas).filter((k) => k.startsWith(prefijo)).length;

  const proximas: ProximaPublicacion[] = programadas.slice(0, 5).map((p) => {
    const seleccion = (p.redes || []).filter((r) => !r.publicadoEn && !r.error).map((r) => r.red);
    return {
      id: p.id,
      titulo: p.titulo || "Sin título",
      tipo: p.tipo,
      fecha: p.fechaProgramada!,
      imagenUrl: p.imagenUrl,
      redes: seleccion.length ? seleccion : redesConectadas.map((r) => r.red),
    };
  });

  return {
    empresaId: empresa.id,
    empresaNombre: empresa.nombre,
    kpis,
    actividad: Array.from(porDia.values()),
    proximas,
    alertas,
    alertasOcultas,
    redes,
  };
}
