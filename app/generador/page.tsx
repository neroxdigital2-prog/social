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

    const textoCrudo = await res.text();

    // ===== DIAGNÓSTICO TEMPORAL — quitar después de resolver =====
    console.log("[DIAGNOSTICO empresas] status:", res.status);
    console.log("[DIAGNOSTICO empresas] userId enviado:", session.user.id);
    console.log("[DIAGNOSTICO empresas] respuesta cruda:", textoCrudo);
    // ================================================================

    const data = JSON.parse(textoCrudo);

    if (Array.isArray(data)) {
      empresas = data
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((e) => ({ id: e.id, nombre: e.nombre }));
    } else {
      console.log("[DIAGNOSTICO empresas] la respuesta NO es un array:", data);
    }
  } catch (err) {
    console.log("[DIAGNOSTICO empresas] ERROR capturado:", err);
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
