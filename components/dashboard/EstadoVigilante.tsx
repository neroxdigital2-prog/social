"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, RefreshCw, ShieldCheck } from "lucide-react";

interface Informe {
  momento: string;
  revisado: string[];
  corregido: string[];
  problemas: { clave: string; titulo: string; avisado: boolean }[];
  resueltos: string[];
  error?: string;
}

interface Estado {
  instalado: boolean;
  telegram: boolean;
  ultimaEjecucion?: string | null;
  segundosDesde?: number | null;
  informe?: Informe | null;
  abiertas?: number;
  silenciadas?: number;
}

type Nivel = "activo" | "retrasado" | "detenido" | "sin-instalar";

const ETIQUETA: Record<Nivel, string> = {
  activo: "Activo",
  retrasado: "Retrasado",
  detenido: "Detenido",
  "sin-instalar": "Sin instalar",
};

function hace(segundos: number) {
  if (segundos < 60) return "hace unos segundos";
  const min = Math.round(segundos / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h ${min % 60} min`;
  return `hace ${Math.floor(h / 24)} día(s)`;
}

export function EstadoVigilante() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [oculto, setOculto] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTic] = useState(0);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/vigilante", { cache: "no-store" }).catch(() => null);
    if (!res || res.status === 403 || res.status === 401) return setOculto(true);
    setEstado(await res.json().catch(() => null));
  }, []);

  useEffect(() => {
    cargar();
    const recarga = setInterval(cargar, 60_000);
    const reloj = setInterval(() => setTic((t) => t + 1), 30_000);
    return () => {
      clearInterval(recarga);
      clearInterval(reloj);
    };
  }, [cargar]);

  async function revisarAhora() {
    setRevisando(true);
    setError(null);
    const res = await fetch("/api/vigilante", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) setError(data?.error || "No se pudo revisar.");
    await cargar();
    setAbierto(true);
    setRevisando(false);
  }

  if (oculto) return null;

  if (!estado) {
    return (
      <section className="dsh-card vg" aria-busy="true">
        <p className="dsh-muted">Comprobando el vigilante…</p>
      </section>
    );
  }

  const segundos = estado.segundosDesde ?? null;
  const nivel: Nivel = !estado.instalado || segundos === null ? "sin-instalar" : segundos < 25 * 60 ? "activo" : segundos < 60 * 60 ? "retrasado" : "detenido";
  const informe = estado.informe;
  const abiertas = estado.abiertas ?? 0;
  const proxima = segundos !== null ? Math.max(0, 15 - Math.floor(segundos / 60)) : null;

  return (
    <section className={`dsh-card vg vg-${nivel}`} aria-labelledby="vg-titulo">
      <header className="dsh-card-header">
        <h2 id="vg-titulo" className="vg-titulo">
          <ShieldCheck size={18} aria-hidden="true" /> Vigilante automático
        </h2>
        <span className={`vg-insignia vg-insignia-${nivel}`} role="status">
          <span className="vg-latido" aria-hidden="true" />
          {ETIQUETA[nivel]}
        </span>
      </header>

      {nivel === "sin-instalar" ? (
        <p className="dsh-muted">
          Aún no se ha ejecutado. Sube <code>vigilante.php</code>, ejecuta <code>vigilante.sql</code> y crea el job de cron-job.org para{" "}
          <code>/api/cron/vigilante</code> cada 15 min.
        </p>
      ) : (
        <>
          <p className="vg-linea">
            Última revisión <strong>{hace(segundos!)}</strong>
            {nivel === "activo" && proxima !== null && <span className="dsh-muted"> · próxima en ~{proxima} min</span>}
          </p>
          {nivel !== "activo" && (
            <p className="dsh-alerta dsh-alerta-error" role="alert">
              No revisa desde hace más de {nivel === "retrasado" ? "25 min" : "1 hora"}. Comprueba el job de cron-job.org (activo, URL y cabecera
              Authorization).
            </p>
          )}
          <ul className="vg-chips" aria-label="Resumen">
            <li className={abiertas ? "vg-chip vg-chip-aviso" : "vg-chip vg-chip-ok"}>
              {abiertas ? `${abiertas} incidencia(s) abierta(s)` : "Sin incidencias"}
            </li>
            {!!estado.silenciadas && <li className="vg-chip">{estado.silenciadas} silenciada(s)</li>}
            <li className={estado.telegram ? "vg-chip vg-chip-ok" : "vg-chip vg-chip-aviso"}>
              Telegram {estado.telegram ? "conectado" : "sin configurar"}
            </li>
          </ul>
        </>
      )}

      {error && <p role="alert" className="dsh-alerta dsh-alerta-error">{error}</p>}

      <div className="dsh-cabecera-acciones">
        <button type="button" className="dsh-boton dsh-boton-mini" onClick={revisarAhora} disabled={revisando}>
          <RefreshCw size={14} aria-hidden="true" className={revisando ? "dsh-girando" : undefined} />
          {revisando ? "Revisando…" : "Revisar ahora"}
        </button>
        {informe && (
          <button type="button" className="dsh-enlace vg-detalle-btn" aria-expanded={abierto} aria-controls="vg-detalle" onClick={() => setAbierto(!abierto)}>
            Ver última revisión <ChevronDown size={14} aria-hidden="true" className="vg-chevron" />
          </button>
        )}
      </div>

      {abierto && informe && (
        <div id="vg-detalle" className="vg-detalle">
          <h3>Revisado</h3>
          <ul>{informe.revisado.map((r) => <li key={r}>{r}</li>)}</ul>
          {informe.corregido.length > 0 && (
            <>
              <h3>🛠️ Corregido solo</h3>
              <ul>{informe.corregido.map((r) => <li key={r}>{r}</li>)}</ul>
            </>
          )}
          {informe.problemas.length > 0 && (
            <>
              <h3>⚠️ Necesita revisión</h3>
              <ul>{informe.problemas.map((p) => <li key={p.clave}>{p.titulo}</li>)}</ul>
            </>
          )}
          {informe.resueltos.length > 0 && (
            <>
              <h3>✅ Resueltos</h3>
              <ul>{informe.resueltos.map((r) => <li key={r}>{r}</li>)}</ul>
            </>
          )}
          {informe.error && <p className="dsh-alerta dsh-alerta-error">{informe.error}</p>}
        </div>
      )}
    </section>
  );
}
