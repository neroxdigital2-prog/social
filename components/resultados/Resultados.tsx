"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Desplegable } from "@/components/ui/Desplegable";
import { descargarCSV, sello } from "@/lib/exportar";
import { DIMENSIONES, type FilaCriterio, type Informe, type PublicacionAnalizada } from "@/lib/estadisticas/analisis";

const VEREDICTO: Record<FilaCriterio["veredicto"], { icono: string; texto: string; clase: string }> = {
  FUNCIONA: { icono: "🟢", texto: "Funciona", clase: "rs-ok" },
  NORMAL: { icono: "🟡", texto: "Normal", clase: "rs-normal" },
  NO_FUNCIONA: { icono: "🔴", texto: "No funciona", clase: "rs-mal" },
  POCOS_DATOS: { icono: "⚪", texto: "Pocos datos", clase: "rs-nd" },
};
const RESULTADO: Record<PublicacionAnalizada["resultado"], string> = {
  PUBLICADA: "✅ Publicada",
  PARCIAL: "🟡 Parcial",
  ERROR: "❌ Error",
  PROGRAMADA: "⏱️ Programada",
  BORRADOR: "📝 Borrador",
};

const fmt = (x: number) => new Intl.NumberFormat("es-ES").format(x);
const fecha = (f: string | null) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)} ${f.slice(11, 16)}` : "—");

function hoyMenos(dias: number) {
  const d = new Date(Date.now() - dias * 86400_000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
}

export function Resultados({ empresaId }: { empresaId: string }) {
  const [desde, setDesde] = useState(hoyMenos(90));
  const [hasta, setHasta] = useState(hoyMenos(-30));
  const [informe, setInforme] = useState<Informe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState<{ dim: string; valor: string } | null>(null);
  const [buscar, setBuscar] = useState("");
  const [orden, setOrden] = useState<"fecha" | "tasa" | "alcance">("fecha");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const res = await fetch(`/api/estadisticas?empresa=${empresaId}&desde=${desde}&hasta=${hasta}`, { cache: "no-store" }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setCargando(false);
    if (!res?.ok || !d?.kpis) return setError(d?.error || "No se pudieron cargar las estadísticas.");
    setInforme(d);
  }, [empresaId, desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const lista = useMemo(() => {
    if (!informe) return [];
    let l = informe.publicaciones;
    if (filtro) l = l.filter((p) => (p.criterios as unknown as Record<string, string>)[filtro.dim] === filtro.valor);
    if (buscar.trim()) {
      const b = buscar.toLowerCase();
      l = l.filter((p) => `${p.titulo} ${Object.values(p.criterios).join(" ")} ${p.noticia || ""}`.toLowerCase().includes(b));
    }
    return [...l].sort((a, b) => (orden === "tasa" ? (b.tasa ?? -1) - (a.tasa ?? -1) : orden === "alcance" ? b.alcance - a.alcance : (b.fecha || "").localeCompare(a.fecha || "")));
  }, [informe, filtro, buscar, orden]);

  function exportar() {
    descargarCSV(
      `resultados-publicaciones-${sello()}.csv`,
      ["Fecha", "Título", "Resultado", "Origen", "Formato", "Tipo", "Objetivo", "Palabra clave", "Categoría", "Día", "Franja", "Reel de prueba", "Alcance", "Reproducciones", "Me gusta", "Comentarios", "Compartidos", "Guardados", "Interacción %", "Puntuación"],
      lista.map((p) => [
        fecha(p.fecha),
        p.titulo,
        RESULTADO[p.resultado],
        p.criterios.origen,
        p.criterios.formato,
        p.criterios.tipo,
        p.criterios.objetivo,
        p.criterios.palabraClave,
        p.criterios.categoria,
        p.criterios.dia,
        p.criterios.franja,
        p.criterios.reelPrueba,
        p.alcance,
        p.reproducciones,
        p.meGusta,
        p.comentarios,
        p.compartidos,
        p.guardados,
        p.tasa ?? "",
        p.puntuacion ?? "",
      ])
    );
  }

  const k = informe?.kpis;
  return (
    <div className="rs">
      <div className="rs-filtros">
        <label>
          <span>Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <div className="rs-rapidos">
          {[30, 90, 365].map((d) => (
            <button key={d} type="button" className="crm-btn" onClick={() => { setDesde(hoyMenos(d)); setHasta(hoyMenos(0)); }}>
              Últimos {d} días
            </button>
          ))}
        </div>
        <button type="button" className="crm-btn" onClick={cargar} disabled={cargando}>
          <RefreshCw size={14} aria-hidden="true" className={cargando ? "dsh-girando" : undefined} /> Actualizar
        </button>
      </div>

      {error && <p role="alert" className="dsh-alerta dsh-alerta-error">{error}</p>}

      <Desplegable id="rs-resumen" titulo="📊 Resumen" subtitulo="Todas las publicaciones del periodo y sus resultados reales en Instagram y Facebook.">
        {!k ? (
          <p className="dsh-muted">Cargando…</p>
        ) : (
          <ul className="rs-kpis">
            <li><strong>{fmt(k.total)}</strong><span>publicaciones</span></li>
            <li><strong>{fmt(k.publicadas)}</strong><span>publicadas</span></li>
            <li className={k.conError ? "rs-kpi-mal" : undefined}><strong>{fmt(k.conError)}</strong><span>con error</span></li>
            <li><strong>{fmt(k.programadas)}</strong><span>programadas</span></li>
            <li><strong>{fmt(k.alcanceTotal)}</strong><span>alcance total</span></li>
            <li><strong>{fmt(k.alcanceMedio)}</strong><span>alcance medio</span></li>
            <li><strong>{k.tasaMedia ?? "—"}{k.tasaMedia !== null ? "%" : ""}</strong><span>interacción media</span></li>
            <li><strong>{fmt(k.guardados)}</strong><span>guardados</span></li>
            <li><strong>{fmt(k.compartidos)}</strong><span>compartidos</span></li>
            <li><strong>{fmt(k.comentarios)}</strong><span>comentarios</span></li>
          </ul>
        )}
      </Desplegable>

      <Desplegable id="rs-conclusiones" titulo="🧭 ¿Lo estamos haciendo bien?" subtitulo="Conclusiones automáticas comparando cada criterio con la media." resumen={informe ? `${informe.conclusiones.length} conclusión(es)` : undefined}>
        {!informe ? (
          <p className="dsh-muted">Cargando…</p>
        ) : (
          <ul className="rs-conclusiones">
            {informe.conclusiones.map((c, i) => (
              <li key={i} className={`rs-c-${c.tipo.toLowerCase()}`}>
                {c.tipo === "BIEN" ? "🟢" : c.tipo === "MAL" ? "🔴" : "ℹ️"} {c.texto}
              </li>
            ))}
          </ul>
        )}
      </Desplegable>

      <Desplegable id="rs-criterios" titulo="🧪 Qué criterio funciona" subtitulo="Interacción ponderada (me gusta ×1, comentarios ×2, compartidos ×3, guardados ×3) sobre el alcance. Pulsa una fila para ver sus publicaciones." abiertoPorDefecto>
        {!informe ? (
          <p className="dsh-muted">Cargando…</p>
        ) : (
          <div className="rs-dimensiones">
            {DIMENSIONES.map((d) => {
              const filas = informe.porCriterio[d.id] || [];
              if (!filas.length) return null;
              return (
                <details key={d.id} className="rs-dim" open={d.id === "origen" || d.id === "formato"}>
                  <summary>
                    <strong>{d.nombre}</strong> <span className="dsh-muted">· {filas.length} valor(es)</span>
                  </summary>
                  <div className="cc-tabla-scroll">
                    <table className="cc-tabla rs-tabla">
                      <thead>
                        <tr>
                          <th scope="col">{d.nombre}</th>
                          <th scope="col">Publ.</th>
                          <th scope="col">Con datos</th>
                          <th scope="col">Alcance medio</th>
                          <th scope="col">Interacción</th>
                          <th scope="col">vs media</th>
                          <th scope="col">Guard.</th>
                          <th scope="col">Comp.</th>
                          <th scope="col">Coment.</th>
                          <th scope="col">Veredicto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((f) => {
                          const activo = filtro?.dim === d.id && filtro.valor === f.valor;
                          return (
                            <tr key={f.valor} className={activo ? "rs-fila-activa" : undefined}>
                              <th scope="row">
                                <button type="button" className="rs-enlace" onClick={() => setFiltro(activo ? null : { dim: d.id, valor: f.valor })} aria-pressed={activo}>
                                  {f.valor}
                                </button>
                              </th>
                              <td>{f.publicaciones}</td>
                              <td>{f.conMetricas}</td>
                              <td>{fmt(f.alcanceMedio)}</td>
                              <td>{f.tasaMedia !== null ? `${f.tasaMedia}%` : "—"}</td>
                              <td>{f.vsMedia !== null ? `${f.vsMedia > 0 ? "+" : ""}${f.vsMedia}%` : "—"}</td>
                              <td>{f.guardadosMedio}</td>
                              <td>{f.compartidosMedio}</td>
                              <td>{f.comentariosMedio}</td>
                              <td className={VEREDICTO[f.veredicto].clase}>
                                {VEREDICTO[f.veredicto].icono} {VEREDICTO[f.veredicto].texto}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Desplegable>

      {informe && informe.mejores.length > 0 && (
        <Desplegable id="rs-ranking" titulo="🏆 Mejores y peores publicaciones" abiertoPorDefecto={false}>
          <div className="rs-ranking">
            {[
              { t: "Mejores", l: informe.mejores },
              { t: "Peores", l: informe.peores },
            ].map((g) => (
              <section key={g.t}>
                <h3>{g.t}</h3>
                <ol>
                  {g.l.map((p) => (
                    <li key={p.id}>
                      <strong>{p.titulo}</strong>
                      <small>
                        {p.criterios.origen} · {p.criterios.formato} · {fecha(p.fecha)} · interacción {p.tasa}% · alcance {fmt(p.alcance)}
                      </small>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </Desplegable>
      )}

      <Desplegable
        id="rs-todas"
        titulo="📋 Todas las publicaciones y su criterio"
        subtitulo={filtro ? `Filtrado por «${filtro.valor}»` : "Cada publicación con el criterio con que se creó y sus resultados."}
        resumen={informe ? `${lista.length} publicación(es)` : undefined}
        acciones={
          <button type="button" className="crm-btn" onClick={exportar} disabled={!lista.length}>
            <Download size={14} aria-hidden="true" /> Excel
          </button>
        }
      >
        <div className="rs-filtros">
          <label className="rs-buscar">
            <span>Buscar</span>
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Título, criterio, noticia…" />
          </label>
          <label>
            <span>Ordenar por</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)}>
              <option value="fecha">Fecha</option>
              <option value="tasa">Interacción</option>
              <option value="alcance">Alcance</option>
            </select>
          </label>
          {filtro && (
            <button type="button" className="crm-btn" onClick={() => setFiltro(null)}>
              Quitar filtro «{filtro.valor}»
            </button>
          )}
        </div>
        <ul className="rs-lista">
          {lista.slice(0, 200).map((p) => (
            <li key={p.id}>
              {p.miniatura ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.miniatura} alt="" loading="lazy" />
              ) : (
                <span className="pa-miniatura" aria-hidden="true" />
              )}
              <div className="rs-pub">
                <strong>{p.titulo}</strong>
                <small>
                  {fecha(p.fecha)} · {RESULTADO[p.resultado]} · {p.redes.map((r) => `${r.red === "INSTAGRAM" ? "IG" : r.red === "FACEBOOK" ? "FB" : r.red === "GOOGLE" ? "GB" : r.red}${r.ok ? "✓" : r.error ? "✗" : "…"}`).join(" ")}
                </small>
                <span className="rs-chips">
                  {[p.criterios.origen, p.criterios.formato, p.criterios.tipo, p.criterios.objetivo, p.criterios.palabraClave, p.criterios.categoria, p.criterios.franja, p.criterios.reelPrueba]
                    .filter((x) => x && x !== "—")
                    .map((x) => (
                      <span key={x} className="cc-chip">
                        {x}
                      </span>
                    ))}
                </span>
                {p.noticia && <small className="pa-fuente">📰 {p.noticia}</small>}
              </div>
              <dl className="rs-metricas">
                <div><dt>Alcance</dt><dd>{p.conMetricas ? fmt(p.alcance) : "—"}</dd></div>
                <div><dt>Interacción</dt><dd>{p.tasa !== null ? `${p.tasa}%` : "—"}</dd></div>
                <div><dt>Guard.</dt><dd>{p.conMetricas ? p.guardados : "—"}</dd></div>
                <div><dt>Comp.</dt><dd>{p.conMetricas ? p.compartidos : "—"}</dd></div>
                <div><dt>Coment.</dt><dd>{p.conMetricas ? p.comentarios : "—"}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
        {lista.length > 200 && <p className="dsh-muted">Mostrando 200 de {lista.length}. Descarga el Excel para verlas todas.</p>}
      </Desplegable>
    </div>
  );
}
