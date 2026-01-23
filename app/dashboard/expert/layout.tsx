import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpertLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role === "EXPERT_PENDING") {
    redirect("/expert/status");
  }

  if (session.user.role !== "EXPERT") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
