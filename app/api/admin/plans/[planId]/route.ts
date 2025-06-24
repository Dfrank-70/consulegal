import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// Funzione per aggiornare un piano
export async function PATCH(
  req: Request,
  { params }: { params: { planId: string } }
) {
  try {
    const session = await auth();
    const body = await req.json();
    const { name, description, features, stripePriceId, isActive } = body;

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.planId) {
      return new NextResponse("Plan ID is required", { status: 400 });
    }

    const plan = await prisma.plan.update({
      where: {
        id: params.planId,
      },
      data: {
        name,
        description,
        features,
        stripePriceId,
        isActive,
      },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("[PLAN_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// Funzione per eliminare un piano
export async function DELETE(
  req: Request, // req non è usato ma necessario per la firma della funzione
  { params }: { params: { planId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!params.planId) {
      return new NextResponse("Plan ID is required", { status: 400 });
    }

    const plan = await prisma.plan.delete({
      where: {
        id: params.planId,
      },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("[PLAN_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
