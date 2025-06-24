import prisma from "@/lib/prisma";
import { PlanForm } from "./components/plan-form";

const PlanPage = async ({ params }: { params: { planId: string } }) => {
  let plan = null;

  if (params.planId !== 'new') {
    plan = await prisma.plan.findUnique({
      where: {
        id: params.planId,
      },
    });
  }

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <PlanForm initialData={plan} />
      </div>
    </div>
  );
};

export default PlanPage;
