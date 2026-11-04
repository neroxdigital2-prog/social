// Utilidades de exportación en el navegador (Excel/CSV) y formato de fechas.

// Fechas de MySQL ("YYYY-MM-DD HH:MM:SS.fff") o ISO → Date (Safari no acepta el espacio)
export function aFecha(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const d = new Date(valor.includes("T") ? valor : valor.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fechaHora(valor: string | null | undefined): string {
  const d = aFecha(valor);
  if (!d) return "—";
  return d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function celda(v: unknown): string {
  const texto = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// CSV con ";" y BOM UTF-8: Excel en español lo abre con columnas y tildes correctas
export function descargarCSV(nombreArchivo: string, cabeceras: string[], filas: unknown[][]) {
  const contenido = [cabeceras, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sello(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function anotarDescarga(empresaId: string, descripcion: string) {
  await fetch("/api/crm/registro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empresaId, tipo: "INFORME_DESCARGADO", descripcion }),
  }).catch(() => null);
}
