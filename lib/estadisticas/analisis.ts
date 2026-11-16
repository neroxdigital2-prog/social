// Análisis de resultados: qué criterio (origen, formato, tipo, día, hora,
// palabra clave, categoría…) consigue mejores resultados reales.

export interface RedPublicacion {
  red: string;
  publicadoEn: string | null;
  error: string | null;
  alcance: number | string | null;
  reproducciones: number | string | null;
  meGusta: number | string | null;
  comentarios: number | string | null;
  compartidos: number | string | null;
  guardados: number | string | null;
  interacciones: number | string | null;
  metricasEn: string | null;
}

export interface PublicacionBruta {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  hashtags: string[];
  estado: string;
  formato: string | null;
  imagenUrl: string | null;
  videoUrl: string | null;
  fechaProgramada: string | null;
  createdAt: string;
  reelPrueba: number | string | null;
  hueco: string | null;
  noticiaTitulo: string | null;
  noticiaFuente: string | null;
  criterio: Record<string, unknown> | null;
  redes: RedPublicacion[];
}

export interface Criterios {
  origen: string;
  formato: string;
  tipo: string;
  dia: string;
  franja: string;
  palabraClave: string;
  categoria: string;
  reelPrueba: string;
  objetivo: string;
  longitud: string;
}

export interface PublicacionAnalizada {
  id: string;
  titulo: string;
  fecha: string | null;
  estado: string;
  resultado: "PUBLICADA" | "PARCIAL" | "ERROR" | "PROGRAMADA" | "BORRADOR";
  miniatura: string | null;
  criterios: Criterios;
  detalleCriterio: Record<string, unknown> | null;
  noticia: string | null;
  redes: { red: string; ok: boolean; error: string | null; alcance: number; interacciones: number }[];
  alcance: number;
  reproducciones: number;
  meGusta: number;
  comentarios: number;
  compartidos: number;
  guardados: number;
  interacciones: number;
  tasa: number | null; // interacción ponderada / alcance (%)
  puntuacion: number | null; // 0-100
  conMetricas: boolean;
}

export interface FilaCriterio {
  valor: string;
  publicaciones: number;
  conMetricas: number;
  alcanceMedio: number;
  tasaMedia: number | null;
  guardadosMedio: number;
  compartidosMedio: number;
  comentariosMedio: number;
  veredicto: "FUNCIONA" | "NORMAL" | "NO_FUNCIONA" | "POCOS_DATOS";
  vsMedia: number | null; // % sobre la media global
}

export const DIMENSIONES: { id: keyof Criterios; nombre: string }[] = [
  { id: "origen", nombre: "Origen (quién la creó)" },
  { id: "formato", nombre: "Formato" },
  { id: "tipo", nombre: "Tipo de publicación" },
  { id: "objetivo", nombre: "Objetivo" },
  { id: "palabraClave", nombre: "Palabra clave del CTA" },
  { id: "categoria", nombre: "Categoría de noticia / campaña" },
  { id: "dia", nombre: "Día de la semana" },
  { id: "franja", nombre: "Franja horaria" },
  { id: "reelPrueba", nombre: "Reel de prueba" },
  { id: "longitud", nombre: "Longitud del texto" },
];

const ORIGEN: Record<string, string> = {
  PRINCIPAL: "Piloto · calendario semanal",
  NOTICIA: "Piloto · noticia del día",
  HISTORIA: "Piloto · historia diaria",
  CAMPANA: "Piloto · campaña / ideas",
  APP: "Piloto · apps en venta",
};
const FORMATO: Record<string, string> = { VIDEO: "Reel 9:16", IMAGEN: "Imagen 9:16", HISTORIA: "Historia 9:16" };
const TIPO: Record<string, string> = {
  INFORMATIVA: "Informativa",
  CONSEJO: "Consejo",
  CASO_EXITO: "Caso de éxito",
  ANTES_DESPUES: "Antes y después",
  PROMOCION: "Promoción",
  PREGUNTA_FRECUENTE: "Pregunta frecuente",
  NOTICIA_SECTOR: "Noticia del sector",
  CURIOSIDAD: "Curiosidad",
  MITO_REALIDAD: "Mito / realidad",
  TESTIMONIO: "Testimonio",
  ENCUESTA: "Encuesta",
  LLAMADA_ACCION: "Llamada a la acción",
};
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const n = (v: unknown) => Number(v) || 0;

