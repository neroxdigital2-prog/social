// Piloto automático: tipos y configuración por defecto (sin dependencias de servidor).
// Calendario semanal para vender desarrollo y apps listas + noticias + historias diarias.

export type FormatoAuto = "REEL" | "CARRUSEL" | "HISTORIAS" | "IMAGEN" | "NADA";

export interface DiaPlantilla {
  formato: FormatoAuto;
  objetivo: string;
  tema: string;
  cta: string; // llamada a la acción (palabra clave al DM)
  palabraClave: string; // WEB, APP, CATALOGO…
  segundos: number; // duración objetivo del Reel
  diapositivas: number; // carrusel / historias
  reelPrueba: boolean; // Trial Reel: solo se muestra a no seguidores
}

export interface CategoriaNoticias {
  id: string;
  nombre: string;
  activa: boolean;
  busquedas: string[];
}

export interface ConfigAutoPiloto {
  horaPrincipal: string; // "10:00"
  horaNoticia: string; // "13:30"
  horaHistoria: string; // "18:00"
  diasNoticia: number[]; // 1=lunes … 7=domingo
  historiasDiarias: boolean;
  aprobacion: boolean; // true = queda pendiente hasta aprobar (Telegram / Biblioteca)
  redes: string[]; // vacío = todas las conectadas
  diasAntelacion: number; // cuántos días por delante se preparan
  plantilla: Record<string, DiaPlantilla>; // "1".."7"
  categorias: CategoriaNoticias[];
  campana: CampanaIdeas;
  promoApps: PromoApps;
}

/** Promoción de las apps listas para vender (catálogo en Generador → Apps en venta). */
export interface PromoApps {
  activa: boolean;
  hora: string;
  dias: number[];
  formato: "ALTERNAR" | "REEL" | "HISTORIAS";
  segundos: number;
}

export interface AppVenta {
  id: string;
  nombre: string;
  resumen: string | null;
  problema: string | null;
  publico: string | null;
  funciones: string | null;
  precio: string | null;
  entrega: string | null;
  demoUrl: string | null;
  imagenes: string[];
  palabraClave: string | null;
  estado: "ACTIVA" | "PAUSADA";
  vecesPromocionada: number;
  ultimaPromocion: string | null;
}

