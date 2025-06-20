"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { DashboardSidebar, type Conversation } from "@/components/dashboard/dashboard-sidebar";

export function DashboardClientLayout({
  children,
  conversations,
}: {
  children: React.ReactNode;
  conversations: Conversation[];
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      />

      <div className="lg:pl-64 flex flex-col flex-1">
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
              ConsulLegal AI
            </Link>
            <div className="w-5"></div>
          </div>
        </header>
        <main className="flex-1 py-6 px-4 sm:px-6 md:px-8">
          <Suspense fallback={<div className="flex h-full items-center justify-center"><div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div><span className='ml-2'>Caricamento pagina...</span></div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
