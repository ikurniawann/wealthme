import Link from "next/link";
import { useLocale } from "@/hooks/use-locale";

export function LegalLinks() {
  const { t } = useLocale();

  return (
    <nav
      aria-label={`${t.legal.privacyLink}, ${t.legal.termsLink}, ${t.legal.licenseLink}`}
      className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      <Link
        className="inline-flex min-h-11 items-center hover:text-primary"
        href="/legal/privasi"
      >
        {t.legal.privacyLink}
      </Link>
      <Link
        className="inline-flex min-h-11 items-center hover:text-primary"
        href="/legal/syarat"
      >
        {t.legal.termsLink}
      </Link>
      <Link
        className="inline-flex min-h-11 items-center hover:text-primary"
        href="/legal/lisensi"
      >
        {t.legal.licenseLink}
      </Link>
    </nav>
  );
}
