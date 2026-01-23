import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const requests = await (prisma as any).expertProfile.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        fullName: true,
        firmName: true,
        phone: true,
        practiceAreas: true,
        status: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error("[ADMIN_EXPERT_REQUESTS_GET]", error);
    return NextResponse.json({ error: "Errore interno", details: error.message }, { status: 500 });
  }
}
