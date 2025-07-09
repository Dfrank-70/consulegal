import { auth } from "@/auth";
import { ChatInterface } from "@/components/chat/chat-interface";
import { getUserSubscription } from "@/lib/subscription";

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Attendere searchParams prima di utilizzarlo (Next.js 15 requirement)
  const params = await searchParams;
  const conversationId = params.conversationId;
  
  const session = await auth();
  if (!session?.user?.id) {
    // In a real app, you'd likely redirect to login
    return <div>Non autorizzato</div>;
  }

  const subscription = await getUserSubscription(session.user.id);
  const isSubscribed = 
    !!subscription &&
    !!subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd.getTime() > Date.now();

  return (
    <div className="container mx-auto h-full">
      <ChatInterface 
        selectedConversationId={typeof conversationId === 'string' ? conversationId : null}
        isSubscribed={isSubscribed} 
      />
    </div>
  );
}
