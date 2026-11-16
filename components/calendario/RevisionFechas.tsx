"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check } from "lucide-react";
import { Desplegable } from "@/components/ui/Desplegable";

interface Pub {
  id: string;
  titulo: string;
  estado: string;
  imagenUrl: string | null;
  fechaProgramada: string | null;
}

type Motivo = "PASADA" | "ANIO" | "LEJANA" | "MADRUGADA" | "DUPLICADA";
interface Problema {
  pub: Pub;
  motivos: { tipo: Motivo; texto: string }[];
  sugerida: Date | null;
  sugeridaTexto: string;
}

const TZ = "Europe/Madrid";
const ETIQUETA: Record<Motivo, string> = {
  PASADA: "⏰ En el pasado",
  ANIO: "📅 Año equivocado",
  LEJANA: "🔭 Demasiado lejos",
  MADRUGADA: "🌙 De madrugada",
  DUPLICADA: "👯 Misma hora que otra",
};

function aFecha(s: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(" ", "T")}Z`);
}
function partes(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute };
}
/** Fecha/hora de Madrid → Date (UTC) */
function madrid(y: number, m: number, d: number, h: number, min: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const p = partes(guess);
  const diff = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess.getTime();
  return new Date(guess.getTime() - diff);
}
const texto = (d: Date) =>
  new Intl.DateTimeFormat("es-ES", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
const aInput = (d: Date) => {
  const p = partes(d);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.m)}-${z(p.d)}T${z(p.h)}:${z(p.min)}`;
};

function detectar(pubs: Pub[]): Problema[] {
  const ahora = new Date();
  const hoy = partes(ahora);
  const programadas = pubs.filter((p) => p.fechaProgramada && ["PROGRAMADA", "BORRADOR", "APROBADA"].includes(p.estado));
  const porMinuto = new Map<string, number>();
  for (const p of programadas) {
    const k = aFecha(p.fechaProgramada!).toISOString().slice(0, 16);
    porMinuto.set(k, (porMinuto.get(k) || 0) + 1);
  }

  const lista: Problema[] = [];
  for (const p of programadas) {
    const f = aFecha(p.fechaProgramada!);
    if (Number.isNaN(f.getTime())) continue;
    const t = partes(f);
    const motivos: Problema["motivos"] = [];
    let sug = { ...t };

    if (t.y !== hoy.y && Math.abs(t.y - hoy.y) >= 1 && f.getTime() - ahora.getTime() > 200 * 86400_000) {
      motivos.push({ tipo: "ANIO", texto: `Año ${t.y}: ¿querías ${hoy.y}?` });
      sug.y = hoy.y;
    } else if (t.y < hoy.y) {
      motivos.push({ tipo: "ANIO", texto: `Año ${t.y}: ya pasó` });
      sug.y = hoy.y;
    } else if (f.getTime() - ahora.getTime() > 120 * 86400_000) {
      motivos.push({ tipo: "LEJANA", texto: `Está a ${Math.round((f.getTime() - ahora.getTime()) / 86400_000)} días` });
    }
    if (t.h < 7) {
      motivos.push({ tipo: "MADRUGADA", texto: `A las ${String(t.h).padStart(2, "0")}:${String(t.min).padStart(2, "0")}: ¿querías las ${t.h + 12}:${String(t.min).padStart(2, "0")}?` });
      sug.h = t.h + 12;
    }
    if (f.getTime() < ahora.getTime() - 15 * 60_000 && p.estado === "PROGRAMADA") {
      motivos.push({ tipo: "PASADA", texto: "La fecha ya pasó y no se publicó" });
    }
    if ((porMinuto.get(f.toISOString().slice(0, 16)) || 0) > 1) {
      motivos.push({ tipo: "DUPLICADA", texto: "Hay otra publicación a la misma hora" });
    }
    if (!motivos.length) continue;

    let sugerida: Date | null = madrid(sug.y, sug.m, sug.d, sug.h, sug.min);
    // Si la sugerida sigue en el pasado: misma hora, próximo día posible
    if (sugerida.getTime() < ahora.getTime() + 10 * 60_000) {
      sugerida = madrid(hoy.y, hoy.m, hoy.d, sug.h, sug.min);
      while (sugerida.getTime() < ahora.getTime() + 10 * 60_000) sugerida = new Date(sugerida.getTime() + 86400_000);
    }
    if (sugerida.getTime() === f.getTime()) sugerida = null;
    lista.push({ pub: p, motivos, sugerida, sugeridaTexto: sugerida ? texto(sugerida) : "" });
  }
  return lista.sort((a, b) => aFecha(a.pub.fechaProgramada!).getTime() - aFecha(b.pub.fechaProgramada!).getTime());
}

