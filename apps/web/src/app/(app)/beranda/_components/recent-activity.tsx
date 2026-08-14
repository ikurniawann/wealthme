"use client";

import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import type { DashboardSummaryDto } from "@wealthme/contracts";
import { CardLink, SectionCard } from "@/components/wm";
import { useLocale } from "@/hooks/use-locale";
import type { MoneyFormatters } from "./use-beranda-data";

/**
 * EPIC-026 Wave 8 — prototype's `.card.bento-transactions`
 * ("Transaksi Terakhir"), rendered as `.list-row`s.
 */
type Transaction = DashboardSummaryDto["recentTransactions"][number];

const TYPE_ICON: Record<string, LucideIcon> = {
  income: ArrowDownLeft,
  expense: CreditCard,
  transfer: ArrowLeftRight,
};

const TYPE_ICON_COLOR: Record<string, string> = {
  income: "var(--success)",
  expense: "var(--destructive)",
  transfer: "var(--brand-purple)",
};

export function RecentActivity({
  isLoading,
  transactions,
  fmt,
}: {
  isLoading: boolean;
  transactions: Transaction[];
  fmt: MoneyFormatters;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const { money, isReady } = fmt;

  function formatRelativeDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
    if (diffDays === 0) return t.common.today;
    if (diffDays === 1) return t.common.yesterday;
    return date.toLocaleDateString(t.beranda.dateLocale, {
      day: "numeric",
      month: "short",
    });
  }

  function fallbackCategory(type: string): string {
    if (type === "income") return t.common.income2;
    if (type === "expense") return t.common.expense2;
    return t.common.transfer;
  }

  return (
    <SectionCard
      className="bento-transactions"
      title={t.beranda.recentTransactions}
      action={
        <CardLink onClick={() => router.push("/transaksi")}>
          {t.common.viewAll}
        </CardLink>
      }
    >
      {isLoading ? (
        <div className="stack">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[42px] animate-pulse rounded-md bg-muted"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="t-md t-muted py-4 text-center">
          {t.beranda.noTransactions}
        </div>
      ) : (
        transactions.map((tx, i) => {
          const Icon = TYPE_ICON[tx.type] ?? ArrowLeftRight;
          const isTransfer = tx.type === "transfer";
          const isIncome = tx.type === "income";
          // EPIC-022 B8 — a transfer is neither income nor expense; render it
          // neutrally (no +/- sign) instead of a red negative.
          const amount = !isReady
            ? t.common.loading
            : isTransfer
              ? money(tx.amount)
              : (isIncome ? "+" : "−") + money(tx.amount);

          return (
            <div className="list-row" key={`${tx.occurredAt}-${i}`}>
              <span
                className="list-row__icon"
                style={{ color: TYPE_ICON_COLOR[tx.type] }}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="list-row__body">
                {/* EPIC-023 Task E retry (MEDIUM 5) — `accountName` is null
                    for a card purchase; without this fallback a
                    description-less card purchase rendered a blank row. */}
                <span className="list-row__title">
                  {tx.description ?? tx.accountName ?? "—"}
                </span>
                {/* EPIC-026 Wave 3 — prototype's `.list-row__sub` is a single
                    "account · category · date" line. */}
                <span className="list-row__sub">
                  {[
                    tx.accountName,
                    tx.categoryName ?? fallbackCategory(tx.type),
                    formatRelativeDate(tx.occurredAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span
                className={`list-row__amount mono ${
                  isTransfer ? "t-muted" : isIncome ? "t-success" : "t-danger"
                }`}
              >
                {amount}
              </span>
            </div>
          );
        })
      )}
    </SectionCard>
  );
}
