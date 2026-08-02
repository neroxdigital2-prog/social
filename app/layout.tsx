import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { SelectorEmpresa } from "@/components/layout/SelectorEmpresa";
import { CerrarSesionBoton } from "@/components/layout/CerrarSesionBoton";
export const metadata: Metadata = { title: "Nerox Social IA" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <nav className="app-nav">
          <a href="/dashboard" className="app-nav-brand">Nerox</a>
          <Suspense fallback={null}>
            <SelectorEmpresa />
          </Suspense>
          <div className="app-nav-links">
            <a href="/generador">Generador</a>
            <a href="/calendario">Calendario</a>
            <a href="/biblioteca">Biblioteca</a>
            <a href="/crm">CRM</a>
            <a href="/whatsapp">WhatsApp</a>
            <a href="/agenda">Agenda</a>
            <a href="/configuracion">Configuración</a>
            <CerrarSesionBoton />
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
