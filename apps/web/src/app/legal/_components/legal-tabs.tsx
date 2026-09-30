"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/legal/privasi", label: "Kebijakan Privasi" },
  { href: "/legal/syarat", label: "Syarat & Ketentuan" },
  { href: "/legal/lisensi", label: "Lisensi Open Source" },
];

export function LegalTabs() {
  const pathname = usePathname();
  return (
    <nav className="lg-tabs" aria-label="Dokumen legal">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
