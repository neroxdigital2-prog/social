import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AgendaPanel } from "@/components/agenda/AgendaPanel";

async function bridgePost(url: string | undefined, body: unknown) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET! },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return await res.json();
  } catch {
    return null;
  }
}

export default async function AgendaPage({ searchParams }: { searchParams: { empresa?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const empresas = await bridgePost(process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST, {
    userId: session.user.id,
  });
  const listaEmpresas = Array.isArray(empresas) ? empresas : [];
  const empresaId = searchParams.empresa || listaEmpresas[0]?.id;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Agenda</h1>
        <p className="text-muted">Servicios, horario de atención y citas de tus clientes</p>
      </header>
      <section className="form-card">
        {!empresaId ? (
          <p>
            Aún no tienes empresas registradas. <a href="/empresas/nueva">Crea tu primera empresa</a>
          </p>
        ) : (
          <AgendaPanel empresaId={empresaId} />
        )}
      </section>
    </main>
  );
}
