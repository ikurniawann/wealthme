"use client";

// Hardening audit (errors, HIGH) — covers every route OUTSIDE the `(app)`
// group (login, register, join, reset-password, the root page, …), which
// has no shell/session context to lean on. Kept deliberately standalone
// from `(app)/error.tsx` (no AppShell, no "go to dashboard" assumption
// beyond a plain link) since a signed-out visitor can hit this too.

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";

export default function RootSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error("[root error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SectionCard className="max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-2">
          <AlertTriangle
            aria-hidden="true"
            className="size-8 text-destructive"
          />
          <h1 className="text-lg font-bold text-foreground">
            {t.errors.boundaryTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.errors.boundaryBody}
          </p>
          <div className="mt-2 flex gap-2">
            <Button onClick={reset}>{t.errors.retryButton}</Button>
            <Button
              variant="outline"
              onClick={() => window.location.assign("/")}
            >
              {t.errors.homeButton}
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
