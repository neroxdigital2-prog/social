import { prisma } from "@/lib/prisma";
import { RolEquipo } from "@prisma/client";

const JERARQUIA: Record<RolEquipo, number> = {
  PROPIETARIO: 4,
  ADMIN: 3,
  EDITOR: 2,
  LECTOR: 1,
};

export async function obtenerAccesoEmpresa(userId: string, empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    include: { agencia: { include: { miembros: true } } },
  });

  if (!empresa) return null;
  if (empresa.userId === userId) return { empresa, rol: "PROPIETARIO" as RolEquipo };

  if (empresa.agencia) {
    const miembro = empresa.agencia.miembros.find((m) => m.userId === userId);
    if (miembro) return { empresa, rol: miembro.rol };
  }

  return null;
}

export async function verificarPermiso(userId: string, empresaId: string, rolMinimo: RolEquipo): Promise<boolean> {
  const acceso = await obtenerAccesoEmpresa(userId, empresaId);
  if (!acceso) return false;
  return JERARQUIA[acceso.rol] >= JERARQUIA[rolMinimo];
}

export async function verificarPermisoPorPublicacion(
  userId: string,
  publicacionId: string,
  rolMinimo: RolEquipo
): Promise<{ ok: boolean; empresaId?: string }> {
  const publicacion = await prisma.publicacion.findUnique({
    where: { id: publicacionId },
    select: { empresaId: true },
  });
  if (!publicacion) return { ok: false };

  const permitido = await verificarPermiso(userId, publicacion.empresaId, rolMinimo);
  return { ok: permitido, empresaId: publicacion.empresaId };
}

export async function empresasAccesiblesPorUsuario(userId: string) {
  const propias = await prisma.empresa.findMany({ where: { userId } });

  const membresias = await prisma.miembroAgencia.findMany({
    where: { userId },
    include: { agencia: { include: { empresas: true } } },
  });

  const deAgencias = membresias.flatMap((m) => m.agencia.empresas);
  const todas = [...propias, ...deAgencias];
  return Array.from(new Map(todas.map((e) => [e.id, e])).values());
}
