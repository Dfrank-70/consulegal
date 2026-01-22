import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (session.user.role !== "EXPERT") {
      return NextResponse.json(
        { error: "Accesso negato. Riservato agli esperti." },
        { status: 403 }
      );
    }

    const { id } = await ctx.params;

    const found = await (prisma as any).case.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        conversationId: true,
        status: true,
        priority: true,
        triggeredBy: true,
        expertPacket: true,
        expertSummary: true,
        expertSummaryProvider: true,
        expertSummaryModel: true,
        expertSummaryCreatedAt: true,
        createdAt: true,
        updatedAt: true,
        assignedToId: true,
        user: { select: { email: true } },
        conversation: {
          select: {
            id: true,
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
                attachments: true,
                meta: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!found) {
      return NextResponse.json({ error: "Case non trovato" }, { status: 404 });
    }

    if (found.assignedToId !== session.user.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    return NextResponse.json(found);
  } catch (error: any) {
    console.error("Errore nell'API GET /api/expert/cases/[id]:", error);
    return NextResponse.json(
      { error: "Errore interno del server", details: error.message },
      { status: 500 }
    );
  }
}
