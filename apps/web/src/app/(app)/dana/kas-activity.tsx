"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Info,
} from "lucide-react";
import type { TransactionDto } from "@wealthme/contracts";

import { useLocale } from "@/hooks/use-locale";
import { useMoney } from "@/hooks/use-money";
import { fill } from "@/i18n/rekening-v3";

import type { KasRow } from "./kas-model";
import { STALE_DAYS } from "./kas-model";
import { MASK } from "./kas-summary";

export function KasAttention({
  items,
  onReconcile,
}: {
  items: readonly KasRow[];
  onReconcile: (row: KasRow) => void;
}) {
  const { t } = useLocale();
  const c = t.dana.v3.page;
  const first = items[0];
  if (!first) return null;
  const line =
    items.length > 1
      ? fill(c.attentionMany, { n: items.length, days: STALE_DAYS })
      : first.checkedDaysAgo === null
        ? fill(c.attentionNever, { name: first.account.name })
        : fill(c.attentionOne, {
            name: first.account.name,
            days: first.checkedDaysAgo,
          });
  // Withheld balances cannot be reconciled; the CTA targets the first that can.
  const target = items.find((r) => r.idr !== null);
  return (
    <section className="kw-card kw-attn" role="status">
      <span className="kw-attn-ic" aria-hidden="true">
        <AlertCircle />
      </span>
      <div className="kw-attn-text">
        <p className="kw-attn-title">{c.attentionTitle}</p>
        <p>{line}</p>
      </div>
      {target && (
        <button
          type="button"
          className="kw-btn"
          data-primary=""
          onClick={() => onReconcile(target)}
        >
          {c.reconcileCta}
        </button>
      )}
    </section>
  );
}

export function KasActivity({
  txns,
  hidden,
  locale,
}: {
  txns: readonly TransactionDto[];
  hidden: boolean;
  locale: "id" | "en";
}) {
  const { t } = useLocale();
  const c = t.dana.v3.page;
  const money = useMoney();
  return (
    <section className="kw-card kw-activity" aria-labelledby="kw-act-title">
      <div className="kw-act-head">
        <h2 id="kw-act-title" className="kw-h2">
          {c.activityTitle}
        </h2>
        <Link href="/transaksi" className="kw-link">
          {c.viewAll} <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      {txns.length === 0 ? (
        <p className="kw-empty-inline">{c.activityEmpty}</p>
      ) : (
        <ul className="kw-act-list">
          {txns.map((tx) => {
            const isTransfer = tx.type === "transfer";
            const isIncome = tx.type === "income";
            const Icon = isTransfer
              ? ArrowLeftRight
              : isIncome
                ? ArrowDownLeft
                : ArrowUpRight;
            const sub = isTransfer
              ? `${c.transfer} • ${tx.accountName ?? "—"} → ${tx.toAccountName ?? "—"}`
              : (tx.accountName ?? "—");
            const amount = Number(tx.amount);
            const text = hidden
              ? MASK
              : (isTransfer ? "" : isIncome ? "+" : "-") + money.format(amount);
            return (
              <li key={tx.id} className="kw-act-row">
                <span className="kw-act-ic" aria-hidden="true">
                  <Icon />
                </span>
                <div className="kw-act-text">
                  <b>{tx.description ?? tx.categoryName ?? "—"}</b>
                  <small>{sub}</small>
                </div>
                <time className="kw-act-date" dateTime={tx.occurredAt}>
                  {new Date(tx.occurredAt).toLocaleDateString(
                    locale === "en" ? "en-US" : "id-ID",
                    { day: "numeric", month: "short", year: "numeric" },
                  )}
                </time>
                <span
                  className="kw-act-amt wm-num"
                  data-tone={isTransfer ? undefined : isIncome ? "in" : "out"}
                >
                  {text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="kw-note">
        <Info aria-hidden="true" /> {c.activityNote}
      </p>
    </section>
  );
}
