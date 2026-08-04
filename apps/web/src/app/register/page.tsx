"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Mail, User, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/hooks/use-locale";

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
          <ArrowLeft className="size-4" /> Kembali
        </Link>

        <div className="mb-4 flex items-center justify-center gap-2.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-extrabold tracking-tighter text-white">
            W
          </div>
          <div className="text-[22px] font-extrabold text-slate-900">
            Wealth<span className="text-primary">Me</span>
          </div>
        </div>

        {/* Language choice — persists via setLocale() and applies app-wide.
            EPIC-022 Group G (G3) — text label, not a flag emoji: 🇮🇩/🇬🇧
            render as tofu boxes on systems without an emoji-flag font. */}
        <div className="mx-auto mb-6 flex w-fit items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setLocale("id")}
            aria-pressed={locale === "id"}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              locale === "id"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-400"
            }`}
          >
            <span className="mr-1 font-black tracking-tight">ID</span>
            Indonesia
          </button>
          <button
            type="button"
            onClick={() => setLocale("en")}
            aria-pressed={locale === "en"}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              locale === "en"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-400"
            }`}
          >
            <span className="mr-1 font-black tracking-tight">EN</span>
            English
          </button>
        </div>

        <h1 className="text-center text-[22px] font-extrabold text-slate-900">
          Buat Akun Baru 🚀
        </h1>
        <p className="mb-7 text-center text-[13px] text-slate-400">
          Mulai kelola keuangan Anda hari ini
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doRegister();
          }}
        >
          <label
            htmlFor="name"
            className="mb-1.5 block text-xs font-semibold text-slate-600"
          >
            Nama Lengkap
          </label>
          <InputWrap icon={<User className="size-3.5" />}>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: "" });
              }}
              placeholder="Jane Doe"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-primary"
            />
          </InputWrap>
          {errors.name && (
            <p
              id="name-error"
              role="alert"
              className="mb-3 text-xs text-red-500"
            >
              {errors.name}
            </p>
          )}

          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-semibold text-slate-600"
          >
            Email
          </label>
          <InputWrap icon={<Mail className="size-3.5" />}>
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
              className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-primary"
            />
          </InputWrap>
          {errors.email && (
            <p
              id="email-error"
              role="alert"
              className="mb-3 text-xs text-red-500"
            >
              {errors.email}
            </p>
          )}

          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold text-slate-600"
          >
            Password
          </label>
          <InputWrap icon={<Lock className="size-3.5" />}>
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
              aria-describedby={errors.password ? "password-error" : undefined}
              className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-primary"
            />
            <button
              type="button"
              aria-label={
                showPassword ? "Sembunyikan password" : "Tampilkan password"
              }
              aria-pressed={showPassword}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
            >
              {showPassword ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </InputWrap>
          {errors.password && (
            <p
              id="password-error"
              role="alert"
              className="mb-3 text-xs text-red-500"
            >
              {errors.password}
            </p>
          )}

          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-xs font-semibold text-slate-600"
          >
            Konfirmasi Password
          </label>
          <InputWrap icon={<Lock className="size-3.5" />}>
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword)
                  setErrors({ ...errors, confirmPassword: "" });
              }}
              placeholder="Ulang password Anda"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={
                errors.confirmPassword ? "confirmPassword-error" : undefined
              }
              className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-primary"
            />
            <button
              type="button"
              aria-label={
                showConfirm ? "Sembunyikan password" : "Tampilkan password"
              }
              aria-pressed={showConfirm}
              onClick={() => setShowConfirm((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
            >
              {showConfirm ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </InputWrap>
          {errors.confirmPassword && (
            <p
              id="confirmPassword-error"
              role="alert"
              className="mb-3 text-xs text-red-500"
            >
              {errors.confirmPassword}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-primary-strong hover:shadow-[0_4px_16px_rgba(79,70,229,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Membuat Akun…" : "Daftar"}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-400">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="font-semibold text-primary hover:text-primary-strong transition-colors"
          >
            Masuk Sekarang
          </Link>
        </div>
      </div>
    </div>
  );
}

function InputWrap({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mb-4">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
        {icon}
      </span>
      {children}
    </div>
  );
}
