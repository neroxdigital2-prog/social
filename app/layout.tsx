import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { SelectorEmpresa } from "@/components/layout/SelectorEmpresa";
import { CerrarSesionBoton } from "@/components/layout/CerrarSesionBoton";
import { NavLinks } from "@/components/layout/NavLinks";
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
            <Suspense fallback={null}>
              <NavLinks />
            </Suspense>
            <CerrarSesionBoton />
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
