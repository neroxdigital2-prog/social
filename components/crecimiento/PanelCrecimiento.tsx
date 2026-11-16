"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileText, RefreshCw } from "lucide-react";
import { Desplegable } from "@/components/ui/Desplegable";
import { descargarCSV, sello } from "@/lib/exportar";
import type { Informe } from "@/lib/estadisticas/analisis";

interface Punto {
  red: "INSTAGRAM" | "FACEBOOK";
  fecha: string;
  seguidores: number;
  publicaciones: number | null;
}
interface Serie {
  instalado: boolean;
  ultimaLectura: string | null;
  serie: Punto[];
}

const fmt = (n: number) => n.toLocaleString("es-ES");
const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const diaMadrid = (offset = 0) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date(Date.now() - offset * 86400_000));

function lunes(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function Kpi({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle?: string; tono?: "sube" | "baja" }) {
  return (
    <li className={tono ? `cr-kpi cr-kpi-${tono}` : "cr-kpi"}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
      {detalle && <small>{detalle}</small>}
    </li>
  );
}

export function PanelCrecimiento({ empresaId }: { empresaId?: string }) {
  const [desde, setDesde] = useState(diaMadrid(30));
  const [hasta, setHasta] = useState(diaMadrid(0));
  const [seg, setSeg] = useState<Serie | null>(null);
  const [inf, setInf] = useState<Informe | null>(null);
  const [cargando, setCargando] = useState(true);
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pdf, setPdf] = useState(false);

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setCargando(true);
    const q = `empresa=${empresaId}&desde=${desde}&hasta=${hasta}`;
    const [a, b] = await Promise.all([
      fetch(`/api/crecimiento/listar?${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/estadisticas?${q}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    setSeg(a?.serie ? a : null);
    setInf(b?.kpis ? b : null);
    if (!a?.serie) setAviso({ ok: false, texto: a?.error || "No se pudo leer el histórico de seguidores." });
    setCargando(false);
  }, [empresaId, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function leerAhora() {
    if (!empresaId) return;
    setLeyendo(true);
    setAviso(null);
    const r = await fetch("/api/crecimiento/actualizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setAviso({ ok: !!r?.ok, texto: d?.mensaje || d?.error || "No se pudo conectar con Meta." });
    setLeyendo(false);
    cargar();
  }

  async function descargarPdf() {
    if (!empresaId) return;
    setPdf(true);
    const res = await fetch(`/api/crecimiento/pdf?empresa=${empresaId}&desde=${desde}&hasta=${hasta}`).catch(() => null);
    if (res?.ok) {
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `crecimiento-${desde}-a-${hasta}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const d = await res?.json().catch(() => null);
      setAviso({ ok: false, texto: d?.error || "No se pudo generar el PDF." });
    }
    setPdf(false);
  }

  // ── Seguidores: una fila por día con IG y FB ──
  const dias = useMemo(() => {
    const mapa = new Map<string, { fecha: string; ig: number | null; fb: number | null; posts: number | null }>();
    for (const p of seg?.serie || []) {
      const f = mapa.get(p.fecha) || { fecha: p.fecha, ig: null, fb: null, posts: null };
      if (p.red === "INSTAGRAM") {
        f.ig = p.seguidores;
        f.posts = p.publicaciones;
      } else f.fb = p.seguidores;
      mapa.set(p.fecha, f);
    }
    const l = [...mapa.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    let prevIg: number | null = null;
    let prevFb: number | null = null;
    return l.map((d) => {
      const fila = { ...d, etiqueta: ddmm(d.fecha), dIg: d.ig !== null && prevIg !== null ? d.ig - prevIg : null, dFb: d.fb !== null && prevFb !== null ? d.fb - prevFb : null };
      if (d.ig !== null) prevIg = d.ig;
      if (d.fb !== null) prevFb = d.fb;
      return fila;
    });
  }, [seg]);

  const resumenRed = (clave: "ig" | "fb") => {
    const v = dias.map((d) => d[clave]).filter((x): x is number => x !== null);
    if (!v.length) return null;
    return { actual: v[v.length - 1], inicio: v[0], dif: v[v.length - 1] - v[0], pct: v[0] ? ((v[v.length - 1] - v[0]) / v[0]) * 100 : null };
  };
  const ig = resumenRed("ig");
  const fb = resumenRed("fb");

  // ── Rendimiento real de las publicaciones por semana ──
  const semanas = useMemo(() => {
    const mapa = new Map<string, { semana: string; publicadas: number; alcance: number; interacciones: number; conDatos: number; tasaSuma: number; nuevosIg: number | null }>();
    for (const p of inf?.publicaciones || []) {
      if (!p.fecha || !["PUBLICADA", "PARCIAL"].includes(p.resultado)) continue;
      const s = lunes(p.fecha.slice(0, 10));
      const f = mapa.get(s) || { semana: s, publicadas: 0, alcance: 0, interacciones: 0, conDatos: 0, tasaSuma: 0, nuevosIg: null };
      f.publicadas++;
      f.alcance += p.alcance;
      f.interacciones += p.meGusta + p.comentarios + p.compartidos + p.guardados;
      if (p.tasa !== null) {
        f.conDatos++;
        f.tasaSuma += p.tasa;
      }
      mapa.set(s, f);
    }
    for (const d of dias) {
      if (d.dIg === null) continue;
      const s = lunes(d.fecha);
      const f = mapa.get(s) || { semana: s, publicadas: 0, alcance: 0, interacciones: 0, conDatos: 0, tasaSuma: 0, nuevosIg: null };
      f.nuevosIg = (f.nuevosIg ?? 0) + d.dIg;
      mapa.set(s, f);
    }
    return [...mapa.values()]
      .sort((a, b) => (a.semana < b.semana ? -1 : 1))
      .map((s) => ({ ...s, etiqueta: `Sem ${ddmm(s.semana)}`, tasa: s.conDatos ? Math.round((s.tasaSuma / s.conDatos) * 10) / 10 : null }));
  }, [inf, dias]);

  const k = inf?.kpis;
  const diasPeriodo = Math.max(1, Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400_000) + 1);
  const ritmo = ig ? Math.round((ig.dif / diasPeriodo) * 7 * 10) / 10 : null;

  function exportar() {
    descargarCSV(
      `crecimiento-${sello()}.csv`,
      ["Fecha", "Seguidores Instagram", "Cambio IG", "Seguidores Facebook", "Cambio FB", "Publicaciones en Instagram"],
      dias.map((d) => [d.fecha, d.ig ?? "", d.dIg ?? "", d.fb ?? "", d.dFb ?? "", d.posts ?? ""])
    );
  }

  if (!empresaId) return <p className="text-muted">Selecciona una empresa arriba para ver su crecimiento.</p>;

  return (
    <div className="rs">
      <div className="rs-filtros">
        <label>
          <span>Desde</span>
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <div className="rs-rapidos">
          {[7, 30, 90, 365].map((n) => (
            <button key={n} type="button" className="crm-btn" onClick={() => { setDesde(diaMadrid(n)); setHasta(diaMadrid(0)); }}>
              {n} días
            </button>
          ))}
        </div>
        <button type="button" className="crm-btn" onClick={leerAhora} disabled={leyendo} title="Consulta ahora a Meta los seguidores reales">
          <RefreshCw size={14} aria-hidden="true" className={leyendo ? "dsh-girando" : undefined} /> {leyendo ? "Leyendo de Meta…" : "Leer ahora de Meta"}
        </button>
        <button type="button" className="crm-btn" onClick={descargarPdf} disabled={pdf || !dias.length}>
          <FileText size={14} aria-hidden="true" /> {pdf ? "Generando…" : "PDF"}
        </button>
        <button type="button" className="crm-btn" onClick={exportar} disabled={!dias.length}>
          <Download size={14} aria-hidden="true" /> Excel
        </button>
      </div>

      {aviso && (
        <p role="status" className={aviso.ok ? "dsh-alerta" : "dsh-alerta dsh-alerta-error"}>
          {aviso.texto}
        </p>
      )}
      {seg && !seg.instalado && (
        <p role="alert" className="dsh-alerta dsh-alerta-error">
          Falta instalar el registro diario de seguidores: ejecuta <code>estadisticas.sql</code> y sube <code>estadisticas.php</code> a IONOS.
        </p>
      )}
      <p className="dsh-muted">
        Datos reales leídos de la API de Meta cada hora por el vigilante
        {seg?.ultimaLectura ? ` · última lectura ${seg.ultimaLectura.slice(8, 10)}/${seg.ultimaLectura.slice(5, 7)} ${seg.ultimaLectura.slice(11, 16)}` : ""}.
      </p>

      <Desplegable id="cr-resumen" titulo="📌 Resumen del periodo" abiertoPorDefecto>
        {cargando && !seg ? (
          <p className="dsh-muted">Cargando…</p>
        ) : (
          <ul className="cr-kpis">
            <Kpi
              titulo="Seguidores Instagram"
              valor={ig ? fmt(ig.actual) : "—"}
              detalle={ig ? `${ig.dif >= 0 ? "+" : ""}${fmt(ig.dif)}${ig.pct !== null ? ` (${ig.pct.toFixed(1)}%)` : ""} en el periodo` : "Sin lecturas todavía"}
              tono={ig ? (ig.dif > 0 ? "sube" : ig.dif < 0 ? "baja" : undefined) : undefined}
            />
            <Kpi
              titulo="Seguidores Facebook"
              valor={fb ? fmt(fb.actual) : "—"}
              detalle={fb ? `${fb.dif >= 0 ? "+" : ""}${fmt(fb.dif)} en el periodo` : "Sin lecturas todavía"}
              tono={fb ? (fb.dif > 0 ? "sube" : fb.dif < 0 ? "baja" : undefined) : undefined}
            />
            <Kpi titulo="Ritmo Instagram" valor={ritmo !== null ? `${ritmo >= 0 ? "+" : ""}${ritmo}/sem` : "—"} detalle="seguidores nuevos por semana" />
            <Kpi titulo="Publicadas" valor={k ? fmt(k.publicadas) : "—"} detalle={k ? `${fmt(k.conError)} con error · ${fmt(k.programadas)} programadas` : undefined} />
            <Kpi titulo="Alcance total" valor={k ? fmt(k.alcanceTotal) : "—"} detalle={k ? `${fmt(k.alcanceMedio)} de media por publicación` : undefined} />
            <Kpi titulo="Interacción media" valor={k?.tasaMedia != null ? `${k.tasaMedia}%` : "—"} detalle={k ? `${fmt(k.guardados)} guardados · ${fmt(k.compartidos)} compartidos` : undefined} />
            <Kpi
              titulo="Coste por seguidor"
              valor={ig && ig.dif > 0 && k?.publicadas ? `${(k.publicadas / ig.dif).toFixed(1)} publ.` : "—"}
              detalle="publicaciones necesarias por cada seguidor nuevo"
            />
          </ul>
        )}
      </Desplegable>

      <Desplegable id="cr-seguidores" titulo="📈 Evolución de seguidores" subtitulo="Instagram y Facebook, un dato real por día." abiertoPorDefecto>
        {dias.length < 2 ? (
          <p className="dsh-muted">
            {dias.length === 1 ? "Solo hay una lectura: la gráfica aparece a partir del segundo día." : "Todavía no hay lecturas en este rango. Pulsa «Leer ahora de Meta» para guardar la primera."}
          </p>
        ) : (
          <div className="cr-grafica" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dias} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e5e7)" vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} minTickGap={16} />
                <YAxis yAxisId="ig" tick={{ fontSize: 11 }} width={48} domain={["dataMin - 2", "dataMax + 2"]} allowDecimals={false} />
                <YAxis yAxisId="fb" orientation="right" tick={{ fontSize: 11 }} width={48} domain={["dataMin - 2", "dataMax + 2"]} allowDecimals={false} hide={!fb} />
                <Tooltip formatter={(v, n) => [fmt(Number(v) || 0), String(n)]} labelFormatter={(l) => `Día ${l}`} />
                <Legend />
                <Line yAxisId="ig" type="monotone" dataKey="ig" name="Instagram" stroke="#7c3aed" strokeWidth={2.5} dot={false} connectNulls />
                {fb && <Line yAxisId="fb" type="monotone" dataKey="fb" name="Facebook" stroke="#2563eb" strokeWidth={2} dot={false} connectNulls />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Desplegable>

      <Desplegable
        id="cr-semanas"
        titulo="📊 ¿Las publicaciones traen seguidores?"
        subtitulo="Por semana: publicaciones hechas, alcance real y seguidores ganados en Instagram."
        abiertoPorDefecto
      >
        {!semanas.length ? (
          <p className="dsh-muted">Sin publicaciones ni lecturas en este rango.</p>
        ) : (
          <>
            <div className="cr-grafica" style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={semanas} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e5e7)" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="a" tick={{ fontSize: 11 }} width={52} />
                  <YAxis yAxisId="b" orientation="right" tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
                  <Tooltip formatter={(v, n) => [fmt(Number(v) || 0), String(n)]} />
                  <Legend />
                  <Bar yAxisId="a" dataKey="alcance" name="Alcance" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="b" type="monotone" dataKey="publicadas" name="Publicadas" stroke="#0f766e" strokeWidth={2} />
                  <Line yAxisId="b" type="monotone" dataKey="nuevosIg" name="Seguidores nuevos IG" stroke="#7c3aed" strokeWidth={2.5} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="cc-tabla-scroll">
              <table className="cc-tabla">
                <thead>
                  <tr>
                    <th scope="col">Semana</th>
                    <th scope="col">Publicadas</th>
                    <th scope="col">Alcance</th>
                    <th scope="col">Interacciones</th>
                    <th scope="col">Interacción %</th>
                    <th scope="col">Seguidores IG</th>
                  </tr>
                </thead>
                <tbody>
                  {[...semanas].reverse().map((s) => (
                    <tr key={s.semana}>
                      <th scope="row">{s.etiqueta}</th>
                      <td>{s.publicadas}</td>
                      <td>{fmt(s.alcance)}</td>
                      <td>{fmt(s.interacciones)}</td>
                      <td>{s.tasa !== null ? `${s.tasa}%` : "—"}</td>
                      <td className={s.nuevosIg === null ? undefined : s.nuevosIg > 0 ? "rs-ok" : s.nuevosIg < 0 ? "rs-mal" : undefined}>
                        {s.nuevosIg === null ? "—" : `${s.nuevosIg > 0 ? "+" : ""}${s.nuevosIg}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="dsh-muted">
              Detalle por criterio (formato, tipo, hora, palabra clave…) en <a href={`/resultados?empresa=${empresaId}`}>📊 Resultados</a>.
            </p>
          </>
        )}
      </Desplegable>

      <Desplegable id="cr-diario" titulo="🗓️ Detalle diario" resumen={dias.length ? `${dias.length} día(s) con datos` : undefined}>
        {!dias.length ? (
          <p className="dsh-muted">Sin lecturas.</p>
        ) : (
          <div className="cc-tabla-scroll">
            <table className="cc-tabla">
              <thead>
                <tr>
                  <th scope="col">Día</th>
                  <th scope="col">Instagram</th>
                  <th scope="col">Cambio</th>
                  <th scope="col">Facebook</th>
                  <th scope="col">Cambio</th>
                  <th scope="col">Posts IG</th>
                </tr>
              </thead>
              <tbody>
                {[...dias].reverse().map((d) => (
                  <tr key={d.fecha}>
                    <th scope="row">{d.fecha.split("-").reverse().join("/")}</th>
                    <td>{d.ig !== null ? fmt(d.ig) : "—"}</td>
                    <td className={d.dIg ? (d.dIg > 0 ? "rs-ok" : "rs-mal") : undefined}>{d.dIg === null ? "—" : `${d.dIg > 0 ? "+" : ""}${d.dIg}`}</td>
                    <td>{d.fb !== null ? fmt(d.fb) : "—"}</td>
                    <td className={d.dFb ? (d.dFb > 0 ? "rs-ok" : "rs-mal") : undefined}>{d.dFb === null ? "—" : `${d.dFb > 0 ? "+" : ""}${d.dFb}`}</td>
                    <td>{d.posts ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Desplegable>
    </div>
  );
}
