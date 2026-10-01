import Link from "next/link";
import { useLocale } from "@/hooks/use-locale";

export function LegalLinks() {
  const { t } = useLocale();

  return (
    <nav
      aria-label={`${t.legal.privacyLink}, ${t.legal.termsLink}, ${t.legal.licenseLink}`}
      className="au-legal"
    >
      <Link href="/legal/privasi">{t.legal.privacyLink}</Link>
      <Link href="/legal/syarat">{t.legal.termsLink}</Link>
      <Link href="/legal/lisensi">{t.legal.licenseLink}</Link>
    </nav>
  );
}
