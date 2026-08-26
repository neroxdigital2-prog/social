import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PanelCrecimiento } from "@/components/crecimiento/PanelCrecimiento";

export default async function CrecimientoPage({ searchParams }: { searchParams: { empresa?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>📈 Crecimiento</h1>
        <p className="text-muted">
          Evolución de seguidores de Instagram. Usa el selector de empresa de arriba para cambiar de cuenta.
        </p>
      </header>
      <section className="form-card">
        <PanelCrecimiento empresaId={searchParams.empresa} />
      </section>
    </main>
  );
}
