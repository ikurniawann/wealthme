"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  Wallet,
} from "lucide-react";
import type {
  DashboardSummaryDto,
  LiabilityDto,
  NetWorthHistoryPointDto,
} from "@wealthme/contracts";
import { SparklineChart } from "@/components/charts/apex-presets";
import { CategoryIcon } from "@/components/shell/tx-pickers";
import { useLocale } from "@/hooks/use-locale";
import { dueState, effectiveDueDate } from "@/lib/due-date";
import { berandaMobileCopy } from "./mobile-copy";
import type { MoneyFormatters } from "./use-beranda-data";
import "./mobile-home.css";

const DOTS = 8;

/**
 * Scale each month's income + expense into one stacked column of 8 dots,
 * against the busiest month, so the two colours never overflow the column.
 */
export function dotColumns(
  income: readonly number[],
  expense: readonly number[],
) {
  const totals = income.map(
    (value, index) => Math.max(0, value) + Math.max(0, expense[index] ?? 0),
  );
  const peak = Math.max(1, ...totals);
  return income.map((value, index) => {
    const out = Math.round((Math.max(0, expense[index] ?? 0) / peak) * DOTS);
    const total = Math.round((totals[index] / peak) * DOTS);
    return { expense: out, income: Math.max(0, total - out) };
  });
}

/**
 * The net-worth points to draw: this calendar month when it holds at least two
 * snapshots, else the last 30 days, else nothing (the sparkline is hidden).
 * Reads the history the desktop hero already fetched; no extra request.
 */
export function monthHistory(
  points: readonly NetWorthHistoryPointDto[],
  now: Date,
): NetWorthHistoryPointDto[] {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const inMonth = points.filter(
    (p) => new Date(p.capturedAt).getTime() >= monthStart,
  );
  if (inMonth.length >= 2) return inMonth;
  const since = now.getTime() - 30 * 86_400_000;
  const recent = points.filter(
    (p) => new Date(p.capturedAt).getTime() >= since,
  );
  return recent.length >= 2 ? recent : [];
}

/** Installments overdue or due soon, plus pending approvals. */
function reminderCount(liabilities: LiabilityDto[], approvals: number) {
  const now = new Date();
  const due = liabilities.filter((item) => {
    const date = effectiveDueDate(item);
    if (!date) return false;
    const isLate = item.nextDueDate ? item.currentInstallmentLate : null;
    return dueState(date, { now, isLate }).state !== "later";
  }).length;
  return { due, total: due + approvals };
}

type Recent = DashboardSummaryDto["recentTransactions"][number];

function RecentRow({ tx, fmt }: { tx: Recent; fmt: MoneyFormatters }) {
  const isTransfer = tx.type === "transfer";
  const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";
  const amount = `${sign}${fmt.money(Math.abs(tx.amount))}`;
  return (
    <li>
      <Link
        href={`/transaksi?tx=${encodeURIComponent(tx.id)}`}
        className="bmh-tx"
      >
        <span className="bmh-tile" aria-hidden="true">
          {isTransfer ? (
            <ArrowLeftRight />
          ) : (
            <CategoryIcon name={tx.categoryName ?? ""} />
          )}
        </span>
        <span className="bmh-tx-t">
          <b>{tx.description || tx.categoryName || "—"}</b>
          <small>{tx.accountName ?? tx.categoryName ?? "—"}</small>
        </span>
        <span className="bmh-amt wm-num" data-type={tx.type}>
          {amount}
        </span>
      </Link>
    </li>
  );
}

/**
 * Phone-only Beranda (<= 720px), per docs/design/refs/2026-10-20: a lime
 * "Kekayaan bersih" card with the month's net-worth sparkline, the as-of date,
 * this month's spending, the last transactions and a reminders row. The
 * greeting stays in the shell's `PageGreeting`; the desktop bento is hidden at
 * this width and both read the same data.
 */
