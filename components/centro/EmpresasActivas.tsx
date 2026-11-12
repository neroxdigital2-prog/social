"use client";

import { useState } from "react";
import type { EmpresaActiva } from "@/components/centro/tipos";

/** Activar / desactivar empresas. Desactivada = no publica, no se vigila y no avisa (no se borra nada). */
export function EmpresasActivas({ empresas, onCambio }: { empresas: EmpresaActiva[]; onCambio: () => Promise<void> | void }) {
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error?: boolean } | null>(null);

  async function cambiar(e: EmpresaActiva, activa: boolean) {
    setOcupado(e.id);
    setConfirmar(null);
    setMensaje(null);
    const res = await fetch("/api/centro/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresaId: e.id, activa }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setMensaje({ texto: data?.mensaje || data?.error || "No se pudo guardar.", error: !res?.ok });
    await onCambio();
    setOcupado(null);
  }

  function pulsar(e: EmpresaActiva) {
    if (e.activa && e.programadas > 0 && confirmar !== e.id) {
      setConfirmar(e.id);
      return;
    }
    cambiar(e, !e.activa);
  }

  if (!empresas.length) return <p className="dsh-muted">No hay empresas.</p>;
  const activas = empresas.filter((e) => e.activa).length;

  return (
    <div className="cc-emp">
      <p className="dsh-muted">
        {activas} de {empresas.length} activa(s). Una empresa desactivada <strong>no publica</strong>, <strong>no se vigila</strong> y <strong>no genera avisos</strong>; sus datos y publicaciones se conservan.
      </p>
      <ul className="cc-emp-lista">
        {empresas.map((e) => (
          <li key={e.id} className={e.activa ? undefined : "cc-emp-off"}>
            <span className="cc-emp-info">
              <strong>{e.nombre}</strong>
              <small>
                {e.programadas} programada(s) · {e.redes} red(es) conectada(s) · {e.activa ? "🟢 Activa" : "⚪ Desactivada: pausada"}
              </small>
              {confirmar === e.id && (
                <span className="cc-emp-confirmar" role="alert">
                  Se pausarán {e.programadas} publicación(es) programada(s) hasta que la vuelvas a activar.
                  <button type="button" className="dsh-boton dsh-boton-mini" onClick={() => cambiar(e, false)}>
                    Desactivar
                  </button>
                  <button type="button" className="dsh-enlace cc-emp-cancelar" onClick={() => setConfirmar(null)}>
                    Cancelar
                  </button>
                </span>
              )}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={e.activa}
              aria-label={`${e.activa ? "Desactivar" : "Activar"} ${e.nombre}`}
              className="cc-switch"
              onClick={() => pulsar(e)}
              disabled={ocupado === e.id || e.sinDatos}
              title={e.sinDatos ? "Ejecuta el último vigilante.sql para poder activar/desactivar" : undefined}
            >
              <span aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {mensaje && <p role="status" className={mensaje.error ? "dsh-alerta dsh-alerta-error" : "dsh-muted"}>{mensaje.texto}</p>}
    </div>
  );
}
