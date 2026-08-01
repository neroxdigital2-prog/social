import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CalendarioSemana } from "@/components/calendario/CalendarioSemana";

interface Publicacion {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  hashtags: string[];
  estado: string;
  imagenUrl: string | null;
  fechaProgramada: string | null;
}

async function bridgePost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET! },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return res.json().catch(() => null);
}

// Lunes de la semana que contiene `fecha`
function lunesDeLaSemana(fecha: Date): Date {
  const d = new Date(fecha);
  const dia = d.getDay(); // 0 = domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: { empresa?: string; semana?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const empresas = await bridgePost(process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST!, {
    userId: session.user.id,
  });
  const listaEmpresas = Array.isArray(empresas) ? empresas : [];
  const empresaId = searchParams.empresa || listaEmpresas[0]?.id;

  let publicaciones: Publicacion[] = [];
  if (empresaId) {
    const data = await bridgePost(process.env.IONOS_BRIDGE_URL_PUBLICACIONES_LIST!, {
      userId: session.user.id,
      empresaId,
    });
    publicaciones = Array.isArray(data) ? data : [];
  }

  const offsetSemanas = Number(searchParams.semana || 0);
  const hoy = new Date();
  const inicioSemana = lunesDeLaSemana(hoy);
  inicioSemana.setDate(inicioSemana.getDate() + offsetSemanas * 7);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Calendario de publicaciones</h1>
        <p className="text-muted">Programa cuándo se publica cada contenido generado</p>
      </header>
      <section className="form-card">
        {!empresaId ? (
          <p>
            Aún no tienes empresas registradas. <a href="/empresas/nueva">Crea tu primera empresa</a>
          </p>
        ) : (
          <CalendarioSemana
            publicaciones={publicaciones}
            inicioSemanaISO={inicioSemana.toISOString()}
            offsetSemanas={offsetSemanas}
            empresaId={empresaId}
          />
        )}
      </section>
    </main>
  );
}
