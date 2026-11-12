// Catálogo de agentes del Centro de control (sin dependencias de servidor:
// lo usan tanto el vigilante como la interfaz).

export type EstadoAgente = "OK" | "AVISO" | "ERROR" | "OFF";

export interface DefAgente {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string;
  frecuencia: string;
}

export const AGENTES: DefAgente[] = [
  { id: "publicador", nombre: "Publicador", icono: "🤖", descripcion: "Publica a su hora lo programado en el Calendario.", frecuencia: "cada 15 min" },
  { id: "envios", nombre: "Envíos a redes", icono: "📤", descripcion: "Resultado de cada publicación. Corrige solo: reintentos, imagen que falta, Reel que falla → imagen, límite de la red → reprograma.", frecuencia: "cada 15 min" },
  { id: "redes", nombre: "Conexiones", icono: "🌐", descripcion: "Tokens de Facebook, Instagram y Google Business. Renueva los de Meta antes de caducar y avisa 7 días antes si no puede.", frecuencia: "cada hora" },
  { id: "ionos", nombre: "IONOS", icono: "🔌", descripcion: "Bridges PHP y base de datos en IONOS.", frecuencia: "cada 15 min" },
  { id: "ia_texto", nombre: "IA de texto", icono: "🧠", descripcion: "Gemini, Groq, Cerebras y OpenRouter (rotación automática).", frecuencia: "cada hora" },
  { id: "ia_imagen", nombre: "IA de imagen", icono: "🎨", descripcion: "Gemini imagen, con Pollinations como respaldo.", frecuencia: "cada hora" },
  { id: "reels", nombre: "Reels", icono: "🎬", descripcion: "Vídeo de Pexels y voz con Gemini TTS.", frecuencia: "cada hora" },
  { id: "whatsapp", nombre: "WhatsApp", icono: "💬", descripcion: "API de WhatsApp Business y bot de respuestas.", frecuencia: "cada hora" },
  { id: "telegram", nombre: "Avisos", icono: "📨", descripcion: "Telegram (al momento) y email (escalado e informe semanal). Modo noche: de madrugada solo lo crítico.", frecuencia: "cada hora" },
  { id: "vigilante", nombre: "Vigilante", icono: "🛡️", descripcion: "Revisa todo, corrige lo que puede y avisa del resto.", frecuencia: "cada 15 min" },
];

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
