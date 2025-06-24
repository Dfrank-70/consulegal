"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

import { columns, PlanColumn } from "./columns";

interface PlansClientProps {
  data: PlanColumn[];
}

export const PlansClient: React.FC<PlansClientProps> = ({ data }) => {
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading
          title={`Piani (${data.length})`}
          description="Gestisci i piani di abbonamento per la tua applicazione"
        />
        <Button onClick={() => router.push(`/dashboard/admin/plans/new`)}>
          <Plus className="mr-2 h-4 w-4" /> Aggiungi Nuovo
        </Button>
      </div>
      <Separator />
      <DataTable searchKey="name" columns={columns} data={data} />
    </>
  );
};
