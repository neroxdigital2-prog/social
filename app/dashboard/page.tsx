import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Building2, CalendarDays, Plus, Sparkles } from "lucide-react";
import { BannerSaludCompacto } from "@/components/salud/BannerSaludCompacto";
import { cargarDashboard } from "@/lib/dashboard";
import { TarjetaKpi } from "@/components/dashboard/TarjetaKpi";
import { GraficaActividad } from "@/components/dashboard/GraficaActividad";
import { ProximasPublicaciones } from "@/components/dashboard/ProximasPublicaciones";
import { PanelAlertas } from "@/components/dashboard/PanelAlertas";
import { EstadoRedes } from "@/components/dashboard/EstadoRedes";

export const dynamic = "force-dynamic";

function saludo(): string {
  const hora = Number(new Intl.DateTimeFormat("es-ES", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Madrid" }).format(new Date()));
  return hora < 13 ? "Buenos días" : hora < 21 ? "Buenas tardes" : "Buenas noches";
}

export default async function DashboardPage({ searchParams }: { searchParams: { empresa?: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const datos = await cargarDashboard(session.user.id, searchParams.empresa);
  const nombre = session.user.name?.split(" ")[0] || "";

  if (!datos.empresaId) {
    return (
      <main className="dsh">
        <section className="dsh-card dsh-bienvenida-vacia">
          <Building2 size={28} aria-hidden="true" />
          <h1>{saludo()}{nombre ? `, ${nombre}` : ""}</h1>
          <p className="dsh-muted">Registra tu primera empresa para empezar a generar y publicar contenido.</p>
          <a href="/empresas/nueva" className="dsh-boton dsh-boton-primario"><Plus size={16} aria-hidden="true" /> Registrar empresa</a>
        </section>
      </main>
    );
  }

  const q = `?empresa=${datos.empresaId}`;

  return (
    <main className="dsh">
      <BannerSaludCompacto />

      <header className="dsh-cabecera">
        <div>
          <h1>{saludo()}{nombre ? `, ${nombre}` : ""}</h1>
          <p className="dsh-muted">Resumen de <strong>{datos.empresaNombre}</strong></p>
        </div>
        <nav className="dsh-acciones" aria-label="Acciones rápidas">
          <a href={`/calendario${q}`} className="dsh-boton"><CalendarDays size={16} aria-hidden="true" /> Calendario</a>
          <a href={`/generador${q}`} className="dsh-boton dsh-boton-primario"><Sparkles size={16} aria-hidden="true" /> Generar con IA</a>
        </nav>
      </header>

      <section className="dsh-kpis" aria-label="Indicadores principales">
        {datos.kpis.map((k) => <TarjetaKpi key={k.etiqueta} kpi={k} />)}
      </section>

      <div className="dsh-rejilla">
        <div className="dsh-columna-principal">
          <GraficaActividad datos={datos.actividad} />
          <ProximasPublicaciones items={datos.proximas} empresaId={datos.empresaId} />
        </div>
        <aside className="dsh-columna-lateral" aria-label="Estado">
          <PanelAlertas alertas={datos.alertas} />
          <EstadoRedes redes={datos.redes} empresaId={datos.empresaId} />
        </aside>
      </div>
    </main>
  );
}
