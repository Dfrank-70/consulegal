import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

    const body = await req.json();
    const content = typeof body?.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json({ error: "content richiesto" }, { status: 400 });
    }

    const prismaAny = prisma as any;
    const { id } = await ctx.params;

    const found = await prismaAny.case.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        conversationId: true,
        status: true,
      },
    });

    if (!found) {
      return NextResponse.json({ error: "Case non trovato" }, { status: 404 });
    }

    if (!['OPEN', 'WAITING_EXPERT'].includes(found.status)) {
      return NextResponse.json(
        { error: "Case non in stato risolvibile", status: found.status },
        { status: 400 }
      );
    }

    const expertUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true },
    });

    const updated = await prisma.$transaction(async (tx) => {
      await (tx as any).caseMessage.create({
        data: {
          caseId: found.id,
          authorId: session.user.id,
          role: "EXPERT",
          content,
        },
      });

      await (tx as any).message.create({
        data: {
          conversationId: found.conversationId,
          role: "ASSISTANT",
          content,
          meta: {
            authorType: "expert",
            expertId: expertUser?.id,
            expertEmail: expertUser?.email,
            expertName: expertUser?.name,
          },
        },
      });

      return await (tx as any).case.update({
        where: { id: found.id },
        data: { status: "ANSWERED" },
        select: { id: true, status: true },
      });
    });

    return NextResponse.json({ success: true, caseId: updated.id, status: updated.status });
  } catch (error: any) {
    console.error("Errore nell'API POST /api/admin/cases/[id]/reply:", error);
    return NextResponse.json(
      { error: "Errore interno del server", details: error.message },
      { status: 500 }
    );
  }
}
