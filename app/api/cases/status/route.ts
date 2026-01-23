import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const userId = session.user.id;
    const conversationId = req.nextUrl.searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Il parametro conversationId è richiesto" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      select: { id: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversazione non trovata o non autorizzata" },
        { status: 404 }
      );
    }

    const pendingCase = (prisma as any).case?.findFirst
      ? await (prisma as any).case.findFirst({
          where: {
            userId,
            conversationId,
            status: { in: ["OPEN", "WAITING_EXPERT"] },
          },
          orderBy: { createdAt: "desc" },
          select: { status: true },
        })
      : null;

    return NextResponse.json({
      pendingExpertCaseStatus: pendingCase?.status ?? null,
    });
  } catch (error: any) {
    console.error("--- ERRORE DETTAGLIATO NEL GET /api/cases/status ---");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Errore:", error.message);
    console.error("Stack Trace:", error.stack);
    console.error("--- FINE ERRORE DETTAGLIATO ---");

    return NextResponse.json(
      { error: "Errore interno del server", details: error.message },
      { status: 500 }
    );
  }
}
