"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PuntoActividad } from "@/lib/dashboard";

const SERIES = [
  { clave: "publicadas", nombre: "Publicaciones", color: "var(--dsh-serie-1)" },
  { clave: "leads", nombre: "Leads", color: "var(--dsh-serie-2)" },
] as const;

type Clave = (typeof SERIES)[number]["clave"];

export function GraficaActividad({ datos }: { datos: PuntoActividad[] }) {
  const [visibles, setVisibles] = useState<Record<Clave, boolean>>({ publicadas: true, leads: true });
  const totales = {
    publicadas: datos.reduce((s, d) => s + d.publicadas, 0),
    leads: datos.reduce((s, d) => s + d.leads, 0),
  };

  return (
    <section className="dsh-card dsh-grafica" aria-labelledby="dsh-grafica-titulo">
      <header className="dsh-card-header">
        <div>
          <h2 id="dsh-grafica-titulo">Actividad</h2>
          <p className="dsh-muted">Últimos 30 días</p>
        </div>
        <div className="dsh-leyenda" role="group" aria-label="Series visibles">
          {SERIES.map((s) => (
            <button
              key={s.clave}
              type="button"
              className="dsh-leyenda-item"
              aria-pressed={visibles[s.clave]}
              onClick={() => setVisibles((v) => ({ ...v, [s.clave]: !v[s.clave] }))}
            >
              <span className="dsh-punto" style={{ background: s.color }} aria-hidden="true" />
              {s.nombre}
              <strong>{totales[s.clave]}</strong>
            </button>
          ))}
        </div>
      </header>
      <div className="dsh-grafica-lienzo">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.clave} id={`dsh-grad-${s.clave}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--dsh-borde)" />
            <XAxis dataKey="dia" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} fontSize={12} stroke="var(--color-text-muted)" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-text-muted)" />
            <Tooltip
              cursor={{ stroke: "var(--dsh-borde-fuerte)" }}
              contentStyle={{ borderRadius: 10, border: "1px solid var(--dsh-borde)", boxShadow: "var(--shadow-card)", fontSize: 13 }}
            />
            {SERIES.filter((s) => visibles[s.clave]).map((s) => (
              <Area
                key={s.clave}
                type="monotone"
                dataKey={s.clave}
                name={s.nombre}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#dsh-grad-${s.clave})`}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
