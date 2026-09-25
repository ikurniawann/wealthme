"use client";

import { useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { SectionCard } from "@/components/wm";

// EPIC-026 Wave 7 — markup rebuilt from
// docs/prototype/pages/lupa-password.html (token-based `.auth` layout per
// EPIC-025-N3-translation-table.md): brand above card, form state and
// "sent" empty-state, "Link berlaku 60 menit" (better-auth's default reset
// token expiry is 1 hour) and the outline "Kembali ke Login" button.
// The reset email goes out over SMTP from sysadmin@wit.id
// (lib/reset-password-mailer.ts). Request logic is untouched.

export default function LupaPasswordPage() {
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

        {sent ? (
          <SectionCard>
            <div className="grid place-items-center gap-2 px-5 py-6 text-center">
              <div className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
                <Send className="size-[26px]" />
              </div>
              <div className="text-[16px] font-extrabold">Cek Email Anda</div>
              {/* Honest copy: the server answers the same way whether or not
                  the address has an account (so nobody can probe which emails
                  are registered), so the page must not claim it was sent. */}
              <div className="text-[12.5px] text-muted-foreground">
                Jika <strong>{email}</strong> terdaftar di WealthMe, link reset
                password sudah kami kirim ke sana. Periksa kotak masuk atau
                folder spam Anda.
              </div>
              <div className="mt-1 text-[11.5px] text-muted-foreground">
                Tidak ada email masuk? Pastikan alamatnya sama persis dengan
                yang dipakai saat mendaftar. Akun yang dibuatkan Master (login
                <em> nama@kodekeluarga</em>) minta Master mereset password.
              </div>
              <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                Link berlaku 60 menit. Tidak menerima email?{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-[12.5px] font-bold text-primary transition-colors hover:text-primary-strong"
                >
                  Coba lagi
                </button>
              </div>
            </div>
            <Link
              href="/login"
              className="flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] border bg-card px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Kembali ke Login
            </Link>
          </SectionCard>
        ) : (
          <SectionCard>
            <Link
              href="/login"
              className="text-[12.5px] font-bold text-primary transition-colors hover:text-primary-strong"
            >
              ← Kembali ke Login
            </Link>

            <h1 className="mt-3.5 text-center text-[16px] font-extrabold">
              Lupa Password?
            </h1>
            <p className="mt-1 mb-[18px] text-center text-[11.5px] text-muted-foreground">
              Masukkan email Anda dan kami akan mengirim link untuk mereset
              password.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void doRequest();
              }}
            >
              <label
                htmlFor="email"
                className="mb-[5px] block text-[12.5px] font-semibold"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full rounded-[9px] border bg-background px-3 py-[9px] text-[13.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-primary/20"
              />
              {/* The prototype's "minta kepala keluarga menyetel ulang
                  passwordnya" half is now real: a Master can set a new
                  password for a username (no-email) member from /iam
                  (POST /family-groups/:id/members/:memberId/password). */}
              <div className="mt-[5px] text-[11.5px] text-muted-foreground">
                Reset lewat email hanya untuk akun ber-email. Login pakai
                username? Minta Master keluarga mengganti password Anda dari
                menu IAM Roles.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-[18px] flex h-9 w-full items-center justify-center gap-[7px] rounded-[9px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="size-4" />
                {loading ? "Mengirim…" : "Kirim Link Reset"}
              </button>
            </form>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
