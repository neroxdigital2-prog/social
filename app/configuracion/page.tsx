import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ConfiguracionApiKeys } from "@/components/configuracion/ConfiguracionApiKeys";
import { RedesConectadas } from "@/components/configuracion/RedesConectadas";
import { ConectarX } from "@/components/configuracion/ConectarX";

async function bridgePost(url: string | undefined, body: unknown) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET! },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ConfiguracionPage({ searchParams }: { searchParams: { empresa?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const empresas = await bridgePost(process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST, { userId: session.user.id });
  const listaEmpresas = Array.isArray(empresas) ? empresas : [];
  const empresaId = searchParams.empresa || listaEmpresas[0]?.id;

  let redesConectadas: { red: string }[] = [];
  if (empresaId) {
    const data = await bridgePost(process.env.IONOS_BRIDGE_URL_REDES_LIST, {
      userId: session.user.id,
      empresaId,
    });
    redesConectadas = Array.isArray(data) ? data : [];
  }
  const xYaConectado = redesConectadas.some((r) => r.red === "TWITTER");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Configuración</h1>
        <p className="text-muted">Gestiona tus preferencias y claves de API</p>
      </header>
      {empresaId && (
        <section className="form-card">
          <h2>Redes sociales conectadas</h2>
          <p className="text-muted" style={{ marginTop: 0 }}>
            Conecta tu página de Facebook e Instagram para que las publicaciones programadas se publiquen solas.
          </p>
          <RedesConectadas empresaId={empresaId} />

          <div style={{ marginTop: "1.25rem" }}>
            <ConectarX empresaId={empresaId} yaConectado={xYaConectado} />
          </div>
        </section>
      )}
      <section className="form-card">
        <h2>Claves de API para generar contenido</h2>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Por defecto usamos nuestras propias claves. Si prefieres usar las tuyas (por ejemplo, para tener tu propio
          límite de uso), puedes pegarlas aquí. Se usan en este orden: Gemini, Groq, Cerebras y OpenRouter — si una falla, se prueba la siguiente automáticamente.
        </p>
        <ConfiguracionApiKeys />
      </section>
    </main>
  );
}
