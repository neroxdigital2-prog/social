"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, RefreshCw, XCircle } from "lucide-react";
import type { EstadoRed } from "@/lib/dashboard";
import { DetalleIncidencia } from "@/components/dashboard/DetalleIncidencia";
import { marcarResueltaEnNavegador } from "@/lib/alertasResueltas";
import type { Diagnostico } from "@/lib/diagnosticoRedes";

interface ResultadoVerificacion {
  red: string;
  ok: boolean | null;
  mensaje: string;
  diagnostico?: Diagnostico;
}

const TEXTO_ESTADO: Record<EstadoRed["estado"], string> = {
  ok: "Activa",
  error: "Con errores",
  aviso: "Revisar",
  off: "No conectada",
};

export function EstadoRedes({ redes, empresaId }: { redes: EstadoRed[]; empresaId: string }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [comprobando, setComprobando] = useState(false);
  const [verificacion, setVerificacion] = useState<Record<string, ResultadoVerificacion>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [refrescando, startTransition] = useTransition();

  async function comprobar() {
    setComprobando(true);
    setErrorGeneral(null);
    try {
      const res = await fetch(`/api/redes/verificar?empresa=${empresaId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo comprobar las conexiones.");
      const mapa: Record<string, ResultadoVerificacion> = {};
      for (const r of data.resultados as ResultadoVerificacion[]) mapa[r.red] = r;
      setVerificacion(mapa);

      // Si la conexión ya funciona y el último fallo era de conexión, se da por resuelto
      for (const red of redes) {
        if (mapa[red.red]?.ok && red.incidencia?.diagnostico.ambito === "conexion" && red.claveAlerta && red.firmaAlerta) {
          marcarResueltaEnNavegador(red.claveAlerta, red.firmaAlerta);
        }
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErrorGeneral(e instanceof Error ? e.message : "No se pudo comprobar las conexiones.");
    } finally {
      setComprobando(false);
    }
  }

  function marcarResuelta(red: EstadoRed) {
    if (!red.claveAlerta || !red.firmaAlerta) return;
    marcarResueltaEnNavegador(red.claveAlerta, red.firmaAlerta);
    setAbierta(null);
    startTransition(() => router.refresh());
  }

  const ocupado = comprobando || refrescando;

  return (
    <section className="dsh-card" aria-labelledby="dsh-redes-titulo" aria-busy={ocupado}>
      <header className="dsh-card-header">
        <h2 id="dsh-redes-titulo">Redes</h2>
        <div className="dsh-cabecera-acciones">
          <button type="button" className="dsh-boton dsh-boton-mini" onClick={comprobar} disabled={ocupado}>
            <RefreshCw size={14} aria-hidden="true" className={ocupado ? "dsh-girando" : undefined} />
            {comprobando ? "Comprobando…" : "Comprobar conexiones"}
          </button>
          <a className="dsh-enlace" href={`/configuracion?empresa=${empresaId}`}>Gestionar</a>
        </div>
      </header>

      {errorGeneral && (
        <p role="alert" className="dsh-alerta dsh-alerta-error">
          <XCircle size={16} aria-hidden="true" />
          <span>{errorGeneral}</span>
        </p>
      )}

      <ul className="dsh-lista">
        {redes.map((r) => {
          const v = verificacion[r.red];
          const expandible = r.estado !== "ok" || !!v;
          const id = `dsh-red-${r.red}`;
          const estaAbierta = abierta === r.red;
          return (
            <li key={r.red} className="dsh-red">
              <button
                type="button"
                className="dsh-fila dsh-fila-compacta dsh-fila-boton"
                aria-expanded={expandible ? estaAbierta : undefined}
                aria-controls={expandible ? id : undefined}
                onClick={() => expandible && setAbierta(estaAbierta ? null : r.red)}
                disabled={!expandible}
              >
                <span className={`dsh-estado dsh-estado-${r.estado}`} aria-hidden="true" />
                <span className="dsh-fila-texto">
                  <strong>{r.nombre}</strong>
                  <span className="dsh-muted">{r.cuenta || TEXTO_ESTADO[r.estado]}</span>
                </span>
                <span className={`dsh-etiqueta-estado dsh-etiqueta-${r.estado}`}>{TEXTO_ESTADO[r.estado]}</span>
                {expandible && <ChevronDown size={16} aria-hidden="true" className="dsh-chevron" />}
              </button>

              {expandible && estaAbierta && (
                <div id={id} className="dsh-red-detalle">
                  {v && (
                    <p className={`dsh-verificacion ${v.ok ? "dsh-verif-ok" : v.ok === false ? "dsh-verif-error" : ""}`}>
                      {v.ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
                      <span>
                        <strong>Comprobación en vivo:</strong> {v.ok === false ? v.diagnostico?.titulo || v.mensaje : v.mensaje}
                      </span>
                    </p>
                  )}

                  {r.incidencia ? (
                    <>
                      <p className="dsh-detalle-cabecera">{r.incidencia.diagnostico.titulo}</p>
                      <DetalleIncidencia incidencia={r.incidencia} empresaId={empresaId} />
                      <button type="button" className="dsh-boton dsh-boton-mini dsh-boton-resolver" onClick={() => marcarResuelta(r)}>
                        <CheckCircle2 size={14} aria-hidden="true" /> Ya lo he corregido
                      </button>
                    </>
                  ) : r.estado === "off" ? (
                    <p className="dsh-muted">
                      No conectada. <a className="dsh-enlace" href={`/configuracion?empresa=${empresaId}`}>Conectar en Configuración</a>
                    </p>
                  ) : v?.ok === false && v.diagnostico ? (
                    <div className="dsh-detalle">
                      <p className="dsh-muted">{v.diagnostico.causa}</p>
                      <ol className="dsh-pasos">
                        {v.diagnostico.pasos.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
