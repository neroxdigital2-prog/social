"use client";

import { useCallback, useEffect, useState } from "react";
import { AGENTES } from "@/lib/agentes";

interface Fila { agente: string; dia: string; muestras: number; ok: number; avisos: number; errores: number }

const fmt = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
const hace = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };

/** Lunes de la semana de una fecha YYYY-MM-DD. */
function lunes(dia: string) {
  const d = new Date(dia + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return fmt(d);
}

function etiqueta(clave: string, modo: "dias" | "semanas") {
  const t = `${clave.slice(8, 10)}/${clave.slice(5, 7)}`;
  return modo === "semanas" ? `Sem ${t}` : t;
}

export function HistorialDisponibilidad() {
  const [desde, setDesde] = useState(hace(29));
  const [hasta, setHasta] = useState(hace(0));
  const [modo, setModo] = useState<"dias" | "semanas">("dias");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!desde || !hasta || desde > hasta) return setError("Rango no válido");
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/centro/disponibilidad?desde=${desde}&hasta=${hasta}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo cargar el historial.");
      setFilas((await res.json()).filas || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const preset = (n: number) => { setDesde(hace(n - 1)); setHasta(hace(0)); };

  const acum = new Map<string, { muestras: number; ok: number; avisos: number; errores: number }>();
  const claves = new Set<string>();
  for (const f of filas) {
    const c = modo === "semanas" ? lunes(f.dia) : f.dia;
    claves.add(c);
    const k = `${f.agente}|${c}`;
    const a = acum.get(k) || { muestras: 0, ok: 0, avisos: 0, errores: 0 };
    a.muestras += f.muestras; a.ok += f.ok; a.avisos += f.avisos; a.errores += f.errores;
    acum.set(k, a);
  }
  const cols = [...claves].sort();

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", margin: "8px 0" }}>
        {[7, 30, 90, 180].map((n) => <button key={n} type="button" className="dsh-btn" onClick={() => preset(n)}>{n} días</button>)}
        <label>Desde <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></label>
        <label>Hasta <input type="date" value={hasta} min={desde} max={hace(0)} onChange={(e) => setHasta(e.target.value)} /></label>
        <label>Ver por{" "}
          <select value={modo} onChange={(e) => setModo(e.target.value as "dias" | "semanas")}>
            <option value="dias">Días</option>
            <option value="semanas">Semanas</option>
          </select>
        </label>
      </div>
      {error && <p className="dsh-muted" role="alert">{error}</p>}
      {cargando && <p className="dsh-muted">Cargando…</p>}
      {!cargando && !error && cols.length === 0 && <p className="dsh-muted">Sin datos en ese rango.</p>}
      {cols.length > 0 && (
        <div className="cc-tabla-scroll">
          <table className="cc-tabla cc-disp">
            <thead>
              <tr>
                <th scope="col">Agente</th>
                {cols.map((c) => <th key={c} scope="col">{etiqueta(c, modo)}</th>)}
                <th scope="col">Media</th>
              </tr>
            </thead>
            <tbody>
              {AGENTES.map((a) => {
                let m = 0, o = 0;
                return (
                  <tr key={a.id}>
                    <th scope="row"><span aria-hidden="true">{a.icono}</span> {a.nombre}</th>
                    {cols.map((c) => {
                      const x = acum.get(`${a.id}|${c}`);
                      if (x) { m += x.muestras; o += x.ok; }
                      const pct = x && x.muestras ? Math.round((x.ok / x.muestras) * 1000) / 10 : null;
                      const nivel = pct === null ? "nd" : pct >= 99 ? "ok" : pct >= 90 ? "aviso" : "error";
                      return (
                        <td key={c}>
                          <span className={`cc-celda cc-celda-${nivel}`} title={x ? `${x.muestras} revisiones · ${x.avisos} avisos · ${x.errores} errores` : "Sin datos"}>
                            {pct !== null ? `${pct}%` : "—"}
                          </span>
                        </td>
                      );
                    })}
                    <td><strong>{m ? `${Math.round((o / m) * 1000) / 10}%` : "—"}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
