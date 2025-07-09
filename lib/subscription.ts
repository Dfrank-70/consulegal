import prisma from "@/lib/prisma";
import { Subscription } from "@prisma/client";

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: userId,
    },
    orderBy: {
      createdAt: 'desc',
    }
  });

  if (!subscription) {
    return null;
  }

  return subscription;
}
