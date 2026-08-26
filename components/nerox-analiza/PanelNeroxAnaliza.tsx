"use client";

import { useEffect, useState } from "react";

interface Negocio {
  id: string;
  loteId: string;
  sector: string;
  ciudad: string;
  nombreNegocio: string;
  web: string;
  telefono: string | null;
  direccion: string | null;
  email: string | null;
  whatsapp: string | null;
  facebook: string | null;
  instagram: string | null;
  rating: number;
  reviews: number;
  icp: number;
  intent: number;
  status: "HOT" | "WARM" | "COLD";
  flags: string[];
  diagnostico: string;
  accion: string;
  propuestaVenta: string | null;
  leadId: string | null;
  usadoEnPublicacion: number;
  publicacionId: string | null;
  creadoEn: string;
}

interface Resumen {
  HOT: number;
  WARM: number;
  COLD: number;
  usados: number;
  total: number;
}

const COLOR_STATUS: Record<string, string> = {
  HOT: "var(--color-error)",
  WARM: "#d97706",
  COLD: "var(--color-secondary)",
};

const FILTROS = [
  { valor: "", etiqueta: "Todos" },
  { valor: "HOT", etiqueta: "🔴 HOT" },
  { valor: "WARM", etiqueta: "🟠 WARM" },
  { valor: "COLD", etiqueta: "🔵 COLD" },
];

function TarjetaSkeleton() {
  return (
    <div className="na-skeleton na-skeleton-card" aria-hidden="true" />
  );
}

