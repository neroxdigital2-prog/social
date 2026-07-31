"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export function EmpresaForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [servicios, setServicios] = useState<string[]>([]);
  const [servicioInput, setServicioInput] = useState("");
  const [agencias, setAgencias] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    fetch("/api/agencias").then((r) => r.json()).then((data) => setAgencias(data.propias || [])).catch(() => {});
  }, []);

  function agregarServicio() {
    const valor = servicioInput.trim();
    if (!valor || servicios.includes(valor)) return;
    setServicios((prev) => [...prev, valor]);
    setServicioInput("");
  }

  function quitarServicio(servicio: string) {
    setServicios((prev) => prev.filter((s) => s !== servicio));
  }

  function handleServicioKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); agregarServicio(); }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const web = (formData.get("web") as string)?.trim();

    const payload = {
      nombre: formData.get("nombre"),
      sector: formData.get("sector"),
      ciudad: formData.get("ciudad"),
      servicios,
      web: web || undefined,
      whatsapp: (formData.get("whatsapp") as string)?.trim() || undefined,
      agenciaId: (formData.get("agenciaId") as string) || undefined,
    };

    const res = await fetch("/api/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.mensaje || "Revisa los datos ingresados. La web debe incluir https://");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="field"><label htmlFor="nombre">Nombre de la empresa</label><input id="nombre" name="nombre" type="text" required minLength={2} autoComplete="organization" /></div>
      <div className="field-row">
        <div className="field"><label htmlFor="sector">Sector</label><input id="sector" name="sector" type="text" required minLength={2} placeholder="Ej. Estética, Restauración, Legal" /></div>
        <div className="field"><label htmlFor="ciudad">Ciudad</label><input id="ciudad" name="ciudad" type="text" required minLength={2} autoComplete="address-level2" /></div>
      </div>
      <div className="field">
        <label htmlFor="servicioInput">Servicios que ofreces</label>
        <div className="chip-input-row">
          <input id="servicioInput" type="text" value={servicioInput} onChange={(e) => setServicioInput(e.target.value)} onKeyDown={handleServicioKeyDown} placeholder="Escribe un servicio y pulsa Enter" />
          <button type="button" className="btn-secondary" onClick={agregarServicio}>Añadir</button>
        </div>
        {servicios.length > 0 && (
          <ul className="chip-list">
            {servicios.map((servicio) => (
              <li key={servicio} className="chip">{servicio}<button type="button" className="chip-remove" onClick={() => quitarServicio(servicio)} aria-label={`Quitar ${servicio}`}>×</button></li>
            ))}
          </ul>
        )}
      </div>
      <div className="field-row">
        <div className="field"><label htmlFor="web">Página web (opcional)</label><input id="web" name="web" type="url" placeholder="https://tuempresa.com" autoComplete="url" /></div>
        <div className="field"><label htmlFor="whatsapp">WhatsApp (opcional)</label><input id="whatsapp" name="whatsapp" type="tel" placeholder="+34 600 000 000" autoComplete="tel" /></div>
      </div>
      {agencias.length > 0 && (
        <div className="field">
          <label htmlFor="agenciaId">Asignar a agencia (opcional)</label>
          <select id="agenciaId" name="agenciaId">
            <option value="">Empresa personal (sin agencia)</option>
            {agencias.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </div>
      )}
      {error && <p role="alert" className="field-error">{error}</p>}
      <button type="submit" className="btn-primary" disabled={loading} aria-busy={loading}>{loading ? "Guardando..." : "Guardar empresa"}</button>
    </form>
  );
}
