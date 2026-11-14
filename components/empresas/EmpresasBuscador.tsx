"use client";

import { useMemo, useState } from "react";

interface Empresa {
  id: string;
  nombre: string;
  sector: string;
  ciudad: string;
}

export function EmpresasBuscador({ empresas: empresasIniciales }: { empresas: Empresa[] }) {
  const [empresas, setEmpresas] = useState<Empresa[]>(empresasIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [borrandoId, setBorrandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function borrarEmpresa(empresa: Empresa) {
    const ok = window.confirm(
      `¿Borrar la empresa «${empresa.nombre}» (${empresa.sector} · ${empresa.ciudad}, id …${empresa.id.slice(-4)})?\n\nSe eliminarán también sus publicaciones, redes conectadas y datos asociados. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setBorrandoId(empresa.id);
    setError(null);
    try {
      const res = await fetch(`/api/empresas/${empresa.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo borrar la empresa");
      setEmpresas((prev) => prev.filter((e) => e.id !== empresa.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo borrar la empresa");
    } finally {
      setBorrandoId(null);
    }
  }

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

      {error && (
        <p role="alert" style={{ color: "#dc2626", margin: "0 0 1rem" }}>
          {error}
        </p>
      )}

      {filtradas.length === 0 ? (
        <p className="text-muted">No se encontraron empresas con ese criterio.</p>
      ) : (
        <div className="cal-sin-programar-lista">
          {filtradas.map((empresa) => (
            <div key={empresa.id} className="cal-sin-programar-item">
              <div>
                <strong className="cal-item-titulo">{empresa.nombre}</strong>
                <div className="cal-item-tipo">{empresa.sector} · {empresa.ciudad} · id …{empresa.id.slice(-4)}</div>
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <a href={`/generador?empresa=${empresa.id}`} className="btn-secondary" style={{ textDecoration: "none" }}>
                  Generar contenido
                </a>
                <a href={`/configuracion?empresa=${empresa.id}`} className="btn-primary" style={{ textDecoration: "none" }}>
                  Configurar
                </a>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => borrarEmpresa(empresa)}
                  disabled={borrandoId === empresa.id}
                  style={{ color: "#dc2626" }}
                >
                  {borrandoId === empresa.id ? "Borrando…" : "🗑 Borrar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
