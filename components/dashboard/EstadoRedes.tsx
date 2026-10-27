import type { EstadoRed } from "@/lib/dashboard";

export function EstadoRedes({ redes, empresaId }: { redes: EstadoRed[]; empresaId: string }) {
  return (
    <section className="dsh-card" aria-labelledby="dsh-redes-titulo">
      <header className="dsh-card-header">
        <h2 id="dsh-redes-titulo">Redes</h2>
        <a className="dsh-enlace" href={`/configuracion?empresa=${empresaId}`}>Gestionar</a>
      </header>
      <ul className="dsh-lista">
        {redes.map((r) => {
          const estado = !r.conectada ? "off" : r.ultimoError ? "error" : "ok";
          const textoEstado = estado === "off" ? "No conectada" : estado === "error" ? "Con errores" : "Activa";
          return (
            <li key={r.red} className="dsh-fila dsh-fila-compacta">
              <span className={`dsh-estado dsh-estado-${estado}`} aria-hidden="true" />
              <span className="dsh-fila-texto">
                <strong>{r.nombre}</strong>
                <span className="dsh-muted">{r.cuenta || textoEstado}</span>
              </span>
              <span className={`dsh-etiqueta-estado dsh-etiqueta-${estado}`}>{textoEstado}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
