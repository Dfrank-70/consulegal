import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ExpertStatusPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  const profile = await (prisma as any).expertProfile.findUnique({
    where: { userId },
    select: { status: true, approvalNotes: true, approvedAt: true },
  });

  if (session.user.role === "EXPERT" || profile?.status === "APPROVED") {
    redirect("/dashboard/expert");
  }

  const status = profile?.status ?? "PENDING";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-slate-100">
      <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        {status === "REJECTED" ? (
          <>
            <h1 className="text-2xl font-bold">Richiesta rifiutata</h1>
            <p className="text-slate-300">
              La tua richiesta non è stata approvata. {profile?.approvalNotes ? `Note: ${profile.approvalNotes}` : ""}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Richiesta in revisione</h1>
            <p className="text-slate-300">
              Abbiamo ricevuto la tua candidatura. Ti avviseremo quando sarà approvata.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
