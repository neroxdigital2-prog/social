import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CentroControl } from "@/components/centro/CentroControl";

export const metadata = { title: "Centro de control · Nerox Social IA" };

export default async function CentroControlPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="dsh">
      <header className="dsh-cabecera">
        <div>
          <h1>Centro de control</h1>
          <p className="dsh-muted">Estado de cada agente, averías, avisos enviados y quién las resolvió.</p>
        </div>
      </header>
      <CentroControl />
    </main>
  );
}
