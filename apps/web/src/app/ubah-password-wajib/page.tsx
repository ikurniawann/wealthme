"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession, signOut } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";
import { SectionCard } from "@/components/wm";

/** Same shape `apiFetch` throws (`{ status, message }`) — surfaces the
 *  server's real reason instead of one generic failure string. Mirrors the
 *  identically-named local helper in persetujuan/page.tsx. */
function extractApiErrorMessage(err: unknown, fallback: string): string {
  return err && typeof err === "object" && "message" in err
    ? String((err as { message: unknown }).message)
    : fallback;
}

// EPIC-026 Wave 7 — markup rebuilt from
// docs/prototype/pages/ubah-password-wajib.html (token-based `.auth`
// layout per EPIC-025-N3-translation-table.md): warning-tinted brand mark
// above the card, avatar identity row, token `.notice--warning`, field
// hints. NOT ported, per J2: the prototype's "minta kepala keluarga
// menyetel ulang di Akun & Keluarga → Anggota" footer — head-resets-a-
// member's-password has zero backend support today. The prototype's
// username/role/created-by identity detail is trimmed to what the session
// actually carries (the display name). Logic is untouched.
//
// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — forced first-login password
// change for a head-created dependant/operational member
// (`mustChangePassword: true`). Lives OUTSIDE the `(app)` route group so
// `ForcePasswordChangeGuard` (mounted in `app/(app)/layout.tsx`) never
// redirects it into itself. The real enforcement is server-side
// (`ForcePasswordChangeGuard`, apps/api) — every other endpoint refuses the
// account with 403 `{ code: "PASSWORD_CHANGE_REQUIRED" }` until this
// succeeds; this page is reachable specifically because
// `POST /auth/set-password` is allowlisted there.

const INPUT_CLASS =
  "w-full rounded-[9px] border bg-background px-3 py-[9px] text-[13.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-primary/20";
const LABEL_CLASS = "mb-[5px] block text-[12.5px] font-semibold";
const HINT_CLASS = "mt-[5px] text-[11.5px] text-muted-foreground";

export default function UbahPasswordWajibPage() {
  const { t } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const token = session?.accessToken;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () =>
      apiFetch("/auth/set-password", {
        method: "POST",
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: async () => {
      // The 204 means the server already cleared `mustChangePassword`, so
      // write that into the cache SYNCHRONOUSLY before navigating.
      // `ForcePasswordChangeGuard` reads this exact query key and redirects
      // whenever it reads a truthy value; a bare fire-and-forget
      // `invalidateQueries` only marks the entry stale, and React Query keeps
      // serving the cached `true` until the background refetch lands. The
      // navigation below won that race every time, so the guard bounced the
      // user straight back to this page — the change had actually succeeded,
      // which is why signing out and back in with the new password "fixed"
      // it (a fresh session refetched the flag as false).
      queryClient.setQueryData(["auth", "password-status", token], {
        mustChangePassword: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["auth", "password-status", token],
      });
      toast.success(t.forcePasswordChange.toastSuccess);
      router.replace("/beranda");
    },
    onError: (err) => {
      // Surface the server's real reason ("Current password is incorrect")
      // instead of one generic failure string for every cause.
      toast.error(
        extractApiErrorMessage(err, t.forcePasswordChange.toastFailed),
      );
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.warning(t.forcePasswordChange.toastMinLength);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning(t.forcePasswordChange.toastMismatch);
      return;
    }
    submit();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-[18px] flex items-center justify-center gap-2.5">
          <div className="grid size-[34px] place-items-center rounded-[9px] bg-warning text-white">
            <ShieldAlert className="size-[18px]" />
          </div>
          <div className="text-[18px] font-extrabold tracking-tight">
            WealthMe
          </div>
        </div>

        <SectionCard>
          <h1 className="text-center text-[16px] font-extrabold">
            {t.forcePasswordChange.title}
          </h1>
          <p className="mt-1.5 text-center text-[11.5px] text-muted-foreground">
            {t.forcePasswordChange.subtitle}
          </p>

          {session?.user.name && (
            <div className="mt-4 flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-extrabold text-accent-foreground">
                {session.user.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 text-[12.5px] font-bold">
                {session.user.name}
              </div>
            </div>
          )}

          {/* EPIC-025 N3-H3 (J2) — states the real, already-enforced backend
              gate (see the file-level comment above), NOT the prototype's
              "kepala keluarga bisa reset password anggota" promise, which
              has zero backend support today. */}
          <div className="mt-3.5 flex items-start gap-2.5 rounded-[11px] border border-warning/35 bg-warning-soft p-3 text-[12.5px] text-warning">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Langkah ini tidak bisa dilewati.</strong> Semua halaman
              lain menolak akun ini sampai password diganti.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="mt-4">
            <div>
              <label htmlFor="currentPassword" className={LABEL_CLASS}>
                {t.forcePasswordChange.currentPasswordLabel}
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={INPUT_CLASS}
                required
              />
              <div className={HINT_CLASS}>
                Password sementara yang diberikan kepala keluarga saat akun ini
                dibuat.
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="newPassword" className={LABEL_CLASS}>
                {t.forcePasswordChange.newPasswordLabel}
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={INPUT_CLASS}
                minLength={8}
                required
              />
            </div>

            <div className="mt-3">
              <label htmlFor="confirmPassword" className={LABEL_CLASS}>
                {t.forcePasswordChange.confirmPasswordLabel}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={INPUT_CLASS}
                minLength={8}
                required
              />
              <div className={HINT_CLASS}>
                Minimal 8 karakter. Kepala keluarga tidak bisa melihat password
                barumu.
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !token}
              className="mt-4 flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending
                ? t.forcePasswordChange.submitting
                : t.forcePasswordChange.submitButton}
            </button>
          </form>

          <button
            onClick={() => {
              void signOut({ callbackUrl: "/login" });
            }}
            className="mt-2.5 flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] border bg-card px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <LogOut className="size-[15px]" />{" "}
            {t.forcePasswordChange.logoutButton}
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
