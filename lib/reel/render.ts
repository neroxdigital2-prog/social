import { spawn } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegRuta from "ffmpeg-static";
import type { Medio } from "@/lib/reel/medios";

export const ANCHO = 1080;
export const ALTO = 1920;
const FPS = 30;
const DURACION_CTA = 2.6;
const DURACION_MAX = 45;

const FUENTE_TITULO = path.join(process.cwd(), "assets/fonts/Montserrat_800ExtraBold.ttf");
const FUENTE_TEXTO = path.join(process.cwd(), "assets/fonts/Montserrat_600SemiBold.ttf");

export interface EscenaRender {
  texto: string;
  medio: Medio;
}

export interface OpcionesRender {
  escenas: EscenaRender[];
  empresa: string;
  cta: string;
  voz?: { wav: Buffer; segundos: number } | null;
  musicaUrl?: string | null;
}

export interface ResultadoRender {
  mp4: Buffer;
  segundos: number;
}

// Parte el texto en líneas de ~maxCar caracteres (drawtext no hace saltos de línea solo)
function envolver(texto: string, maxCar: number, maxLineas: number): string {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if ((actual + " " + palabra).trim().length > maxCar && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = (actual + " " + palabra).trim();
    }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > maxLineas) {
    const recortadas = lineas.slice(0, maxLineas);
    recortadas[maxLineas - 1] = recortadas[maxLineas - 1].replace(/[\s,.;:]*$/, "…");
    return recortadas.join("\n");
  }
  return lineas.join("\n");
}

