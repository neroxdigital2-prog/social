"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const TONOS_COMUNICACION = [
  { value: "cercano", label: "Cercano y cálido" },
  { value: "profesional", label: "Profesional y formal" },
  { value: "premium", label: "Premium / exclusivo" },
  { value: "tecnico", label: "Técnico / experto" },
  { value: "divertido", label: "Divertido / desenfadado" },
];

const OBJETIVOS_PRINCIPALES = [
  { value: "ventas", label: "Ventas directas" },
  { value: "reservas", label: "Reservas o citas" },
  { value: "llamadas", label: "Llamadas telefónicas" },
  { value: "visitas_web", label: "Visitas a la web" },
  { value: "leads", label: "Captar contactos (leads)" },
];

const MAX_PUBLICO_OBJETIVO = 200;

export function EmpresaForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [servicios, setServicios] = useState<string[]>([]);
  const [servicioInput, setServicioInput] = useState("");
  const [competidores, setCompetidores] = useState<string[]>([]);
  const [competidorInput, setCompetidorInput] = useState("");
  const [publicoObjetivo, setPublicoObjetivo] = useState("");
  const [colorPrimario, setColorPrimario] = useState("#6D28D9");
  const [agencias, setAgencias] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    fetch("/api/agencias").then((r) => r.json()).then((data) => setAgencias(data.propias || [])).catch(() => {});
  }, []);

  function agregarChip(valor: string, lista: string[], setLista: (v: string[]) => void, setInput: (v: string) => void) {
    const limpio = valor.trim();
    if (!limpio || lista.includes(limpio)) return;
    setLista([...lista, limpio]);
    setInput("");
  }

  function quitarChip(valor: string, lista: string[], setLista: (v: string[]) => void) {
    setLista(lista.filter((s) => s !== valor));
  }

  function handleChipKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    input: string,
    lista: string[],
    setLista: (v: string[]) => void,
    setInput: (v: string) => void
  ) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      agregarChip(input, lista, setLista, setInput);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.currentTarget);
    const web = (formData.get("web") as string)?.trim();
    const logoUrl = (formData.get("logoUrl") as string)?.trim();

    const payload = {
      nombre: formData.get("nombre"),
      sector: formData.get("sector"),
      ciudad: formData.get("ciudad"),
      servicios,
      web: web || undefined,
      whatsapp: (formData.get("whatsapp") as string)?.trim() || undefined,
      agenciaId: (formData.get("agenciaId") as string) || undefined,
      publicoObjetivo: publicoObjetivo.trim() || undefined,
      tonoComunicacion: (formData.get("tonoComunicacion") as string) || undefined,
      objetivoPrincipal: (formData.get("objetivoPrincipal") as string) || undefined,
      competidores: competidores.length > 0 ? competidores.join(", ") : undefined,
      colorPrimario: colorPrimario || undefined,
      logoUrl: logoUrl || undefined,
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
      <fieldset className="form-fieldset">
        <legend className="form-legend">Datos básicos</legend>

        <div className="field"><label htmlFor="nombre">Nombre de la empresa</label><input id="nombre" name="nombre" type="text" required minLength={2} autoComplete="organization" /></div>
        <div className="field-row">
          <div className="field"><label htmlFor="sector">Sector</label><input id="sector" name="sector" type="text" required minLength={2} placeholder="Ej. Estética, Restauración, Legal" /></div>
          <div className="field"><label htmlFor="ciudad">Ciudad</label><input id="ciudad" name="ciudad" type="text" required minLength={2} autoComplete="address-level2" /></div>
        </div>
        <div className="field">
          <label htmlFor="servicioInput">Servicios que ofreces</label>
          <div className="chip-input-row">
            <input
              id="servicioInput"
              type="text"
              value={servicioInput}
              onChange={(e) => setServicioInput(e.target.value)}
              onKeyDown={(e) => handleChipKeyDown(e, servicioInput, servicios, setServicios, setServicioInput)}
              placeholder="Escribe un servicio y pulsa Enter"
            />
            <button type="button" className="btn-secondary" onClick={() => agregarChip(servicioInput, servicios, setServicios, setServicioInput)}>Añadir</button>
          </div>
          {servicios.length > 0 && (
            <ul className="chip-list">
              {servicios.map((s) => (
                <li key={s} className="chip">{s}<button type="button" className="chip-remove" onClick={() => quitarChip(s, servicios, setServicios)} aria-label={`Quitar ${s}`}>×</button></li>
              ))}
            </ul>
          )}
        </div>
        <div className="field-row">
          <div className="field"><label htmlFor="web">Página web (opcional)</label><input id="web" name="web" type="url" placeholder="https://tuempresa.com" autoComplete="url" /></div>
          <div className="field"><label htmlFor="whatsapp">WhatsApp (opcional)</label><input id="whatsapp" name="whatsapp" type="tel" placeholder="+34 600 000 000" autoComplete="tel" /></div>
        </div>
      </fieldset>

      <fieldset className="form-fieldset">
        <legend className="form-legend">Estrategia de contenido</legend>
        <p className="text-muted field-help-intro">
          Estos datos afinan lo que genera la IA: úsalos para que el contenido suene realmente a tu negocio.
        </p>

        <div className="field">
          <label htmlFor="publicoObjetivo">
            Público objetivo (opcional)
            <span className="field-char-count"> · {publicoObjetivo.length}/{MAX_PUBLICO_OBJETIVO}</span>
          </label>
          <textarea
            id="publicoObjetivo"
            name="publicoObjetivo"
            rows={2}
            maxLength={MAX_PUBLICO_OBJETIVO}
            value={publicoObjetivo}
            onChange={(e) => setPublicoObjetivo(e.target.value)}
            placeholder="Ej. Mujeres 25-45 años, residentes en la zona, interesadas en cuidado personal"
            aria-describedby="publicoObjetivo-help"
          />
          <p id="publicoObjetivo-help" className="field-help">Cuanto más específico, más preciso será el contenido generado.</p>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="tonoComunicacion">Tono de comunicación (opcional)</label>
            <select id="tonoComunicacion" name="tonoComunicacion" defaultValue="">
              <option value="">Sin especificar (cercano por defecto)</option>
              {TONOS_COMUNICACION.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="objetivoPrincipal">Objetivo principal (opcional)</label>
            <select id="objetivoPrincipal" name="objetivoPrincipal" defaultValue="">
              <option value="">Sin especificar (visibilidad general)</option>
              {OBJETIVOS_PRINCIPALES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="competidorInput">Competidores a diferenciarte de (opcional)</label>
          <div className="chip-input-row">
            <input
              id="competidorInput"
              type="text"
              value={competidorInput}
              onChange={(e) => setCompetidorInput(e.target.value)}
              onKeyDown={(e) => handleChipKeyDown(e, competidorInput, competidores, setCompetidores, setCompetidorInput)}
              placeholder="Nombre de un negocio similar y pulsa Enter"
            />
            <button type="button" className="btn-secondary" onClick={() => agregarChip(competidorInput, competidores, setCompetidores, setCompetidorInput)}>Añadir</button>
          </div>
          {competidores.length > 0 && (
            <ul className="chip-list">
              {competidores.map((c) => (
                <li key={c} className="chip">{c}<button type="button" className="chip-remove" onClick={() => quitarChip(c, competidores, setCompetidores)} aria-label={`Quitar ${c}`}>×</button></li>
              ))}
            </ul>
          )}
          <p className="field-help">No se mencionan directamente en el contenido; solo se usan como referencia de qué evitar repetir.</p>
        </div>
      </fieldset>

      <fieldset className="form-fieldset">
        <legend className="form-legend">Identidad de marca</legend>

        <div className="field-row">
          <div className="field">
            <label htmlFor="colorPrimario">Color principal de marca</label>
            <div className="color-picker-row">
              <input
                id="colorPrimario"
                name="colorPrimario"
                type="color"
                value={colorPrimario}
                onChange={(e) => setColorPrimario(e.target.value)}
                className="color-swatch-input"
              />
              <span className="text-muted">{colorPrimario}</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="logoUrl">URL del logo (opcional)</label>
            <input id="logoUrl" name="logoUrl" type="url" placeholder="https://tuempresa.com/logo.png" />
          </div>
        </div>
      </fieldset>

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
