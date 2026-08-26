"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Snapshot {
  fecha: string;
  seguidores: number;
  publicaciones: number | null;
}

function fechaHaceNDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatearNumero(n: number): string {
  return n.toLocaleString("es-ES");
}

function ChartSkeleton() {
  return <div className="na-skeleton" style={{ height: 320, borderRadius: "var(--radius-lg)" }} aria-hidden="true" />;
}

interface PuntoGrafica {
  fecha: string;
  fechaCompleta: string;
  seguidores: number;
  deltaDiario: number | null;
}

function TooltipPersonalizado({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const punto: PuntoGrafica = payload[0].payload;
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e5e7",
        borderRadius: 10,
        padding: "0.6rem 0.9rem",
        boxShadow: "var(--shadow-card-hover)",
        fontSize: "0.85rem",
      }}
    >
      <div style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", marginBottom: 2 }}>{punto.fechaCompleta}</div>
      <div style={{ fontWeight: 700 }}>{formatearNumero(punto.seguidores)} seguidores</div>
      {punto.deltaDiario !== null && (
        <div style={{ color: punto.deltaDiario >= 0 ? "var(--color-success)" : "var(--color-error)", fontSize: "0.8rem" }}>
          {punto.deltaDiario >= 0 ? "+" : ""}
          {punto.deltaDiario} vs. día anterior
        </div>
      )}
    </div>
  );
}

export function PanelCrecimiento({ empresaId }: { empresaId?: string }) {
  const [desde, setDesde] = useState(fechaHaceNDias(30));
  const [hasta, setHasta] = useState(fechaHaceNDias(0));
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [crecimiento, setCrecimiento] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  async function cargar() {
    if (!empresaId) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/crecimiento/listar?empresa=${empresaId}&desde=${desde}&hasta=${hasta}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error || `Error HTTP ${res.status} al cargar el histórico.`);
        setCargando(false);
        return;
      }
      setSnapshots(data.snapshots || []);
      setCrecimiento(data.crecimientoAbsoluto ?? null);
    } catch (e: any) {
      setError("No se pudo conectar con el servidor: " + (e?.message || "error desconocido"));
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, desde, hasta]);

  async function descargarPdf() {
    if (!empresaId) return;
    setGenerandoPdf(true);
    try {
      const res = await fetch(`/api/crecimiento/pdf?empresa=${empresaId}&desde=${desde}&hasta=${hasta}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "No se pudo generar el PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crecimiento-instagram-${desde}-a-${hasta}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerandoPdf(false);
    }
  }

  if (!empresaId) {
    return <p className="text-muted">Selecciona una empresa arriba para ver su crecimiento.</p>;
  }

  const datosGrafica: PuntoGrafica[] = snapshots.map((s, i) => ({
    fecha: s.fecha.slice(5),
    fechaCompleta: s.fecha,
    seguidores: s.seguidores,
    deltaDiario: i > 0 ? s.seguidores - snapshots[i - 1].seguidores : null,
  }));

  const primerSeguidores = snapshots[0]?.seguidores;
  const porcentajeCrecimiento =
    crecimiento !== null && primerSeguidores ? ((crecimiento / primerSeguidores) * 100).toFixed(1) : null;

  return (
    <div>
      {/* Selector de fechas + exportar PDF - barra flotante */}
      <div
        className="na-barra-flotante"
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: 4 }}>Desde</label>
          <input type="date" className="na-input" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: 4 }}>Hasta</label>
          <input type="date" className="na-input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary" onClick={() => { setDesde(fechaHaceNDias(7)); setHasta(fechaHaceNDias(0)); }}>
          7 días
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setDesde(fechaHaceNDias(30)); setHasta(fechaHaceNDias(0)); }}>
          30 días
        </button>
        <button type="button" className="btn-secondary" onClick={() => { setDesde(fechaHaceNDias(90)); setHasta(fechaHaceNDias(0)); }}>
          90 días
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn-primary" onClick={descargarPdf} disabled={generandoPdf || snapshots.length === 0}>
          {generandoPdf ? "Generando…" : "📄 Descargar informe PDF"}
        </button>
      </div>

      {error && <p className="field-error">{error}</p>}

      {cargando && <ChartSkeleton />}

      {!cargando && !error && snapshots.length === 0 && (
        <p className="text-muted">
          Todavía no hay datos de seguidores guardados para este rango de fechas. El cron diario empieza a acumular
          histórico automáticamente a partir de hoy — vuelve mañana para ver la primera gráfica.
        </p>
      )}

      {!cargando && !error && snapshots.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            {crecimiento !== null && (
              <div className="na-card" style={{ display: "inline-block" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600 }}>
                  CRECIMIENTO EN EL PERIODO
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: crecimiento >= 0 ? "var(--color-success)" : "var(--color-error)" }}>
                  {crecimiento >= 0 ? "+" : ""}
                  {formatearNumero(crecimiento)} seguidores
                </div>
              </div>
            )}
            {porcentajeCrecimiento !== null && (
              <div className="na-card" style={{ display: "inline-block" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 600 }}>% DE CRECIMIENTO</div>
                <div
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: 700,
                    color: parseFloat(porcentajeCrecimiento) >= 0 ? "var(--color-success)" : "var(--color-error)",
                  }}
                >
                  {parseFloat(porcentajeCrecimiento) >= 0 ? "+" : ""}
                  {porcentajeCrecimiento}%
                </div>
              </div>
            )}
          </div>

          <div className="na-card" style={{ height: 340, padding: "1.5rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datosGrafica} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradienteSeguidores" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="fecha" tick={{ fontSize: 12, fill: "var(--color-text-muted)" }} />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                  width={55}
                  tickFormatter={(v) => formatearNumero(v)}
                />
                <Tooltip content={<TooltipPersonalizado />} />
                <Area
                  type="monotone"
                  dataKey="seguidores"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  fill="url(#gradienteSeguidores)"
                  dot={{ r: 3, fill: "var(--color-primary)" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
