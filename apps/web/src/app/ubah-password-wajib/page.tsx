"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSession, signOut } from "@/lib/auth-compat";
import { apiFetch } from "@/lib/api-client";
import { useLocale } from "@/hooks/use-locale";

const FIELD_CLASS =
  "w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 px-3.5 text-sm text-slate-900 outline-none transition-colors focus:border-primary";

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
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["auth", "password-status", token],
      });
      toast.success(t.forcePasswordChange.toastSuccess);
      router.replace("/beranda");
    },
    onError: () => {
      toast.error(t.forcePasswordChange.toastFailed);
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
    <div
      className="relative flex min-h-screen items-center justify-center p-5"
      style={{
        backgroundImage:
          "linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4338ca 70%,#6366f1 100%)",
      }}
    >
      <div className="w-full max-w-[420px] rounded-3xl bg-white/[0.97] p-10 shadow-[0_32px_80px_rgba(0,0,0,0.3)]">
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-warning text-xl text-white">
            <ShieldAlert className="size-5" />
          </div>
        </div>
        <h1 className="text-center text-[19px] font-extrabold text-slate-900">
          {t.forcePasswordChange.title}
        </h1>
        <p className="mb-7 text-center text-[13px] text-slate-500">
          {t.forcePasswordChange.subtitle}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-1.5 block text-xs font-semibold text-slate-600"
            >
              {t.forcePasswordChange.currentPasswordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`${FIELD_CLASS} pl-9`}
                required
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-xs font-semibold text-slate-600"
            >
              {t.forcePasswordChange.newPasswordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${FIELD_CLASS} pl-9`}
                minLength={8}
                required
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-xs font-semibold text-slate-600"
            >
              {t.forcePasswordChange.confirmPasswordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`${FIELD_CLASS} pl-9`}
                minLength={8}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !token}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
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
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-200 bg-slate-50 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-destructive hover:bg-red-50"
        >
          <LogOut className="size-3.5" /> {t.forcePasswordChange.logoutButton}
        </button>
      </div>
    </div>
  );
}
