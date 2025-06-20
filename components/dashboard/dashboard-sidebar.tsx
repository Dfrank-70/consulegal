"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { logout } from "@/app/dashboard/actions";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User, Settings, LogOut, X, Users, PlusCircle } from "lucide-react";

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
}

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  initialConversations: Conversation[];
}

export function DashboardSidebar({ sidebarOpen, setSidebarOpen, initialConversations }: DashboardSidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentConversationId = searchParams?.get('conversationId');

  const conversations = initialConversations;

  const baseNavigation = [
    { name: "Nuova Chat", href: "/dashboard", icon: PlusCircle },
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
          const isActive = item.name === 'Nuova Chat'
            ? pathname === item.href && !currentConversationId
            : pathname === item.href;

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
          {conversations.length === 0 && (
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
        <form action={logout}>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              type="submit"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </form>
      </div>
    </>
  );

  return (
    <>
      <div className={`fixed inset-y-0 left-0 w-64 bg-card border-r flex flex-col transform transition-transform ease-in-out duration-300 lg:hidden ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      } z-40`}>
        {commonSidebarContent(true)}
      </div>

      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-card">
         {commonSidebarContent(false)}
      </div>
    </>
  );
}