async function descargar(url: string, destino: string): Promise<void> {
  if (!/^(https:\/\/|data:image\/)/.test(url)) throw new Error("URL de medio no permitida");
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 45_000);
  try {
    const res = await fetch(url, { signal: controlador.signal });
    if (!res.ok) throw new Error(`Descarga fallida (${res.status}) de ${url.slice(0, 80)}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 120 * 1024 * 1024) throw new Error("Medio demasiado grande");
    await writeFile(destino, buf);
  } finally {
    clearTimeout(temporizador);
  }
}

function ejecutarFfmpeg(args: string[], limiteMs = 240_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegRuta) return reject(new Error("ffmpeg-static no disponible en este entorno"));
    const proceso = spawn(ffmpegRuta, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proceso.stderr.on("data", (d) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    const temporizador = setTimeout(() => {
      proceso.kill("SIGKILL");
      reject(new Error("FFmpeg superó el tiempo límite"));
    }, limiteMs);
    proceso.on("error", (e) => {
      clearTimeout(temporizador);
      reject(e);
    });
    proceso.on("close", (codigo) => {
      clearTimeout(temporizador);
      if (codigo === 0) resolve();
      else reject(new Error(`FFmpeg terminó con código ${codigo}: ${stderr.slice(-1500)}`));
    });
  });
}

function calcularDuraciones(escenas: EscenaRender[], segundosVoz: number | null): number[] {
  const n = escenas.length;
  const base = Math.min(DURACION_MAX - DURACION_CTA, Math.max(segundosVoz ? segundosVoz + 0.6 : 0, n * 3.2));
  const pesos = escenas.map((e) => Math.max(3, e.texto.split(" ").length));
  const total = pesos.reduce((a, b) => a + b, 0);
  const dur = pesos.map((p) => Math.max(1.8, (base * p) / total));
  dur[n - 1] += DURACION_CTA; // la última escena sostiene la llamada a la acción
  return dur.map((d) => Math.round(d * 100) / 100);
}

export async function renderizarReel(op: OpcionesRender): Promise<ResultadoRender> {
  if (op.escenas.length === 0) throw new Error("El Reel necesita al menos una escena");
  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));

  try {
    // 1. Descarga de medios (en paralelo)
    const archivos = await Promise.all(
      op.escenas.map(async (e, i) => {
        const ext = e.medio.tipo === "video" ? "mp4" : "jpg";
        const destino = path.join(dir, `m${i}.${ext}`);
        await descargar(e.medio.url, destino);
        return destino;
      })
    );

    const duraciones = calcularDuraciones(op.escenas, op.voz?.segundos ?? null);
    const total = duraciones.reduce((a, b) => a + b, 0);
    const inicioCta = Math.max(0, total - DURACION_CTA);

    // 2. Textos (textfile evita problemas de escape con comillas, dos puntos, %, etc.)
    for (let i = 0; i < op.escenas.length; i++) {
      await writeFile(path.join(dir, `t${i}.txt`), envolver(op.escenas[i].texto, 17, 3));
    }
    await writeFile(path.join(dir, "empresa.txt"), op.empresa.slice(0, 40));
    await writeFile(path.join(dir, "cta.txt"), envolver(op.cta, 16, 3));

    // 3. Entradas
    const args: string[] = ["-y", "-v", "error"];
    op.escenas.forEach((e, i) => {
      const d = String(duraciones[i] + 0.2);
      if (e.medio.tipo === "video") args.push("-stream_loop", "-1", "-t", d, "-i", archivos[i]);
      else args.push("-loop", "1", "-framerate", String(FPS), "-t", d, "-i", archivos[i]);
    });
    let idx = op.escenas.length;
    let idxVoz = -1;
    let idxMusica = -1;
    if (op.voz) {
      const rutaVoz = path.join(dir, "voz.wav");
      await writeFile(rutaVoz, op.voz.wav);
      args.push("-i", rutaVoz);
      idxVoz = idx++;
    }
    if (op.musicaUrl) {
      try {
        const rutaMusica = path.join(dir, "musica.mp3");
        await descargar(op.musicaUrl, rutaMusica);
        args.push("-stream_loop", "-1", "-i", rutaMusica);
        idxMusica = idx++;
      } catch (error) {
        console.error("renderizarReel: no se pudo descargar la música, sigo sin ella:", error);
      }
    }

    // 4. Vídeo: cada escena a 1080x1920 + texto animado; luego concat + marca + CTA
    const filtros: string[] = [];
    op.escenas.forEach((e, i) => {
      const d = duraciones[i];
      const encuadre =
        e.medio.tipo === "video"
          ? `scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=increase,crop=${ANCHO}:${ALTO}`
          : // foto: ligero desplazamiento tipo Ken Burns
            `scale=${Math.round(ANCHO * 1.15)}:${Math.round(ALTO * 1.15)}:force_original_aspect_ratio=increase,` +
            `crop=${Math.round(ANCHO * 1.15)}:${Math.round(ALTO * 1.15)},` +
            `crop=${ANCHO}:${ALTO}:x='(iw-ow)*min(1,t/${d})':y='(ih-oh)/2'`;
      const texto =
        `drawtext=fontfile='${FUENTE_TITULO}':textfile='${path.join(dir, `t${i}.txt`)}':expansion=none:` +
        `fontsize=82:fontcolor=white:line_spacing=14:box=1:boxcolor=black@0.42:boxborderw=26:` +
        `x=(w-text_w)/2:y='h*0.60+40*max(0,1-t/0.35)':alpha='min(1,t/0.35)'` +
        (i === op.escenas.length - 1 ? `:enable='lt(t,${(d - DURACION_CTA).toFixed(2)})'` : "");
      filtros.push(
        `[${i}:v]trim=duration=${d},setpts=PTS-STARTPTS,${encuadre},fps=${FPS},setsar=1,` +
          `eq=brightness=-0.03:saturation=1.08,${texto}[v${i}]`
      );
    });
    const etiquetas = op.escenas.map((_, i) => `[v${i}]`).join("");
    filtros.push(
      `${etiquetas}concat=n=${op.escenas.length}:v=1:a=0,` +
        `drawtext=fontfile='${FUENTE_TEXTO}':textfile='${path.join(dir, "empresa.txt")}':expansion=none:` +
        `fontsize=40:fontcolor=white:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=(w-text_w)/2:y=150,` +
        `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.55:t=fill:enable='gte(t,${inicioCta.toFixed(2)})',` +
        `drawtext=fontfile='${FUENTE_TITULO}':textfile='${path.join(dir, "cta.txt")}':expansion=none:` +
        `fontsize=92:fontcolor=white:line_spacing=16:x=(w-text_w)/2:y=(h-text_h)/2:` +
        `enable='gte(t,${inicioCta.toFixed(2)})',` +
        `format=yuv420p[v]`
    );

    // 5. Audio: voz + música con "ducking" (la música baja cuando habla la voz) y normalizado a -14 LUFS
    const fin = Math.max(0, total - 1.5).toFixed(2);
    if (idxVoz >= 0 && idxMusica >= 0) {
      filtros.push(
        `[${idxVoz}:a]adelay=300|300,aresample=48000,aformat=channel_layouts=stereo,apad,asplit[vz1][vz2]`,
        `[${idxMusica}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.30[mus]`,
        `[mus][vz1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=450[musd]`,
        `[vz2][musd]amix=inputs=2:duration=longest:normalize=0,atrim=duration=${total},afade=t=out:st=${fin}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11[a]`
      );
    } else if (idxVoz >= 0) {
      filtros.push(
        `[${idxVoz}:a]adelay=300|300,aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${total},loudnorm=I=-14:TP=-1.5:LRA=11[a]`
      );
    } else if (idxMusica >= 0) {
      filtros.push(
        `[${idxMusica}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${total},afade=t=in:d=0.8,afade=t=out:st=${fin}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11[a]`
      );
    } else {
      filtros.push(`anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${total}[a]`);
    }

    const salida = path.join(dir, "reel.mp4");
    args.push(
      "-filter_complex", filtros.join(";"),
      "-map", "[v]", "-map", "[a]",
      "-t", total.toFixed(2),
      // Especificación de Instagram Reels: H.264 High, yuv420p, 30 fps, AAC 48 kHz, moov al inicio
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-profile:v", "high", "-level", "4.1",
      "-pix_fmt", "yuv420p", "-r", String(FPS), "-g", String(FPS * 2), "-maxrate", "8M", "-bufsize", "16M",
      "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
      "-movflags", "+faststart",
      salida
    );

    await ejecutarFfmpeg(args);
    const { readFile } = await import("fs/promises");
    return { mp4: await readFile(salida), segundos: total };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
