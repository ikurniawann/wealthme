"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Info } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";

// EPIC-026 Wave 7 — markup rebuilt from docs/prototype/pages/register.html
// (token-based `.auth` layout per EPIC-025-N3-translation-table.md). Cut
// per J1: the consent checkbox (nothing records it). Ported from the
// prototype: the "Tidak ada rekening yang dibuat otomatis" notice (accurate
// — EPIC-024 item 11 removed the auto-created "Akun Utama") and the
// "Anggota keluarga tidak mendaftar sendiri" footer (accurate — the family
// head creates member accounts directly). Registration logic is untouched.

const INPUT_CLASS =
  "w-full rounded-[9px] border bg-background px-3 py-[9px] text-[13.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-primary/20";
const LABEL_CLASS = "mb-[5px] block text-[12.5px] font-semibold";
const ERROR_CLASS = "mt-[5px] text-[11.5px] font-semibold text-destructive";

// EPIC-025 N3-H2 — password-strength meter ported from
// docs/prototype/pages/register.html. Pure client-side UI, no backend
// involved.
type StrengthLevel = { label: string; colorClass: string; fill: number };

const STRENGTH_LEVELS: StrengthLevel[] = [
  { label: "Sangat lemah", colorClass: "bg-destructive", fill: 1 },
  { label: "Lemah", colorClass: "bg-destructive", fill: 2 },
  { label: "Cukup", colorClass: "bg-warning", fill: 3 },
  { label: "Kuat", colorClass: "bg-success", fill: 4 },
];

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
  const level = STRENGTH_LEVELS[scorePassword(password) - 1];
  return (
    <div aria-hidden="true">
      <div className="mt-2 flex gap-[5px]">
        {STRENGTH_LEVELS.map((_, i) => (
          <span
            key={i}
            className={`h-[5px] flex-1 rounded-full ${
              i < level.fill ? level.colorClass : "bg-secondary"
            }`}
          />
        ))}
      </div>
      <div className="mt-[5px] text-[11.5px] text-muted-foreground">
        Kekuatan password: <strong>{level.label}</strong> · {password.length}{" "}
        karakter
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { locale, setLocale } = useLocale();
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
            ← Kembali ke Masuk
          </Link>

          <h1 className="mt-3.5 text-center text-[16px] font-extrabold">
            Buat Akun Baru
          </h1>
          <p className="mt-1 mb-4 text-center text-[11.5px] text-muted-foreground">
            Mulai kelola keuangan Anda hari ini
          </p>

          {/* Language choice — persists via setLocale() and applies
              app-wide. EPIC-022 Group G (G3) — text label, not a flag
              emoji: 🇮🇩/🇬🇧 render as tofu boxes on systems without an
              emoji-flag font. */}
          <div
            role="tablist"
            className="mx-auto mb-4 flex w-fit gap-0.5 rounded-[10px] bg-secondary p-[3px]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={locale === "id"}
              onClick={() => setLocale("id")}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                locale === "id"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              ID Indonesia
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={locale === "en"}
              onClick={() => setLocale("en")}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                locale === "en"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              EN English
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void doRegister();
            }}
          >
            <div>
              <label htmlFor="name" className={LABEL_CLASS}>
                Nama Lengkap
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: "" });
                }}
                placeholder="cth: Budi Santoso"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
                className={INPUT_CLASS}
              />
              {errors.name && (
                <p id="name-error" role="alert" className={ERROR_CLASS}>
                  {errors.name}
                </p>
              )}
            </div>

            <div className="mt-3">
              <label htmlFor="email" className={LABEL_CLASS}>
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
                placeholder="user@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={INPUT_CLASS}
              />
              {errors.email && (
                <p id="email-error" role="alert" className={ERROR_CLASS}>
                  {errors.email}
                </p>
              )}
            </div>

            <div className="mt-3">
              <label htmlFor="password" className={LABEL_CLASS}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: "" });
                  }}
                  placeholder="Min. 8 karakter"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  className={`${INPUT_CLASS} pr-10`}
                />
                <button
                  type="button"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
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
              <PasswordStrengthMeter password={password} />
              {errors.password && (
                <p id="password-error" role="alert" className={ERROR_CLASS}>
                  {errors.password}
                </p>
              )}
            </div>

            <div className="mt-3">
              <label htmlFor="confirmPassword" className={LABEL_CLASS}>
                Konfirmasi Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword)
                      setErrors({ ...errors, confirmPassword: "" });
                  }}
                  placeholder="Ulangi password Anda"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={
                    errors.confirmPassword ? "confirmPassword-error" : undefined
                  }
                  className={`${INPUT_CLASS} pr-10`}
                />
                <button
                  type="button"
                  aria-label={
                    showConfirm ? "Sembunyikan password" : "Tampilkan password"
                  }
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
              {errors.confirmPassword && (
                <p
                  id="confirmPassword-error"
                  role="alert"
                  className={ERROR_CLASS}
                >
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* EPIC-024 item 11 — no auto-created "Akun Utama" anymore;
                the prototype records this real behavior. Polish batch 7b
                item 7 — shortened from a 5-line explanation to one line. */}
            <div className="mt-3.5 flex items-start gap-2.5 rounded-[11px] border border-primary/25 bg-accent p-3 text-[12.5px] text-accent-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>Rekening pertama kamu tambahkan setelah daftar.</span>
            </div>

            {/* EPIC-025 N3-H2 (J1) — the prototype's consent checkbox is cut:
                nothing records it, so it would be a dead control. */}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Membuat Akun…" : "Daftar"}
            </button>
          </form>

          <div className="mt-4 text-center text-[11.5px] text-muted-foreground">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="text-[12.5px] font-bold text-primary transition-colors hover:text-primary-strong"
            >
              Masuk Sekarang
            </Link>
          </div>
        </SectionCard>

        <div className="mt-3.5 text-center text-[11.5px] text-muted-foreground">
          Anggota keluarga didaftarkan oleh kepala keluarga.
        </div>
      </div>
    </div>
  );
}
