import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Resultados } from "@/components/resultados/Resultados";
import { empresasDelUsuario } from "@/lib/empresasActivas";

export default async function ResultadosPage({ searchParams }: { searchParams: { empresa?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const empresaId = searchParams.empresa || (await empresasDelUsuario(session.user.id!))?.[0]?.id;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>📊 Resultados</h1>
        <p className="text-muted">Estadística real de todas las publicaciones: qué criterio se usó en cada una y si está funcionando.</p>
      </header>
      {empresaId ? <Resultados empresaId={empresaId} /> : <p className="text-muted">Elige una empresa en el selector de arriba.</p>}
    </main>
  );
}
