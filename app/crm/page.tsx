import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CRMLista } from "@/components/crm/CRMLista";

interface Lead {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  origen: string;
  estado: string;
  valorEstimado: number | null;
  createdAt: string;
}

async function bridgePost(url: string | undefined, body: unknown) {
  if (!url) {
    console.error("bridgePost: URL de entorno no definida");
    return null;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET! },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return await res.json();
  } catch (error) {
    console.error("bridgePost falló:", error);
    return null;
  }
}

export default async function CRMPage({ searchParams }: { searchParams: { empresa?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const empresas = await bridgePost(process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST, {
    userId: session.user.id,
  });
  const listaEmpresas = Array.isArray(empresas) ? empresas : [];
  const empresaId = searchParams.empresa || listaEmpresas[0]?.id;

  let leads: Lead[] = [];
  let errorCarga = false;

  if (empresaId) {
    const data = await bridgePost(process.env.IONOS_BRIDGE_URL_LEADS_LIST, {
      userId: session.user.id,
      empresaId,
    });
    if (Array.isArray(data)) {
      leads = data;
    } else {
      errorCarga = true;
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>CRM de clientes</h1>
        <p className="text-muted">Gestiona tus leads y su progreso en el embudo de ventas</p>
      </header>
      <section className="form-card">
        {!empresaId ? (
          <p>
            Aún no tienes empresas registradas. <a href="/empresas/nueva">Crea tu primera empresa</a>
          </p>
        ) : errorCarga ? (
          <p className="cal-error" style={{ display: "inline-block" }}>
            No se pudieron cargar los leads. Verifica la configuración del servidor e inténtalo de nuevo.
          </p>
        ) : (
          <CRMLista leads={leads} empresaId={empresaId} />
        )}
      </section>
    </main>
  );
}