export function RevisionFechas({ publicaciones }: { publicaciones: Pub[] }) {
  const router = useRouter();
  const problemas = useMemo(() => detectar(publicaciones), [publicaciones]);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<Record<string, { ok: boolean; texto: string } | "guardando">>({});
  const [masivo, setMasivo] = useState(false);

  async function programar(id: string, fecha: Date | null) {
    setEstado((e) => ({ ...e, [id]: "guardando" }));
    const res = await fetch(`/api/publicaciones/${id}/programar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fechaProgramada: fecha ? fecha.toISOString() : null }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    const ok = !!res?.ok;
    setEstado((e) => ({ ...e, [id]: { ok, texto: ok ? (fecha ? `Movida a ${texto(fecha)}` : "Pasada a borrador") : d?.error || "No se pudo cambiar." } }));
    return ok;
  }

  async function corregirTodas() {
    const conSugerencia = problemas.filter((p) => p.sugerida);
    if (!window.confirm(`¿Aplicar la fecha sugerida a ${conSugerencia.length} publicación(es)?`)) return;
    setMasivo(true);
    for (const p of conSugerencia) await programar(p.pub.id, p.sugerida);
    setMasivo(false);
    router.refresh();
  }

  async function guardarManual(id: string) {
    const v = manual[id];
    if (!v) return;
    const [f, h] = v.split("T");
    const [y, m, d] = f.split("-").map(Number);
    const [hh, mm] = h.split(":").map(Number);
    if (await programar(id, madrid(y, m, d, hh, mm))) router.refresh();
  }

  return (
    <Desplegable
      id="cal-revision"
      titulo={problemas.length ? `⚠️ Revisión de fechas (${problemas.length})` : "✅ Revisión de fechas"}
      subtitulo="Fechas que parecen un error al teclear: año equivocado, de madrugada (1:00 en vez de 13:00), ya pasadas sin publicar o repetidas a la misma hora."
      resumen={problemas.length ? `${problemas.length} por revisar` : "Todo correcto"}
      abiertoPorDefecto={problemas.length > 0}
      acciones={
        problemas.some((p) => p.sugerida) ? (
          <button type="button" className="crm-btn" onClick={corregirTodas} disabled={masivo}>
            <Check size={14} aria-hidden="true" /> {masivo ? "Corrigiendo…" : "Aplicar todas las sugerencias"}
          </button>
        ) : undefined
      }
    >
      {!problemas.length ? (
        <p className="dsh-muted">No hay fechas sospechosas en las publicaciones programadas.</p>
      ) : (
        <ul className="rv-lista">
          {problemas.map((p) => {
            const st = estado[p.pub.id];
            const f = aFecha(p.pub.fechaProgramada!);
            return (
              <li key={p.pub.id} className="rv-item">
                {p.pub.imagenUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.pub.imagenUrl} alt="" loading="lazy" />
                ) : (
                  <span className="pa-miniatura" aria-hidden="true" />
                )}
                <div className="rv-cuerpo">
                  <strong>{p.pub.titulo || "(sin título)"}</strong>
                  <span className="rv-fecha">
                    <CalendarClock size={14} aria-hidden="true" /> Programada: <b>{texto(f)}</b> · {p.pub.estado.toLowerCase()}
                  </span>
                  <span className="rs-chips">
                    {p.motivos.map((m) => (
                      <span key={m.tipo} className={`cc-chip rv-${m.tipo.toLowerCase()}`} title={m.texto}>
                        {ETIQUETA[m.tipo]}
                      </span>
                    ))}
                  </span>
                  <small className="dsh-muted">{p.motivos.map((m) => m.texto).join(" · ")}</small>
                  <div className="rv-acciones">
                    {p.sugerida && (
                      <button
                        type="button"
                        className="dsh-boton dsh-boton-mini"
                        disabled={st === "guardando"}
                        onClick={async () => (await programar(p.pub.id, p.sugerida)) && router.refresh()}
                      >
                        <Check size={14} aria-hidden="true" /> Mover a {p.sugeridaTexto}
                      </button>
                    )}
                    <label className="rv-manual">
                      <span className="sr-only">Otra fecha para {p.pub.titulo}</span>
                      <input
                        type="datetime-local"
                        value={manual[p.pub.id] ?? aInput(p.sugerida || f)}
                        onChange={(e) => setManual((m) => ({ ...m, [p.pub.id]: e.target.value }))}
                      />
                    </label>
                    <button type="button" className="dsh-boton dsh-boton-mini" disabled={st === "guardando" || !manual[p.pub.id]} onClick={() => guardarManual(p.pub.id)}>
                      Guardar fecha
                    </button>
                    <button type="button" className="dsh-boton dsh-boton-mini" disabled={st === "guardando"} onClick={async () => (await programar(p.pub.id, null)) && router.refresh()}>
                      Pasar a borrador
                    </button>
                  </div>
                  {st && st !== "guardando" && (
                    <p role="status" className={st.ok ? "rs-ok" : "rs-mal"}>
                      {st.texto}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Desplegable>
  );
}
