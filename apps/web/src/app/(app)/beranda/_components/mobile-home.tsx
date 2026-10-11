"use client";

import { currencyDisplay } from "@/lib/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import type {
  AccountDto,
  DashboardSummaryDto,
  GoalDto,
} from "@wealthme/contracts";
import { AccountCard, GoalIcon, Track, useCardLooks } from "@/components/wm";
import { useCountUp } from "@/components/wm/motion";
import { useEnterMotionChildren } from "@/components/wm/use-enter-motion";
import { useShell } from "@/components/shell/shell-context";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { canRecordTransaction } from "@/lib/nav";
import { DELTA_ARROW, deltaSrText, deltaTone } from "@/lib/delta";
import {
  monthCompareCaption,
  type MonthCompareBase,
} from "@/lib/month-compare";
import { initials, memberTint, monthDelta } from "./bento-sections";
import { bucketDays, useBerandaFlow } from "./use-beranda-flow";
import type { BerandaMember, MoneyFormatters } from "./use-beranda-data";

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
 * Phone-only Beranda (prototype `.mhome`, <= 720px): notched dark card with an
 * account carousel, the net worth and two actions, then spending and latest
 * transaction tiles, a six-month dot chart and goals. The desktop bento is
 * hidden at that width; both read the same data.
 */
