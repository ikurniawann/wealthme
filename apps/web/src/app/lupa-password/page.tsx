"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { useLocale } from "@/hooks/use-locale";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-fields";

// EPIC-026 Wave 7 — markup rebuilt from
// docs/prototype/pages/lupa-password.html (token-based `.auth` layout per
// EPIC-025-N3-translation-table.md): brand above card, form state and
// "sent" empty-state, "Link berlaku 60 menit" (better-auth's default reset
// token expiry is 1 hour) and the outline "Kembali ke Login" button.
// The reset email goes out over SMTP from sysadmin@wit.id
// (lib/reset-password-mailer.ts). Request logic is untouched.

export default function LupaPasswordPage() {
  const v2 = useLocale().t.lupaPassword.v2;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const doRequest = async () => {
    if (!email.trim()) {
      toast.warning("Masukkan email Anda");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      if (result.error) {
        toast.error(result.error.message ?? "Gagal mengirim email reset");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
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
      {sent ? (
        <div className="au-center">
          <div className="au-tick">
            <Send size={24} aria-hidden="true" />
          </div>
          <h1 className="au-title">Cek Email Anda</h1>
          {/* Honest copy: the server answers the same way whether or not
              the address has an account (so nobody can probe which emails
              are registered), so the page must not claim it was sent. */}
          <p className="au-sub">
            Jika <strong>{email}</strong> terdaftar di WealthMe, link reset
            password sudah kami kirim ke sana. Periksa kotak masuk atau folder
            spam Anda.
          </p>
          <p className="au-sub">
            Tidak ada email masuk? Pastikan alamatnya sama persis dengan yang
            dipakai saat mendaftar. Akun yang dibuatkan Master (login
            <em> nama@kodekeluarga</em>) minta Master mereset password.
          </p>
          <p className="au-sub">
            Link berlaku 60 menit. Tidak menerima email?{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="au-link"
            >
              Coba lagi
            </button>
          </p>
          <Link href="/login" className="au-btn">
            Kembali ke Login
          </Link>
        </div>
      ) : (
        <>
          <Link href="/login" className="au-back">
            <ArrowLeft size={14} aria-hidden="true" /> Kembali ke Login
          </Link>
          <h1 className="au-title">Lupa Password?</h1>
          <p className="au-sub">
            Masukkan email Anda dan kami akan mengirim link untuk mereset
            password.
          </p>
          <form
            className="au-form"
            onSubmit={(e) => {
              e.preventDefault();
              void doRequest();
            }}
          >
            <AuthField
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              hint="Reset lewat email hanya untuk akun ber-email. Login pakai username? Minta Master keluarga mengganti password Anda dari menu IAM Roles."
            />
            <button
              type="submit"
              disabled={loading}
              className="au-btn"
              data-variant="primary"
            >
              <Send size={16} aria-hidden="true" />
              {loading ? "Mengirim…" : "Kirim Link Reset"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
