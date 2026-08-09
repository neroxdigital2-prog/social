import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { EmpresasBuscador } from "@/components/empresas/EmpresasBuscador";

async function bridgePost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bridge-Secret": process.env.BRIDGE_SECRET! },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return res.json();
}

export default async function EmpresasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const empresas = await bridgePost(process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST!, {
    userId: session.user.id,
  });
  const listaEmpresas = Array.isArray(empresas) ? empresas : [];

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Mis empresas</h1>
        <p className="text-muted">{listaEmpresas.length} empresas registradas</p>
      </header>
      <a href="/empresas/nueva" className="btn-primary" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1.5rem" }}>
        + Registrar empresa
      </a>
      <EmpresasBuscador empresas={listaEmpresas} />
    </main>
  );
}
