import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { LegalTabs } from "./legal-tabs";
import "./legal-shell.css";

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
    <div className="lg-wrap">
      <div className="lg-in">
        <Link href="/login" className="lg-back">
          <ArrowLeft size={14} aria-hidden="true" /> Kembali
        </Link>

        <div className="lg-brand">
          <span className="lg-mark" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed small brand mark */}
            <img src="/brand/wealthme-mark.png" alt="" />
          </span>
          WealthMe
        </div>

        <h1 className="lg-title">{title}</h1>
        <p className="lg-date">Diperbarui terakhir: {updatedAt}</p>

        <div className="lg-draft">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            Draf, belum final. Dokumen ini sedang disusun dan belum ditinjau
            oleh tim hukum. Isinya dapat berubah sewaktu-waktu.
          </span>
        </div>

        <div className="lg-body">{children}</div>

        <LegalTabs />
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
      <h2>{heading}</h2>
      <div className="lg-sec-in">{children}</div>
    </section>
  );
}
