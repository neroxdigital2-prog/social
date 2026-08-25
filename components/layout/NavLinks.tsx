"use client";

import { useSearchParams } from "next/navigation";

const ENLACES = [
  { href: "/generador", label: "Generador" },
  { href: "/nerox-analiza", label: "🔎 Nerox Analiza" },
  { href: "/calendario", label: "Calendario" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/crm", label: "CRM" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/agenda", label: "Agenda" },
  { href: "/configuracion", label: "Configuración" },
];

export function NavLinks() {
  const searchParams = useSearchParams();
  const empresaActual = searchParams.get("empresa");

  return (
    <>
      {ENLACES.map((enlace) => (
        <a key={enlace.href} href={empresaActual ? `${enlace.href}?empresa=${empresaActual}` : enlace.href}>
          {enlace.label}
        </a>
      ))}
    </>
  );
}
