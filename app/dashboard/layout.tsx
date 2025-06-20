"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar toggle backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Suspense
        fallback={ // Fallback per l'intera sidebar (mobile e desktop)
          <>
            {/* Fallback Skeleton per Mobile Sidebar (visibile solo se sidebarOpen fosse true) */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-card border-r flex flex-col transform transition-transform ease-in-out duration-300 lg:hidden ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full" // Usa sidebarOpen per coerenza, anche se il contenuto è scheletro
            } z-40`}>
              <div className="flex items-center justify-between px-4 h-16 border-b">
                <span className="text-xl font-bold text-primary animate-pulse">ConsulLegal AI</span>
                {/* No close button in skeleton */}
              </div>
              <div className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
                <div className="h-8 bg-muted rounded w-3/4 animate-pulse"></div>
                <div className="h-8 bg-muted rounded w-1/2 animate-pulse"></div>
                <div className="h-8 bg-muted rounded w-2/3 animate-pulse"></div>
                <div className="mt-4 pt-4 border-t border-border">
                  <h3 className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2 animate-pulse">
                    Le Tue Consulenze
                  </h3>
                  <div className="h-6 bg-muted rounded w-full animate-pulse mb-1.5"></div>
                  <div className="h-6 bg-muted rounded w-full animate-pulse mb-1.5"></div>
                  <div className="h-6 bg-muted rounded w-full animate-pulse"></div>
                </div>
              </div>
              <div className="border-t p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                <div className="h-9 bg-muted rounded w-full animate-pulse"></div>
              </div>
            </div>
            {/* Fallback Skeleton per Desktop Sidebar */}
            <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-card">
              <div className="flex items-center h-16 px-4 border-b">
                <span className="text-xl font-bold text-primary animate-pulse">ConsulLegal AI</span>
              </div>
              <div className="flex-1 flex flex-col overflow-y-auto py-4 px-3 space-y-2">
                <div className="h-8 bg-muted rounded w-3/4 animate-pulse"></div>
                <div className="h-8 bg-muted rounded w-1/2 animate-pulse"></div>
                <div className="h-8 bg-muted rounded w-2/3 animate-pulse"></div>
                <div className="mt-4 pt-4 border-t border-border">
                  <h3 className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2 animate-pulse">
                    Le Tue Consulenze
                  </h3>
                  <div className="h-6 bg-muted rounded w-full animate-pulse mb-1.5"></div>
                  <div className="h-6 bg-muted rounded w-full animate-pulse mb-1.5"></div>
                  <div className="h-6 bg-muted rounded w-full animate-pulse"></div>
                </div>
              </div>
              <div className="border-t p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                <div className="h-9 bg-muted rounded w-full animate-pulse"></div>
              </div>
            </div>
          </>
        }
      >
        <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      </Suspense>

      {/* Main content */}
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
            <div className="w-5"></div> {/* Empty div for balanced layout */}
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
