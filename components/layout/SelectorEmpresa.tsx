"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface EmpresaOpcion { id: string; nombre: string; }

export function SelectorEmpresa() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [empresas, setEmpresas] = useState<EmpresaOpcion[]>([]);
  const empresaActual = searchParams.get("empresa");

  useEffect(() => {
    fetch("/api/empresas").then((r) => r.json()).then((data) => setEmpresas(Array.isArray(data) ? data : []));
  }, []);

  if (empresas.length <= 1) return null;

  function cambiar(nuevoId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("empresa", nuevoId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select className="selector-empresa-nav" value={empresaActual || empresas[0]?.id} onChange={(e) => cambiar(e.target.value)}>
      {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
    </select>
  );
}
