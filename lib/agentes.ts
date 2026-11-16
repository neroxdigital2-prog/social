// Catálogo de agentes del Centro de control (sin dependencias de servidor:
// lo usan tanto el vigilante como la interfaz).

export type EstadoAgente = "OK" | "AVISO" | "ERROR" | "OFF";

export interface DefAgente {
  id: string;
  nombre: string;
  icono: string;
  grupo: string;
  descripcion: string; // qué hace
  frecuencia: string;
  repara: { lugar: string; ruta: string; quien: string }; // dónde se arregla y quién, si falla
}

export interface GrupoAgentes {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string;
}

export const GRUPOS_AGENTES: GrupoAgentes[] = [
  { id: "publicacion", nombre: "Publicación", icono: "📤", descripcion: "Que cada publicación salga a su hora en cada red." },
  { id: "contenido", nombre: "Creación de contenido", icono: "✨", descripcion: "Quién escribe, diseña y monta los Reels, historias e imágenes." },
  { id: "conexiones", nombre: "Conexiones e infraestructura", icono: "🔌", descripcion: "Cuentas de redes, servidor de IONOS y WhatsApp." },
  { id: "supervision", nombre: "Supervisión y avisos", icono: "🛡️", descripcion: "Quién vigila el sistema y cómo te avisa." },
];

export const AGENTES: DefAgente[] = [
  {
    id: "publicador",
    nombre: "Publicador",
    icono: "🤖",
    grupo: "publicacion",
    descripcion: "Publica a su hora lo programado en el Calendario (Reels, imágenes e historias).",
    frecuencia: "cada 15 min",
    repara: { lugar: "cron-job.org (job /api/cron/publicar) y Calendario", ruta: "/calendario", quien: "Vigilante (relanza solo) · si sigue: tú en cron-job.org" },
  },
  {
    id: "envios",
    nombre: "Envíos a redes",
    icono: "📨",
    grupo: "publicacion",
    descripcion: "Comprueba el resultado en cada red y corrige solo: reintentos, imagen que falta, Reel → imagen, límite de la red → reprograma.",
    frecuencia: "cada 15 min",
    repara: { lugar: "Biblioteca (la publicación afectada)", ruta: "/biblioteca", quien: "Vigilante (reintenta hasta 3 veces) · si no: tú" },
  },
  {
    id: "autopiloto",
    nombre: "Piloto automático",
    icono: "🗓️",
    grupo: "contenido",
    descripcion: "Prepara cada día el calendario semanal, la noticia, la historia diaria, las campañas y las apps en venta, sin repetir.",
    frecuencia: "cada hora",
    repara: { lugar: "Generador → Piloto automático", ruta: "/generador", quien: "Se reintenta cada hora · si no: tú" },
  },
  {
    id: "ia_texto",
    nombre: "IA de texto",
    icono: "🧠",
    grupo: "contenido",
    descripcion: "Escribe textos y guiones con Gemini, Groq, Cerebras y OpenRouter, rotando si uno falla.",
    frecuencia: "cada hora",
    repara: { lugar: "Configuración → APIs (claves) o Vercel", ruta: "/configuracion", quien: "Rotación automática · si fallan todas: tú" },
  },
  {
    id: "ia_imagen",
    nombre: "IA de imagen",
    icono: "🎨",
    grupo: "contenido",
    descripcion: "Crea las imágenes 9:16 con Gemini y, si falla, con Pollinations.",
    frecuencia: "cada hora",
    repara: { lugar: "Clave GEMINI_API_KEY en Vercel", ruta: "/configuracion", quien: "Respaldo automático · si fallan ambos: tú" },
  },
  {
    id: "reels",
    nombre: "Reels",
    icono: "🎬",
    grupo: "contenido",
    descripcion: "Monta los vídeos 9:16: metraje de Pexels o capturas reales, voz en español y música.",
    frecuencia: "cada hora",
    repara: { lugar: "Clave PEXELS_API_KEY en Vercel", ruta: "/configuracion", quien: "Tú" },
  },
  {
    id: "redes",
    nombre: "Conexiones",
    icono: "🌐",
    grupo: "conexiones",
    descripcion: "Vigila los tokens de Facebook, Instagram y Google Business; renueva los de Meta antes de caducar.",
    frecuencia: "cada hora",
    repara: { lugar: "Configuración → Conectar redes", ruta: "/configuracion", quien: "Renovación automática · si caduca: tú (reconectar)" },
  },
  {
    id: "ionos",
    nombre: "IONOS",
    icono: "🗄️",
    grupo: "conexiones",
    descripcion: "Comprueba los bridges PHP y la base de datos de IONOS.",
    frecuencia: "cada 15 min",
    repara: { lugar: "IONOS (Webspace /public/apps/social/ y phpMyAdmin)", ruta: "/salud", quien: "Tú" },
  },
  {
    id: "whatsapp",
    nombre: "WhatsApp",
    icono: "💬",
    grupo: "conexiones",
    descripcion: "API de WhatsApp Business y bot que responde a los clientes.",
    frecuencia: "cada hora",
    repara: { lugar: "Configuración → WhatsApp y Meta Business", ruta: "/configuracion", quien: "Tú" },
  },
  {
    id: "vigilante",
    nombre: "Vigilante",
    icono: "🛡️",
    grupo: "supervision",
    descripcion: "Revisa todo cada 15 min, corrige lo que puede y avisa del resto.",
    frecuencia: "cada 15 min",
    repara: { lugar: "cron-job.org (job /api/cron/vigilante)", ruta: "/centro-control", quien: "Tú" },
  },
  {
    id: "telegram",
    nombre: "Avisos",
    icono: "🔔",
    grupo: "supervision",
    descripcion: "Te avisa por Telegram al momento y por email si no respondes; de noche solo lo crítico.",
    frecuencia: "cada hora",
    repara: { lugar: "Centro de control → Avisos por Telegram", ruta: "/centro-control", quien: "Tú" },
  },
];

