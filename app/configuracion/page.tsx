import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ConfiguracionApiKeys } from "@/components/configuracion/ConfiguracionApiKeys";

export default async function ConfiguracionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Configuración</h1>
        <p className="text-muted">Gestiona tus preferencias y claves de API</p>
      </header>

      <section className="form-card">
        <h2>Claves de API para generar contenido</h2>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Por defecto usamos nuestras propias claves. Si prefieres usar las tuyas (por ejemplo, para tener tu propio
          límite de uso), puedes pegarlas aquí. Se usan en este orden: Gemini primero, y si falla, Groq.
        </p>
        <ConfiguracionApiKeys />
      </section>
    </main>
  );
}
