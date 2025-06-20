"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation"; // Import useSearchParams
import { useSession } from "next-auth/react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { SubscriptionGate } from "@/components/chat/subscription-gate";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);

  useEffect(() => {
    if (searchParams?.get("new-subscription") === "true") {
      toast.success("Abbonamento attivato con successo!", {
        description: "Benvenuto a bordo! Ora hai accesso a tutte le funzionalità del tuo piano.",
        duration: 5000,
      });
      router.replace("/dashboard", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      const checkSubscription = async () => {
        try {
          const response = await fetch('/api/user/subscription-status');
          const data = await response.json();
          if (response.ok) {
            setHasActiveSubscription(data.hasActiveSubscription);
          } else {
            setHasActiveSubscription(false);
          }
        } catch (error) {
          console.error("Failed to fetch subscription status", error);
          setHasActiveSubscription(false);
        }
      };
      checkSubscription();
    }
  }, [status, router]);

  if (status === "loading" || hasActiveSubscription === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <span className="ml-2">Caricamento...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto h-full">
      {hasActiveSubscription ? (
        <ChatInterface selectedConversationId={searchParams?.get("conversationId")} />
      ) : (
        <SubscriptionGate />
      )}
    </div>
  );
}
