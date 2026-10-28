"use client";

import { apiErrorMessage } from "@/lib/api-error";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/hooks/use-locale";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-fields";

// EPIC-026 Wave 7 — markup rebuilt from
// docs/prototype/pages/reset-password.html (token-based `.auth` layout per
// EPIC-025-N3-translation-table.md). NOT ported, per J2: the prototype's
// "semua sesi aktif di perangkat lain akan keluar" notice — session/device
// revocation on password reset is promised in copy but not implemented, so
// the reassuring copy stays out until it is built. The prototype's sub-text
// also shows the account email, which the token-only reset flow cannot know
// client-side — omitted rather than faked. Reset logic is untouched.

// EPIC-025 N3-H4 — live rule checklist ported from the prototype, pure
// client-side UI. Trimmed to ONLY the rules `doReset` (below) and the
// backend actually enforce (min 8 chars + confirmation match) — extra
// uppercase/number/symbol rules would be a fake requirement.
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
    <div className="au-rules">
      {rules.map((rule) => (
        <div key={rule.label} className="au-rule" data-ok={rule.ok}>
          <i aria-hidden="true">
            {rule.ok && <Check size={10} strokeWidth={3} />}
          </i>
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
      <div className="au-center">
        <p className="au-err" style={{ marginBottom: 12 }}>
          Link reset password tidak valid atau sudah kadaluarsa.
        </p>
        <Link href="/lupa-password" className="au-link">
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
        toast.error(
          apiErrorMessage(
            {
              status: result.error.status ?? 400,
              message: result.error.message,
            },
            "Gagal mereset password",
          ),
        );
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
      <h1 className="au-title">Reset Password</h1>
      <p className="au-sub">Masukkan password baru Anda</p>

      <form
        className="au-form"
        onSubmit={(e) => {
          e.preventDefault();
          void doReset();
        }}
      >
        <AuthField
          id="password"
          label="Password Baru"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 karakter"
          reveal={{
            show: showPassword,
            onToggle: () => setShowPassword((s) => !s),
            showLabel: "Tampilkan",
            hideLabel: "Sembunyikan",
          }}
        />
        <AuthField
          id="confirm"
          label="Konfirmasi Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Ulangi password baru"
          error={
            confirm.length > 0 && password !== confirm
              ? "Password tidak cocok"
              : undefined
          }
          reveal={{
            show: showConfirm,
            onToggle: () => setShowConfirm((s) => !s),
            showLabel: "Tampilkan",
            hideLabel: "Sembunyikan",
          }}
        />

        <PasswordRules password={password} confirm={confirm} />

        {/* EPIC-025 N3-H4 (J2) — the prototype's "semua sesi aktif di
            perangkat lain akan keluar" notice is NOT ported: session
            revocation on reset is not implemented, so it would be a false
            security promise. */}

        <button
          type="submit"
          disabled={loading}
          className="au-btn"
          data-variant="primary"
        >
          {loading ? "Menyimpan…" : "Simpan Password Baru"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  const v2 = useLocale().t.resetPassword.v2;
  return (
    <AuthShell
      cover={{
        headline: (
          <>
            {v2.coverPre}
            <em>{v2.coverEm}</em>
            {v2.coverPost}
          </>
        ),
        features: v2.features,
      }}
    >
      <Link href="/login" className="au-back">
        <ArrowLeft size={14} aria-hidden="true" /> Kembali ke Login
      </Link>

      <Suspense fallback={<p className="au-sub">Memuat…</p>}>
        <ResetPasswordForm />
      </Suspense>

      <p className="au-foot">
        Link kedaluwarsa?{" "}
        <Link className="au-link" href="/lupa-password">
          Minta link baru
        </Link>
      </p>
    </AuthShell>
  );
}
