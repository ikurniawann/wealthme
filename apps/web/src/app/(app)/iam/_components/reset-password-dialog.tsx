"use client";

import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";

import { CopyButton } from "./copy-button";

const MIN_PASSWORD_LENGTH = 8;

/** IAM copy-credentials — the new password only ever exists at the moment
 * it's set (hashed server-side after), so it's held only in local state and
 * cleared with the rest of the form on close. */
type ResetResult = {
  username: string;
  password: string;
};

export type ResetPasswordTarget = {
  id: string;
  name: string;
  username: string | null;
};

type ResetPasswordDialogProps = {
  member: ResetPasswordTarget | null;
  onClose: () => void;
  familyGroupId: string | null;
  token: string | undefined;
};

/**
 * Master sets a new password for a head-created (username) login. Those
 * members have no mailbox, so "Lupa Password" can never reach them — this is
 * their only way back in. The API refuses real-email accounts, so the page
 * only opens this dialog for rows with `managedLogin`.
 *
 * The password is TEMPORARY: the member is signed out of every device and,
 * at their next login, must choose their own password (/ubah-password-wajib).
 */
export function ResetPasswordDialog({
  member,
  onClose,
  familyGroupId,
  token,
}: ResetPasswordDialogProps) {
  const { t } = useLocale();
  const fieldId = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // IAM copy-credentials — set on success; the dialog switches to a result
  // view instead of closing, since the password can only be copied now.
  const [result, setResult] = useState<ResetResult | null>(null);

  const close = () => {
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setResult(null);
    onClose();
  };

  const resetPassword = useMutation({
    // `memberUsername` rides in the variables so the result view names the
    // member this request was for, not whoever the dialog shows now.
    mutationFn: (vars: {
      memberId: string;
      memberUsername: string;
      newPassword: string;
    }) =>
      apiFetch(
        `/family-groups/${familyGroupId}/members/${vars.memberId}/password`,
        {
          token,
          method: "POST",
          body: JSON.stringify({ newPassword: vars.newPassword }),
        },
      ),
    onSuccess: (_data, vars) => {
      setResult({ username: vars.memberUsername, password: vars.newPassword });
      toast.success(t.akun.resetPassword.toastSuccess);
    },
    onError: (e: { message?: string }) =>
      toast.error(e.message ?? "Gagal mengganti password"),
  });

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    password.length >= MIN_PASSWORD_LENGTH &&
    confirm === password &&
    !resetPassword.isPending;

  const submit = () => {
    if (!member || !familyGroupId || !canSubmit) return;
    resetPassword.mutate({
      memberId: member.id,
      memberUsername: member.username ?? "",
      newPassword: password,
    });
  };

  return (
    <Dialog
      open={member !== null}
      // Locked while the request is in flight so it cannot be cancelled and
      // reopened for someone else mid-change.
      onOpenChange={(o) => !o && !resetPassword.isPending && close()}
    >
      <DialogContent className="dialog--sm">
        <DialogTitle>Reset Password</DialogTitle>
        {!result && (
          <DialogDescription>
            {member?.name}
            {member?.username ? ` (login: ${member.username})` : ""} — dia
            dikeluarkan dari semua perangkat dan wajib membuat password baru
            sendiri saat login berikutnya.
          </DialogDescription>
        )}
        {result ? (
          <>
            <DialogBody>
              <div className="field">
                <label className="label">
                  {t.akun.copyCredentials.usernameRowLabel}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    className="input mono"
                    readOnly
                    value={result.username}
                  />
                  <CopyButton
                    value={result.username}
                    ariaLabel={t.akun.copyCredentials.usernameAriaLabel}
                  />
                </div>
              </div>
              <div className="field">
                <label className="label">
                  {t.akun.copyCredentials.passwordRowLabel}
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      className="input mono pr-10"
                      readOnly
                      type={showPassword ? "text" : "password"}
                      value={result.password}
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword
                          ? "Sembunyikan password"
                          : "Tampilkan password"
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-accent hover:text-primary focus-visible:bg-accent focus-visible:text-primary focus-visible:outline-none"
                    >
                      {showPassword ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>
                  <CopyButton
                    value={result.password}
                    ariaLabel={t.akun.copyCredentials.passwordAriaLabel}
                  />
                </div>
              </div>
              <CopyButton
                variant="full"
                value={`Username: ${result.username}\nPassword: ${result.password}`}
                ariaLabel={t.akun.copyCredentials.copyAllButton}
                label={t.akun.copyCredentials.copyAllButton}
              />
            </DialogBody>
            <DialogFooter>
              <button
                type="button"
                className="btn btn--primary"
                onClick={close}
              >
                {t.akun.copyCredentials.doneButton}
              </button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <DialogBody>
              <div className="field">
                <label className="label" htmlFor={`${fieldId}-new`}>
                  Password Sementara
                </label>
                <div className="relative">
                  <input
                    id={`${fieldId}-new`}
                    className="input pr-10"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={resetPassword.isPending}
                    aria-invalid={tooShort}
                    aria-describedby={
                      tooShort ? `${fieldId}-new-error` : undefined
                    }
                    placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-accent hover:text-primary focus-visible:bg-accent focus-visible:text-primary focus-visible:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
                {tooShort && (
                  <p
                    id={`${fieldId}-new-error`}
                    className="hint text-destructive"
                  >
                    Minimal {MIN_PASSWORD_LENGTH} karakter.
                  </p>
                )}
              </div>
              <div className="field">
                <label className="label" htmlFor={`${fieldId}-confirm`}>
                  Ulangi Password Sementara
                </label>
                <input
                  id={`${fieldId}-confirm`}
                  className="input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={resetPassword.isPending}
                  aria-invalid={mismatch}
                  aria-describedby={
                    mismatch ? `${fieldId}-confirm-error` : undefined
                  }
                />
                {mismatch && (
                  <p
                    id={`${fieldId}-confirm-error`}
                    className="hint text-destructive"
                  >
                    Password tidak sama.
                  </p>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <button
                type="button"
                className="btn btn--outline"
                onClick={close}
                disabled={resetPassword.isPending}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!canSubmit}
              >
                {resetPassword.isPending ? "Menyimpan…" : "Reset Password"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