/** Dónde se arregla una avería concreta y quién se encarga. */
export function reparacionDe(clave: string, agente?: string | null): { lugar: string; ruta: string; quien: string } {
  if (clave.startsWith("token:") || clave.startsWith("caduca:")) {
    const empresa = clave.split(":")[1];
    return { lugar: "Configuración → Conectar redes", ruta: `/configuracion?empresa=${empresa}`, quien: "Tú (reconectar la cuenta)" };
  }
  if (clave.startsWith("pub:")) return { lugar: "Biblioteca → la publicación afectada", ruta: "/biblioteca", quien: "Vigilante reintenta · si no: tú" };
  if (clave === "bridges") return { lugar: "IONOS (Webspace /public/apps/social/ y phpMyAdmin)", ruta: "/salud", quien: "Tú" };
  if (clave === "cron-publicar") return { lugar: "cron-job.org (job /api/cron/publicar)", ruta: "/calendario", quien: "Tú" };
  const def = AGENTES.find((a) => a.id === (agente || clave.replace(/^agente:/, "")));
  return def?.repara || { lugar: "Centro de control", ruta: "/centro-control", quien: "Tú" };
}

export const NOMBRE_AGENTE: Record<string, string> = Object.fromEntries(AGENTES.map((a) => [a.id, a.nombre]));

export const TEXTO_ESTADO: Record<EstadoAgente, string> = {
  OK: "Operativo",
  AVISO: "Revisar",
  ERROR: "Avería",
  OFF: "No configurado",
};

export const TEXTO_VIA: Record<string, string> = {
  AUTOMATICO: "automático",
  TELEGRAM: "Telegram",
  DASHBOARD: "Dashboard",
  WHATSAPP: "WhatsApp",
  EMAIL: "email",
  SISTEMA: "sistema",
};

/** "2026-11-12 15:34:07.123" (hora de IONOS, Madrid) → "12/11/2026 15:34:07" */
export function fechaHoraBD(valor?: string | null): string {
  if (!valor) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(valor);
  if (!m) return valor;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6] || "00"}`;
}

export function duracion(segundos?: number | null): string {
  if (segundos == null || segundos < 0) return "—";
  if (segundos < 60) return `${segundos} s`;
  const min = Math.floor(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${min % 60} min`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
}

export function haceTiempo(segundos?: number | null): string {
  if (segundos == null) return "nunca";
  if (segundos < 60) return "hace unos segundos";
  return `hace ${duracion(segundos)}`;
}
