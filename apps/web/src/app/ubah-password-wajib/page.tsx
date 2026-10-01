"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession, signOut } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-fields";

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

  const fp = t.forcePasswordChange;
  return (
    <AuthShell>
      <div className="au-panel">
        <h1 className="au-title">{fp.title}</h1>
        <p className="au-sub">{fp.subtitle}</p>

        <div className="au-form">
          {session?.user.name && (
            <div className="au-ident">
              <strong>{session.user.name}</strong>
            </div>
          )}

          {/* EPIC-025 N3-H3 (J2) — states the real, already-enforced backend
              gate (see the file-level comment above), NOT the prototype's
              "kepala keluarga bisa reset password anggota" promise, which
              has zero backend support today. */}
          <div className="au-warn">
            <Lock size={16} aria-hidden="true" style={{ flex: "none" }} />
            <span>
              <strong>Langkah ini tidak bisa dilewati.</strong> Semua halaman
              lain menolak akun ini sampai password diganti.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="au-form">
            <AuthField
              id="currentPassword"
              label={fp.currentPasswordLabel}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              hint="Password sementara yang diberikan kepala keluarga saat akun ini dibuat."
              required
            />
            <AuthField
              id="newPassword"
              label={fp.newPasswordLabel}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
            <AuthField
              id="confirmPassword"
              label={fp.confirmPasswordLabel}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              hint="Minimal 8 karakter. Kepala keluarga tidak bisa melihat password barumu."
              minLength={8}
              required
            />
            <button
              type="submit"
              disabled={isPending || !token}
              className="au-btn"
              data-variant="primary"
            >
              {isPending ? fp.submitting : fp.submitButton}
            </button>
          </form>

          <button
            type="button"
            className="au-btn"
            onClick={() => {
              void signOut({ callbackUrl: "/login" });
            }}
          >
            <LogOut size={15} aria-hidden="true" /> {fp.logoutButton}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
