import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const plans = await prisma.plan.findMany({
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error("[PLANS_GET_ADMIN]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    const { name, description, features, stripePriceId } = body;

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!name || !features || !stripePriceId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        features,
        stripePriceId,
      },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("[PLANS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
