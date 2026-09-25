"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { SectionCard } from "@/components/wm";

// EPIC-026 Wave 7 — markup rebuilt from
// docs/prototype/pages/reset-password.html (token-based `.auth` layout per
// EPIC-025-N3-translation-table.md). NOT ported, per J2: the prototype's
// "semua sesi aktif di perangkat lain akan keluar" notice — session/device
// revocation on password reset is promised in copy but not implemented, so
// the reassuring copy stays out until it is built. The prototype's sub-text
// also shows the account email, which the token-only reset flow cannot know
// client-side — omitted rather than faked. Reset logic is untouched.

const INPUT_CLASS =
  "w-full rounded-[9px] border bg-background px-3 py-[9px] text-[13.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-primary/20";
const LABEL_CLASS = "mb-[5px] block text-[12.5px] font-semibold";

// EPIC-025 N3-H4 — live rule checklist ported from the prototype, pure
// client-side UI. Trimmed to ONLY the rules `doReset` (below) and the
// backend actually enforce (min 8 chars + confirmation match) — the
// prototype's extra uppercase/number/symbol rules aren't checked by
// better-auth's password policy here, so showing them would be a fake
// requirement (honest-UI mandate).
function PasswordRules({
  password,
  confirm,
}: {
  password: string;
  confirm: string;
}) {
  const rules = [
    { label: "Minimal 8 karakter", ok: password.length >= 8 },
    {
      label: "Konfirmasi sama dengan password baru",
      ok: password.length > 0 && password === confirm,
    },
  ];
  return (
    <div className="mt-4 space-y-1.5">
      {rules.map((rule) => (
        <div
          key={rule.label}
          className={`flex items-center gap-2 text-[12px] ${
            rule.ok ? "text-success" : "text-muted-foreground"
          }`}
        >
          <span aria-hidden="true">{rule.ok ? "✓" : "○"}</span>
          {rule.label}
        </div>
      ))}
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <p className="mb-4 text-[12.5px] font-semibold text-destructive">
          Link reset password tidak valid atau sudah kadaluarsa.
        </p>
        <Link
          href="/lupa-password"
          className="text-[12.5px] font-bold text-primary transition-colors hover:text-primary-strong"
        >
          Minta link baru
        </Link>
      </div>
    );
  }

  const doReset = async () => {
    if (!password || !confirm) {
      toast.warning("Semua kolom harus diisi");
      return;
    }
    if (password.length < 8) {
      toast.warning("Password minimal 8 karakter");
      return;
    }
    if (password !== confirm) {
      toast.warning("Password tidak cocok");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Gagal mereset password");
        return;
      }
      toast.success("Password berhasil direset! Silakan login.");
      router.push("/login");
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="mt-3.5 text-center text-[16px] font-extrabold">
        Reset Password
      </h1>
      <p className="mt-1 mb-[18px] text-center text-[11.5px] text-muted-foreground">
        Masukkan password baru Anda
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doReset();
        }}
      >
        <div>
          <label htmlFor="password" className={LABEL_CLASS}>
            Password Baru
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 karakter"
              className={`${INPUT_CLASS} pr-10`}
            />
            <button
              type="button"
              aria-label={showPassword ? "Sembunyikan" : "Tampilkan"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-primary"
            >
              {showPassword ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="confirm" className={LABEL_CLASS}>
            Konfirmasi Password
          </label>
          <div className="relative">
            <input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ulangi password baru"
              className={`${INPUT_CLASS} pr-10`}
            />
            <button
              type="button"
              aria-label={showConfirm ? "Sembunyikan" : "Tampilkan"}
              aria-pressed={showConfirm}
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-primary"
            >
              {showConfirm ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
          {confirm.length > 0 && password !== confirm && (
            <p className="mt-[5px] text-[11.5px] font-semibold text-destructive">
              Password tidak cocok
            </p>
          )}
        </div>

        <PasswordRules password={password} confirm={confirm} />

        {/* EPIC-025 N3-H4 (J2) — the prototype's "semua sesi aktif di
            perangkat lain akan keluar" warning notice is NOT ported:
            session/device revocation on password reset is not implemented,
            and porting the reassuring copy before it exists would be a
            false security promise. */}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Menyimpan…" : "Simpan Password Baru"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-[18px] flex items-center justify-center gap-2.5">
          <div className="grid size-[34px] place-items-center rounded-[9px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand mark, no responsive srcset needed */}
            <img
              src="/brand/wealthme-mark.png"
              alt=""
              className="size-full object-contain"
            />
          </div>
          <div className="text-[18px] font-extrabold tracking-tight">
            WealthMe
          </div>
        </div>

        <SectionCard>
          <Link
            href="/login"
            className="text-[12.5px] font-bold text-primary transition-colors hover:text-primary-strong"
          >
            ← Kembali ke Login
          </Link>

          <Suspense
            fallback={
              <div className="py-6 text-center text-[12.5px] text-muted-foreground">
                Memuat…
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </SectionCard>

        <div className="mt-3.5 text-center text-[11.5px] text-muted-foreground">
          Link kedaluwarsa?{" "}
          <Link
            href="/lupa-password"
            className="text-[12.5px] font-bold text-primary transition-colors hover:text-primary-strong"
          >
            Minta link baru
          </Link>
        </div>
      </div>
    </div>
  );
}
