"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/hooks/use-locale";
import { AiChatProvider } from "@/components/providers/ai-chat-provider";
import { ShellProvider } from "./shell-context";
import { SidebarNav } from "./sidebar";
import { ShellLoading } from "./shell-loading";
import { Topbar } from "./topbar";
import { PageGreeting } from "./page-greeting";
import { MobileNav } from "./mobile-bars";
import { SearchDialog } from "./search-dialog";
import { TransactionDialog } from "./transaction-dialog";
import { FloatingAiLauncher } from "./floating-ai-launcher";
import { useSidebarRail } from "./use-sidebar-rail";
import { Walkthrough } from "@/components/onboarding/walkthrough";

/**
 * Bento v2 shell (`.wm-app`): hub sidebar | topbar + phone greeting + page.
 * The sidebar → icon rail → pill dock progression is pure CSS (bento.css).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const router = useRouter();
  const { t } = useLocale();
  const { rail, toggle } = useSidebarRail();

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) {
    return <ShellLoading />;
  }

  return (
    <ShellProvider>
      {/* A1 (revisi-2) — wraps `children` too: the /ai page and the floating
          launcher must read/write the SAME conversation. */}
      <AiChatProvider>
        <div className="wm-app" data-rail={rail || undefined}>
          <a href="#main-content" className="skip-link">
            Lewati ke konten
          </a>
          <Suspense fallback={null}>
            <SidebarNav rail={rail} onToggle={toggle} />
          </Suspense>

          <div className="wm-main">
            <Suspense fallback={null}>
              <Topbar />
              <PageGreeting />
            </Suspense>
            <main className="page" id="main-content" tabIndex={-1}>
              {children}
            </main>
          </div>

          <MobileNav />
        </div>

        <SearchDialog />
        <TransactionDialog />
        <Walkthrough />
        <FloatingAiLauncher />
      </AiChatProvider>
    </ShellProvider>
  );
}
