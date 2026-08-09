"use client";

import { useMemo, useState } from "react";

interface Empresa {
  id: string;
  nombre: string;
  sector: string;
  ciudad: string;
}

export function EmpresasBuscador({ empresas }: { empresas: Empresa[] }) {
  const [busqueda, setBusqueda] = useState("");

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q) ||
        e.ciudad.toLowerCase().includes(q)
    );
  }, [busqueda, empresas]);

  return (
    <div>
      <div className="field" style={{ maxWidth: 420, marginBottom: "1.5rem" }}>
        <label htmlFor="buscar-empresa">Buscar empresa</label>
        <input
          id="buscar-empresa"
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Nombre, sector o ciudad..."
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="text-muted">No se encontraron empresas con ese criterio.</p>
      ) : (
        <div className="cal-sin-programar-lista">
          {filtradas.map((empresa) => (
            <div key={empresa.id} className="cal-sin-programar-item">
              <div>
                <strong className="cal-item-titulo">{empresa.nombre}</strong>
                <div className="cal-item-tipo">{empresa.sector} · {empresa.ciudad}</div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <a href={`/generador?empresa=${empresa.id}`} className="btn-secondary" style={{ textDecoration: "none" }}>
                  Generar contenido
                </a>
                <a href={`/configuracion?empresa=${empresa.id}`} className="btn-primary" style={{ textDecoration: "none" }}>
                  Configurar
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
