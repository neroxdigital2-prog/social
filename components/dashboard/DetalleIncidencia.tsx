import { ExternalLink } from "lucide-react";
import type { Incidencia } from "@/lib/dashboard";
import type { AccionDiagnostico } from "@/lib/diagnosticoRedes";

function formatearFecha(f: string): string {
  const d = new Date(f.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return f;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function enlaceAccion(a: AccionDiagnostico, empresaId: string, publicacionId?: string): { href: string; externo: boolean } {
  if (a.destino === "externo" && a.url) return { href: a.url, externo: true };
  if (a.destino === "publicacion" && publicacionId) return { href: `/biblioteca?empresa=${empresaId}#pub-${publicacionId}`, externo: false };
  if (a.destino === "configuracion") return { href: `/configuracion?empresa=${empresaId}`, externo: false };
  return { href: `/biblioteca?empresa=${empresaId}`, externo: false };
}

export function DetalleIncidencia({ incidencia, empresaId }: { incidencia: Incidencia; empresaId: string }) {
  const d = incidencia.diagnostico;
  const primeraAfectada = incidencia.afectadas[0]?.id;

  return (
    <div className="dsh-detalle">
      <dl className="dsh-detalle-datos">
        <div>
          <dt>Qué pasa</dt>
          <dd>{d.causa}</dd>
        </div>
        <div>
          <dt>Último fallo</dt>
          <dd>{formatearFecha(incidencia.fecha)}</dd>
        </div>
      </dl>

      <div>
        <h4 className="dsh-detalle-titulo">Cómo solucionarlo</h4>
        <ol className="dsh-pasos">
          {d.pasos.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </div>

      {incidencia.afectadas.length > 0 && (
        <div>
          <h4 className="dsh-detalle-titulo">
            Publicaciones afectadas{incidencia.afectadas.length >= 5 ? " (últimas 5)" : ""}
          </h4>
          <ul className="dsh-afectadas">
            {incidencia.afectadas.map((p) => (
              <li key={`${p.id}-${p.fecha}`}>
                <a href={`/biblioteca?empresa=${empresaId}#pub-${p.id}`}>{p.titulo}</a>
                <span className="dsh-muted"> · {formatearFecha(p.fecha)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="dsh-original">
        <summary>Mensaje original de {incidencia.nombreRed}</summary>
        <code>{incidencia.mensaje}</code>
      </details>

      <div className="dsh-acciones-detalle">
        {d.acciones.map((a) => {
          const { href, externo } = enlaceAccion(a, empresaId, primeraAfectada);
          return (
            <a
              key={a.etiqueta}
              href={href}
              className="dsh-boton dsh-boton-mini"
              {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {a.etiqueta}
              {externo && <ExternalLink size={13} aria-hidden="true" />}
            </a>
          );
        })}
      </div>
    </div>
  );
}
