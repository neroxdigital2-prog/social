import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { GeneradorForm } from "@/components/generador/GeneradorForm";

// ⚠️ TEMPORAL: URL forzada directamente en código para descartar problemas
// con la variable de entorno. Una vez confirmado que funciona, se puede
// volver a usar process.env.IONOS_BRIDGE_URL_EMPRESAS_LIST si esa variable
// ya está corregida en Vercel.
const BRIDGE_URL_EMPRESAS = "https://bridge.nerox.es/empresas-list.php";

export default async function GeneradorPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let empresas: { id: string; nombre: string }[] = [];

  try {
    console.log("[DIAGNOSTICO empresas] URL usada:", BRIDGE_URL_EMPRESAS);
    console.log("[DIAGNOSTICO empresas] userId enviado:", session.user.id);

    const res = await fetch(BRIDGE_URL_EMPRESAS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bridge-Secret": process.env.BRIDGE_SECRET!,
      },
      body: JSON.stringify({ userId: session.user.id }),
      cache: "no-store",
    });

    const textoCrudo = await res.text();

    console.log("[DIAGNOSTICO empresas] status:", res.status);
    console.log("[DIAGNOSTICO empresas] respuesta cruda:", textoCrudo);

    const data = JSON.parse(textoCrudo);

    if (Array.isArray(data)) {
      empresas = data
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((e) => ({ id: e.id, nombre: e.nombre }));
      console.log("[DIAGNOSTICO empresas] empresas mapeadas:", JSON.stringify(empresas));
    } else {
      console.log("[DIAGNOSTICO empresas] la respuesta NO es un array:", JSON.stringify(data));
    }
  } catch (err) {
    console.log("[DIAGNOSTICO empresas] ERROR capturado:", err);
    empresas = [];
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <h1>Generador de contenido IA</h1>
        <p className="text-muted">Elige una empresa y genera publicaciones listas para revisar y programar</p>
      </header>
      <section className="form-card">
        {empresas.length === 0 ? (
          <p>Aún no tienes empresas registradas. <a href="/empresas/nueva">Crea tu primera empresa</a></p>
        ) : (
          <GeneradorForm empresas={empresas} />
        )}
      </section>
    </main>
  );
}
