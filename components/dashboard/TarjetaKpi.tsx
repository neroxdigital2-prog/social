import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Kpi } from "@/lib/dashboard";

const ICONO_TENDENCIA = { sube: ArrowUpRight, baja: ArrowDownRight, igual: Minus };

export function TarjetaKpi({ kpi }: { kpi: Kpi }) {
  const Icono = kpi.tendencia ? ICONO_TENDENCIA[kpi.tendencia] : null;
  return (
    <a href={kpi.href} className="dsh-card dsh-kpi">
      <span className="dsh-kpi-etiqueta">{kpi.etiqueta}</span>
      <strong className="dsh-kpi-valor">{kpi.valor}</strong>
      <span className={`dsh-kpi-detalle${kpi.tendencia ? ` dsh-tend-${kpi.tendencia}` : ""}`}>
        {Icono && <Icono size={14} aria-hidden="true" />}
        {kpi.detalle}
      </span>
    </a>
  );
}
