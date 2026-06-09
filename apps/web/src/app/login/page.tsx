"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Info, Lock, LogIn, Mail } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    if (!email || !password) {
      toast.warning("Isi email dan password");
      return;
    }
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result?.ok) {
        toast.error(result?.error ?? "Login failed");
        return;
      }
      router.push("/beranda");
    } finally {
      setLoading(false);
    }
  };

  const doGoogleLogin = () => {
    void signIn("google", { callbackUrl: "/beranda" });
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
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-extrabold tracking-tighter text-white">
            W
          </div>
          <div className="text-[22px] font-extrabold text-slate-900">
            Wealth<span className="text-primary">Me</span>
          </div>
        </div>

        <h1 className="text-center text-[22px] font-extrabold text-slate-900">
          Selamat Datang Kembali 👋
        </h1>
        <p className="mb-7 text-center text-[13px] text-slate-400">
          Masuk ke Personal Wealth OS kamu
        </p>

        {process.env.NODE_ENV !== "production" && (
          <div className="mb-[22px] flex items-center gap-2.5 rounded-xl border-[1.5px] border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 px-4 py-3">
            <Info className="size-4 shrink-0 text-primary" />
            <div className="text-xs text-indigo-900">
              <strong className="block">Demo Account tersedia</strong>
              Gunakan <code>irfan.arsandi@wealthme.id</code> /{" "}
              <code>demo1234</code> untuk masuk.
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doLogin();
          }}
        >
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
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-3.5 text-sm text-slate-900 outline-none transition-colors focus:border-primary"
            />
          </InputWrap>

          <label
            htmlFor="password"
            className="mb-1.5 block text-xs font-semibold text-slate-600"
          >
            Password
          </label>
          <InputWrap icon={<Lock className="size-3.5" />}>
            <input
              id="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-10 text-sm text-slate-900 outline-none transition-colors focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
            >
              {show ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </InputWrap>

          <div className="mb-4 mt-1 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-slate-600">
              <input
                type="checkbox"
                defaultChecked
                className="accent-[#4f46e5]"
              />{" "}
              Ingat saya
            </label>
            <span className="cursor-pointer text-[12.5px] font-semibold text-primary">
              Lupa password?
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-primary-strong hover:shadow-[0_4px_16px_rgba(79,70,229,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <LogIn className="size-4" /> {loading ? "Memuat…" : "Masuk"}
          </button>
        </form>

        <div className="relative my-4 text-center text-xs text-slate-400">
          <span className="relative z-10 bg-white px-3">atau masuk dengan</span>
          <span className="absolute left-0 top-1/2 h-px w-[40%] bg-slate-200" />
          <span className="absolute right-0 top-1/2 h-px w-[40%] bg-slate-200" />
        </div>

        <button
          onClick={doGoogleLogin}
          className="flex w-full items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-200 bg-slate-50 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-primary hover:bg-indigo-50"
        >
          <GoogleIcon /> Google
        </button>

        <div className="mt-5 text-center text-xs text-slate-400">
          Belum punya akun?{" "}
          <span
            onClick={() => toast("Fitur registrasi segera hadir!")}
            className="cursor-pointer font-semibold text-primary"
          >
            Daftar Sekarang
          </span>
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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.1 14.7 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c5.9 0 9.8-4.1 9.8-9.9 0-.7-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
