"use client";

// Hardening audit (errors, HIGH) — the LAST-resort boundary: it only
// activates when the ROOT layout itself throws (a bug in providers, the
// theme script, or font loading), and it replaces the entire tree — Next.js
// requires it to render its own <html>/<body>. Everything RootLayout
// normally provides (ThemeProvider, AuthProvider, query client, the anti-
// FOUC theme script) is gone at this point, so this stays deliberately
// minimal and self-contained. `./globals.css` is imported directly (the
// documented Next.js pattern for global-error) so the fallback still has
// base styling instead of unstyled HTML.
import "./globals.css";

import { useEffect } from "react";
import { useLocale } from "@/hooks/use-locale";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="id">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="card max-w-md text-center">
            <div className="card__body flex flex-col items-center gap-3 py-6">
              <h1 className="text-lg font-bold">{t.errors.globalErrorTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {t.errors.globalErrorBody}
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={reset}
              >
                {t.errors.retryButton}
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
