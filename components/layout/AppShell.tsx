"use client";

import { usePathname } from "next/navigation";

/** Barra lateral + contenido. En login/registro no se muestra el menú. */
export function AppShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname() || "";
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) return <>{children}</>;
  return (
    <div className="shell">
      <aside className="side" aria-label="Menú principal">{sidebar}</aside>
      <div className="shell-main">{children}</div>
    </div>
  );
}
