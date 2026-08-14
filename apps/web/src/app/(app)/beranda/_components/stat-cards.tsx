"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChartNoAxesCombined,
  ReceiptText,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useLocale } from "@/hooks/use-locale";
import type { MoneyFormatters } from "./use-beranda-data";

/**
 * EPIC-026 Wave 8 — the prototype's four `.card.stat.bento-stat` tiles
 * (Cash & E-Wallet / Bank & Account / Investasi / Liabilitas).
 *
 * Honest UI: the prototype's `.stat__delta` line reads "Naik 2,4% dari Juli".
 * The backend exposes no month-over-month comparison for these totals, so the
 * delta line is omitted entirely rather than filled with a fabricated
 * percentage. Each tile is a link to the page that owns the real detail.
 */
type StatTile = {
  icon: LucideIcon;
  iconStyle: CSSProperties;
  label: string;
  amount: string;
  href: string;
};

export function StatCards({
  hasData,
  cashEwalletTotal,
  bankTotal,
  investasiTotal,
  totalLiabilities,
  fmt,
}: {
  /** Guarded on real data (not just `isLoading`) so the tiles never render a
   *  populated-looking "Rp 0" before their backing summary exists. */
  hasData: boolean;
  cashEwalletTotal: number;
  bankTotal: number;
  investasiTotal: number;
  totalLiabilities: number;
  fmt: MoneyFormatters;
}) {
  const router = useRouter();
  const { t } = useLocale();

  if (!hasData) {
    return (
      <>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="card bento-stat min-h-[136px] animate-pulse"
            aria-hidden="true"
          />
        ))}
      </>
    );
  }

  const tiles: StatTile[] = [
    {
      icon: WalletCards,
      iconStyle: { background: "var(--success-soft)", color: "var(--success)" },
      label: t.shell.pageTitles.dana,
      amount: fmt.moneyCompact(cashEwalletTotal),
      href: "/dana",
    },
    {
      icon: Building2,
      iconStyle: {
        background: "var(--accent)",
        color: "var(--accent-foreground)",
      },
      label: t.shell.pageTitles.rekening,
      amount: fmt.moneyCompact(bankTotal),
      href: "/rekening",
    },
    {
      icon: ChartNoAxesCombined,
      iconStyle: {
        background: "var(--brand-purple-soft)",
        color: "var(--brand-purple)",
      },
      label: t.shell.pageTitles.investasi,
      amount: fmt.moneyCompact(investasiTotal),
      href: "/investasi",
    },
    {
      icon: ReceiptText,
      iconStyle: {
        background: "color-mix(in oklab, var(--destructive) 14%, transparent)",
        color: "var(--destructive)",
      },
      label: t.shell.pageTitles.liabilitas,
      amount: fmt.moneyCompact(totalLiabilities),
      href: "/liabilitas",
    },
  ];

  return (
    <>
      {tiles.map((tile) => (
        <article key={tile.label} className="card stat bento-stat">
          <div className="stat__icon" style={tile.iconStyle}>
            <tile.icon aria-hidden="true" />
          </div>
          <div>
            <div className="stat__label">{tile.label}</div>
            <div className="stat__value mono">{tile.amount}</div>
          </div>
          <button
            type="button"
            onClick={() => router.push(tile.href)}
            aria-label={`${t.common.viewDetail} ${tile.label}`}
            className="card-link stat__delta mt-auto self-start"
          >
            {t.common.viewDetail}
          </button>
        </article>
      ))}
    </>
  );
}
