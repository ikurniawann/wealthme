"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useLocale } from "@/hooks/use-locale";

const legalTitles = {
  privasi: "privacyTitle",
  syarat: "termsTitle",
  lisensi: "licenseTitle",
} as const;

type LegalSlug = keyof typeof legalTitles;

export default function LegalPage() {
  const params = useParams<{ slug: string }>();
  const { t } = useLocale();
  const slug = params.slug;

  if (!(slug in legalTitles)) notFound();

  const title = t.legal[legalTitles[slug as LegalSlug]];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col bg-background px-4 py-8 text-foreground sm:py-12">
      <Link
        href="/login"
        className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
      >
        {t.legal.backToLogin}
      </Link>
      <article className="rounded-xl border bg-card p-5 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {t.legal.contentNotice}
        </p>
      </article>
    </main>
  );
}
