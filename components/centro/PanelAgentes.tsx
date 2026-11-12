"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, RefreshCw, X } from "lucide-react";
import { TEXTO_ESTADO, fechaHoraBD, haceTiempo } from "@/lib/agentes";
import { IncidenciaTarjeta } from "@/components/centro/IncidenciaTarjeta";
import type { AgenteVista, DatosCentro, IncidenciaVista } from "@/components/centro/tipos";

const LUZ: Record<AgenteVista["estado"], string> = { OK: "ok", AVISO: "aviso", ERROR: "error", OFF: "off" };

function DetalleAgente({ agente, onCerrar, onCambio }: { agente: AgenteVista; onCerrar: () => void; onCambio: () => void }) {
  const [incidencias, setIncidencias] = useState<IncidenciaVista[] | null>(null);
  const [resueltas, setResueltas] = useState<IncidenciaVista[]>([]);

  const cargar = useCallback(async () => {
    const [p, r] = await Promise.all([
      fetch(`/api/centro/incidencias?agente=${agente.id}&estado=pendientes`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : [])).catch(() => []),
      fetch(`/api/centro/incidencias?agente=${agente.id}&estado=resueltas&dias=7`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : [])).catch(() => []),
    ]);
    setIncidencias(Array.isArray(p) ? p : []);
    setResueltas(Array.isArray(r) ? r.slice(0, 5) : []);
  }, [agente.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <section className="cc-detalle" aria-labelledby="cc-detalle-titulo">
      <header className="cc-detalle-cabecera">
        <h3 id="cc-detalle-titulo">
          <span aria-hidden="true">{agente.icono}</span> {agente.nombre}
          <span className={`cc-etiqueta cc-etiqueta-${LUZ[agente.estado]}`}>{TEXTO_ESTADO[agente.estado]}</span>
        </h3>
        <button type="button" className="cc-cerrar" onClick={onCerrar} aria-label="Cerrar detalle">
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <p className="dsh-muted">{agente.descripcion}</p>
      <dl className="cc-datos">
        <div><dt>Estado</dt><dd>{agente.mensaje}</dd></div>
        <div><dt>En este estado desde</dt><dd>{fechaHoraBD(agente.desdeEstado)}</dd></div>
        <div><dt>Última revisión</dt><dd>{fechaHoraBD(agente.ultimaRevision)} ({haceTiempo(agente.segundosRevision)})</dd></div>
        {agente.ultimaActividad && <div><dt>Última actividad</dt><dd>{fechaHoraBD(agente.ultimaActividad)}</dd></div>}
        <div><dt>Se revisa</dt><dd>{agente.frecuencia}</dd></div>
      </dl>
      {agente.detalle.length > 0 && (
        <ul className="cc-lista-detalle">
          {agente.detalle.map((d) => <li key={d}>{d}</li>)}
        </ul>
      )}

      <h4 className="cc-subtitulo">Reporte de averías</h4>
      {incidencias === null ? (
        <p className="dsh-muted">Cargando…</p>
      ) : incidencias.length === 0 ? (
        <p className="cc-sin-averias">✅ Sin averías abiertas.</p>
      ) : (
        <div className="cc-incidencias">
          {incidencias.map((i, n) => (
            <IncidenciaTarjeta key={i.clave} inc={i} abiertaInicial={n === 0} onCambio={() => { cargar(); onCambio(); }} />
          ))}
        </div>
      )}

      {resueltas.length > 0 && (
        <>
          <h4 className="cc-subtitulo">Resueltas (últimos 7 días)</h4>
          <div className="cc-incidencias">
            {resueltas.map((i) => <IncidenciaTarjeta key={i.clave} inc={i} />)}
          </div>
        </>
      )}
    </section>
  );
}

