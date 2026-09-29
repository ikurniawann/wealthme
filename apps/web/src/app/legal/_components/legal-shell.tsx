import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Hardening batch G2 — shared shell for the /legal pages (Kebijakan Privasi,
// Syarat & Ketentuan). Public routes (outside the authenticated `(app)`
// shell), so no useLocale()/t.* — same convention as /login, /register.
export function LegalShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-[720px]">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Kembali
        </Link>

        <div className="mb-2 flex items-center gap-2.5">
          <div className="grid size-[30px] place-items-center rounded-[9px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand mark */}
            <img
              src="/brand/wealthme-mark.png"
              alt=""
              className="size-full object-contain"
            />
          </div>
          <div className="text-[16px] font-extrabold tracking-tight">
            WealthMe
          </div>
        </div>

        <h1 className="text-[22px] font-extrabold text-foreground">{title}</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Diperbarui terakhir: {updatedAt}
        </p>

        <div className="mt-4 rounded-[10px] border border-warning bg-warning-soft px-3.5 py-3 text-[12.5px] font-semibold text-warning-foreground">
          Draf, belum final. Dokumen ini sedang disusun dan belum ditinjau oleh
          tim hukum. Isinya dapat berubah sewaktu-waktu.
        </div>

        <div className="mt-6 space-y-5 rounded-[12px] border bg-card p-5 text-[13px] leading-relaxed text-foreground">
          {children}
        </div>

        <div className="mt-5 flex flex-wrap gap-3 text-[12.5px] font-semibold text-primary">
          <Link href="/legal/privasi" className="hover:text-primary-strong">
            Kebijakan Privasi
          </Link>
          <Link href="/legal/syarat" className="hover:text-primary-strong">
            Syarat &amp; Ketentuan
          </Link>
          <Link href="/legal/lisensi" className="hover:text-primary-strong">
            Lisensi Open Source
          </Link>
        </div>
      </div>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1.5 text-[14px] font-bold text-foreground">
        {heading}
      </h2>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  );
}
