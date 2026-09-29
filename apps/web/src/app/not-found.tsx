"use client";

// Hardening audit (errors, HIGH) — no `not-found.tsx` existed, so an
// unmatched route (or a page calling Next's `notFound()`) fell through to
// Next's default 404 instead of friendly Indonesian copy with a way back.

import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";

export default function NotFound() {
  const { t } = useLocale();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SectionCard className="max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-2">
          <FileQuestion
            aria-hidden="true"
            className="size-8 text-muted-foreground"
          />
          <h1 className="text-lg font-bold text-foreground">
            {t.errors.notFoundTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.errors.notFoundBody}
          </p>
          <Button className="mt-2" onClick={() => window.location.assign("/")}>
            {t.errors.notFoundButton}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
