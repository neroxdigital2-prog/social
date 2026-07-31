import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const Schema = z.object({
  nombre: z.string().min(2),
  sector: z.string().min(2),
  ciudad: z.string().min(2),
  servicios: z.array(z.string()).default([]),
  web: z.string().url().optional(),
  whatsapp: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const empresa = await prisma.empresa.findFirst({ where: { id: params.id, userId: session.user.id } });
  if (!empresa) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const actualizada = await prisma.empresa.update({
    where: { id: empresa.id },
    data: {
      nombre: parsed.data.nombre,
      sector: parsed.data.sector,
      ciudad: parsed.data.ciudad,
      servicios: parsed.data.servicios as Prisma.InputJsonValue,
      web: parsed.data.web,
      whatsapp: parsed.data.whatsapp,
    },
  });

  return NextResponse.json(actualizada);
}
