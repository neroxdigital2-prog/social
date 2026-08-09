import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let empresas = 0;
  try {
    const res = await fetch(process.env.IONOS_BRIDGE_URL_EMPRESAS_COUNT!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bridge-Secret": process.env.BRIDGE_SECRET!,
      },
      body: JSON.stringify({ userId: session.user.id }),
      cache: "no-store",
    });
    const data = await res.json();
    empresas = data.count ?? 0;
  } catch {
    empresas = 0;
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Bienvenido, {session.user.name}</h1>
        <p className="text-muted">Este es el resumen de tu actividad</p>
      </header>
      <section className="stats-grid">
        <article className="stat-card"><span className="stat-number">{empresas}</span><span className="stat-label">Empresas registradas</span></article>
      </section>
      <a href="/empresas" className="btn-primary btn-large" style={{ textDecoration: "none" }}>Ver mis empresas</a>
      <a href="/empresas/nueva" className="btn-primary btn-large">+ Registrar empresa</a>
      <a href="/generador" className="btn-primary btn-large">+ Generar contenido con IA</a>
    </main>
  );
}
