// Redactor del piloto automático: escribe cada publicación siguiendo el
// calendario semanal, las reglas de crecimiento/venta y sin repetir lo ya publicado.
import { generarRespuestaChat } from "@/lib/generadorTexto";
import { REGLAS_CRECIMIENTO, type DiaPlantilla } from "@/lib/autopiloto/plantilla";
import { buscarRepetida, tituloYaUsado, type Previa } from "@/lib/autopiloto/antiRepeticion";
import type { Noticia } from "@/lib/autopiloto/noticias";

export interface PerfilAuto {
  nombre: string;
  sector: string;
  ciudad: string;
  servicios: string[];
  web?: string | null;
  whatsapp?: string | null;
}

export interface Diapositiva {
  titulo: string; // texto grande en pantalla (máx. 8 palabras)
  texto: string; // apoyo (máx. 18 palabras)
}

export interface PublicacionAuto {
  tipo: string;
  titulo: string;
  texto: string;
  altText: string;
  hashtags: string[];
  imagenPrompt: string;
  diapositivas: Diapositiva[];
  indice?: number;
}

const TIPOS = ["INFORMATIVA", "CONSEJO", "CASO_EXITO", "ANTES_DESPUES", "PROMOCION", "PREGUNTA_FRECUENTE", "NOTICIA_SECTOR", "CURIOSIDAD", "MITO_REALIDAD", "TESTIMONIO", "ENCUESTA", "LLAMADA_ACCION"];

function sistema(perfil: PerfilAuto) {
  return `Eres el director de contenido de ${perfil.nombre}, ${perfil.sector} en ${perfil.ciudad} (España). Vendes desarrollo web, apps a medida, apps listas para entregar y automatización con IA a pymes y autónomos.
Escribes en español de España, cercano, directo y profesional. Formato vertical 9:16 tipo Reel.
${REGLAS_CRECIMIENTO}
Servicios: ${perfil.servicios.join(", ") || "desarrollo web, apps, automatización"}.
Responde SOLO con JSON válido, sin texto antes ni después.`;
}

function limpiarHashtags(h: unknown, marca: string): string[] {
  const lista = (Array.isArray(h) ? h : [])
    .map((x) => String(x).trim().replace(/\s+/g, ""))
    .filter(Boolean)
    .map((x) => (x.startsWith("#") ? x : `#${x}`).toLowerCase());
  const tagMarca = `#${marca.toLowerCase().replace(/[^a-z0-9]/g, "") || "nerox"}`;
  const sinMarca = lista.filter((x) => x !== tagMarca);
  return [...new Set([...sinMarca.slice(0, 4), tagMarca])].slice(0, 5); // máximo 5 en total
}

function extraerJson(bruto: string): Record<string, unknown> {
  const ini = bruto.indexOf("{");
  const fin = bruto.lastIndexOf("}");
  if (ini < 0 || fin < ini) throw new Error("La IA no devolvió JSON");
  return JSON.parse(bruto.slice(ini, fin + 1));
}

function aPublicacion(j: Record<string, unknown>, perfil: PerfilAuto, tipoDefecto: string): PublicacionAuto {
  const tipo = TIPOS.includes(String(j.tipo)) ? String(j.tipo) : tipoDefecto;
  const diapositivas = (Array.isArray(j.diapositivas) ? j.diapositivas : [])
    .map((d: { titulo?: string; texto?: string }) => ({ titulo: String(d?.titulo || "").slice(0, 80), texto: String(d?.texto || "").slice(0, 160) }))
    .filter((d: Diapositiva) => d.titulo);
  return {
    tipo,
    titulo: String(j.titulo || "").slice(0, 120).trim(),
    texto: String(j.texto || "").trim(),
    altText: String(j.altText || "").slice(0, 100),
    hashtags: limpiarHashtags(j.hashtags, perfil.nombre),
    imagenPrompt: String(j.imagenPrompt || "").slice(0, 600) || "modern small business owner using a laptop in a bright office, vertical",
    diapositivas,
    indice: Number(j.indice) || undefined,
  };
}

