import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SelectorPaginaFacebook } from "@/components/configuracion/SelectorPaginaFacebook";

interface PaginaFacebook {
  id: string;
  name: string;
}

export default async function ElegirPaginaPage({
  searchParams,
}: {
  searchParams: { empresa?: string; seleccion?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const seleccionId = searchParams.seleccion || "";
  let paginas: PaginaFacebook[] = [];
  let empresaId = searchParams.empresa || "";

  if (seleccionId) {
    try {
      const res = await fetch(process.env.IONOS_BRIDGE_URL_FACEBOOK_SELECCION_LEER!, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET! },
        body: JSON.stringify({ id: seleccionId }),
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        empresaId = data.empresaId || empresaId;
        paginas = (data.paginas || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
      }
    } catch {
      paginas = [];
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Elige la página de Facebook</h1>
        <p className="text-muted">
          Administras varias páginas. Elige cuál quieres conectar a esta empresa en Nerox Social IA.
        </p>
      </header>
      <section className="form-card">
        {paginas.length === 0 ? (
          <p>
            La selección expiró o no es válida.{" "}
            <a href={`/configuracion?empresa=${empresaId}`}>Vuelve a Configuración e inténtalo de nuevo.</a>
          </p>
        ) : (
          <SelectorPaginaFacebook paginas={paginas} empresaId={empresaId} seleccionId={seleccionId} />
        )}
      </section>
    </main>
  );
}
