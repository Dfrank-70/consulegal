"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageSquare, User, Settings, LogOut, X, Users } from "lucide-react";

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
}

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export function DashboardSidebar({ sidebarOpen, setSidebarOpen }: DashboardSidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter(); // Potrebbe servire per navigazione programmatica
  const searchParams = useSearchParams();
  const currentConversationId = searchParams?.get('conversationId');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const baseNavigation = [
    { name: "Chat", href: "/dashboard", icon: MessageSquare },
    { name: "Profilo", href: "/dashboard/profile", icon: User },
    { name: "Impostazioni", href: "/dashboard/settings", icon: Settings },
  ];

  let navigation = [...baseNavigation];

  if (session?.user?.role === "ADMIN") {
    navigation.push({
      name: "Gestione Utenti",
      href: "/dashboard/admin/user-management",
      icon: Users,
    });
  }

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoadingConversations(true);
      setFetchError(null);
      try {
        const response = await fetch('/api/conversations', { cache: 'no-store' });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Errore nel recupero delle conversazioni' }));
          throw new Error(errorData.error || 'Errore nel recupero delle conversazioni');
        }
        const data = await response.json();
        setConversations(data);
      } catch (error) {
        console.error("Fetch error:", error);
        setFetchError(error instanceof Error ? error.message : 'Errore sconosciuto');
      } finally {
        setIsLoadingConversations(false);
      }
    };

    if (session?.user) {
      fetchConversations();
    } else if (session === null) {
      setIsLoadingConversations(false);
      setConversations([]);
    }
  }, [session?.user, pathname, searchParams]);

  const commonSidebarContent = (isMobile: boolean) => (
    <>
      <div className={`flex items-center justify-between px-4 h-16 border-b ${isMobile ? "" : "lg:border-b"}`}>
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          ConsulLegal AI
        </Link>
        {isMobile && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={{ pathname: item.href }}
              className={`flex items-center rounded-md px-3 py-2 text-sm ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              onClick={() => isMobile && setSidebarOpen(false)}
            >
              <item.icon className="mr-3 h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
        <div className="mt-4 pt-4 border-t border-border">
          <h3 className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
            Le Tue Consulenze
          </h3>
          {isLoadingConversations && <p className="px-3 text-sm text-muted-foreground">Caricamento...</p>}
          {fetchError && <p className="px-3 text-sm text-destructive">Errore: {fetchError}</p>}
          {!isLoadingConversations && !fetchError && conversations.length === 0 && (
            <p className="px-3 text-sm text-muted-foreground">Nessuna consulenza trovata.</p>
          )}
          <div className="space-y-1">
            {conversations.map((convo) => {
              const isActive = currentConversationId === convo.id;
              return (
                <Link
                  key={convo.id}
                  href={{ pathname: '/dashboard', query: { conversationId: convo.id } }}
                  className={`flex items-center rounded-md px-3 py-2 text-sm truncate ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                  onClick={() => isMobile && setSidebarOpen(false)}
                >
                  {convo.title || `Consulenza del ${new Date(convo.createdAt).toLocaleDateString()}`}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <div className="border-t p-4">
        <p className="text-sm text-muted-foreground mb-2 truncate">
          {session?.user?.email}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile sidebar */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-card border-r flex flex-col transform transition-transform ease-in-out duration-300 lg:hidden ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {commonSidebarContent(true)}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-card">
         {commonSidebarContent(false)}
      </div>
    </>
  );
}
