import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName, email, password, firmName, phone, practiceAreas, consent } = body;

    if (!fullName || !email || !password || !consent) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    const normalizedAreas = Array.isArray(practiceAreas)
      ? practiceAreas.filter((area: string) => typeof area === "string" && area.trim().length > 0)
      : [];

    const prismaAny = prisma as any;
    const existingUser = await prismaAny.user.findUnique({ where: { email } });

    if (existingUser) {
      const existingRole = (existingUser as any).role as string | undefined;
      if (existingRole === "EXPERT" || existingRole === "EXPERT_PENDING") {
        return NextResponse.json(
          { error: "Richiesta già presente o account esperto esistente." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Email già registrata. Effettua il login." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await (prisma as any).user.create({
      data: {
        email,
        password: hashedPassword,
        name: fullName,
        role: "EXPERT_PENDING",
      },
      select: { id: true, email: true },
    });

    await (prisma as any).expertProfile.create({
      data: {
        userId: user.id,
        fullName,
        firmName: firmName || null,
        phone: phone || null,
        practiceAreas: normalizedAreas,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error: any) {
    console.error("[EXPERT_APPLY_POST]", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
