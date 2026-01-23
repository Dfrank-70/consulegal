import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

    const prismaAny = prisma as any;
    const { id } = await ctx.params;

    const found = await prismaAny.case.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        conversationId: true,
        assignedToId: true,
        status: true,
        priority: true,
        triggeredBy: true,
        expertPacket: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { email: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
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

    return NextResponse.json(found);
  } catch (error: any) {
    console.error("Errore nell'API GET /api/admin/cases/[id]:", error);
    return NextResponse.json(
      { error: "Errore interno del server", details: error.message },
      { status: 500 }
    );
  }
}
