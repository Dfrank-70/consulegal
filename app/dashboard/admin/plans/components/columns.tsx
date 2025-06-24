"use client";

import { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "./cell-action";

export type PlanColumn = {
  id: string;
  name: string;
  isActive: boolean;
  stripePriceId: string;
  features: string;
  createdAt: string;
};

export const columns: ColumnDef<PlanColumn>[] = [
  {
    accessorKey: "name",
    header: "Nome",
  },
  {
    accessorKey: "isActive",
    header: "Attivo",
    cell: ({ row }) => (row.original.isActive ? 'Sì' : 'No'),
  },
  {
    accessorKey: "stripePriceId",
    header: "Stripe Price ID",
  },
  {
    accessorKey: "features",
    header: "Caratteristiche",
  },
  {
    accessorKey: "createdAt",
    header: "Data Creazione",
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
