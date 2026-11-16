"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Sección desplegable reutilizable. Recuerda si estaba abierta o cerrada
 * (por navegador) con la clave `id`. El contenido cerrado no se monta
 * salvo `mantener`, para no cargar datos que no se ven.
 */
export function Desplegable({
  id,
  titulo,
  subtitulo,
  resumen,
  acciones,
  abiertoPorDefecto = true,
  mantener = false,
  className = "",
  children,
}: {
  id: string;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  resumen?: ReactNode; // se ve también cerrado (ej. "3 averías")
  acciones?: ReactNode;
  abiertoPorDefecto?: boolean;
  mantener?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);
  const idCuerpo = useId();

  useEffect(() => {
    try {
      const v = localStorage.getItem(`desplegable:${id}`);
      if (v === "1" || v === "0") setAbierto(v === "1");
    } catch {
      /* sin almacenamiento: se usa el valor por defecto */
    }
  }, [id]);

  function alternar() {
    setAbierto((a) => {
      try {
        localStorage.setItem(`desplegable:${id}`, a ? "0" : "1");
      } catch {
        /* nada */
      }
      return !a;
    });
  }

  return (
    <section className={`dsh-card desp${abierto ? " desp-abierto" : ""} ${className}`.trim()} id={id}>
      <header className="desp-cabecera">
        <button type="button" className="desp-boton" aria-expanded={abierto} aria-controls={idCuerpo} onClick={alternar}>
          <ChevronDown size={18} aria-hidden="true" className="desp-chevron" />
          <span className="desp-titulos">
            <span className="desp-titulo">{titulo}</span>
            {subtitulo && <span className="desp-subtitulo">{subtitulo}</span>}
          </span>
          {resumen && <span className="desp-resumen">{resumen}</span>}
        </button>
        {acciones && abierto && <div className="desp-acciones">{acciones}</div>}
      </header>
      <div id={idCuerpo} className="desp-cuerpo" hidden={!abierto}>
        {(abierto || mantener) && children}
      </div>
    </section>
  );
}
