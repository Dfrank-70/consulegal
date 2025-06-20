import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClientLayout } from "./client-layout";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
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

    const serializedConversations = conversations.map((c: { id: string; title: string | null; createdAt: Date }) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
  }));

  return (
    <DashboardClientLayout conversations={serializedConversations}>
      {children}
    </DashboardClientLayout>
  );
}
