import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { ChatInterface } from "@/components/chat/chat-interface";
import { getUserSubscription } from "@/lib/subscription";

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return <div>Non autorizzato</div>; 
  }

  // Se l'utente è un admin, reindirizza alla dashboard admin
  if (session.user.role === 'ADMIN') {
    redirect('/dashboard/admin');
  }

  if (session.user.role === 'EXPERT_PENDING') {
    redirect('/expert/status');
  }

  if (session.user.role === 'EXPERT') {
    redirect('/dashboard/expert');
  }

  // Logica per gli utenti non-admin
  const searchParamsResolved = await searchParams;
  const conversationId = searchParamsResolved.conversationId;
  
  const subscription = await getUserSubscription(session.user.id);
  const isSubscribed = session.user.role === 'CUSTOMER'
    ? (
        !!subscription &&
        !!subscription.currentPeriodEnd &&
        subscription.currentPeriodEnd.getTime() > Date.now()
      )
    : true;

  return (
    <div className="h-full w-full">
      <ChatInterface 
        selectedConversationId={typeof conversationId === 'string' ? conversationId : null}
        isSubscribed={isSubscribed}
      />
    </div>
  );
}
