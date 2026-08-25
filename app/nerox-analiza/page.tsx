import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PanelNeroxAnaliza } from "@/components/nerox-analiza/PanelNeroxAnaliza";

export default async function NeroxAnalizaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>🔎 Nerox Analiza</h1>
        <p className="text-muted">
          Negocios detectados automáticamente por el Agente Analista, con su diagnóstico digital y la acción
          recomendada. Sirven como base para el pilar de contenido &quot;Nerox Analiza&quot;.
        </p>
      </header>
      <section className="form-card">
        <PanelNeroxAnaliza />
      </section>
    </main>
  );
}
