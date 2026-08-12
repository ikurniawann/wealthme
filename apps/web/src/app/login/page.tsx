"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Info, Lock, LogIn, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { DeviceUnlockPad } from "@/components/auth/device-unlock-pad";
import {
  readAnyStoredDevice,
  type StoredDevice,
} from "@/components/auth/device-storage";

// EPIC-023 D1/D6 (US-FAM-12, US-AUTH-9) — a head-created dependant/
// operational member has no email and signs in with a username instead
// (better-auth's `username` plugin, enabled server-side in
// apps/web/src/lib/auth.ts). `auth-client.ts` is a protected foundation
// file this task may not modify, so this calls the plugin's REST endpoint
// directly via the base client's `$fetch` (present on every better-auth
// client regardless of registered client-side plugins) instead of the
// typed `usernameClient()` convenience wrapper. A hard navigation (not
// `router.push`) follows a successful sign-in so the app's session store
// re-initializes from the now-valid session cookie, the same way it would
// after any full page load.
type UsernameSignInResponse = { token: string };

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "username">("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // EPIC-023 D2 (US-FAM-13, D7) — "PIN thereafter, a new device needs the
  // password again". `storedDevice` starts `undefined` (not yet checked, so
  // the PIN pad never flashes before the check runs) and resolves to either
  // a `StoredDevice` (show the pad) or `null` (no binding on this browser —
  // show the normal password form, unchanged default behavior).
  const [storedDevice, setStoredDevice] = useState<
    StoredDevice | null | undefined
  >(undefined);

  // localStorage is only reachable client-side (SSR has no window), so this
  // genuinely needs a mount-time effect, not a derivable render value —
  // matches the codebase's existing mount-detection pattern (see
  // components/shell/theme-toggle.tsx).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStoredDevice(readAnyStoredDevice());
  }, []);

  const doLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Email dan password harus diisi");
      toast.warning("Email dan password harus diisi");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/beranda",
      });
      if (result.error) {
        const errorMsg = result.error.message ?? "Login gagal";
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }
      router.push("/beranda");
    } finally {
      setLoading(false);
    }
  };

  const doUsernameLogin = async () => {
    setError("");
    if (!username || !password) {
      setError("Username dan password harus diisi");
      toast.warning("Username dan password harus diisi");
      return;
    }
    setLoading(true);
    try {
      const { error: fetchError } =
        await authClient.$fetch<UsernameSignInResponse>("/sign-in/username", {
          method: "POST",
          body: { username, password },
        });
      if (fetchError) {
        const errorMsg = fetchError.message ?? "Login gagal";
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }
      // Hard navigation — see the file-level comment above.
      window.location.href = "/beranda";
    } finally {
      setLoading(false);
    }
  };

  const doGoogleLogin = () => {
    void authClient.signIn.social({
      provider: "google",
      callbackURL: "/beranda",
    });
  };

  // EPIC-023 D2 (US-FAM-13, D7) — a device with a stored deviceSecret gets
  // the PIN pad instead of the password form. "Use password instead" always
  // falls through to the normal form below (never trapped on the pad).
  if (storedDevice) {
    return (
      <div
        className="relative flex min-h-screen items-center justify-center p-5"
        style={{
          backgroundImage:
            "linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4338ca 70%,#6366f1 100%)",
        }}
      >
        <DeviceUnlockPad
          device={storedDevice}
          onUnlocked={() => {
            // Hard navigation — same reasoning as doUsernameLogin above: the
            // session cookie was just set server-side by the route handler,
            // so the app's session store needs a fresh load to pick it up.
            window.location.href = "/beranda";
          }}
          onUsePassword={() => setStoredDevice(null)}
        />
      </div>
    );
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
              Gunakan <code>demo@wealthme.id</code> / <code>demo1234</code>{" "}
              untuk masuk.
            </div>
          </div>
        )}

        {/* EPIC-023 D1/D6 — a dependant/operational member has no email and
            signs in by username instead. */}
        <div className="mb-4 flex rounded-lg bg-slate-100 p-1 text-[12.5px] font-semibold">
          <button
            type="button"
            aria-pressed={mode === "email"}
            onClick={() => {
              setMode("email");
              setError("");
            }}
            className={`flex-1 rounded-md py-1.5 transition-colors ${
              mode === "email"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            aria-pressed={mode === "username"}
            onClick={() => {
              setMode("username");
              setError("");
            }}
            className={`flex-1 rounded-md py-1.5 transition-colors ${
              mode === "username"
                ? "bg-white text-primary shadow-sm"
                : "text-slate-500"
            }`}
          >
            Username
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (mode === "email" ? doLogin() : doUsernameLogin());
          }}
        >
          {mode === "email" ? (
            <>
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
                    if (error) setError("");
                  }}
                  className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-3.5 text-sm text-slate-900 outline-none transition-colors focus:border-primary"
                />
              </InputWrap>
            </>
          ) : (
            <>
              <label
                htmlFor="username"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Username
              </label>
              <InputWrap icon={<User className="size-3.5" />}>
                <input
                  id="username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError("");
                  }}
                  className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-3.5 text-sm text-slate-900 outline-none transition-colors focus:border-primary"
                />
              </InputWrap>
            </>
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
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-10 text-sm text-slate-900 outline-none transition-colors focus:border-primary"
            />
            <button
              type="button"
              aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
              aria-pressed={show}
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

          {error && (
            <p
              id="login-error"
              role="alert"
              className="mb-3 text-xs text-red-500"
            >
              {error}
            </p>
          )}

          {/* EPIC-025 N3-H1 (J1) — the "Ingat saya" checkbox was purely
              decorative (no session-persistence logic reads it) — cut per
              the honest-UI mandate instead of shipping a dead control.
              Password-reset is email-based — not applicable to a
              username-only dependant/operational account, so it only shows
              in email mode. */}
          {mode === "email" && (
            <div className="mb-4 mt-1 flex items-center justify-end">
              <Link
                href="/lupa-password"
                className="text-[12.5px] font-semibold text-primary hover:text-primary-strong transition-colors"
              >
                Lupa password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-primary-strong hover:shadow-[0_4px_16px_rgba(79,70,229,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <LogIn className="size-4" /> {loading ? "Memuat…" : "Masuk"}
          </button>
        </form>

        {/* Google sign-in and self-registration only apply to an email
            account — a dependant/operational username account is created
            by the family head (POST .../members/dependant), never
            self-registered. */}
        {mode === "email" && (
          <>
            <div className="relative my-4 text-center text-xs text-slate-400">
              <span className="relative z-10 bg-white px-3">
                atau masuk dengan
              </span>
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
              <Link
                href="/register"
                className="font-semibold text-primary hover:text-primary-strong transition-colors"
              >
                Daftar Sekarang
              </Link>
            </div>
          </>
        )}
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
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.1 14.7 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c5.9 0 9.8-4.1 9.8-9.9 0-.7-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
