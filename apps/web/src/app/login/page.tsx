"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Info, LogIn } from "lucide-react";
import { toast } from "sonner";
import { isFamilyLoginId } from "@wealthme/contracts";
import { authClient } from "@/lib/auth-client";
import { SectionCard } from "@/components/wm";

// EPIC-026 Wave 7 — markup rebuilt from docs/prototype/pages/login.html
// (token-based `.auth` layout: brand above a `.card`, `.input`/`.btn`/
// `.segmented` translations per EPIC-025-N3-translation-table.md). Cut per
// J1: the PIN attempt counter, the "Perangkat dikenali" badge, and the
// inert "Ingat saya" checkbox. The prototype's "Undangan keluarga sudah
// tidak dipakai" footer is tombstone copy (same class as join-token.html's
// — J1) and contradicts the still-working /join/[token] flow, so it is not
// ported. Auth logic below is untouched.
//
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

const INPUT_CLASS =
  "w-full rounded-[9px] border bg-background px-3 py-[9px] text-[13.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-primary/20";
const LABEL_CLASS = "mb-[5px] block text-[12.5px] font-semibold";
const BTN_PRIMARY_BLOCK =
  "flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50";
const BTN_OUTLINE_BLOCK =
  "flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] border bg-card px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

function AuthBrand() {
  return (
    <div className="mb-[18px] flex items-center justify-center gap-2.5">
      <div className="grid size-[34px] place-items-center rounded-[9px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand mark, no responsive srcset needed */}
        <img
          src="/brand/wealthme-mark.png"
          alt=""
          className="size-full object-contain"
        />
      </div>
      <div className="text-[18px] font-extrabold tracking-tight">WealthMe</div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "username">("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // PIN unlock is temporarily disabled until the device-unlock flow is stable.
  // The normal email/username password login remains the only active path.

  const doLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Email dan password harus diisi");
      toast.warning("Email dan password harus diisi");
      return;
    }
    // EPIC-031 — `budi@arsandi` (a family login ID, no dot after "@") typed
    // into the Email tab is a username login, not an email.
    if (isFamilyLoginId(email)) {
      await signInWithUsername(email.trim());
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
    await signInWithUsername(username.trim());
  };

  const signInWithUsername = async (loginId: string) => {
    setLoading(true);
    try {
      const { error: fetchError } =
        await authClient.$fetch<UsernameSignInResponse>("/sign-in/username", {
          method: "POST",
          body: { username: loginId.toLowerCase(), password },
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

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-6">
      <div className="w-full max-w-[420px]">
        <AuthBrand />

        <SectionCard>
          <h1 className="text-center text-[16px] font-extrabold">
            Selamat Datang Kembali
          </h1>
          <p className="mt-1 mb-4 text-center text-[11.5px] text-muted-foreground">
            Masuk ke Personal Wealth OS kamu
          </p>

          {process.env.NODE_ENV !== "production" && (
            <div className="mb-3.5 flex items-center gap-2.5 rounded-[11px] border border-primary/25 bg-accent p-3 text-[12.5px] text-accent-foreground">
              <Info className="size-4 shrink-0" />
              <div>
                <strong className="block">Demo Account tersedia</strong>
                Gunakan <code>demo@wealthme.id</code> / <code>demo1234</code>{" "}
                untuk masuk.
              </div>
            </div>
          )}

          {/* EPIC-023 D1/D6 — a dependant/operational member has no email
              and signs in by username instead. */}
          <div
            role="tablist"
            className="mb-3.5 flex w-full gap-0.5 rounded-[10px] bg-secondary p-[3px]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "email"}
              onClick={() => {
                setMode("email");
                setError("");
              }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                mode === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Email
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "username"}
              onClick={() => {
                setMode("username");
                setError("");
              }}
              className={`flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                mode === "username"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
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
              <div>
                <label htmlFor="email" className={LABEL_CLASS}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  className={INPUT_CLASS}
                />
                <div className="mt-[5px] text-[11.5px] text-muted-foreground">
                  Anggota yang dibuatkan akun oleh Master bisa masuk dengan
                  username keluarga, misalnya <em>budi@arsandi</em>.
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="username" className={LABEL_CLASS}>
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  placeholder="nama@kodekeluarga"
                  aria-describedby="username-hint"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError("");
                  }}
                  className={INPUT_CLASS}
                />
                <div
                  id="username-hint"
                  className="mt-[5px] text-[11.5px] text-muted-foreground"
                >
                  Contoh: <em>budi@arsandi</em>. Username &amp; kode keluarga
                  didapat dari Master keluarga Anda.
                </div>
              </div>
            )}

            <div className="mt-3">
              <label htmlFor="password" className={LABEL_CLASS}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  className={`${INPUT_CLASS} pr-10`}
                />
                <button
                  type="button"
                  aria-label={
                    show ? "Sembunyikan password" : "Tampilkan password"
                  }
                  aria-pressed={show}
                  onClick={() => setShow((s) => !s)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-primary"
                >
                  {show ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p
                id="login-error"
                role="alert"
                className="mt-[5px] text-[11.5px] font-semibold text-destructive"
              >
                {error}
              </p>
            )}

            {/* EPIC-025 N3-H1 (J1) — the "Ingat saya" checkbox was purely
                decorative (no session-persistence logic reads it) — cut per
                the honest-UI mandate instead of shipping a dead control.
                Password-reset is email-based — not applicable to a
                username-only dependant/operational account, so it only
                shows in email mode. */}
            {mode === "email" && (
              <div className="mt-3.5 flex items-center justify-end">
                <Link
                  href="/lupa-password"
                  className="text-[12.5px] font-bold text-primary transition-colors hover:text-primary-strong"
                >
                  Lupa password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`${BTN_PRIMARY_BLOCK} mt-4`}
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
              <div className="my-4 flex items-center gap-2.5">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11.5px] text-muted-foreground">
                  atau masuk dengan
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <button
                type="button"
                onClick={doGoogleLogin}
                className={BTN_OUTLINE_BLOCK}
              >
                Google
              </button>

              <div className="mt-4 text-center text-[11.5px] text-muted-foreground">
                Belum punya akun?{" "}
                <Link
                  href="/register"
                  className="text-[12.5px] font-bold text-primary transition-colors hover:text-primary-strong"
                >
                  Daftar Sekarang
                </Link>
              </div>
            </>
          )}
        </SectionCard>

        {/* Hardening batch G2 — link the draft legal pages from the login
            footer, per the coming-soon inventory decision. */}
        <div className="mt-4 flex justify-center gap-3 text-[11.5px] text-muted-foreground">
          <Link href="/legal/privasi" className="hover:text-foreground">
            Kebijakan Privasi
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/legal/syarat" className="hover:text-foreground">
            Syarat &amp; Ketentuan
          </Link>
        </div>
      </div>
    </div>
  );
}
