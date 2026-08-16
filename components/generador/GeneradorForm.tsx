"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EmpresaOpcion { id: string; nombre: string; }

export function GeneradorForm({
  empresas,
  empresaIdInicial,
}: {
  empresas: EmpresaOpcion[];
  empresaIdInicial?: string;
}) {
  const router = useRouter();
  const empresaValida = empresaIdInicial && empresas.some((e) => e.id === empresaIdInicial);
  const [empresaId, setEmpresaId] = useState(empresaValida ? empresaIdInicial! : empresas[0]?.id ?? "");
  const [cantidad, setCantidad] = useState(10);
  const [tema, setTema] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/empresas/${empresaId}/generar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad, tema: tema.trim() || undefined }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.mensaje || "No se pudo generar el contenido. Inténtalo de nuevo.");
      return;
    }

    router.push(`/biblioteca?empresa=${empresaId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form" noValidate>
      <div className="field">
        <label htmlFor="empresaId">Empresa</label>
        <select id="empresaId" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} required>
          {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="tema">Tema o instrucciones (opcional)</label>
        <textarea
          id="tema"
          rows={3}
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Ej: Enfócate en el nuevo servicio de automatización con IA para peluquerías"
        />
        <p className="text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>
          Si lo dejas vacío, la IA elige el tema automáticamente rotando entre los pilares de contenido habituales.
        </p>
      </div>
      <div className="field">
        <label htmlFor="cantidad">Cantidad de publicaciones</label>
        <input id="cantidad" type="number" min={1} max={10} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} required />
        <p className="text-muted" style={{ fontSize: "0.8rem", margin: 0 }}>Máximo 10 por vez (límite del plan gratuito de hosting). Puedes generar varias veces.</p>
      </div>
      {error && <p role="alert" className="field-error">{error} {error.includes("plan") && <a href="/suscripcion">Ver planes</a>}</p>}
      <button type="submit" className="btn-primary btn-large" disabled={loading || !empresaId} aria-busy={loading}>{loading ? "Generando con IA..." : `Generar ${cantidad} publicaciones`}</button>
    </form>
  );
}
