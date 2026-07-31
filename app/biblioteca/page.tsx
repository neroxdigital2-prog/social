import { auth } from "@/auth";
import { redirect } from "next/navigation";

interface Publicacion {
  id: string;
  tipo: string;
  titulo: string;
  texto: string;
  hashtags: string[];
  estado: string;
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
      <section className="publicaciones-grid">
        {publicaciones.map((pub) => {
          const hashtags = pub.hashtags as string[];
          return (
            <article key={pub.id} className="pub-card">
              <span className="pub-tipo">{pub.tipo.replace(/_/g, " ")}</span>
              <h3>{pub.titulo}</h3>
              <p>{pub.texto}</p>
              <div className="pub-hashtags">{hashtags.map((tag) => <span key={tag} className="tag">#{tag}</span>)}</div>
              <span className={`pub-estado estado-${pub.estado.toLowerCase()}`}>{pub.estado}</span>
            </article>
          );
        })}
      </section>
    </main>
  );
}
