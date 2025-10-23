import { auth } from "@/auth";
import { redirect } from 'next/navigation';
import { ChatInterface } from "@/components/chat/chat-interface";
import { getUserSubscription } from "@/lib/subscription";

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return <div>Non autorizzato</div>; 
  }

  // Se l'utente è un admin, reindirizza alla dashboard admin
  if (session.user.role === 'ADMIN') {
    redirect('/dashboard/admin');
  }

  // Logica per gli utenti non-admin
  const searchParamsResolved = await searchParams;
  const conversationId = searchParamsResolved.conversationId;
  const newSubscription = searchParamsResolved['new-subscription'];
  
  // Se l'utente torna da Stripe dopo acquisto, sincronizza l'abbonamento
  if (newSubscription === 'true') {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/admin/sync-subscription`, {
      method: 'POST',
    });
    if (response.ok) {
      console.log('Abbonamento sincronizzato dopo acquisto Stripe');
    }
  }
  
  const subscription = await getUserSubscription(session.user.id);
  const isSubscribed = 
    !!subscription &&
    !!subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd.getTime() > Date.now();

  return (
    <div className="h-full w-full">
      <ChatInterface 
        selectedConversationId={typeof conversationId === 'string' ? conversationId : null}
        isSubscribed={isSubscribed} 
      />
    </div>
  );
}
