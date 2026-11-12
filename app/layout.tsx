import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { SelectorEmpresa } from "@/components/layout/SelectorEmpresa";
import { CerrarSesionBoton } from "@/components/layout/CerrarSesionBoton";
import { NavLinks } from "@/components/layout/NavLinks";
import { AppShell } from "@/components/layout/AppShell";
export const metadata: Metadata = { title: "Nerox Social IA" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppShell
          sidebar={
            <>
              <a href="/dashboard" className="side-marca"><span className="side-logo" aria-hidden="true">N</span>Nerox</a>
              <Suspense fallback={null}>
                <SelectorEmpresa />
              </Suspense>
              <nav className="side-nav">
                <Suspense fallback={null}>
                  <NavLinks />
                </Suspense>
              </nav>
              <div className="side-pie"><CerrarSesionBoton /></div>
            </>
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
