import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PanelCrecimiento } from "@/components/crecimiento/PanelCrecimiento";
import { empresasDelUsuario } from "@/lib/empresasActivas";

export default async function CrecimientoPage({ searchParams }: { searchParams: { empresa?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const empresaId = searchParams.empresa || (await empresasDelUsuario(session.user.id!))?.[0]?.id;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>📈 Crecimiento</h1>
        <p className="text-muted">
          Seguidores reales de Instagram y Facebook y lo que aportan las publicaciones. Datos leídos de Meta cada hora.
        </p>
      </header>
      <PanelCrecimiento empresaId={empresaId} />
    </main>
  );
}
