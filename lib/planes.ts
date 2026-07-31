import { Plan } from "@prisma/client";

export const LIMITES_PLAN: Record<Plan, { maxEmpresas: number; maxPublicacionesMes: number }> = {
  GRATIS: { maxEmpresas: 1, maxPublicacionesMes: 5 },
  PRO: { maxEmpresas: 3, maxPublicacionesMes: Infinity },
  AGENCIA: { maxEmpresas: Infinity, maxPublicacionesMes: Infinity },
};
