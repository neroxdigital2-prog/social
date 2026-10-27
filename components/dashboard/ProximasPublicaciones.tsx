import { CalendarClock, ImageOff } from "lucide-react";
import type { ProximaPublicacion } from "@/lib/dashboard";

const CORTO: Record<string, string> = { FACEBOOK: "FB", INSTAGRAM: "IG", GOOGLE: "GB", LINKEDIN: "IN", TIKTOK: "TT", TWITTER: "X" };

function formatearFecha(f: string): string {
  const d = new Date(f.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return f;
  return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function ProximasPublicaciones({ items, empresaId }: { items: ProximaPublicacion[]; empresaId: string }) {
  return (
    <section className="dsh-card" aria-labelledby="dsh-proximas-titulo">
      <header className="dsh-card-header">
        <h2 id="dsh-proximas-titulo">Próximas publicaciones</h2>
        <a className="dsh-enlace" href={`/calendario?empresa=${empresaId}`}>Ver calendario</a>
      </header>
      {items.length === 0 ? (
        <p className="dsh-vacio">
          <CalendarClock size={18} aria-hidden="true" /> No hay nada programado.{" "}
          <a className="dsh-enlace" href={`/generador?empresa=${empresaId}`}>Generar contenido</a>
        </p>
      ) : (
        <ul className="dsh-lista">
          {items.map((p) => (
            <li key={p.id} className="dsh-fila">
              {p.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagenUrl} alt="" width={36} height={64} loading="lazy" className="dsh-miniatura" />
              ) : (
                <span className="dsh-miniatura dsh-miniatura-vacia" aria-hidden="true"><ImageOff size={14} /></span>
              )}
              <span className="dsh-fila-texto">
                <strong>{p.titulo}</strong>
                <span className="dsh-muted">{formatearFecha(p.fecha)} · {p.tipo.replace(/_/g, " ").toLowerCase()}</span>
              </span>
              <span className="dsh-chips" aria-label={`Redes: ${p.redes.join(", ")}`}>
                {p.redes.map((r) => <span key={r} className="dsh-chip">{CORTO[r] || r}</span>)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
