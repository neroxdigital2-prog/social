import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import PDFDocument from "pdfkit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BRIDGE_SECRET = process.env.BRIDGE_SECRET!;
const BRIDGE_SNAPSHOT_LISTAR = process.env.IONOS_BRIDGE_URL_SNAPSHOT_LISTAR!;
const BRIDGE_EMPRESAS_LIST = process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST!;

interface Snapshot {
  fecha: string;
  seguidores: number;
  publicaciones: number | null;
}

function dibujarGrafica(doc: PDFKit.PDFDocument, snapshots: Snapshot[], x: number, y: number, ancho: number, alto: number) {
  if (snapshots.length < 2) return;

  const valores = snapshots.map((s) => s.seguidores);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;

  // Ejes
  doc.strokeColor("#d1d1d6").lineWidth(1);
  doc.moveTo(x, y).lineTo(x, y + alto).lineTo(x + ancho, y + alto).stroke();

  // Etiquetas min/max en el eje Y
  doc.fontSize(8).fillColor("#6e6e73");
  doc.text(String(max), x - 30, y - 4, { width: 26, align: "right" });
  doc.text(String(min), x - 30, y + alto - 4, { width: 26, align: "right" });

  // Linea de la serie
  const paso = ancho / (snapshots.length - 1);
  doc.strokeColor("#7c3aed").lineWidth(2);
  snapshots.forEach((s, i) => {
    const px = x + i * paso;
    const py = y + alto - ((s.seguidores - min) / rango) * alto;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();

  // Puntos
  doc.fillColor("#7c3aed");
  snapshots.forEach((s, i) => {
    const px = x + i * paso;
    const py = y + alto - ((s.seguidores - min) / rango) * alto;
    doc.circle(px, py, 2).fill();
  });

  // Etiquetas de fecha (primera, mitad, ultima para no saturar)
  doc.fontSize(7).fillColor("#6e6e73");
  const indicesEtiqueta = [0, Math.floor(snapshots.length / 2), snapshots.length - 1];
  indicesEtiqueta.forEach((i) => {
    const px = x + i * paso;
    doc.text(snapshots[i].fecha, px - 25, y + alto + 6, { width: 50, align: "center" });
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const empresaId = req.nextUrl.searchParams.get("empresa");
  if (!empresaId) return NextResponse.json({ error: "Falta el parámetro empresa." }, { status: 400 });

  const desde = req.nextUrl.searchParams.get("desde") || undefined;
  const hasta = req.nextUrl.searchParams.get("hasta") || undefined;

  try {
    // 1) Nombre de la empresa
    let nombreEmpresa = "Empresa";
    if (BRIDGE_EMPRESAS_LIST) {
      const resEmp = await fetch(BRIDGE_EMPRESAS_LIST, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
        body: JSON.stringify({ userId: session.user.id }),
        cache: "no-store",
      });
      const empresas = await resEmp.json().catch(() => []);
      const encontrada = Array.isArray(empresas) ? empresas.find((e: any) => e.id === empresaId) : null;
      if (encontrada?.nombre) nombreEmpresa = encontrada.nombre;
    }

    // 2) Datos de crecimiento
    const resSnap = await fetch(BRIDGE_SNAPSHOT_LISTAR, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": BRIDGE_SECRET },
      body: JSON.stringify({ empresaId, desde, hasta }),
      cache: "no-store",
    });
    const dataSnap = await resSnap.json().catch(() => ({ snapshots: [] }));
    const snapshots: Snapshot[] = dataSnap.snapshots || [];

    if (snapshots.length === 0) {
      return NextResponse.json({ error: "No hay datos de seguidores en ese rango de fechas todavía." }, { status: 404 });
    }

    // 3) Generar PDF
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));

    const finalizado = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(20).fillColor("#1d1d1f").text("Informe de crecimiento en Instagram", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(13).fillColor("#6e6e73").text(nombreEmpresa);
    doc.fontSize(10).fillColor("#6e6e73").text(`Periodo: ${dataSnap.desde} — ${dataSnap.hasta}`);
    doc.moveDown(1.5);

    const primerSeguidores = snapshots[0].seguidores;
    const ultimoSeguidores = snapshots[snapshots.length - 1].seguidores;
    const crecimiento = ultimoSeguidores - primerSeguidores;

    doc.fontSize(11).fillColor("#1d1d1f");
    doc.text(`Seguidores al inicio del periodo: ${primerSeguidores}`);
    doc.text(`Seguidores al final del periodo: ${ultimoSeguidores}`);
    doc
      .fillColor(crecimiento >= 0 ? "#1a8a4c" : "#c0392b")
      .text(`Crecimiento: ${crecimiento >= 0 ? "+" : ""}${crecimiento} seguidores`);
    doc.moveDown(1.5);

    dibujarGrafica(doc, snapshots, 90, doc.y, 400, 180);
    doc.y += 210;

    doc.fontSize(12).fillColor("#1d1d1f").text("Detalle diario", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor("#6e6e73");
    snapshots.forEach((s) => {
      doc.text(`${s.fecha}   ·   ${s.seguidores} seguidores${s.publicaciones !== null ? `   ·   ${s.publicaciones} publicaciones` : ""}`);
    });

    doc.end();
    const bufferPdf = await finalizado;

    return new NextResponse(bufferPdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="crecimiento-${empresaId}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Fallo al generar el PDF: " + (error?.message || "error desconocido") }, { status: 502 });
  }
}
