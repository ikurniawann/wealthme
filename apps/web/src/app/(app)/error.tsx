"use client";

// Hardening audit (errors, HIGH) — no `error.tsx` existed anywhere under
// `app/`, so an uncaught render/query throw inside the app shell (e.g. a
// component that reads `data!` before load, or a route param that fails to
// resolve) showed Next.js's default blank/dev-overlay screen instead of
// Indonesian copy with a retry. This boundary sits INSIDE the shell
// (`(app)/layout.tsx` renders `AppShell` above `{children}`), so the
// sidebar/topbar stay usable while only the failed page body is replaced.

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <SectionCard className="max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-2">
          <AlertTriangle
            aria-hidden="true"
            className="size-8 text-destructive"
          />
          <h2 className="text-lg font-bold text-foreground">
            {t.errors.boundaryTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.errors.boundaryBody}
          </p>
          <div className="mt-2 flex gap-2">
            <Button onClick={reset}>{t.errors.retryButton}</Button>
            <Button
              variant="outline"
              onClick={() => window.location.assign("/beranda")}
            >
              {t.errors.homeButton}
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