/** Pide a la IA y reintenta si sale algo repetido. */
async function redactarSinRepetir(
  perfil: PerfilAuto,
  usuario: (evitar: string) => string,
  historial: Previa[],
  tipoDefecto: string
): Promise<PublicacionAuto> {
  const recientes = historial.slice(0, 40).map((h) => `- ${h.titulo}`).join("\n");
  let rechazados: string[] = [];
  let ultimo: PublicacionAuto | null = null;
  for (let intento = 0; intento < 3; intento++) {
    const evitar = `NO repitas ni parafrasees estos títulos/temas ya publicados (busca un ángulo, ejemplo y gancho NUEVOS):\n${recientes || "- (ninguno)"}${
      rechazados.length ? `\nTambién rechazados por repetidos: ${rechazados.join(" | ")}` : ""
    }`;
    const bruto = await generarRespuestaChat(sistema(perfil), usuario(evitar));
    const pub = aPublicacion(extraerJson(bruto), perfil, tipoDefecto);
    if (!pub.titulo || pub.texto.length < 40) throw new Error("La IA devolvió una publicación incompleta");
    ultimo = pub;
    const repetida = buscarRepetida(pub.titulo, pub.texto, historial);
    if (!repetida && !tituloYaUsado(pub.titulo, rechazados)) return pub;
    rechazados = [...rechazados, pub.titulo];
  }
  throw new Error(`No se consiguió un texto que no se repita (último intento: «${ultimo?.titulo}»)`);
}

const FORMATO_JSON = `{"tipo":"TIPO","titulo":"...","texto":"...","altText":"...","hashtags":["#...","#..."],"imagenPrompt":"...","diapositivas":[{"titulo":"...","texto":"..."}]}`;

/** Publicación principal del día según el calendario semanal. */
export async function redactarPrincipal(perfil: PerfilAuto, dia: DiaPlantilla, historial: Previa[]): Promise<PublicacionAuto> {
  const nDiap = dia.formato === "CARRUSEL" ? Math.min(8, Math.max(5, dia.diapositivas || 6)) : dia.formato === "HISTORIAS" ? Math.min(6, Math.max(2, dia.diapositivas || 4)) : 0;
  const tipoDefecto = dia.formato === "HISTORIAS" ? "ENCUESTA" : dia.formato === "CARRUSEL" ? "CONSEJO" : "INFORMATIVA";
  return redactarSinRepetir(
    perfil,
    (evitar) => `Crea la publicación de hoy del calendario semanal.
FORMATO: ${dia.formato === "REEL" ? `Reel vertical de ${dia.segundos || 30} s` : dia.formato === "CARRUSEL" ? `carrusel educativo de ${nDiap} diapositivas (se publicará como vídeo 9:16 diapositiva a diapositiva)` : `${nDiap} historias de Instagram 9:16`}
OBJETIVO: ${dia.objetivo}
TEMA DE LA SEMANA (mismo enfoque, pero con un ángulo y ejemplo NUEVO cada semana): ${dia.tema}
LLAMADA A LA ACCIÓN OBLIGATORIA (literal o casi literal, al final del texto): ${dia.cta}
${dia.palabraClave ? `PALABRA CLAVE que deben comentar: ${dia.palabraClave}` : ""}

${evitar}

Entrega:
- tipo: uno de ${TIPOS.join(", ")}
- titulo: gancho de máximo 8 palabras que muestre el problema o el resultado
- texto: 60-120 palabras. Primera frase = gancho con palabra clave SEO. Estructura: resultado/problema → explicación → beneficio (ahorro de tiempo) → CTA con la palabra clave. Sin enlaces.
- altText: qué se ve en la imagen, máx. 100 caracteres
- hashtags: 4 de nicho (desarrollo de apps, webs para empresas, ciudad…) — el de marca lo añado yo
- imagenPrompt: escena realista en inglés, vertical 9:16, sin texto
- diapositivas: ${nDiap ? `exactamente ${nDiap}; la 1.ª es el gancho, la última repite la CTA. titulo máx. 8 palabras, texto máx. 18 palabras` : "[] (vacío)"}

JSON exacto: ${FORMATO_JSON}`,
    historial,
    tipoDefecto
  );
}

