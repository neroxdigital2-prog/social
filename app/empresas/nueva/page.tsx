import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { EmpresaForm } from "@/components/empresas/EmpresaForm";

export default async function NuevaEmpresaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Registra tu empresa</h1>
        <p className="text-muted">Esta información entrena a la IA para generar contenido adaptado a tu negocio</p>
      </header>
      <section className="form-card"><EmpresaForm /></section>
    </main>
  );
}
