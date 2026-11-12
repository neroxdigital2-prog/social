"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Sparkles, Search, TrendingUp, CalendarDays, FolderOpen, Users, MessageCircle, Clock, Settings, Compass } from "lucide-react";

const GRUPOS = [
  { titulo: "Principal", items: [
    { href: "/dashboard", label: "Dashboard", Icono: LayoutDashboard },
    { href: "/calendario", label: "Calendario", Icono: CalendarDays },
  ] },
  { titulo: "Crear", items: [
    { href: "/generador", label: "Generador", Icono: Sparkles },
    { href: "/biblioteca", label: "Biblioteca", Icono: FolderOpen },
  ] },
  { titulo: "Analizar", items: [
    { href: "/nerox-analiza", label: "Nerox Analiza", Icono: Search },
    { href: "/crecimiento", label: "Crecimiento", Icono: TrendingUp },
  ] },
  { titulo: "Clientes", items: [
    { href: "/crm", label: "CRM", Icono: Users },
    { href: "/whatsapp", label: "WhatsApp", Icono: MessageCircle },
    { href: "/agenda", label: "Agenda", Icono: Clock },
  ] },
  { titulo: "Sistema", items: [
    { href: "/centro-control", label: "Centro de control", Icono: Compass },
    { href: "/configuracion", label: "Configuración", Icono: Settings },
  ] },
];

export function NavLinks() {
  const searchParams = useSearchParams();
  const pathname = usePathname() || "";
  const empresaActual = searchParams.get("empresa");

  return (
    <>
      {GRUPOS.map((g) => (
        <div key={g.titulo} className="side-grupo">
          <div className="side-titulo">{g.titulo}</div>
          {g.items.map(({ href, label, Icono }) => {
            const activo = pathname === href || pathname.startsWith(href + "/");
            return (
              <a key={href} href={empresaActual ? `${href}?empresa=${empresaActual}` : href} className={`side-link${activo ? " activo" : ""}`} aria-current={activo ? "page" : undefined}>
                <Icono size={18} aria-hidden="true" />
                <span>{label}</span>
              </a>
            );
          })}
        </div>
      ))}
    </>
  );
}
