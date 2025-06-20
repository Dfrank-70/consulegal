"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation"; // Import useSearchParams
import { useSession } from "next-auth/react";
import { ChatInterface } from "@/components/chat/chat-interface";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const searchParams = useSearchParams(); // Get search params
  const conversationId = searchParams?.get("conversationId"); // Get conversationId

  useEffect(() => {
    // Redirect to login if not authenticated
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <span className="ml-2">Caricamento...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto h-full">
      {/* Pass conversationId to ChatInterface */}
      <ChatInterface selectedConversationId={conversationId} />
    </div>
  );
}