export function PanelNeroxAnaliza() {
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [filtro, setFiltro] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const [sector, setSector] = useState("dentista");
  const [ciudad, setCiudad] = useState("Madrid");
  const [escaneando, setEscaneando] = useState(false);
  const [mensajeEscaneo, setMensajeEscaneo] = useState<string | null>(null);

  async function copiarPropuesta(id: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiadoId(id);
      setTimeout(() => setCopiadoId(null), 2000);
    } catch {
      // si el navegador bloquea el portapapeles, no rompemos nada, solo no se copia
    }
  }

  async function cargar(status: string) {
    setCargando(true);
    setError(null);
    try {
      const url = status ? `/api/nerox-analiza/listar?status=${status}` : "/api/nerox-analiza/listar";
      const res = await fetch(url);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error || `Error HTTP ${res.status} al cargar el listado.`);
        setCargando(false);
        return;
      }
      setNegocios(data.negocios || []);
      setResumen(data.resumen || null);
    } catch (e: any) {
      setError("No se pudo conectar con el servidor: " + (e?.message || "error desconocido"));
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar(filtro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function escanearAhora() {
    setEscaneando(true);
    setMensajeEscaneo(null);
    try {
      const res = await fetch("/api/nerox-analiza/escanear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector, ciudad }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMensajeEscaneo(`❌ ${data?.error || "Error al escanear."}`);
      } else {
        setMensajeEscaneo(`✅ Se analizaron ${data.total} negocios de "${sector}" en ${ciudad}.`);
        cargar(filtro);
      }
    } catch {
      setMensajeEscaneo("❌ No se pudo conectar con el servidor.");
    }
    setEscaneando(false);
  }

  return (
    <div>
      {/* Panel colapsable: escaneo manual */}
      <div className="na-panel-colapsable">
        <button
          type="button"
          className="na-panel-cabecera"
          onClick={() => setPanelAbierto((v) => !v)}
          aria-expanded={panelAbierto}
        >
          <span>🔎 Escanear un mercado ahora</span>
          <span className={`na-panel-flecha ${panelAbierto ? "abierto" : ""}`}>▼</span>
        </button>
        <div className={`na-panel-cuerpo ${panelAbierto ? "abierto" : "cerrado"}`}>
          <div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", paddingTop: "0.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
                  Sector
                </label>
                <input
                  className="na-input"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  placeholder="dentista, restaurante..."
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
                  Ciudad
                </label>
                <input className="na-input" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Madrid" />
              </div>
              <button type="button" className="btn-primary" onClick={escanearAhora} disabled={escaneando}>
                {escaneando ? "Escaneando… (10-20s)" : "🔎 Escanear mercado"}
              </button>
            </div>
            {mensajeEscaneo && <p style={{ marginTop: "0.75rem", marginBottom: 0 }}>{mensajeEscaneo}</p>}
          </div>
        </div>
      </div>

      {/* Resumen */}
      {resumen && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {(["HOT", "WARM", "COLD"] as const).map((s) => (
            <div key={s} className="na-card" style={{ flex: "1 1 120px" }}>
              <div style={{ fontSize: "0.75rem", color: COLOR_STATUS[s], fontWeight: 700, letterSpacing: "0.03em" }}>
                {s}
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{resumen[s]}</div>
            </div>
          ))}
          <div className="na-card" style={{ flex: "1 1 160px" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--color-success)", fontWeight: 700, letterSpacing: "0.03em" }}>
              YA CONVERTIDOS EN CONTENIDO
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>
              {resumen.usados}{" "}
              <span style={{ fontSize: "1rem", color: "var(--color-text-muted)", fontWeight: 400 }}>/ {resumen.total}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filtros - barra flotante, se queda visible al hacer scroll */}
      <div className="na-barra-flotante" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            className={`na-filtro-btn ${filtro === f.valor ? "activo" : ""}`}
            onClick={() => setFiltro(f.valor)}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {/* Listado */}
      {error && <p className="field-error">{error}</p>}

      {cargando && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} aria-label="Cargando negocios analizados">
          <TarjetaSkeleton />
          <TarjetaSkeleton />
          <TarjetaSkeleton />
        </div>
      )}

      {!cargando && !error && negocios.length === 0 && (
        <p className="text-muted">No hay negocios analizados todavía con este filtro. Prueba a escanear un mercado arriba.</p>
      )}

      {!cargando && !error && negocios.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {negocios.map((n) => (
            <div key={n.id} className="na-card">
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <strong style={{ fontSize: "0.95rem" }}>{n.nombreNegocio}</strong>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "white",
                    background: COLOR_STATUS[n.status],
                    padding: "2px 10px",
                    borderRadius: "999px",
                  }}
                >
                  {n.status} · ICP {n.icp}
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", margin: "0.3rem 0 0.5rem" }}>
                {n.sector} · {n.ciudad} {n.web ? `· ${n.web}` : "· sin web detectada"}
              </div>
              {n.direccion && (
                <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", margin: "0 0 0.5rem" }}>
                  📍 {n.direccion}
                </div>
              )}
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                {n.flags.map((f, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: "0.7rem",
                      background: "var(--color-surface)",
                      color: "var(--color-text-muted)",
                      padding: "2px 8px",
                      borderRadius: "999px",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
              <p style={{ margin: 0, fontSize: "0.9rem" }}>
                <strong>Diagnóstico:</strong> {n.diagnostico}
              </p>
              <p style={{ margin: "0.25rem 0 0.5rem", fontSize: "0.9rem" }}>
                <strong>Acción recomendada:</strong> {n.accion}
              </p>

              {(n.telefono || n.email || n.whatsapp || n.facebook || n.instagram) && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  {n.telefono && (
                    <a href={`tel:${n.telefono}`} className="btn-secondary" style={{ fontSize: "0.75rem", padding: "3px 9px", textDecoration: "none" }}>
                      ☎️ {n.telefono}
                    </a>
                  )}
                  {n.whatsapp && (
                    <a href={n.whatsapp} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: "0.75rem", padding: "3px 9px", textDecoration: "none" }}>
                      📲 WhatsApp
                    </a>
                  )}
                  {n.email && (
                    <a href={`mailto:${n.email}`} className="btn-secondary" style={{ fontSize: "0.75rem", padding: "3px 9px", textDecoration: "none" }}>
                      ✉️ {n.email}
                    </a>
                  )}
                  {n.facebook && (
                    <a href={n.facebook} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: "0.75rem", padding: "3px 9px", textDecoration: "none" }}>
                      📘 Facebook
                    </a>
                  )}
                  {n.instagram && (
                    <a href={n.instagram} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ fontSize: "0.75rem", padding: "3px 9px", textDecoration: "none" }}>
                      📸 Instagram
                    </a>
                  )}
                </div>
              )}

              {n.propuestaVenta && (
                <div
                  style={{
                    background: "var(--color-surface)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.75rem 0.9rem",
                    margin: "0.5rem 0",
                  }}
                >
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 4 }}>
                    💬 PROPUESTA DE PRIMER CONTACTO
                  </div>
                  <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.4 }}>{n.propuestaVenta}</p>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                      onClick={() => copiarPropuesta(n.id, n.propuestaVenta!)}
                    >
                      {copiadoId === n.id ? "✅ Copiado" : "📋 Copiar mensaje"}
                    </button>
                    {n.leadId && (
                      <a
                        href={`/crm?empresa=cfdf21c6f22303f501abe580e&lead=${n.leadId}`}
                        className="btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "4px 10px", textDecoration: "none", display: "inline-block" }}
                      >
                        👤 Ver lead en CRM
                      </a>
                    )}
                    {(n.whatsapp || n.telefono) && (
                      <a
                        href={`${n.whatsapp || `https://wa.me/${n.telefono!.replace(/[^0-9]/g, "")}`}?text=${encodeURIComponent(n.propuestaVenta)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={{ fontSize: "0.75rem", padding: "4px 10px", textDecoration: "none", display: "inline-block" }}
                      >
                        📲 Enviar por WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div style={{ fontSize: "0.75rem", color: n.usadoEnPublicacion ? "var(--color-success)" : "var(--color-text-muted)" }}>
                {n.usadoEnPublicacion ? "✅ Ya convertido en publicación" : "⏳ Pendiente de usar en contenido"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
