import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

import { BillingForm } from "./components/billing-form";
import { Heading as DashboardHeader } from "@/components/ui/heading";
import { getUserSubscription } from "@/lib/subscription";

export default async function BillingPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return redirect("/");
  }

  const [subscription, plans] = await Promise.all([
    getUserSubscription(userId),
    prisma.plan.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        price: 'asc'
      }
    })
  ]);

  return (
    <div className="grid items-start gap-8">
      <DashboardHeader
        title="Abbonamento e Fatturazione"
        description="Gestisci il tuo abbonamento e visualizza la cronologia di fatturazione."
      />
      <BillingForm subscription={subscription} plans={plans} userId={userId} />
    </div>
  );
}
