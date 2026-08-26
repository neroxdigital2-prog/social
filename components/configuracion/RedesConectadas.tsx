"use client";

import { useEffect, useState } from "react";

interface RedConectada {
  id: string;
  red: string;
  cuentaExterna: string;
  cuentaSecundaria: string | null;
  updatedAt: string;
}

const NOMBRE_RED: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
  GOOGLE: "Google Business",
};

export function RedesConectadas({ empresaId }: { empresaId: string }) {
  const [redes, setRedes] = useState<RedConectada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const res = await fetch(`/api/redes?empresa=${empresaId}`);
    const data = await res.json().catch(() => []);
    setRedes(Array.isArray(data) ? data : []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();

    const params = new URLSearchParams(window.location.search);
    if (params.get("redes_ok")) {
      setMensaje("¡Cuenta conectada correctamente!");
      window.history.replaceState({}, "", "/configuracion");
    } else if (params.get("redes_error")) {
      setMensaje("No se pudo conectar: " + params.get("redes_error"));
      window.history.replaceState({}, "", "/configuracion");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function desconectar(id: string) {
    setRedes((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/redes/${id}`, { method: "DELETE" });
  }

  const tieneFacebook = redes.some((r) => r.red === "FACEBOOK");
  const tieneInstagram = redes.some((r) => r.red === "INSTAGRAM");
  const tieneGoogle = redes.some((r) => r.red === "GOOGLE");

  return (
    <div>
      {mensaje && (
        <p className="text-muted" style={{ marginBottom: "0.75rem" }}>
          {mensaje}
        </p>
      )}

      {cargando ? (
        <p className="text-muted">Cargando…</p>
      ) : (
        <>
          {redes.length > 0 && (
            <div className="agenda-lista" style={{ marginBottom: "1rem" }}>
              {redes.map((r) => (
                <div key={r.id} className="agenda-servicio-item">
                  <div>
                    <strong>{NOMBRE_RED[r.red] || r.red}</strong>
                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                      {r.cuentaSecundaria || r.cuentaExterna}
                    </div>
                  </div>
                  <button type="button" className="btn-secundario" onClick={() => desconectar(r.id)}>
                    Desconectar
                  </button>
                </div>
              ))}
            </div>
          )}

          {!tieneFacebook && !tieneInstagram && (
            <a href={`/api/redes/facebook/conectar?empresa=${empresaId}`} className="btn-primary" style={{ display: "inline-block", textDecoration: "none" }}>
              Conectar Facebook e Instagram
            </a>
          )}
          {(tieneFacebook || tieneInstagram) && (
            <p className="text-muted" style={{ fontSize: "0.8rem" }}>
              Se conectan juntas desde tu página de Facebook (si tiene una cuenta de Instagram Business vinculada).
            </p>
          )}

          <div style={{ marginTop: "1.25rem" }}>
            {!tieneGoogle ? (
              <a
                href={`/api/redes/google/conectar?empresa=${empresaId}`}
                className="btn-primary"
                style={{ display: "inline-block", textDecoration: "none" }}
              >
                Conectar Google Business
              </a>
            ) : (
              <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                Google Business conectado. Publica actualizaciones directamente en tu ficha de Google.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
