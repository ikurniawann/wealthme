"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Info, LogIn } from "lucide-react";
import { toast } from "sonner";
import { isFamilyLoginId } from "@wealthme/contracts";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/hooks/use-locale";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-fields";
import { LegalLinks } from "@/components/auth/legal-links";

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

export default function LoginPage() {
  const router = useRouter();
  const v2 = useLocale().t.login.v2;
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
      <h1 className="au-title">Selamat Datang Kembali</h1>
      <p className="au-sub">Masuk ke Personal Wealth OS kamu</p>

      {process.env.NODE_ENV !== "production" && (
        <div className="au-info" style={{ marginBottom: 14 }}>
          <Info size={16} />
          <div>
            <b>Demo Account tersedia</b>
            Gunakan <code>demo@wealthme.id</code> / <code>demo1234</code> untuk
            masuk.
          </div>
        </div>
      )}

      {/* EPIC-023 D1/D6 — a dependant/operational member has no email
          and signs in by username instead. */}
      <div role="tablist" className="au-seg">
        {(["email", "username"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
          >
            {m === "email" ? "Email" : "Username"}
          </button>
        ))}
      </div>

      <form
        className="au-form"
        onSubmit={(e) => {
          e.preventDefault();
          void (mode === "email" ? doLogin() : doUsernameLogin());
        }}
      >
        {mode === "email" ? (
          <AuthField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            hint={
              <>
                Anggota yang dibuatkan akun oleh Master bisa masuk dengan
                username keluarga, misalnya <em>budi@arsandi</em>.
              </>
            }
          />
        ) : (
          <AuthField
            id="username"
            label="Username"
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
            hint={
              <span id="username-hint">
                Contoh: <em>budi@arsandi</em>. Username &amp; kode keluarga
                didapat dari Master keluarga Anda.
              </span>
            }
          />
        )}

        <AuthField
          id="password"
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError("");
          }}
          reveal={{
            show,
            onToggle: () => setShow((s) => !s),
            showLabel: "Tampilkan password",
            hideLabel: "Sembunyikan password",
          }}
        />

        {error && (
          <p id="login-error" role="alert" className="au-err">
            {error}
          </p>
        )}

        {/* EPIC-025 N3-H1 (J1) — "Ingat saya" cut: it was decorative.
            Password reset is email-based, so the link is email mode only. */}
        {mode === "email" && (
          <div style={{ textAlign: "right" }}>
            <Link className="au-link" href="/lupa-password">
              Lupa password?
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="au-btn"
          data-variant="primary"
        >
          <LogIn size={16} /> {loading ? "Memuat…" : "Masuk"}
        </button>
      </form>

      {/* Google and self-registration only apply to email accounts. */}
      {mode === "email" && (
        <>
          <div className="au-divide">atau masuk dengan</div>
          <button type="button" onClick={doGoogleLogin} className="au-btn">
            Google
          </button>
          <p className="au-foot">
            Belum punya akun?{" "}
            <Link className="au-link" href="/register">
              Daftar Sekarang
            </Link>
          </p>
        </>
      )}
      <LegalLinks />
    </AuthShell>
  );
}
