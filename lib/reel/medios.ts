// Busca metraje REAL vertical en Pexels (vídeos de stock gratis, uso comercial
// permitido sin atribución). Si no hay vídeo para una búsqueda, usa una foto
// vertical real; y si tampoco, la imagen de la publicación.

export interface Medio {
  tipo: "video" | "imagen";
  url: string;
  credito?: string;
}

interface ArchivoVideoPexels {
  quality: string | null;
  file_type: string;
  width: number | null;
  height: number | null;
  link: string;
}

interface VideoPexels {
  id: number;
  duration: number;
  user?: { name?: string };
  video_files: ArchivoVideoPexels[];
}

function elegirArchivo(v: VideoPexels): ArchivoVideoPexels | null {
  const verticales = v.video_files.filter(
    (f) => f.file_type === "video/mp4" && f.width && f.height && f.height > f.width && f.height >= 1280
  );
  // El más cercano a 1080x1920 sin pasarse de 1440 de ancho (evita 4K, que es lento de procesar)
  return (
    verticales
      .filter((f) => (f.width || 0) <= 1440)
      .sort((a, b) => Math.abs((a.height || 0) - 1920) - Math.abs((b.height || 0) - 1920))[0] || null
  );
}

async function pexels(ruta: string): Promise<any> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.pexels.com${ruta}`, { headers: { Authorization: key }, cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function buscarMedios(busquedas: string[], imagenRespaldo: string | null): Promise<Medio[]> {
  const usados = new Set<number>();

  return Promise.all(
    busquedas.map(async (q): Promise<Medio> => {
      try {
        const data = await pexels(
          `/videos/search?query=${encodeURIComponent(q)}&orientation=portrait&size=medium&per_page=12&locale=es-ES`
        );
        const videos: VideoPexels[] = (data?.videos || []).filter((v: VideoPexels) => v.duration >= 4 && v.duration <= 60);
        for (const v of videos) {
          if (usados.has(v.id)) continue;
          const archivo = elegirArchivo(v);
          if (archivo) {
            usados.add(v.id);
            return { tipo: "video", url: archivo.link, credito: v.user?.name };
          }
        }
        const fotos = await pexels(`/v1/search?query=${encodeURIComponent(q)}&orientation=portrait&per_page=5&locale=es-ES`);
        const foto = fotos?.photos?.[0];
        if (foto?.src?.original) {
          return { tipo: "imagen", url: `${foto.src.original}?auto=compress&cs=tinysrgb&fit=crop&w=1296&h=2304`, credito: foto.photographer };
        }
      } catch (error) {
        console.error(`buscarMedios: fallo buscando "${q}":`, error);
      }
      if (imagenRespaldo) return { tipo: "imagen", url: imagenRespaldo };
      throw new Error(`No se encontró metraje para "${q}" y la publicación no tiene imagen.`);
    })
  );
}
