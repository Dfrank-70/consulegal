import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";

import { PlansClient } from "./components/client";
import { PlanColumn } from "./components/columns";

const PlansPage = async () => {
  const session = await auth();

  if (session?.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const plans = await prisma.plan.findMany({
    orderBy: {
      createdAt: 'asc',
    },
  });

  const formattedPlans: PlanColumn[] = plans.map(item => ({
    id: item.id,
    name: item.name,
    isActive: item.isActive,
    stripePriceId: item.stripePriceId,
    features: item.features.join(', '),
    createdAt: format(item.createdAt, "dd MMMM yyyy", { locale: it }),
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <PlansClient data={formattedPlans} />
      </div>
    </div>
  );
};

export default PlansPage;

