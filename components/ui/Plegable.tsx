"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Hace plegable una tarjeta existente (.dsh-card) sin tocar su contenido:
 * cerrada solo deja ver su cabecera (primer hijo). Recuerda el estado por navegador.
 */
export function Plegable({ id, titulo, abiertoPorDefecto = true, children }: { id: string; titulo: string; abiertoPorDefecto?: boolean; children: ReactNode }) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);

  useEffect(() => {
    try {
      const v = localStorage.getItem(`desplegable:${id}`);
      if (v === "1" || v === "0") setAbierto(v === "1");
    } catch {
      /* sin almacenamiento */
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
    <div className={`plg${abierto ? "" : " plg-cerrado"}`} data-plegable={id}>
      <button type="button" className="plg-boton" aria-expanded={abierto} onClick={alternar} title={abierto ? `Plegar ${titulo}` : `Desplegar ${titulo}`}>
        <ChevronDown size={18} aria-hidden="true" />
        <span className="sr-only">{abierto ? `Plegar ${titulo}` : `Desplegar ${titulo}`}</span>
      </button>
      {children}
    </div>
  );
}
