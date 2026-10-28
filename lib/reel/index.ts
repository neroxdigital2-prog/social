import { crearGuion, type DatosGuion, type GuionReel } from "@/lib/reel/guion";
import { generarVoz } from "@/lib/reel/voz";
import { buscarMedios } from "@/lib/reel/medios";
import { renderizarReel } from "@/lib/reel/render";

export interface EntradaReel extends DatosGuion {
  imagenUrl: string | null;
}

export interface SalidaReel {
  mp4: Buffer;
  segundos: number;
  guion: GuionReel;
  conVoz: boolean;
  conMusica: boolean;
}

// Pistas de música libres de derechos subidas por Nerox a IONOS (lista separada por comas).
function elegirMusica(): string | null {
  const lista = (process.env.REEL_MUSICA_URLS || "")
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("https://"));
  return lista.length ? lista[Math.floor(Math.random() * lista.length)] : null;
}

export async function generarReel(entrada: EntradaReel): Promise<SalidaReel> {
  const guion = await crearGuion(entrada);

  const [voz, medios] = await Promise.all([
    generarVoz(guion.locucion),
    buscarMedios(
      guion.escenas.map((e) => e.busqueda),
      entrada.imagenUrl
    ),
  ]);

  const musicaUrl = elegirMusica();
  const { mp4, segundos } = await renderizarReel({
    escenas: guion.escenas.map((e, i) => ({ texto: e.texto, medio: medios[i] })),
    empresa: entrada.empresa,
    cta: guion.cta,
    voz,
    musicaUrl,
  });

  return { mp4, segundos, guion, conVoz: !!voz, conMusica: !!musicaUrl };
}