export function MobileHome({
  netWorth,
  accounts,
  members,
  currentMonth,
  cashflow,
  monthCompare,
  transactions,
  goals,
  fmt,
}: {
  netWorth: number;
  accounts: AccountDto[];
  members: BerandaMember[];
  currentMonth: DashboardSummaryDto["currentMonth"] | undefined;
  cashflow: DashboardSummaryDto["cashflow"] | undefined;
  monthCompare?: MonthCompareBase;
  transactions: DashboardSummaryDto["recentTransactions"];
  goals: GoalDto[];
  fmt: MoneyFormatters;
}) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const router = useRouter();
  const { setTxnOpen } = useShell();
  const { access } = useMyAccess();
  const [slide, setSlide] = useState(0);
  const { lookFor } = useCardLooks(accounts);
  // The balance counts up once it loads (reduced motion: shown at once).
  const shownNetWorth = useCountUp(netWorth, 900);
  const homeRef = useRef<HTMLElement>(null);
  useEnterMotionChildren(homeRef);
  const ordered = [...accounts]
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .slice(0, 6);
  const spendDelta = monthDelta(cashflow?.expense, "expense", monthCompare);
  const last = transactions[0];
  const flow = useBerandaFlow(7);
  const days = bucketDays(flow.window, 7, flow.today, (date) =>
    date.toLocaleDateString(t.beranda.dateLocale, { weekday: "short" }),
  );
  const columns = dotColumns(
    days.map((day) => day.income),
    days.map((day) => day.expense),
  );
  const canAdd = canRecordTransaction(access);

  return (
    <section
      ref={homeRef}
      className="beranda-mhome"
      aria-label={t.beranda.title}
    >
      <div className="wm-card wm-dark beranda-mh-card">
        <span className="beranda-mh-badge" aria-hidden="true">
          Rp
        </span>
        <p className="beranda-mh-total wm-num">
          <span aria-hidden="true">{fmt.money(shownNetWorth)}</span>
          <span className="sr-only">{fmt.money(netWorth)}</span>
        </p>
        <p className="beranda-mh-cap">{v2.heroCaption}</p>
        {ordered.length > 0 && (
          <>
            <div
              className="beranda-mh-accs"
              onScroll={(event) => {
                const el = event.currentTarget;
                setSlide(
                  Math.round(el.scrollLeft / Math.max(1, el.clientWidth)),
                );
              }}
            >
              {ordered.map((account) => (
                <Link
                  key={account.id}
                  href="/rekening"
                  className="beranda-mh-acc"
                >
                  <AccountCard
                    look={lookFor(account.id, account.type)}
                    bank={account.institution ?? account.name}
                    name={account.name}
                    number={
                      account.maskedNumber
                        ? `**** ${account.maskedNumber.slice(-4)}`
                        : null
                    }
                    holder={account.ownerName ?? ""}
                    balance={fmt.money(Number(account.balance))}
                  />
                </Link>
              ))}
            </div>
            {ordered.length > 1 && (
              <div className="beranda-mh-dots" aria-hidden="true">
                {ordered.map((account, index) => (
                  <i key={account.id} data-on={index === slide || undefined} />
                ))}
              </div>
            )}
          </>
        )}
        <div className="beranda-mh-acts">
          {canAdd && (
            <button
              type="button"
              data-solid="true"
              onClick={() => setTxnOpen(true)}
            >
              {v2.actRecord}
            </button>
          )}
          <button
            type="button"
            data-solid={canAdd ? undefined : "true"}
            onClick={() => router.push("/transaksi")}
          >
            {v2.actHistory}
          </button>
        </div>
      </div>

      <div className="beranda-mh-two">
        <Link href="/anggaran" className="beranda-mh-tile">
          <span className="beranda-mh-h">
            <span className="beranda-mh-d">
              <i>{currencyDisplay(fmt.currency).symbol}</i>
              {v2.mExpense}
            </span>
          </span>
          <span className="beranda-mh-v wm-num">
            {fmt.money(currentMonth?.expense ?? 0)}
            {spendDelta && (
              <em data-tone={deltaTone(spendDelta.dir, "lower-better")}>
                {spendDelta.dir !== "flat" && (
                  <span aria-hidden="true">{DELTA_ARROW[spendDelta.dir]} </span>
                )}
                {Math.round(spendDelta.pct)}%
                <span className="sr-only">
                  {deltaSrText(
                    spendDelta.dir,
                    deltaTone(spendDelta.dir, "lower-better"),
                    t.common.delta,
                  )}
                </span>
              </em>
            )}
          </span>
          <small>
            {spendDelta
              ? monthCompareCaption(
                  spendDelta.comparison,
                  {
                    window: v2.compareWindow,
                    fullMonth: v2.compareFullMonth,
                    lastMonth: t.beranda.thisMonth,
                  },
                  t.beranda.dateLocale,
                )
              : t.beranda.thisMonth}
          </small>
        </Link>
        <div className="beranda-mh-tile">
          <span className="beranda-mh-h">{v2.mLastTx}</span>
          <small
            className="mt-auto line-clamp-2 tabular-nums"
            title={last ? fmt.money(Math.abs(last.amount)) : undefined}
          >
            {last
              ? `${last.description || last.categoryName || ""} · ${fmt.money(Math.abs(last.amount))}`
              : t.beranda.noTransactions}
          </small>
          <div className="beranda-mh-av">
            {members.slice(0, 3).map((member, index) => (
              <span
                key={member.id}
                className="wm-avatar"
                style={memberTint(index)}
                title={member.name}
              >
                {initials(member.name)}
              </span>
            ))}
            {canAdd && (
              <button
                type="button"
                aria-label={t.shell.addTransaction}
                onClick={() => setTxnOpen(true)}
              >
                <Plus aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {columns.length > 0 && (
        <div className="beranda-mh-stat">
          <div className="beranda-mh-h">
            <span>{v2.mStats}</span>
            <Link href="/ringkasan" className="beranda-more">
              {v2.detail}
            </Link>
          </div>
          <div
            className="beranda-mh-matrix"
            role="img"
            aria-label={v2.cashflowAria}
          >
            {columns.map((column, index) => (
              <div key={index} className="beranda-mh-col">
                <span>{days[index].label}</span>
                {Array.from({ length: DOTS }, (_, dot) => (
                  <i
                    key={dot}
                    data-v={
                      dot < column.expense
                        ? "b"
                        : dot < column.expense + column.income
                          ? "a"
                          : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="beranda-mh-leg">
            <span>
              <i data-v="a" />
              {v2.income}
            </span>
            <span>
              <i data-v="b" />
              {v2.expense}
            </span>
          </div>
        </div>
      )}

      <div className="beranda-mh-stat">
        <div className="beranda-mh-h">
          <span>{v2.goalsTitle}</span>
          <Link href="/tujuan" className="beranda-more">
            {v2.seeAll}
          </Link>
        </div>
        {goals.length === 0 ? (
          <p className="wm-cap mt-2">{t.beranda.noGoals}</p>
        ) : (
          goals.slice(0, 3).map((goal) => (
            <Link key={goal.id} href="/tujuan" className="beranda-mh-goal">
              <span className="wm-ic" aria-hidden="true">
                <GoalIcon icon={goal.icon} name={goal.name} />
              </span>
              <span className="min-w-0 flex-1">
                <b>{goal.name}</b>
                <Track value={goal.progressPercent} className="mt-1.5" />
              </span>
              <span className="wm-num text-[13px]">
                {Math.round(goal.progressPercent)}%
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