function franja(hora: number): string {
  if (hora < 7) return "Madrugada (0-7 h)";
  if (hora < 10) return "Primera hora (7-10 h)";
  if (hora < 12) return "Media mañana (10-12 h)";
  if (hora < 15) return "Mediodía (12-15 h)";
  if (hora < 18) return "Tarde (15-18 h)";
  if (hora < 21) return "Tarde-noche (18-21 h)";
  return "Noche (21-24 h)";
}

/** "2026-11-16 13:30:00" (hora de Madrid guardada en IONOS) → partes */
function partes(f: string | null): { dia: string; hora: number } | null {
  const m = f && /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})/.exec(f);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return { dia: DIAS[d.getUTCDay()], hora: Number(m[4]) };
}

function palabraClave(texto: string, criterio: Record<string, unknown> | null): string {
  const c = String(criterio?.palabraClave || "").trim();
  if (c) return c.toUpperCase();
  const m = /(?:comenta|escribe|escríbeme|responde)\s+[«"']?([A-ZÁÉÍÓÚÑ]{3,15})\b/.exec(texto);
  return m ? m[1] : "Sin palabra clave";
}

export function analizarPublicacion(p: PublicacionBruta): PublicacionAnalizada {
  const c = p.criterio;
  const fecha = p.fechaProgramada || p.createdAt;
  const pt = partes(fecha);
  const formato = String(c?.formato || p.formato || "IMAGEN");
  const palabras = (p.texto || "").split(/\s+/).filter(Boolean).length;
  const redesOk = p.redes.filter((r) => r.publicadoEn);
  const redesError = p.redes.filter((r) => !r.publicadoEn && r.error);
  const resultado: PublicacionAnalizada["resultado"] =
    redesOk.length && redesError.length ? "PARCIAL" : redesOk.length ? "PUBLICADA" : redesError.length ? "ERROR" : p.estado === "PROGRAMADA" ? "PROGRAMADA" : p.estado === "PUBLICADA" ? "PUBLICADA" : "BORRADOR";

  const suma = (k: keyof RedPublicacion) => p.redes.reduce((s, r) => s + n(r[k]), 0);
  const alcance = suma("alcance");
  const meGusta = suma("meGusta");
  const comentarios = suma("comentarios");
  const compartidos = suma("compartidos");
  const guardados = suma("guardados");
  const interacciones = suma("interacciones") || meGusta + comentarios + compartidos + guardados;
  const conMetricas = p.redes.some((r) => r.metricasEn) && alcance > 0;
  const ponderada = meGusta + comentarios * 2 + compartidos * 3 + guardados * 3;
  const tasa = conMetricas ? Math.round((ponderada / alcance) * 1000) / 10 : null;

  return {
    id: p.id,
    titulo: p.titulo,
    fecha,
    estado: p.estado,
    resultado,
    miniatura: p.imagenUrl,
    criterios: {
      origen: p.hueco ? ORIGEN[p.hueco.split("_")[0]] || p.hueco : "Manual / generador por lotes",
      formato: FORMATO[formato] || formato,
      tipo: TIPO[String(c?.tipo || p.tipo)] || String(c?.tipo || p.tipo),
      dia: String(c?.dia || pt?.dia || "—"),
      franja: pt ? franja(pt.hora) : "—",
      palabraClave: palabraClave(p.texto || "", c),
      categoria: String(c?.categoria || c?.campana || (c?.app ? "Apps en venta" : "") || "—"),
      reelPrueba: formato === "VIDEO" ? (n(p.reelPrueba) === 1 || c?.reelPrueba ? "Reel de prueba" : "Reel normal") : "—",
      objetivo: String(c?.objetivo || "—"),
      longitud: palabras < 60 ? "Corto (< 60 palabras)" : palabras <= 110 ? "Medio (60-110)" : "Largo (> 110)",
    },
    detalleCriterio: c,
    noticia: p.noticiaTitulo ? `${p.noticiaTitulo}${p.noticiaFuente ? ` — ${p.noticiaFuente}` : ""}` : null,
    redes: p.redes.map((r) => ({ red: r.red, ok: !!r.publicadoEn, error: r.error, alcance: n(r.alcance), interacciones: n(r.interacciones) })),
    alcance,
    reproducciones: suma("reproducciones"),
    meGusta,
    comentarios,
    compartidos,
    guardados,
    interacciones,
    tasa,
    puntuacion: tasa === null ? null : Math.min(100, Math.round(tasa * 5)),
    conMetricas,
  };
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (x: number) => Math.round(x * 10) / 10;

export function agrupar(pubs: PublicacionAnalizada[], dim: keyof Criterios, tasaGlobal: number | null): FilaCriterio[] {
  const grupos = new Map<string, PublicacionAnalizada[]>();
  for (const p of pubs) {
    const v = p.criterios[dim];
    if (!v || v === "—") continue;
    grupos.set(v, [...(grupos.get(v) || []), p]);
  }
  return [...grupos.entries()]
    .map(([valor, lista]) => {
      const con = lista.filter((p) => p.conMetricas);
      const tasaMedia = con.length ? r1(media(con.map((p) => p.tasa || 0))) : null;
      const vsMedia = tasaMedia !== null && tasaGlobal ? Math.round(((tasaMedia - tasaGlobal) / tasaGlobal) * 100) : null;
      const veredicto: FilaCriterio["veredicto"] =
        con.length < 2 || tasaGlobal === null || tasaMedia === null ? "POCOS_DATOS" : tasaMedia >= tasaGlobal * 1.2 ? "FUNCIONA" : tasaMedia <= tasaGlobal * 0.8 ? "NO_FUNCIONA" : "NORMAL";
      return {
        valor,
        publicaciones: lista.length,
        conMetricas: con.length,
        alcanceMedio: Math.round(media(con.map((p) => p.alcance))),
        tasaMedia,
        guardadosMedio: r1(media(con.map((p) => p.guardados))),
        compartidosMedio: r1(media(con.map((p) => p.compartidos))),
        comentariosMedio: r1(media(con.map((p) => p.comentarios))),
        veredicto,
        vsMedia,
      };
    })
    .sort((a, b) => (b.tasaMedia ?? -1) - (a.tasaMedia ?? -1) || b.publicaciones - a.publicaciones);
}

export interface Informe {
  kpis: {
    total: number;
    publicadas: number;
    conError: number;
    programadas: number;
    conMetricas: number;
    alcanceTotal: number;
    alcanceMedio: number;
    interaccionesTotal: number;
    guardados: number;
    compartidos: number;
    comentarios: number;
    tasaMedia: number | null;
  };
  porCriterio: Record<string, FilaCriterio[]>;
  conclusiones: { tipo: "BIEN" | "MAL" | "INFO"; texto: string }[];
  mejores: PublicacionAnalizada[];
  peores: PublicacionAnalizada[];
  publicaciones: PublicacionAnalizada[];
}

export function construirInforme(brutas: PublicacionBruta[]): Informe {
  const pubs = brutas.map(analizarPublicacion);
  const con = pubs.filter((p) => p.conMetricas);
  const tasaGlobal = con.length ? r1(media(con.map((p) => p.tasa || 0))) : null;
  const porCriterio: Record<string, FilaCriterio[]> = {};
  for (const d of DIMENSIONES) porCriterio[d.id] = agrupar(pubs, d.id, tasaGlobal);

  const conclusiones: Informe["conclusiones"] = [];
  const todas = DIMENSIONES.flatMap((d) => porCriterio[d.id].map((f) => ({ ...f, dimension: d.nombre })));
  const buenas = todas.filter((f) => f.veredicto === "FUNCIONA").sort((a, b) => (b.vsMedia ?? 0) - (a.vsMedia ?? 0)).slice(0, 4);
  const malas = todas.filter((f) => f.veredicto === "NO_FUNCIONA").sort((a, b) => (a.vsMedia ?? 0) - (b.vsMedia ?? 0)).slice(0, 4);
  for (const f of buenas) conclusiones.push({ tipo: "BIEN", texto: `${f.dimension}: «${f.valor}» consigue un ${f.vsMedia}% más de interacción que la media (${f.conMetricas} publicaciones). Haz más de esto.` });
  for (const f of malas) conclusiones.push({ tipo: "MAL", texto: `${f.dimension}: «${f.valor}» rinde un ${Math.abs(f.vsMedia ?? 0)}% menos que la media (${f.conMetricas} publicaciones). Cámbialo o reduce su frecuencia.` });

  const errores = pubs.filter((p) => p.resultado === "ERROR" || p.resultado === "PARCIAL").length;
  const salidas = pubs.filter((p) => p.resultado !== "PROGRAMADA" && p.resultado !== "BORRADOR").length;
  if (salidas && errores / salidas > 0.1) conclusiones.push({ tipo: "MAL", texto: `${errores} de ${salidas} publicaciones (${Math.round((errores / salidas) * 100)}%) fallaron en alguna red: revisa el Centro de control.` });
  const sinPalabra = pubs.filter((p) => p.criterios.palabraClave === "Sin palabra clave" && p.resultado === "PUBLICADA").length;
  if (sinPalabra) conclusiones.push({ tipo: "INFO", texto: `${sinPalabra} publicaciones salieron sin palabra clave en el CTA: sin ella no se pueden convertir comentarios en conversaciones.` });
  const sinMetricas = pubs.filter((p) => (p.resultado === "PUBLICADA" || p.resultado === "PARCIAL") && !p.conMetricas).length;
  if (sinMetricas) conclusiones.push({ tipo: "INFO", texto: `${sinMetricas} publicaciones publicadas aún no tienen métricas (se leen cada hora; las de Instagram tardan unas horas en tener datos).` });
  if (!con.length) conclusiones.push({ tipo: "INFO", texto: "Todavía no hay métricas suficientes: en cuanto Instagram y Facebook devuelvan datos, aquí verás qué funciona y qué no." });

  const ordenadas = [...con].sort((a, b) => (b.tasa ?? 0) - (a.tasa ?? 0));
  const sum = (k: "alcance" | "interacciones" | "guardados" | "compartidos" | "comentarios") => pubs.reduce((s, p) => s + p[k], 0);
  return {
    kpis: {
      total: pubs.length,
      publicadas: pubs.filter((p) => p.resultado === "PUBLICADA" || p.resultado === "PARCIAL").length,
      conError: errores,
      programadas: pubs.filter((p) => p.resultado === "PROGRAMADA").length,
      conMetricas: con.length,
      alcanceTotal: sum("alcance"),
      alcanceMedio: con.length ? Math.round(media(con.map((p) => p.alcance))) : 0,
      interaccionesTotal: sum("interacciones"),
      guardados: sum("guardados"),
      compartidos: sum("compartidos"),
      comentarios: sum("comentarios"),
      tasaMedia: tasaGlobal,
    },
    porCriterio,
    conclusiones,
    mejores: ordenadas.slice(0, 5),
    peores: ordenadas.slice(-5).reverse(),
    publicaciones: pubs,
  };
}
