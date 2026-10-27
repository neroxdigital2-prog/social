import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { Alerta } from "@/lib/dashboard";

export function PanelAlertas({ alertas }: { alertas: Alerta[] }) {
  return (
    <section className="dsh-card" aria-labelledby="dsh-alertas-titulo">
      <header className="dsh-card-header">
        <h2 id="dsh-alertas-titulo">Alertas</h2>
        {alertas.length > 0 && <span className="dsh-badge">{alertas.length}</span>}
      </header>
      {alertas.length === 0 ? (
        <p className="dsh-vacio dsh-ok"><CheckCircle2 size={18} aria-hidden="true" /> Todo en orden</p>
      ) : (
        <ul className="dsh-lista">
          {alertas.map((a, i) => {
            const Icono = a.nivel === "error" ? XCircle : AlertTriangle;
            return (
              <li key={i}>
                <a href={a.href} className={`dsh-alerta dsh-alerta-${a.nivel}`}>
                  <Icono size={16} aria-hidden="true" />
                  <span>{a.texto}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
