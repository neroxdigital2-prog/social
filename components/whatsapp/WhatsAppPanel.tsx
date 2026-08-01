"use client";

import { useEffect, useState } from "react";

interface ConversacionResumen {
  id: string;
  telefono: string;
  nombreContacto: string | null;
  modoHumano: boolean;
  leadId: string | null;
  ultimoMensaje: string | null;
  updatedAt: string;
}

interface Mensaje {
  rol: "USUARIO" | "BOT" | "HUMANO";
  contenido: string;
  createdAt: string;
}

interface ConversacionDetalle {
  id: string;
  telefono: string;
  nombreContacto: string | null;
  modoHumano: boolean;
  mensajes: Mensaje[];
}

function etiquetaRol(rol: Mensaje["rol"]) {
  if (rol === "USUARIO") return "Cliente";
  if (rol === "BOT") return "IA";
  return "Tú";
}

export function WhatsAppPanel({ empresaId }: { empresaId: string }) {
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<ConversacionDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cambiandoModo, setCambiandoModo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargarLista() {
    setCargandoLista(true);
    const res = await fetch(`/api/whatsapp/conversaciones?empresa=${empresaId}`);
    const data = await res.json().catch(() => []);
    setConversaciones(Array.isArray(data) ? data : []);
    setCargandoLista(false);
  }

  useEffect(() => {
    cargarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function abrirConversacion(id: string) {
    setSeleccionadaId(id);
    setCargandoDetalle(true);
    setError(null);
    const res = await fetch(`/api/whatsapp/conversaciones/${id}`);
    const data = await res.json().catch(() => null);
    setCargandoDetalle(false);
    if (!res.ok || !data?.id) {
      setError("No se pudo cargar esta conversación.");
      return;
    }
    setDetalle(data);
  }

  async function alternarModo() {
    if (!detalle) return;
    setCambiandoModo(true);
    const nuevoModo = !detalle.modoHumano;
    const res = await fetch(`/api/whatsapp/conversaciones/${detalle.id}/modo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modoHumano: nuevoModo }),
    });
    setCambiandoModo(false);
    if (res.ok) {
      setDetalle((prev) => (prev ? { ...prev, modoHumano: nuevoModo } : prev));
      setConversaciones((prev) =>
        prev.map((c) => (c.id === detalle.id ? { ...c, modoHumano: nuevoModo } : c))
      );
    }
  }

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault();
    if (!detalle || !mensaje.trim()) return;
    setEnviando(true);
    setError(null);
    const res = await fetch(`/api/whatsapp/conversaciones/${detalle.id}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje }),
    });
    const data = await res.json().catch(() => null);
    setEnviando(false);
    if (!res.ok) {
      setError(data?.error || "No se pudo enviar el mensaje.");
      return;
    }
    setDetalle((prev) =>
      prev
        ? { ...prev, mensajes: [...prev.mensajes, { rol: "HUMANO", contenido: mensaje, createdAt: new Date().toISOString() }] }
        : prev
    );
    setMensaje("");
  }

  return (
    <div className="whatsapp-layout">
      <aside className="whatsapp-lista">
        {cargandoLista ? (
          <p className="text-muted">Cargando conversaciones…</p>
        ) : conversaciones.length === 0 ? (
          <p className="cal-sin-publicaciones">
            Aún no hay conversaciones. En cuanto alguien te escriba por WhatsApp aparecerá aquí.
          </p>
        ) : (
          conversaciones.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`whatsapp-item ${seleccionadaId === c.id ? "whatsapp-item-activo" : ""}`}
              onClick={() => abrirConversacion(c.id)}
            >
              <strong>{c.nombreContacto || c.telefono}</strong>
              <span className="whatsapp-item-preview">{c.ultimoMensaje || "Sin mensajes"}</span>
              {c.modoHumano && <span className="whatsapp-badge-humano">Modo humano</span>}
            </button>
          ))
        )}
      </aside>

      <section className="whatsapp-chat">
        {!seleccionadaId ? (
          <p className="text-muted">Selecciona una conversación para verla.</p>
        ) : cargandoDetalle ? (
          <p className="text-muted">Cargando conversación…</p>
        ) : detalle ? (
          <>
            <div className="whatsapp-chat-header">
              <div>
                <strong>{detalle.nombreContacto || detalle.telefono}</strong>
                <div className="text-muted" style={{ fontSize: "0.85rem" }}>{detalle.telefono}</div>
              </div>
              <button type="button" className="btn-primary" onClick={alternarModo} disabled={cambiandoModo}>
                {detalle.modoHumano ? "Devolver a la IA" : "Tomar el control"}
              </button>
            </div>

            <div className="whatsapp-mensajes">
              {detalle.mensajes.map((m, i) => (
                <div key={i} className={`whatsapp-burbuja whatsapp-burbuja-${m.rol.toLowerCase()}`}>
                  <span className="whatsapp-burbuja-rol">{etiquetaRol(m.rol)}</span>
                  <p>{m.contenido}</p>
                </div>
              ))}
            </div>

            {error && (
              <p role="alert" className="cal-error" style={{ margin: "0.5rem 0" }}>
                {error}
              </p>
            )}

            <form onSubmit={enviarMensaje} className="whatsapp-form-envio">
              <input
                type="text"
                placeholder="Escribe un mensaje…"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={enviando || !mensaje.trim()}>
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </form>
            {!detalle.modoHumano && (
              <p className="text-muted" style={{ fontSize: "0.8rem" }}>
                La IA sigue respondiendo automáticamente. Pulsa &quot;Tomar el control&quot; para responder tú.
              </p>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
