const PEXELS_API_KEY = process.env.PEXELS_API_KEY!;

export interface FotoPexels {
  id: number;
  ancho: number;
  alto: number;
  alt: string;
  fotografo: string;
  fotografoUrl: string;
  pexelsUrl: string;
  src: {
    original: string;
    grande: string;
    mediana: string;
    miniatura: string;
  };
}

export interface ResultadoBusquedaPexels {
  fotos: FotoPexels[];
  totalResultados: number;
  hayMas: boolean;
}

export async function buscarFotosPexels(
  query: string,
  pagina = 1,
  porPagina = 15
): Promise<ResultadoBusquedaPexels> {
  if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY no configurada");
  if (!query.trim()) throw new Error("Falta el término de búsqueda");

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("page", String(pagina));
  url.searchParams.set("per_page", String(Math.min(porPagina, 80)));
  url.searchParams.set("locale", "es-ES");

  const res = await fetch(url.toString(), {
    headers: { Authorization: PEXELS_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Pexels API error ${res.status}`);
  }

  const data = await res.json();

  const fotos: FotoPexels[] = (data.photos || []).map((p: any) => ({
    id: p.id,
    ancho: p.width,
    alto: p.height,
    alt: p.alt || query,
    fotografo: p.photographer,
    fotografoUrl: p.photographer_url,
    pexelsUrl: p.url,
    src: {
      original: p.src.original,
      grande: p.src.large,
      mediana: p.src.medium,
      miniatura: p.src.tiny,
    },
  }));

  return {
    fotos,
    totalResultados: data.total_results ?? fotos.length,
    hayMas: Boolean(data.next_page),
  };
}
