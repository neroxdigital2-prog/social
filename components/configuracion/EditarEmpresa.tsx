"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EmpresaDatos {
  id: string;
  nombre: string;
  sector: string;
  ciudad: string;
  web?: string | null;
  whatsapp?: string | null;
}

export function EditarEmpresa({ empresa }: { empresa: EmpresaDatos }) {
  const router = useRouter();

  const [nombre, setNombre] = useState(empresa.nombre);
  const [sector, setSector] = useState(empresa.sector);
  const [ciudad, setCiudad] = useState(empresa.ciudad);
  const [web, setWeb] = useState(empresa.web || "");
  const [whatsapp, setWhatsapp] = useState(empresa.whatsapp || "");

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState("");
  const [borrando, setBorrando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setMensaje(null);

    const res = await fetch(`/api/empresas/${empresa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, sector, ciudad, web, whatsapp }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(false);

    if (!res.ok) {
      setError(data?.error || "No se pudieron guardar los cambios.");
      return;
    }

    setMensaje("Cambios guardados correctamente.");
    router.refresh();
  }

  async function borrar() {
    if (textoConfirmacion !== empresa.nombre) return;

    setBorrando(true);
    setError(null);

    const res = await fetch(`/api/empresas/${empresa.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBorrando(false);
      setError(data?.error || "No se pudo borrar la empresa.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section className="form-card">
      <h2>Datos de la empresa</h2>

      <div className="field">
        <label htmlFor="nombre-empresa">Nombre</label>
        <input id="nombre-empresa" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="sector-empresa">Sector</label>
          <input id="sector-empresa" type="text" value={sector} onChange={(e) => setSector(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ciudad-empresa">Ciudad</label>
          <input id="ciudad-empresa" type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="web-empresa">Página web</label>
          <input id="web-empresa" type="text" value={web} onChange={(e) => setWeb(e.target.value)} placeholder="https://tuempresa.com" />
        </div>
        <div className="field">
          <label htmlFor="whatsapp-empresa">WhatsApp</label>
          <input id="whatsapp-empresa" type="text" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+34 600 000 000" />
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}
      {mensaje && <p style={{ color: "var(--color-success)", fontSize: "0.875rem" }}>{mensaje}</p>}

      <button type="button" className="btn-primary" disabled={guardando} onClick={guardar}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>

      <hr style={{ margin: "1.5rem 0", border: "none", borderTop: "1px solid #e5e5ea" }} />

      <h3 style={{ color: "var(--color-error)" }}>Zona de peligro</h3>
      <p className="text-muted" style={{ marginTop: 0 }}>
        Borrar esta empresa elimina también sus publicaciones, leads, conversaciones de WhatsApp, citas y redes conectadas. Esta acción no se puede deshacer.
      </p>

      {!confirmandoBorrado ? (
        <button type="button" className="pub-btn-link pub-btn-danger" onClick={() => setConfirmandoBorrado(true)}>
          Borrar esta empresa
        </button>
      ) : (
        <div className="field">
          <label>
            Escribe <strong>{empresa.nombre}</strong> para confirmar el borrado
          </label>
          <input
            type="text"
            value={textoConfirmacion}
            onChange={(e) => setTextoConfirmacion(e.target.value)}
            placeholder={empresa.nombre}
          />
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn-primary"
              style={{ background: "var(--color-error)" }}
              disabled={borrando || textoConfirmacion !== empresa.nombre}
              onClick={borrar}
            >
              {borrando ? "Borrando…" : "Confirmar borrado definitivo"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirmandoBorrado(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