export function PanelAgentes({
  datos,
  error,
  recargar,
  compacto = false,
}: {
  datos: DatosCentro | null;
  error?: string | null;
  recargar: () => Promise<void> | void;
  compacto?: boolean;
}) {
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function revisarAhora() {
    setRevisando(true);
    setAviso(null);
    const res = await fetch("/api/vigilante", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setAviso(res?.ok ? "Revisión completada." : data?.error || "No se pudo revisar.");
    await recargar();
    setRevisando(false);
  }

  const agentes = datos?.agentes || [];
  const operativos = agentes.filter((a) => a.estado === "OK" || a.estado === "OFF").length;
  const averias = agentes.reduce((n, a) => n + a.abiertas, 0) + (datos?.otrasIncidencias || 0);
  const peor = agentes.some((a) => a.estado === "ERROR") ? "error" : agentes.some((a) => a.estado === "AVISO") ? "aviso" : "ok";
  const elegido = agentes.find((a) => a.id === seleccion) || null;

  return (
    <section className={`dsh-card cc-panel cc-panel-${peor}${compacto ? " cc-compacto" : ""}`} aria-labelledby="cc-panel-titulo" aria-busy={!datos}>
      <header className="cc-panel-cabecera">
        <div className="cc-resumen">
          <span className={`cc-luz cc-luz-${datos ? peor : "off"} cc-luz-grande`} aria-hidden="true" />
          <div>
            <h2 id="cc-panel-titulo">Centro de control</h2>
            <p className="dsh-muted" role="status">
              {!datos
                ? "Comprobando agentes…"
                : !datos.instalado
                  ? "Vigilante sin instalar: sube vigilante.php y ejecuta vigilante.sql"
                  : `${operativos}/${agentes.length} agentes operativos · ${averias ? `${averias} avería(s) abierta(s)` : "sin averías"} · última revisión ${haceTiempo(datos.latido?.segundosDesde)}`}
            </p>
          </div>
        </div>
        <div className="dsh-cabecera-acciones">
          <button type="button" className="dsh-boton dsh-boton-mini" onClick={revisarAhora} disabled={revisando || !datos?.instalado}>
            <RefreshCw size={14} aria-hidden="true" className={revisando ? "dsh-girando" : undefined} />
            {revisando ? "Revisando…" : "Revisar ahora"}
          </button>
          {compacto && (
            <a className="dsh-enlace cc-enlace" href="/centro-control">
              Ver historial <ArrowRight size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      </header>

      {(error || aviso) && <p role="status" className={error ? "dsh-alerta dsh-alerta-error" : "dsh-muted"}>{error || aviso}</p>}

      <ul className="cc-rejilla" aria-label="Agentes">
        {(datos ? agentes : Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` }) as AgenteVista)).map((a) =>
          !datos ? (
            <li key={a.id} className="cc-agente cc-agente-esqueleto" aria-hidden="true" />
          ) : (
            <li key={a.id}>
              <button
                type="button"
                className={`cc-agente cc-agente-${LUZ[a.estado]}`}
                aria-pressed={seleccion === a.id}
                aria-label={`${a.nombre}: ${TEXTO_ESTADO[a.estado]}. ${a.mensaje}`}
                onClick={() => setSeleccion(seleccion === a.id ? null : a.id)}
              >
                <span className="cc-agente-fila">
                  <span className={`cc-luz cc-luz-${LUZ[a.estado]}`} aria-hidden="true" />
                  <span className="cc-agente-nombre"><span aria-hidden="true">{a.icono}</span> {a.nombre}</span>
                  {a.abiertas > 0 && <span className="cc-contador" title="Averías abiertas">{a.abiertas}</span>}
                </span>
                <span className="cc-agente-msg">{a.mensaje}</span>
                <span className="cc-agente-hora">{haceTiempo(a.segundosRevision)}</span>
              </button>
            </li>
          )
        )}
      </ul>

      {elegido && <DetalleAgente key={elegido.id} agente={elegido} onCerrar={() => setSeleccion(null)} onCambio={() => recargar()} />}
    </section>
  );
}
