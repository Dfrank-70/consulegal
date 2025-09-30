"use client";
import { format } from 'date-fns';

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { logout } from "@/app/dashboard/actions";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User, Settings, LogOut, X, Users, PlusCircle, Trash2, Sparkles } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
}

import { type SerializableSubscription } from "@/app/dashboard/client-layout";

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  initialConversations: Conversation[];
  subscription: SerializableSubscription | null;
}

export function DashboardSidebar({
  sidebarOpen,
  setSidebarOpen,
  initialConversations,
  subscription,
}: DashboardSidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentConversationId = searchParams?.get('conversationId');

  const [conversations, setConversations] = React.useState(initialConversations);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [conversationIdToDelete, setConversationIdToDelete] = React.useState<string | null>(null);

  React.useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  const handleDeleteClick = (e: React.MouseEvent, conversationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setConversationIdToDelete(conversationId);
    setIsAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!conversationIdToDelete) return;

    try {
      const response = await fetch(`/api/conversations/${conversationIdToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationIdToDelete));
        if (currentConversationId === conversationIdToDelete) {
          window.location.href = '/dashboard';
        }
      } else {
        alert("Errore durante l'eliminazione della conversazione.");
      }
    } catch (error) {
      console.error('Errore:', error);
      alert("Si è verificato un errore di rete.");
    } finally {
      setIsAlertOpen(false);
      setConversationIdToDelete(null);
    }
  };

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
    navigation.push({
      name: "Gestione Piani",
      href: "/dashboard/admin/plans",
      icon: Settings, 
    });
  }

  const commonSidebarContent = (isMobile: boolean) => (
    <>
      <div className={`flex items-center justify-between px-4 h-16 border-b ${isMobile ? "" : "lg:border-b"}`}>
        <Link href="/dashboard" className="text-xl font-bold text-primary">
          Traspolegal
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
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm group ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                  onClick={() => isMobile && setSidebarOpen(false)}
                >
                  <span className="truncate">
                    {convo.title || `Consulenza del ${new Date(convo.createdAt).toLocaleDateString()}`}
                  </span>
                  <button 
                    onClick={(e) => handleDeleteClick(e, convo.id)}
                    className={`ml-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                      isActive
                        ? "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                    aria-label="Elimina conversazione"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <div className="border-t p-4">
                <div className="mb-4">
          <p className="text-sm font-medium text-foreground truncate">
            {session?.user?.name || session?.user?.email}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {session?.user?.email}
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Abbonamento</h4>
          {subscription ? (
            <div className="px-3 text-sm text-muted-foreground space-y-1">
              <p><span className="font-semibold text-foreground">Piano:</span> {subscription.planName || 'N/A'}</p>
              <p><span className="font-semibold text-foreground">Stato:</span> <span className={`capitalize px-2 py-1 text-xs rounded-full ${subscription.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{subscription.status}</span></p>
                            <p><span className="font-semibold text-foreground">Scadenza:</span> {subscription.currentPeriodEnd ? format(new Date(subscription.currentPeriodEnd), 'dd/MM/yyyy') : 'N/A'}</p>
            </div>
          ) : (
            <div className="px-3 text-sm">
              <p className="text-muted-foreground">Nessun piano attivo.</p>
              <Button variant="ghost" size="sm" className="mt-2 -ml-2" asChild>
                <Link href={{ pathname: "/dashboard/plans" }}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade
                </Link>
              </Button>
            </div>
          )}
        </div>

        <form action={logout} className="mt-4 pt-4 border-t border-border">
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
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler eliminare questa conversazione?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. La conversazione e tutti i suoi messaggi verranno eliminati in modo permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile Sidebar */}
      <div className={`fixed inset-0 z-40 flex lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
        <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative flex w-full max-w-xs flex-col bg-background">
          {commonSidebarContent(true)}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-background">
          {commonSidebarContent(false)}
        </div>
      </div>
    </>
  );
}
