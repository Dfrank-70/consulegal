import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClientLayout } from "./client-layout";
import { headers } from 'next/headers';

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  headers(); // Force dynamic rendering
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  // Check for active subscription
  let subscription = await prisma.subscription.findFirst({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    }
  });

  let planName: string | null = null;
  if (subscription?.stripePriceId) {
    const plan = await prisma.plan.findUnique({
      where: {
        stripePriceId: subscription.stripePriceId,
      },
      select: {
        name: true,
      }
    });
    if (plan) {
      planName = plan.name;
    }
  }



  const conversations = await prisma.conversation.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

    const serializedConversations = conversations.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  const serializedSubscription = subscription ? {
    ...subscription,
    planName: planName,
    // Convert Date objects to strings to make them serializable
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  } : null;

  return (
    <DashboardClientLayout 
      conversations={serializedConversations}
      subscription={serializedSubscription}
    >
      {children}
    </DashboardClientLayout>
  );
}
