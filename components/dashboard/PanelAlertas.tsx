"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw, RotateCcw, X, XCircle } from "lucide-react";
import type { Alerta } from "@/lib/dashboard";
import { DetalleIncidencia } from "@/components/dashboard/DetalleIncidencia";
import { marcarResueltaEnNavegador, restaurarResueltasEnNavegador } from "@/lib/alertasResueltas";

export function PanelAlertas({
  alertas,
  ocultas,
  empresaId,
}: {
  alertas: Alerta[];
  ocultas: number;
  empresaId: string;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function refrescar() {
    startTransition(() => router.refresh());
  }

  function descartar(a: Alerta) {
    marcarResueltaEnNavegador(a.clave, a.firma);
    setAbierta(null);
    refrescar();
  }

  function restaurar() {
    restaurarResueltasEnNavegador(`${empresaId}|`);
    refrescar();
  }

  return (
    <section className="dsh-card" aria-labelledby="dsh-alertas-titulo" aria-busy={pendiente}>
      <header className="dsh-card-header">
        <h2 id="dsh-alertas-titulo">
          Alertas {alertas.length > 0 && <span className="dsh-badge">{alertas.length}</span>}
        </h2>
        <button type="button" className="dsh-boton dsh-boton-mini" onClick={refrescar} disabled={pendiente}>
          <RefreshCw size={14} aria-hidden="true" className={pendiente ? "dsh-girando" : undefined} />
          {pendiente ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      {alertas.length === 0 ? (
        <p className="dsh-vacio dsh-ok">
          <CheckCircle2 size={18} aria-hidden="true" /> Todo en orden
        </p>
      ) : (
        <ul className="dsh-lista">
          {alertas.map((a) => {
            const Icono = a.nivel === "error" ? XCircle : AlertTriangle;
            const id = `dsh-alerta-${a.clave.replace(/[^a-zA-Z0-9]/g, "-")}`;
            const estaAbierta = abierta === a.clave;
            return (
              <li key={a.clave} className={`dsh-alerta-item dsh-alerta-${a.nivel}`}>
                <div className="dsh-alerta-fila">
                  <button
                    type="button"
                    className="dsh-alerta"
                    aria-expanded={estaAbierta}
                    aria-controls={id}
                    onClick={() => setAbierta(estaAbierta ? null : a.clave)}
                  >
                    <Icono size={16} aria-hidden="true" />
                    <span>{a.texto}</span>
                    <ChevronDown size={16} aria-hidden="true" className="dsh-chevron" />
                  </button>
                  <button
                    type="button"
                    className="dsh-descartar"
                    aria-label={`Descartar alerta: ${a.texto}`}
                    title="Descartar (vuelve a aparecer si el problema se repite)"
                    onClick={() => descartar(a)}
                    disabled={pendiente}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>

                {estaAbierta && (
                  <div id={id} className="dsh-alerta-detalle">
                    {a.incidencia ? (
                      <DetalleIncidencia incidencia={a.incidencia} empresaId={empresaId} />
                    ) : (
                      <div className="dsh-detalle">
                        {a.detalle && <p>{a.detalle}</p>}
                        <div className="dsh-acciones-detalle">
                          <a href={a.href} className="dsh-boton dsh-boton-mini">Ir a solucionarlo</a>
                        </div>
                      </div>
                    )}
                    <button type="button" className="dsh-boton dsh-boton-mini dsh-boton-resolver" onClick={() => descartar(a)}>
                      <CheckCircle2 size={14} aria-hidden="true" /> Marcar como resuelta
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {ocultas > 0 && (
        <button type="button" className="dsh-enlace dsh-restaurar" onClick={restaurar} disabled={pendiente}>
          <RotateCcw size={13} aria-hidden="true" /> Mostrar {ocultas} alerta{ocultas > 1 ? "s" : ""} descartada{ocultas > 1 ? "s" : ""}
        </button>
      )}
    </section>
  );
}
