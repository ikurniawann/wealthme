"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

// EPIC-025 N3-H4 — live rule checklist ported from
// docs/prototype/pages/reset-password.html, pure client-side UI. Trimmed to
// ONLY the rules `doReset` (below) and the backend actually enforce (min 8
// chars + confirmation match) — the prototype's extra uppercase/number/
// symbol rules aren't checked by better-auth's password policy here, so
// showing them would be a fake requirement (honest-UI mandate).
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
    <div className="mb-4 space-y-1.5">
      {rules.map((rule) => (
        <div
          key={rule.label}
          className={`flex items-center gap-2 text-[12px] ${
            rule.ok ? "text-success" : "text-slate-400"
          }`}
        >
          <Check
            className={`size-3 shrink-0 ${rule.ok ? "opacity-100" : "opacity-30"}`}
          />
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
        <p className="mb-4 text-sm text-red-500">
          Link reset password tidak valid atau sudah kadaluarsa.
        </p>
        <Link
          href="/lupa-password"
          className="text-sm font-semibold text-primary hover:text-primary-strong transition-colors"
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
      <h1 className="text-center text-[22px] font-extrabold text-slate-900">
        Reset Password
      </h1>
      <p className="mb-7 text-center text-[13px] text-slate-400">
        Masukkan password baru Anda
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void doReset();
        }}
      >
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-semibold text-slate-600"
        >
          Password Baru
        </label>
        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Lock className="size-3.5" />
          </span>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 karakter"
            className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            aria-label={showPassword ? "Sembunyikan" : "Tampilkan"}
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
          >
            {showPassword ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>

        <label
          htmlFor="confirm"
          className="mb-1.5 block text-xs font-semibold text-slate-600"
        >
          Konfirmasi Password
        </label>
        <div className="relative mb-6">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <Lock className="size-3.5" />
          </span>
          <input
            id="confirm"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Ulangi password baru"
            className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            aria-label={showConfirm ? "Sembunyikan" : "Tampilkan"}
            onClick={() => setShowConfirm((s) => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
          >
            {showConfirm ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        </div>

        <PasswordRules password={password} confirm={confirm} />

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-primary-strong hover:shadow-[0_4px_16px_rgba(79,70,229,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Menyimpan…" : "Simpan Password Baru"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-5"
      style={{
        backgroundImage:
          "linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4338ca 70%,#6366f1 100%)",
      }}
    >
      <div className="w-full max-w-[420px] rounded-3xl bg-white/[0.97] p-10 shadow-[0_32px_80px_rgba(0,0,0,0.3)]">
        <Link
          href="/login"
          className="mb-5 flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-strong transition-colors"
        >
          <ArrowLeft className="size-4" /> Kembali ke Login
        </Link>

        <div className="mb-7 flex items-center justify-center gap-2.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-extrabold tracking-tighter text-white">
            W
          </div>
          <div className="text-[22px] font-extrabold text-slate-900">
            Wealth<span className="text-primary">Me</span>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="text-center text-sm text-slate-400">Memuat…</div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