export function MobileHome({
  netWorth,
  balancesHidden,
  history,
  currentMonth,
  transactions,
  liabilities,
  pendingApprovalsCount,
  fmt,
}: {
  netWorth: number;
  balancesHidden: boolean;
  history: NetWorthHistoryPointDto[];
  currentMonth: DashboardSummaryDto["currentMonth"] | undefined;
  transactions: DashboardSummaryDto["recentTransactions"];
  liabilities: LiabilityDto[];
  pendingApprovalsCount: number;
  fmt: MoneyFormatters;
}) {
  const { t, locale } = useLocale();
  const c = berandaMobileCopy(locale);
  const [now] = useState(() => new Date());
  const dateLocale = t.beranda.dateLocale;
  const points = monthHistory(history, now);
  const values = points.map((p) => Number(p.netWorth));
  const tick = (p: NetWorthHistoryPointDto | undefined) =>
    p
      ? new Date(p.capturedAt).toLocaleDateString(dateLocale, {
          day: "numeric",
          month: "short",
        })
      : "";
  const ticks = [
    points[0],
    points[Math.floor((points.length - 1) / 2)],
    points[points.length - 1],
  ].map(tick);
  const value = balancesHidden ? "—" : fmt.money(netWorth);
  const reminders = reminderCount(liabilities, pendingApprovalsCount);
  const remindersHref =
    reminders.due > 0 && pendingApprovalsCount > 0
      ? "/notifikasi"
      : reminders.due > 0
        ? "/liabilitas"
        : "/persetujuan";

  return (
    <section className="beranda-mhome bmh" aria-label={t.beranda.title}>
      <div className="bmh-card">
        <h2 className="bmh-label">{c.netWorth}</h2>
        <p
          className="bmh-value wm-num"
          data-long={value.length > 15 || undefined}
          aria-label={balancesHidden ? c.hidden : undefined}
        >
          {value}
        </p>
        {values.length >= 2 && !balancesHidden && (
          <div className="bmh-spark">
            <SparklineChart
              data={values}
              height={88}
              ariaLabel={c.sparkAria
                .replace("{from}", ticks[0])
                .replace("{to}", ticks[2])}
            />
            <div className="bmh-ticks" aria-hidden="true">
              {ticks.map((label, index) => (
                <span key={index}>{label}</span>
              ))}
            </div>
          </div>
        )}
        <Link
          href="/ringkasan"
          className="bmh-go"
          aria-label={c.netWorthDetail}
        >
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      <p className="bmh-asof">
        {c.asOf.replace(
          "{date}",
          now.toLocaleDateString(dateLocale, { day: "numeric", month: "long" }),
        )}
      </p>

      <Link href="/laporan" className="bmh-row bmh-spend">
        <span className="bmh-tile" aria-hidden="true">
          <Wallet />
        </span>
        <span className="bmh-tx-t">
          <small>{c.spendMonth}</small>
          <b className="wm-num">
            {currentMonth ? fmt.money(currentMonth.expense) : "—"}
          </b>
        </span>
        <ChevronRight className="bmh-chev" aria-hidden="true" />
      </Link>

      <div className="bmh-recent">
        <div className="bmh-head">
          <h2>{c.recent}</h2>
          <Link href="/transaksi" className="bmh-all" aria-label={c.seeAllAria}>
            {c.seeAll}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        {transactions.length === 0 ? (
          <p className="wm-cap bmh-empty">{t.beranda.noTransactions}</p>
        ) : (
          <ul>
            {transactions.slice(0, 3).map((tx) => (
              <RecentRow key={tx.id} tx={tx} fmt={fmt} />
            ))}
          </ul>
        )}
      </div>

      {reminders.total > 0 && (
        <Link href={remindersHref} className="bmh-row bmh-remind">
          <span className="bmh-dot" aria-hidden="true">
            !
          </span>
          <span>{c.reminders.replace("{n}", String(reminders.total))}</span>
          <ChevronRight className="bmh-chev" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
