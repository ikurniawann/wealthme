"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";

// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — a head-created dependant/
// operational account must change its initial password before using the
// app. The REAL enforcement is server-side (`ForcePasswordChangeGuard`,
// apps/api): every request except a small allowlist gets 403
// { code: "PASSWORD_CHANGE_REQUIRED" }. This component is the frontend UX
// half — it proactively checks the flag (via the allowlisted
// `GET /auth/password-status`) and redirects into the dedicated
// `/ubah-password-wajib` page before the user can see any (app) content,
// rather than reacting to a 403 on every unrelated call site.
//
// `apiFetch` (apps/web/src/lib/api-client.ts) is a protected foundation
// file this task may not modify, and it does not forward the response
// body's `code` field on error — only `{ status, message }` — so a global
// "catch a PASSWORD_CHANGE_REQUIRED error anywhere" interceptor isn't
// reachable without touching that file. Checking the flag proactively here,
// mounted once above every (app) page, achieves the same "block navigation
// elsewhere until it succeeds" outcome without touching protected files.
//
// review-qa FIX 1 (HIGH) — rendering `children` unconditionally while the
// redirect fires from a `useEffect` let the (app) shell/chrome paint for a
// frame for a genuinely-affected account before the redirect landed, which
// fails the epic's literal AC ("required to set a new password before
// reaching any page"). Gate rendering itself, not just navigation: withhold
// `children` (a) on the very first check per session (query has no data
// yet) and (b) once `mustChangePassword` resolves `true`, until the
// redirect completes. Mirrors `AppShell`'s own `!ready || !isAuthenticated`
// blocking pattern/markup (components/shell/app-shell.tsx) so the loading
// state is visually consistent instead of a new bespoke spinner.
//
// The 30s `staleTime` (unchanged) is what keeps this from becoming a
// per-navigation flash for the common case: React Query treats the cached
// `mustChangePassword: false` result as fresh for 30s after the first
// check, so `data` is populated synchronously (no loading gap) on every
// route change within that window instead of refetching and re-blocking.
export function ForcePasswordChangeGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const { data, isSuccess } = useQuery({
    queryKey: ["auth", "password-status", token],
    queryFn: () =>
      apiFetch<{ mustChangePassword: boolean }>("/auth/password-status", {
        token,
      }),
    enabled: status === "authenticated" && !!token,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data?.mustChangePassword) {
      router.replace("/ubah-password-wajib");
    }
  }, [data?.mustChangePassword, router]);

  // Unauthenticated: nothing to gate here — `AppShell` itself redirects to
  // /login. Render children through so that path is unaffected.
  const isCheckPending = status === "authenticated" && !isSuccess;
  const mustChangePassword = data?.mustChangePassword === true;

  if (isCheckPending || mustChangePassword) {
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

  return <>{children}</>;
}
