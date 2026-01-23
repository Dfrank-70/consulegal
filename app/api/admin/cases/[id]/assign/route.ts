import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accesso negato. Riservato agli amministratori." },
        { status: 403 }
      );
    }

    const { id } = await ctx.params;
    const caseId = id;
    const body = await req.json();
    const assignedToId = typeof body?.assignedToId === "string" ? body.assignedToId : null;

    if (!assignedToId) {
      return NextResponse.json({ error: "assignedToId richiesto" }, { status: 400 });
    }

    const prismaAny = prisma as any;

    const expert = await prismaAny.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, role: true },
    });

    if (!expert || expert.role !== "EXPERT") {
      return NextResponse.json(
        { error: "Utente esperto non valido" },
        { status: 400 }
      );
    }

    const found = await prismaAny.case.findUnique({
      where: { id: caseId },
      select: { id: true, status: true },
    });

    if (!found) {
      return NextResponse.json({ error: "Case non trovato" }, { status: 404 });
    }

    if (!['OPEN', 'WAITING_EXPERT'].includes(found.status)) {
      return NextResponse.json(
        { error: "Case non assegnabile", status: found.status },
        { status: 400 }
      );
    }

    const updated = await prismaAny.case.update({
      where: { id: caseId },
      data: {
        assignedToId,
        status: "WAITING_EXPERT",
      },
      select: {
        id: true,
        status: true,
        assignedToId: true,
        assignedTo: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, case: updated });
  } catch (error: any) {
    console.error("Errore nell'API PUT /api/admin/cases/[id]/assign:", error);
    return NextResponse.json(
      { error: "Errore interno del server", details: error.message },
      { status: 500 }
    );
  }
}
