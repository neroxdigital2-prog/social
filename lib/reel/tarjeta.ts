// Tarjeta 9:16 (1080x1920) con texto grande sobre una foto: para historias.
// Se dibuja con FFmpeg + fuentes Montserrat incluidas (no depende de fuentes del sistema).
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { ALTO, ANCHO, FUENTE_TEXTO, FUENTE_TITULO, descargar, ejecutarFfmpeg, envolver } from "@/lib/reel/render";

export interface OpcionesTarjeta {
  fondoUrl: string | null; // foto de fondo (se oscurece); sin foto → degradado de marca
  titulo: string;
  texto?: string;
  marca: string;
  pie?: string; // CTA en franja inferior
  numero?: string; // "1/4"
}

export async function renderizarTarjeta(op: OpcionesTarjeta): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "tarjeta-"));
  try {
    const salida = path.join(dir, "tarjeta.jpg");
    await writeFile(path.join(dir, "titulo.txt"), envolver(op.titulo, 15, 5));
    await writeFile(path.join(dir, "texto.txt"), envolver(op.texto || "", 28, 5));
    await writeFile(path.join(dir, "marca.txt"), op.marca.toUpperCase());
    await writeFile(path.join(dir, "pie.txt"), envolver(op.pie || "", 30, 2));
    await writeFile(path.join(dir, "num.txt"), op.numero || "");

    const args: string[] = ["-y"];
    let tieneFondo = false;
    if (op.fondoUrl) {
      try {
        const ruta = path.join(dir, "fondo.jpg");
        await descargar(op.fondoUrl, ruta);
        args.push("-i", ruta);
        tieneFondo = true;
      } catch {
        tieneFondo = false;
      }
    }
    if (!tieneFondo) args.push("-f", "lavfi", "-i", `gradients=s=${ANCHO}x${ALTO}:c0=0x2a0a5e:c1=0x7c3aed:x0=0:y0=0:x1=${ANCHO}:y1=${ALTO}:nb_colors=2,trim=end_frame=1`);

    const t = (f: string) => path.join(dir, f);
    const filtros = [
      `scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=increase,crop=${ANCHO}:${ALTO},setsar=1`,
      tieneFondo ? "eq=brightness=-0.18:saturation=0.9" : "null",
      `drawbox=x=0:y=0:w=iw:h=ih:color=black@${tieneFondo ? "0.45" : "0.15"}:t=fill`,
      `drawtext=fontfile='${FUENTE_TEXTO}':textfile='${t("marca.txt")}':expansion=none:fontsize=38:fontcolor=white@0.9:x=(w-text_w)/2:y=170`,
      op.numero ? `drawtext=fontfile='${FUENTE_TEXTO}':textfile='${t("num.txt")}':expansion=none:fontsize=34:fontcolor=white@0.8:x=w-text_w-70:y=170` : "null",
      `drawtext=fontfile='${FUENTE_TITULO}':textfile='${t("titulo.txt")}':expansion=none:fontsize=92:fontcolor=white:line_spacing=18:x=(w-text_w)/2:y=h*0.27`,
      op.texto ? `drawtext=fontfile='${FUENTE_TEXTO}':textfile='${t("texto.txt")}':expansion=none:fontsize=50:fontcolor=white@0.95:line_spacing=14:x=(w-text_w)/2:y=h*0.53` : "null",
      op.pie
        ? `drawtext=fontfile='${FUENTE_TITULO}':textfile='${t("pie.txt")}':expansion=none:fontsize=46:fontcolor=white:line_spacing=10:box=1:boxcolor=0x7c3aed@0.95:boxborderw=30:x=(w-text_w)/2:y=h-text_h-260`
        : "null",
    ].join(",");

    args.push("-vf", filtros, "-frames:v", "1", "-q:v", "3", salida);
    await ejecutarFfmpeg(args, 60_000);
    return await readFile(salida);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