/** Descripción de una app para que la IA la promocione sin inventar nada. */
export function fichaApp(a: AppVenta): string {
  return [
    `App «${a.nombre}»${a.resumen ? `: ${a.resumen}` : ""}`,
    a.problema ? `Problema que resuelve: ${a.problema}` : "",
    a.publico ? `Para quién: ${a.publico}` : "",
    a.funciones ? `Funciones: ${a.funciones.split("\n").map((f) => f.trim()).filter(Boolean).join("; ")}` : "",
    a.precio ? `Precio: ${a.precio}` : "",
    a.entrega ? `Entrega / puesta en marcha: ${a.entrega}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Cola de ideas (campañas, ideas de ChatGPT vía Telegram /idea): una publicación distinta por idea. */
export interface CampanaIdeas {
  activa: boolean;
  nombre: string;
  hora: string; // "19:30"
  dias: number[]; // 1=lunes … 7=domingo
  formato: "REEL" | "IMAGEN";
  segundos: number;
  cta: string;
  palabraClave: string;
  plantillaTema: string; // {idea} se sustituye por cada línea
  ideas: string[];
}

export const SECTORES_WEB = [
  "Clínicas odontológicas",
  "Zapaterías",
  "Arreglos de ropa y costura",
  "Churrerías",
  "Peluquerías",
  "Barberías",
  "Centros de estética y uñas",
  "Fisioterapeutas",
  "Psicólogos",
  "Clínicas veterinarias",
  "Ópticas",
  "Clínicas médicas privadas",
  "Academias y centros de formación",
  "Autoescuelas",
  "Gimnasios y entrenadores personales",
  "Restaurantes",
  "Bares y cafeterías",
  "Panaderías y pastelerías",
  "Fruterías y carnicerías de barrio",
  "Floristerías",
  "Ferreterías",
  "Talleres mecánicos",
  "Lavaderos de coches",
  "Inmobiliarias",
  "Gestorías y asesorías",
  "Abogados",
  "Arquitectos e interioristas",
  "Empresas de reformas",
  "Fontaneros y electricistas",
  "Cerrajeros",
  "Tiendas de ropa y moda",
  "Joyerías",
  "Tiendas de mascotas",
  "Escuelas infantiles",
  "Hoteles y casas rurales",
  "Fotógrafos",
  "Organizadores de bodas y eventos",
  "Autónomos y freelancers",
  "Emprendedores que empiezan",
  "Pequeños comercios de barrio",
  "Medianas empresas e industria",
  "Grandes empresas",
];

export const CAMPANA_DEFECTO: CampanaIdeas = {
  activa: false,
  nombre: "Web para cada sector",
  hora: "19:30",
  dias: [1, 2, 3, 4, 5, 6],
  formato: "REEL",
  segundos: 30,
  cta: "Comenta WEB y te enseño cómo sería la web de tu negocio.",
  palabraClave: "WEB",
  plantillaTema:
    "Web para {idea}: muestra en los primeros 3 segundos el problema concreto de este tipo de negocio sin web (clientes que buscan en Google o ChatGPT y acaban en la competencia, llamadas para preguntar lo mismo, reservas perdidas) y cómo una web profesional de Nerox lo resuelve: aparecer en Google y en asistentes de IA, reservas o pedidos online, WhatsApp directo, confianza. Habla al dueño de ese negocio con ejemplos de su día a día.",
  ideas: SECTORES_WEB,
};

export const NOMBRE_DIA: Record<string, string> = { "1": "Lunes", "2": "Martes", "3": "Miércoles", "4": "Jueves", "5": "Viernes", "6": "Sábado", "7": "Domingo" };

const NADA: DiaPlantilla = { formato: "NADA", objetivo: "Descanso", tema: "", cta: "", palabraClave: "", segundos: 30, diapositivas: 0, reelPrueba: false };

export const PLANTILLA_DEFECTO: Record<string, DiaPlantilla> = {
  "1": {
    formato: "REEL",
    objetivo: "Audiencia nueva (envíos)",
    tema: "El error de las webs lentas: cómo una web mal diseñada pierde clientes y cómo una optimizada convierte en piloto automático.",
    cta: "Comenta WEB y te envío una auditoría rápida de tu página.",
    palabraClave: "WEB",
    segundos: 30,
    diapositivas: 0,
    reelPrueba: true,
  },
  "2": {
    formato: "CARRUSEL",
    objetivo: "Seguidores (guardados)",
    tema: "Cuánto cuesta realmente crear una app: diferencia de tiempo y dinero entre programar desde cero y usar arquitectura moderna / No-Code.",
    cta: "Guarda este post si tienes una idea de app en mente.",
    palabraClave: "APP",
    segundos: 35,
    diapositivas: 6,
    reelPrueba: false,
  },
  "3": {
    formato: "REEL",
    objetivo: "Ventas (apps listas)",
    tema: "Tour por una app lista para vender: qué problema resuelve, cuánto tiempo de desarrollo se ahorra el comprador y cuánto puede generar. Enfoque de ahorro de tiempo: la compras hoy y mañana sales al mercado.",
    cta: "Comenta APP si quieres ver la demo y el precio de este sistema.",
    palabraClave: "APP",
    segundos: 40,
    diapositivas: 0,
    reelPrueba: false,
  },
  "4": {
    formato: "HISTORIAS",
    objetivo: "Conversión directa",
    tema: "Encuesta de necesidades: ¿qué frena más tus ventas hoy? 1) No tener web 2) Procesos manuales 3) No tener app propia.",
    cta: "Responde a esta historia con 1, 2 o 3 y te escribo con una solución.",
    palabraClave: "",
    segundos: 0,
    diapositivas: 4,
    reelPrueba: false,
  },
  "5": {
    formato: "CARRUSEL",
    objetivo: "Autoridad (guardados)",
    tema: "3 negocios digitales que puedes lanzar este mes: apps web de reservas, academias y gestión que Nerox ya tiene listas para entregar.",
    cta: "Comenta CATALOGO y te mando los detalles por privado.",
    palabraClave: "CATALOGO",
    segundos: 40,
    diapositivas: 7,
    reelPrueba: false,
  },
  "6": {
    formato: "REEL",
    objetivo: "Audiencia nueva (retención)",
    tema: "Antes y después de un proyecto: rediseño radical de una página o app web en menos de 20 segundos.",
    cta: "Envíaselo a ese socio que necesita renovar su negocio.",
    palabraClave: "",
    segundos: 25,
    diapositivas: 0,
    reelPrueba: true,
  },
  "7": NADA,
};

export const CATEGORIAS_DEFECTO: CategoriaNoticias[] = [
  {
    id: "lanzamientos",
    nombre: "Lanzamientos No-Code e IA",
    activa: true,
    busquedas: ["ChatGPT novedades empresas", "Make OR Zapier nueva función", "Webflow OR Bubble novedades", "nueva herramienta IA gratis pymes"],
  },
  {
    id: "casos",
    nombre: "Casos de éxito y métricas",
    activa: true,
    busquedas: ["pyme automatización ahorro costes", "negocio creado sin código factura", "empresa duplica ventas inteligencia artificial"],
  },
  {
    id: "tendencias",
    nombre: "Mercado y tendencias",
    activa: true,
    busquedas: ["hábitos digitales consumidores España", "búsquedas con inteligencia artificial comercio", "marketing digital deja de funcionar"],
  },
  {
    id: "ayudas",
    nombre: "Ayudas, subvenciones y normativa",
    activa: true,
    busquedas: ["Kit Digital convocatoria", "subvención digitalización autónomos inteligencia artificial", "Verifactu facturación electrónica obligatoria", "ley inteligencia artificial empresas España"],
  },
  {
    id: "integraciones",
    nombre: "Integraciones y ecosistemas",
    activa: true,
    busquedas: ["WhatsApp Business inteligencia artificial", "Google Workspace Gemini novedades", "Notion IA novedades"],
  },
];

export const CONFIG_DEFECTO: ConfigAutoPiloto = {
  horaPrincipal: "10:00",
  horaNoticia: "13:30",
  horaHistoria: "18:00",
  diasNoticia: [1, 2, 3, 4, 5],
  historiasDiarias: true,
  aprobacion: false,
  redes: [],
  diasAntelacion: 2,
  plantilla: PLANTILLA_DEFECTO,
  categorias: CATEGORIAS_DEFECTO,
  campana: CAMPANA_DEFECTO,
  promoApps: { activa: true, hora: "12:30", dias: [2, 4, 6], formato: "ALTERNAR", segundos: 35 },
};

/** Completa una configuración guardada con los valores por defecto (por si faltan campos nuevos). */
export function normalizarConfig(c?: Partial<ConfigAutoPiloto> | null): ConfigAutoPiloto {
  const base = structuredClone(CONFIG_DEFECTO);
  if (!c) return base;
  const plantilla = { ...base.plantilla };
  for (const d of Object.keys(plantilla)) if (c.plantilla?.[d]) plantilla[d] = { ...plantilla[d], ...c.plantilla[d] };
  const categorias = base.categorias.map((cat) => {
    const guardada = c.categorias?.find((x) => x.id === cat.id);
    return guardada ? { ...cat, ...guardada, busquedas: guardada.busquedas?.length ? guardada.busquedas : cat.busquedas } : cat;
  });
  return {
    ...base,
    ...c,
    plantilla,
    categorias,
    diasNoticia: Array.isArray(c.diasNoticia) ? c.diasNoticia : base.diasNoticia,
    redes: Array.isArray(c.redes) ? c.redes : base.redes,
    diasAntelacion: Math.min(7, Math.max(1, Number(c.diasAntelacion) || base.diasAntelacion)),
    promoApps: { ...base.promoApps, ...(c.promoApps || {}) },
    campana: { ...base.campana, ...(c.campana || {}), ideas: Array.isArray(c.campana?.ideas) ? c.campana!.ideas : base.campana.ideas },
  };
}

/** Reglas de crecimiento y venta que se aplican a TODO lo que escribe la IA. */
export const REGLAS_CRECIMIENTO = `REGLAS DE CRECIMIENTO Y VENTA (obligatorias):
1. Retención en los 3 primeros segundos: empieza SIEMPRE mostrando el resultado final o el problema que resuelves. Nada de saludos ni presentaciones.
2. SEO en el texto: escribe palabras clave claras que la gente busca (ej. "desarrollo de apps", "páginas web para empresas", "automatización para pymes") dentro de la primera frase y en los subtítulos. El buscador de Instagram indexa el texto, no los hashtags.
3. Máximo 5 hashtags en total (incluido el de marca). Específicos, nada genérico.
4. Pensado para ENVÍOS por mensaje directo: contenido útil que un dueño de negocio quiera reenviar a su socio (comparativas de costes, errores caros, demos rápidas).
5. Conversación, no enlaces: nunca mandes al enlace de la bio ni a webs externas. Cierra pidiendo comentar una PALABRA CLAVE corta en mayúsculas (WEB, APP, CATALOGO…) o responder por privado.
6. Enfoque de ahorro de tiempo al hablar de apps listas: el comprador se ahorra meses de desarrollo y problemas técnicos; la compra hoy y mañana sale al mercado.
7. Contenido 100 % original: habla de los proyectos, apps y método de Nerox; nunca copies frases virales ni plantillas ajenas.
8. Nunca inventes cifras, clientes ni resultados: si no tienes el dato, habla en cualitativo.`;
