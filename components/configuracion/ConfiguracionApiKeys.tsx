"use client";

import { useEffect, useState } from "react";

interface ClaveGuardada {
  proveedor: string;
  apiKeyEnmascarada: string;
  tieneClave: boolean;
}

const PROVEEDORES = [
  { id: "GEMINI", nombre: "Google Gemini", ayuda: "Consíguela gratis en aistudio.google.com/apikey" },
  { id: "GROQ", nombre: "Groq", ayuda: "Consíguela gratis en console.groq.com/keys" },
];

export function ConfiguracionApiKeys() {
  const [claves, setClaves] = useState<ClaveGuardada[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);

  async function cargar() {
    const res = await fetch("/api/configuracion/api-keys");
    if (res.ok) {
      const data = await res.json();
      setClaves(Array.isArray(data) ? data : []);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardar(proveedor: string) {
    const apiKey = inputs[proveedor]?.trim();
    if (!apiKey) return;

    setLoading(proveedor);
    setMensaje(null);

    const res = await fetch("/api/configuracion/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proveedor, apiKey }),
    });

    setLoading(null);

    if (!res.ok) {
      setMensaje({ texto: "No se pudo guardar la clave.", error: true });
      return;
    }

    setInputs((prev) => ({ ...prev, [proveedor]: "" }));
    setMensaje({ texto: "Clave guardada correctamente.", error: false });
    cargar();
  }

  async function eliminar(proveedor: string) {
    setLoading(proveedor);
    setMensaje(null);

    const res = await fetch("/api/configuracion/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proveedor }),
    });

    setLoading(null);

    if (!res.ok) {
      setMensaje({ texto: "No se pudo eliminar la clave.", error: true });
      return;
    }

    setMensaje({ texto: "Clave eliminada. Se usará la clave por defecto del sistema.", error: false });
    cargar();
  }

  return (
    <div className="config-api-keys">
      {mensaje && (
        <p className={mensaje.error ? "field-error" : "field-success"}>{mensaje.texto}</p>
      )}

      {PROVEEDORES.map((p) => {
        const guardada = claves.find((c) => c.proveedor === p.id);
        return (
          <div key={p.id} className="field config-api-key-row">
            <label htmlFor={`clave-${p.id}`}>{p.nombre}</label>
            <p className="text-muted" style={{ fontSize: "0.8rem", margin: "0 0 0.4rem" }}>{p.ayuda}</p>

            {guardada ? (
              <div className="config-api-key-actual">
                <code>{guardada.apiKeyEnmascarada}</code>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => eliminar(p.id)}
                  disabled={loading === p.id}
                >
                  {loading === p.id ? "Eliminando..." : "Eliminar y usar la clave por defecto"}
                </button>
              </div>
            ) : (
              <div className="config-api-key-nueva">
                <input
                  id={`clave-${p.id}`}
                  type="password"
                  placeholder="Pega tu clave aquí"
                  value={inputs[p.id] || ""}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => guardar(p.id)}
                  disabled={loading === p.id || !inputs[p.id]?.trim()}
                >
                  {loading === p.id ? "Guardando..." : "Guardar"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
