import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PanelSalud } from "@/components/salud/PanelSalud";

export default async function SaludPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Estado del sistema</h1>
        <p className="text-muted">Revisa de un vistazo si todos los bridges de IONOS responden correctamente.</p>
      </header>
      <section className="form-card">
        <PanelSalud />
      </section>
    </main>
  );
}
