"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/hooks/use-locale";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField, type AuthReveal } from "@/components/auth/auth-fields";
import { LegalLinks } from "@/components/auth/legal-links";

// EPIC-026 Wave 7 — markup rebuilt from docs/prototype/pages/register.html
// (token-based `.auth` layout per EPIC-025-N3-translation-table.md). Cut
// per J1: the consent checkbox (nothing records it). Ported from the
// prototype: the "Tidak ada rekening yang dibuat otomatis" notice (accurate
// — EPIC-024 item 11 removed the auto-created "Akun Utama") and the
// "Anggota keluarga tidak mendaftar sendiri" footer (accurate — the family
// head creates member accounts directly). Registration logic is untouched.

// EPIC-025 N3-H2 — password-strength meter ported from the prototype.
// Pure client-side UI, no backend involved.
const STRENGTH_LABELS = ["Sangat lemah", "Lemah", "Cukup", "Kuat"] as const;

function scorePassword(value: string): number {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(4, Math.max(1, score));
}

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const score = scorePassword(password);
  const tone = score <= 2 ? "1" : score === 3 ? "2" : "3";
  return (
    <div aria-hidden="true">
      <div className="au-meter">
        {STRENGTH_LABELS.map((label, i) => (
          <i key={label} data-on={i < score ? tone : undefined} />
        ))}
      </div>
      <p className="au-hint" style={{ marginTop: 5 }}>
        Kekuatan password: <strong>{STRENGTH_LABELS[score - 1]}</strong> ·{" "}
        {password.length} karakter
      </p>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const v2 = t.register.v2;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Nama harus diisi";
    } else if (name.trim().length < 2) {
      newErrors.name = "Nama minimal 2 karakter";
    }

    if (!email.trim()) {
      newErrors.email = "Email harus diisi";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email tidak valid";
    }

    if (!password) {
      newErrors.password = "Password harus diisi";
    } else if (password.length < 8) {
      newErrors.password = "Password minimal 8 karakter";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Konfirmasi password harus diisi";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Password tidak cocok";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const doRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: name.trim(),
        callbackURL: "/beranda",
      });

      if (result.error) {
        if (
          result.error.status === 422 ||
          result.error.message?.toLowerCase().includes("already")
        ) {
          toast.error("Email sudah terdaftar");
        } else {
          toast.error(result.error.message ?? "Registrasi gagal");
        }
        return;
      }

      toast.success("Akun berhasil dibuat! Masuk sekarang.");
      router.push("/beranda");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat registrasi",
      );
    } finally {
      setLoading(false);
    }
  };

  const reveal = (
    show: boolean,
    set: (fn: (s: boolean) => boolean) => void,
  ): AuthReveal => ({
    show,
    onToggle: () => set((s) => !s),
    showLabel: "Tampilkan password",
    hideLabel: "Sembunyikan password",
  });
  const clear = (key: string) => {
    if (errors[key]) setErrors({ ...errors, [key]: "" });
  };

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
        <ArrowLeft size={14} aria-hidden="true" /> Kembali ke Masuk
      </Link>
      <h1 className="au-title">Buat Akun Baru</h1>
      <p className="au-sub">Mulai kelola keuangan Anda hari ini</p>

      {/* Language choice — persists via setLocale() and applies app-wide.
          Text label, not a flag emoji (tofu boxes without an emoji font). */}
      <div role="tablist" className="au-seg" data-compact="true">
        <button
          type="button"
          role="tab"
          aria-selected={locale === "id"}
          onClick={() => setLocale("id")}
        >
          ID Indonesia
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={locale === "en"}
          onClick={() => setLocale("en")}
        >
          EN English
        </button>
      </div>

      <form
        className="au-form"
        onSubmit={(e) => {
          e.preventDefault();
          void doRegister();
        }}
      >
        <AuthField
          id="name"
          label="Nama Lengkap"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clear("name");
          }}
          placeholder="cth: Budi Santoso"
          error={errors.name}
        />
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clear("email");
          }}
          placeholder="user@example.com"
          error={errors.email}
        />
        <AuthField
          id="password"
          label="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            clear("password");
          }}
          placeholder="Min. 8 karakter"
          error={errors.password}
          reveal={reveal(showPassword, setShowPassword)}
        >
          <PasswordStrengthMeter password={password} />
        </AuthField>
        <AuthField
          id="confirmPassword"
          label="Konfirmasi Password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            clear("confirmPassword");
          }}
          placeholder="Ulangi password Anda"
          error={errors.confirmPassword}
          reveal={reveal(showConfirm, setShowConfirm)}
        />

        {/* EPIC-024 item 11 — no auto-created "Akun Utama" anymore. */}
        <div className="au-info">
          <Info size={16} aria-hidden="true" />
          <div>Rekening pertama kamu tambahkan setelah daftar.</div>
        </div>

        {/* EPIC-025 N3-H2 (J1) — consent checkbox cut: nothing records it. */}
        <button
          type="submit"
          disabled={loading}
          className="au-btn"
          data-variant="primary"
        >
          {loading ? "Membuat Akun…" : "Daftar"}
        </button>
      </form>

      <p className="au-foot">
        Sudah punya akun?{" "}
        <Link className="au-link" href="/login">
          Masuk Sekarang
        </Link>
      </p>
      <p className="au-foot" style={{ marginTop: 4 }}>
        Anggota keluarga didaftarkan oleh kepala keluarga.
      </p>
      <LegalLinks />
    </AuthShell>
  );
}
