import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
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

    const status = req.nextUrl.searchParams.get("status") || "WAITING_EXPERT";

    const cases = await (prisma as any).case.findMany({
      where: {
        assignedToId: session.user.id,
        status,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        conversationId: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { email: true } },
      },
    });

    return NextResponse.json(cases);
  } catch (error: any) {
    console.error("Errore nell'API GET /api/expert/cases:", error);
    return NextResponse.json(
      { error: "Errore interno del server", details: error.message },
      { status: 500 }
    );
  }
}
