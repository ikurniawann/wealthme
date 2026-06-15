"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

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
          <ArrowLeft className="size-4" /> Kembali ke Login
        </Link>

        <div className="mb-7 flex items-center justify-center gap-2.5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-extrabold tracking-tighter text-white">
            W
          </div>
          <div className="text-[22px] font-extrabold text-slate-900">
            Wealth<span className="text-primary">Me</span>
          </div>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100">
              <Send className="size-7 text-green-600" />
            </div>
            <h1 className="mb-2 text-[20px] font-extrabold text-slate-900">
              Email Terkirim!
            </h1>
            <p className="mb-6 text-sm text-slate-500">
              Kami telah mengirim link reset password ke{" "}
              <strong className="text-slate-700">{email}</strong>. Periksa kotak
              masuk atau folder spam Anda.
            </p>
            <p className="text-xs text-slate-400">
              Tidak menerima email?{" "}
              <button
                onClick={() => setSent(false)}
                className="font-semibold text-primary hover:text-primary-strong transition-colors"
              >
                Coba lagi
              </button>
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-center text-[22px] font-extrabold text-slate-900">
              Lupa Password?
            </h1>
            <p className="mb-7 text-center text-[13px] text-slate-400">
              Masukkan email Anda dan kami akan mengirim link untuk mereset
              password
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void doRequest();
              }}
            >
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold text-slate-600"
              >
                Email
              </label>
              <div className="relative mb-6">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="size-3.5" />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full rounded-md border-[1.5px] border-slate-200 bg-white py-2.5 pl-[38px] pr-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:bg-primary-strong hover:shadow-[0_4px_16px_rgba(79,70,229,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="size-4" />
                {loading ? "Mengirim…" : "Kirim Link Reset"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
