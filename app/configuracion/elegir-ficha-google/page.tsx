import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { COOKIE_SELECCION_GOOGLE, descifrarSeleccion, listarFichasGoogle, type FichaGoogle } from "@/lib/googleBusiness";
import { SelectorFichaGoogle } from "@/components/configuracion/SelectorFichaGoogle";

export const dynamic = "force-dynamic";

export default async function ElegirFichaGooglePage({ searchParams }: { searchParams: { empresa?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const seleccion = descifrarSeleccion(cookies().get(COOKIE_SELECCION_GOOGLE)?.value);
  const empresaId = seleccion?.empresaId || searchParams.empresa || "";

  let fichas: FichaGoogle[] = [];
  let error = "";
  if (seleccion) {
    try {
      fichas = await listarFichasGoogle(seleccion.accessToken);
    } catch (e) {
      error = e instanceof Error ? e.message : "No se pudieron cargar las fichas.";
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Elige la ficha de Google Business</h1>
        <p className="text-muted">
          Tu cuenta de Google administra varias fichas. Elige la que corresponde a esta empresa en Nerox Social IA.
        </p>
      </header>
      <section className="form-card">
        {!seleccion || fichas.length === 0 ? (
          <p>
            {error || "La selección expiró o no es válida."}{" "}
            <a href={`/configuracion?empresa=${empresaId}`}>Vuelve a Configuración y conecta Google Business de nuevo.</a>
          </p>
        ) : (
          <SelectorFichaGoogle fichas={fichas} empresaId={empresaId} />
        )}
      </section>
    </main>
  );
}
