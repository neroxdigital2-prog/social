import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PublicacionCard } from "@/components/biblioteca/PublicacionCard";
import { CrearManualForm } from "@/components/biblioteca/CrearManualForm";

interface Publicacion {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  hashtags: string[];
  estado: string;
  imagenPrompt: string;
  imagenUrl: string | null;
}

async function bridgePost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bridge-Secret": process.env.BRIDGE_SECRET!,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return res.json();
}

export default async function BibliotecaPage({ searchParams }: { searchParams: { empresa?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const empresas = await bridgePost(process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST!, {
    userId: session.user.id,
  });

  const listaEmpresas = Array.isArray(empresas) ? empresas : [];
  const empresaId = searchParams.empresa || listaEmpresas[0]?.id;

  let publicaciones: Publicacion[] = [];
  if (empresaId) {
    const data = await bridgePost(process.env.IONOS_BRIDGE_URL_PUBLICACIONES_LIST!, {
      userId: session.user.id,
      empresaId,
    });
    publicaciones = Array.isArray(data) ? data : [];
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Biblioteca de publicaciones</h1>
        <p className="text-muted">{publicaciones.length} publicaciones generadas</p>
      </header>
      {empresaId && (
        <div style={{ marginBottom: "1.5rem" }}>
          <CrearManualForm empresaId={empresaId} />
        </div>
      )}
      <section className="publicaciones-grid">
        {publicaciones.map((pub) => (
          <PublicacionCard key={pub.id} publicacion={{ ...pub, hashtags: pub.hashtags as string[] }} />
        ))}
      </section>
    </main>
  );
}
