"use client";

import React, { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { DashboardSidebar, type Conversation } from "@/components/dashboard/dashboard-sidebar";
import { useSearchParams, useRouter } from "next/navigation";

import { Subscription } from "@prisma/client";

// Define a serializable subscription type that matches the data from the server
export type SerializableSubscription = Omit<Subscription, 'createdAt' | 'updatedAt' | 'currentPeriodEnd'> & {
  createdAt: string;
  updatedAt: string;
  currentPeriodEnd: string | null;
  planName: string | null;
};

export function DashboardClientLayout({
  children,
  conversations,
  subscription,
}: {
  children: React.ReactNode;
  conversations: Conversation[];
  subscription: SerializableSubscription | null;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Handle new subscription parameter
  useEffect(() => {
    if (!searchParams) return;
    
    const newSubscription = searchParams.get('new-subscription');
    if (newSubscription === 'true') {
      // Remove the query parameter and refresh the page to get the latest subscription data
      const url = new URL(window.location.href);
      url.searchParams.delete('new-subscription');
      
      // Wait a moment to allow webhook processing to complete
      const timer = setTimeout(() => {
        window.location.href = url.toString();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  // Fix viewport height su mobile quando barra browser appare/scompare
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <DashboardSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        initialConversations={conversations}
        subscription={subscription}
      />

      <div className="lg:pl-64 flex flex-col flex-1 h-[100dvh]">
        <header className="sticky top-0 z-20 flex h-16 items-center bg-background border-b lg:hidden">
          <div className="flex items-center px-4 w-full justify-between">
            <button
              type="button"
              className="-mx-2 p-2 rounded-md text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/dashboard" className="text-lg font-bold text-primary">
              Traspolegal
            </Link>
            <div className="w-5"></div>
          </div>
        </header>
        <main className="flex-1 py-0 px-0 sm:py-6 sm:px-6 md:px-8 overflow-hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center"><div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div><span className='ml-2'>Caricamento pagina...</span></div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
