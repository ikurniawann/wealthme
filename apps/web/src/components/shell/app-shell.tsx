"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/hooks/use-locale";
import { ShellProvider } from "./shell-context";
import { SidebarNav } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileHeader, MobileNav } from "./mobile-bars";
import { SearchDialog } from "./search-dialog";
import { TransactionDialog } from "./transaction-dialog";
import { Walkthrough } from "@/components/onboarding/walkthrough";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="flex size-9 items-center justify-center rounded-[10px] bg-primary text-base font-extrabold text-white">
            W
          </div>
          <span className="text-sm font-semibold">{t.shell.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <ShellProvider>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r md:block">
          <Suspense fallback={null}>
            <SidebarNav />
          </Suspense>
        </aside>

        {/* Main */}
        <div className="flex min-h-screen w-full min-w-0 flex-col md:ml-60">
          <Suspense fallback={<div className="h-16 border-b bg-card" />}>
            <Topbar />
          </Suspense>
          <Suspense
            fallback={<div className="h-14 border-b bg-card md:hidden" />}
          >
            <MobileHeader />
          </Suspense>
          <main className="flex-1 px-3.5 pb-20 pt-3.5 md:px-6 md:py-6">
            {children}
          </main>
        </div>

        <MobileNav />
      </div>

      <SearchDialog />
      <TransactionDialog />
      <Walkthrough />
    </ShellProvider>
  );
}
