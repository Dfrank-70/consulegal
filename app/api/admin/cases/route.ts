import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
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

    const status = req.nextUrl.searchParams.get("status") || "WAITING_EXPERT";
    const prismaAny = prisma as any;

    const cases = await prismaAny.case.findMany({
      where: {
        status,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        conversationId: true,
        assignedToId: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        expertPacket: true,
        user: { select: { email: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json(cases);
  } catch (error: any) {
    console.error("Errore nell'API GET /api/admin/cases:", error);
    return NextResponse.json(
      { error: "Errore interno del server", details: error.message },
      { status: 500 }
    );
  }
}
