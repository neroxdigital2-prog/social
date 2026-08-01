import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { GeneradorForm } from "@/components/generador/GeneradorForm";

export default async function GeneradorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let empresas: { id: string; nombre: string }[] = [];

  try {
    const res = await fetch(process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bridge-Secret": process.env.BRIDGE_SECRET!,
      },
      body: JSON.stringify({ userId: session.user.id }),
      cache: "no-store",
    });

    const data = await res.json();

    if (Array.isArray(data)) {
      empresas = data
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((e) => ({ id: e.id, nombre: e.nombre }));
    }
  } catch (error) {
    console.error("Error al cargar empresas:", error);
    empresas = [];
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Generador de contenido IA</h1>
        <p className="text-muted">Elige una empresa y genera publicaciones listas para revisar y programar</p>
      </header>
      <section className="form-card">
        {empresas.length === 0 ? (
          <p>Aún no tienes empresas registradas. <a href="/empresas/nueva">Crea tu primera empresa</a></p>
        ) : (
          <GeneradorForm empresas={empresas} />
        )}
      </section>
    </main>
  );
}
