"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Pencil, Printer, RefreshCw, Trash2 } from "lucide-react";
import { anotarDescarga, descargarCSV, fechaHora, sello } from "@/lib/exportar";

interface Fila {
  id: string;
  empresaId: string | null;
  tipo: string;
  descripcion: string;
  detalle: string | null;
  nota: string | null;
  createdAt: string;
  updatedAt: string;
}

const TIPOS: Record<string, string> = {
  LEAD_CREADO: "Lead creado",
  LEAD_ESTADO: "Cambio de estado",
  LEADS_BORRADOS: "Leads borrados",
  BUSQUEDA_RADAR: "Búsqueda RADAR",
  RADAR_RESULTADO_BORRADO: "Resultado RADAR borrado",
  INFORME_DESCARGADO: "Informe descargado",
};

function haceDias(n: number): string {
  const d = new Date(Date.now() - n * 86400000);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Confirmacion = { tipo: "seleccion" | "todo"; cantidad: number } | null;

export function RegistroActividad({ empresaId, version }: { empresaId: string; version: number }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [desde, setDesde] = useState(haceDias(30));
  const [hasta, setHasta] = useState(haceDias(0));
  const [tipo, setTipo] = useState("");
  const [q, setQ] = useState("");

  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState<Confirmacion>(null);
  const [borrando, setBorrando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [borradorDesc, setBorradorDesc] = useState("");
  const [borradorNota, setBorradorNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const params = new URLSearchParams({ empresa: empresaId, desde, hasta, tipo, q: q.trim() });
    const res = await fetch(`/api/crm/registro?${params}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    setCargando(false);
    if (!res.ok || !Array.isArray(data)) {
      setError(data?.error || "No se pudo cargar el registro.");
      setFilas([]);
      return;
    }
    setFilas(data);
    setSeleccion(new Set());
  }, [empresaId, desde, hasta, tipo, q]);

  useEffect(() => {
    const t = setTimeout(cargar, q ? 350 : 0); // espera a que termine de escribir la búsqueda
    return () => clearTimeout(t);
  }, [cargar, version, q]);

  const todasMarcadas = filas.length > 0 && filas.every((f) => seleccion.has(f.id));
  const algunaMarcada = filas.some((f) => seleccion.has(f.id));
  const resumenTipos = useMemo(() => {
    const m = new Map<string, number>();
    filas.forEach((f) => m.set(f.tipo, (m.get(f.tipo) || 0) + 1));
    return Array.from(m.entries());
  }, [filas]);

  function alternar(id: string) {
    setSeleccion((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function borrar() {
    if (!confirmar) return;
    setBorrando(true);
    setError(null);
    const cuerpo = confirmar.tipo === "todo" ? { empresaId, todo: true } : { empresaId, ids: Array.from(seleccion) };
    const res = await fetch("/api/crm/registro", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const data = await res.json().catch(() => ({}));
    setBorrando(false);
    setConfirmar(null);
    if (!res.ok) {
      setError(data?.error || "No se pudo borrar.");
      return;
    }
    cargar();
  }

  function empezarEdicion(f: Fila) {
    setEditandoId(f.id);
    setBorradorDesc(f.descripcion);
    setBorradorNota(f.nota || "");
  }

  async function guardarEdicion(id: string) {
    if (!borradorDesc.trim()) return;
    setGuardando(true);
    const res = await fetch("/api/crm/registro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, descripcion: borradorDesc.trim(), nota: borradorNota }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(false);
    if (!res.ok) {
      setError(data?.error || "No se pudo guardar.");
      return;
    }
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, descripcion: borradorDesc.trim(), nota: borradorNota.trim() || null } : f)));
    setEditandoId(null);
  }

  function descargarExcel() {
    const origen = seleccion.size > 0 ? filas.filter((f) => seleccion.has(f.id)) : filas;
    descargarCSV(
      `registro_crm_${sello()}.csv`,
      ["Fecha y hora", "Tipo", "Descripción", "Nota", "Última edición"],
      origen.map((f) => [fechaHora(f.createdAt), TIPOS[f.tipo] || f.tipo, f.descripcion, f.nota || "", fechaHora(f.updatedAt)])
    );
    anotarDescarga(empresaId, `Descarga del registro de actividad en Excel (${origen.length} entradas, ${desde} a ${hasta})`);
  }

  function descargarPDF() {
    anotarDescarga(empresaId, `Informe PDF del registro de actividad (${filas.length} entradas, ${desde} a ${hasta})`);
    window.print();
  }

  return (
    <section className="reg" aria-labelledby="reg-titulo">
      <header className="reg-cabecera">
        <div>
          <h2 id="reg-titulo">Registro de actividad</h2>
          <p className="text-muted no-imprimir">
            Todo lo que se hace en el CRM y en las búsquedas RADAR, con fecha y hora. Puedes editarlo, borrarlo y descargarlo.
          </p>
        </div>
        <div className="reg-descargas no-imprimir">
          <button type="button" className="crm-btn" onClick={cargar} disabled={cargando}>
            <RefreshCw size={15} aria-hidden="true" /> Actualizar
          </button>
          <button type="button" className="crm-btn" onClick={descargarExcel} disabled={filas.length === 0}>
            <Download size={15} aria-hidden="true" /> Excel{seleccion.size > 0 ? ` (${seleccion.size})` : ""}
          </button>
          <button type="button" className="crm-btn" onClick={descargarPDF} disabled={filas.length === 0}>
            <Printer size={15} aria-hidden="true" /> PDF
          </button>
        </div>
      </header>

      <p className="reg-solo-imprimir">
        Informe de actividad · {fechaHora(`${desde} 00:00:00`).slice(0, 10)} – {fechaHora(`${hasta} 00:00:00`).slice(0, 10)} · generado el{" "}
        {new Date().toLocaleString("es-ES")}
      </p>

      <div className="reg-filtros no-imprimir">
        <label>
          Desde
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label>
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="reg-filtro-buscar">
          Buscar
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Texto o nota…" />
        </label>
      </div>

      {resumenTipos.length > 0 && (
        <ul className="reg-resumen" aria-label="Resumen por tipo">
          {resumenTipos.map(([t, n]) => (
            <li key={t}>
              <strong>{n}</strong> {TIPOS[t] || t}
            </li>
          ))}
        </ul>
      )}

      <div className="crm-barra no-imprimir">
        <label className="crm-check-todos">
          <input
            type="checkbox"
            checked={todasMarcadas}
            ref={(el) => {
              if (el) el.indeterminate = !todasMarcadas && algunaMarcada;
            }}
            onChange={() => setSeleccion(todasMarcadas ? new Set() : new Set(filas.map((f) => f.id)))}
            disabled={filas.length === 0}
          />
          Seleccionar todo ({filas.length})
        </label>
        <div className="crm-barra-acciones">
          <button
            type="button"
            className="crm-btn crm-btn-peligro"
            disabled={seleccion.size === 0 || borrando}
            onClick={() => setConfirmar({ tipo: "seleccion", cantidad: seleccion.size })}
          >
            <Trash2 size={15} aria-hidden="true" /> Borrar seleccionados ({seleccion.size})
          </button>
          <button
            type="button"
            className="crm-btn crm-btn-peligro"
            disabled={filas.length === 0 || borrando}
            onClick={() => setConfirmar({ tipo: "todo", cantidad: filas.length })}
          >
            Borrar todo el registro
          </button>
        </div>
      </div>

      {confirmar && (
        <div className="crm-confirmar no-imprimir" role="alertdialog" aria-labelledby="reg-confirmar-texto">
          <p id="reg-confirmar-texto">
            {confirmar.tipo === "todo" ? (
              <>
                ¿Borrar <strong>todo el registro de actividad</strong> de esta empresa (también las búsquedas RADAR)?
              </>
            ) : (
              <>
                ¿Borrar <strong>{confirmar.cantidad}</strong> entrada{confirmar.cantidad > 1 ? "s" : ""} del registro?
              </>
            )}{" "}
            No se puede deshacer.
          </p>
          <div className="crm-confirmar-acciones">
            <button type="button" className="crm-btn crm-btn-peligro-solido" onClick={borrar} disabled={borrando} autoFocus>
              {borrando ? "Borrando…" : "Sí, borrar"}
            </button>
            <button type="button" className="crm-btn" onClick={() => setConfirmar(null)} disabled={borrando}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="cal-error">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="text-muted" aria-live="polite">Cargando registro…</p>
      ) : filas.length === 0 && !error ? (
        <p className="cal-sin-publicaciones">No hay actividad en este periodo.</p>
      ) : (
        <div className="reg-tabla-envoltorio">
          <table className="reg-tabla">
            <thead>
              <tr>
                <th scope="col" className="no-imprimir">
                  <span className="sr-only">Seleccionar</span>
                </th>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Tipo</th>
                <th scope="col">Descripción</th>
                <th scope="col">Nota</th>
                <th scope="col" className="no-imprimir">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className={seleccion.has(f.id) ? "reg-marcada" : undefined}>
                  <td className="no-imprimir">
                    <input
                      type="checkbox"
                      checked={seleccion.has(f.id)}
                      onChange={() => alternar(f.id)}
                      aria-label={`Seleccionar entrada del ${fechaHora(f.createdAt)}`}
                    />
                  </td>
                  <td className="reg-fecha">
                    <time dateTime={f.createdAt}>{fechaHora(f.createdAt)}</time>
                  </td>
                  <td>
                    <span className={`reg-tipo reg-tipo-${f.tipo.toLowerCase()}`}>{TIPOS[f.tipo] || f.tipo}</span>
                  </td>
                  {editandoId === f.id ? (
                    <>
                      <td>
                        <textarea
                          className="reg-input"
                          value={borradorDesc}
                          onChange={(e) => setBorradorDesc(e.target.value)}
                          rows={3}
                          aria-label="Descripción"
                        />
                      </td>
                      <td>
                        <textarea
                          className="reg-input"
                          value={borradorNota}
                          onChange={(e) => setBorradorNota(e.target.value)}
                          rows={3}
                          placeholder="Añade una nota…"
                          aria-label="Nota"
                        />
                      </td>
                      <td className="no-imprimir reg-acciones-fila">
                        <button type="button" className="crm-btn crm-btn-mini" onClick={() => guardarEdicion(f.id)} disabled={guardando || !borradorDesc.trim()}>
                          {guardando ? "…" : "Guardar"}
                        </button>
                        <button type="button" className="crm-btn crm-btn-mini" onClick={() => setEditandoId(null)} disabled={guardando}>
                          Cancelar
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="reg-desc">{f.descripcion}</td>
                      <td className="reg-nota">{f.nota || <span className="text-muted no-imprimir">—</span>}</td>
                      <td className="no-imprimir reg-acciones-fila">
                        <button type="button" className="crm-btn crm-btn-mini" onClick={() => empezarEdicion(f)} aria-label="Editar entrada">
                          <Pencil size={14} aria-hidden="true" /> Editar
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
