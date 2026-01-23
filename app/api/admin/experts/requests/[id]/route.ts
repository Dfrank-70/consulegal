import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const body = await request.json();
    const { action, approvalNotes } = body as { action?: string; approvalNotes?: string | null };

    if (!action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
    }

    const { id } = await ctx.params;

    const profile = await (prisma as any).expertProfile.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
    }

    if (action === "approve") {
      await (prisma as any).$transaction([
        (prisma as any).expertProfile.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            approvedById: session.user.id,
            approvalNotes: approvalNotes || null,
          },
        }),
        (prisma as any).user.update({
          where: { id: profile.userId },
          data: { role: "EXPERT" },
        }),
      ]);

      console.log(`[EXPERT_APPROVED] adminId=${session.user.id} userId=${profile.userId}`);
    } else {
      await (prisma as any).expertProfile.update({
        where: { id },
        data: {
          status: "REJECTED",
          approvalNotes: approvalNotes || null,
        },
      });

      console.log(`[EXPERT_REJECTED] adminId=${session.user.id} userId=${profile.userId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[ADMIN_EXPERT_REQUESTS_PUT]", error);
    return NextResponse.json({ error: "Errore interno", details: error.message }, { status: 500 });
  }
}