/** Elige la mejor noticia (no usada) y escribe la publicación. */
export async function redactarNoticia(
  perfil: PerfilAuto,
  noticias: Noticia[],
  historial: Previa[]
): Promise<{ noticia: Noticia; pub: PublicacionAuto }> {
  if (!noticias.length) throw new Error("No hay noticias nuevas disponibles");
  const candidatas = noticias.slice(0, 30);
  const lista = candidatas.map((n, i) => `${i + 1}. [${n.categoriaNombre}] ${n.titulo} (${n.fuente}${n.fecha ? `, ${n.fecha.slice(0, 10)}` : ""})`).join("\n");
  let elegida: Noticia = candidatas[0];
  const pub = await redactarSinRepetir(
    perfil,
    (evitar) => `Eres también el agente de noticias de ${perfil.nombre}. De esta lista de noticias REALES de los últimos días, elige la que más clientes puede atraer para Nerox (pymes y autónomos que necesitan web, app o automatización). Prioriza: lanzamientos de herramientas No-Code/IA útiles, casos de éxito con métricas, cambios de mercado o alertas de obsolescencia, ayudas/subvenciones (Kit Digital) y cambios legales (cookies, IA, facturación electrónica), integraciones con WhatsApp/Google/Notion.

NOTICIAS:
${lista}

${evitar}

Escribe una publicación de imagen 9:16 que:
- titulo: gancho de máx. 8 palabras sobre la noticia (sin clickbait falso)
- texto: 70-120 palabras. 1) La noticia en una frase con palabra clave SEO. 2) Qué significa para un negocio pequeño (oportunidad o riesgo). 3) Qué puede hacer hoy y cómo Nerox le ayuda. 4) CTA: comentar una palabra clave en mayúsculas o escribir por privado. Termina con "Fuente: <medio>". Solo usa datos que estén en el titular; no inventes cifras.
- tipo: NOTICIA_SECTOR
- altText, hashtags (4 de nicho), imagenPrompt (escena realista en inglés, vertical, sin texto), diapositivas: []
Además añade "indice": número de la noticia elegida.

JSON exacto: {"indice":1,"tipo":"NOTICIA_SECTOR","titulo":"...","texto":"...","altText":"...","hashtags":["#..."],"imagenPrompt":"...","diapositivas":[]}`,
    historial,
    "NOTICIA_SECTOR"
  );
  // La IA indica qué noticia eligió; si no, se toma la que más palabras comparte con el texto
  const indice = Number(pub.indice);
  if (indice >= 1 && indice <= candidatas.length) elegida = candidatas[indice - 1];
  else {
    const texto = `${pub.titulo} ${pub.texto}`.toLowerCase();
    elegida = candidatas.find((n) => n.fuente && texto.includes(n.fuente.toLowerCase())) || candidatas[0];
  }
  if (!/fuente:/i.test(pub.texto)) pub.texto = `${pub.texto}\n\nFuente: ${elegida.fuente}`;
  return { noticia: elegida, pub };
}

const TEMAS_HISTORIA = [
  "Caso de éxito: un resultado real de un proyecto de Nerox (sin inventar cifras)",
  "Encuesta rápida: pregunta con 2 opciones sobre un problema digital de su negocio (responder con A o B)",
  "Demo: una función concreta de una app lista para vender y el tiempo que ahorra",
  "Detrás de cámaras: qué estamos construyendo hoy en Nerox",
  "Error común en webs de pymes y cómo detectarlo en 10 segundos",
  "Pregunta frecuente de clientes respondida en una frase",
];

/** Historia diaria (1 diapositiva) para fidelizar y cerrar ventas. */
export async function redactarHistoriaDiaria(perfil: PerfilAuto, historial: Previa[], semilla: number): Promise<PublicacionAuto> {
  const tema = TEMAS_HISTORIA[semilla % TEMAS_HISTORIA.length];
  return redactarSinRepetir(
    perfil,
    (evitar) => `Crea UNA historia de Instagram 9:16 para fidelizar a seguidores y abrir conversación por privado.
Tema: ${tema}
${evitar}
- titulo: máx. 8 palabras (texto grande en pantalla)
- texto: 25-50 palabras (descripción interna)
- diapositivas: exactamente 1 con titulo (máx. 8 palabras) y texto (máx. 18 palabras, termina invitando a responder la historia)
- tipo: ENCUESTA, CASO_EXITO, CONSEJO o INFORMATIVA
- altText, hashtags (2), imagenPrompt (escena realista en inglés, vertical, sin texto)
JSON exacto: ${FORMATO_JSON}`,
    historial,
    "INFORMATIVA"
  );
}
