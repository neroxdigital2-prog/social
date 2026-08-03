import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SelectorPaginaFacebook } from "@/components/configuracion/SelectorPaginaFacebook";

interface PaginaFacebook {
  id: string;
  name: string;
}

export default async function ElegirPaginaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cookieStore = cookies();
  const pendiente = cookieStore.get("fb_pag_pend")?.value;

  let paginas: PaginaFacebook[] = [];
  let empresaId = "";
  if (pendiente) {
    try {
      const decoded = JSON.parse(Buffer.from(pendiente, "base64url").toString("utf-8"));
      empresaId = decoded.empresaId;
      paginas = (decoded.paginas || []).map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }));
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
          <SelectorPaginaFacebook paginas={paginas} empresaId={empresaId} />
        )}
      </section>
    </main>
  );
}
