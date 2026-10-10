"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LineChart as LineChartIcon,
  MoreVertical,
  Plus,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import type {
  AccountDto,
  BudgetDto,
  DashboardSummaryDto,
  GoalDto,
  LiabilityDto,
} from "@wealthme/contracts";
import {
  AccountCard,
  BentoCard,
  BentoHero,
  Delta,
  GhostButton,
  GoalIcon,
  HatchedBar,
  HeroKpi,
  MiniList,
  MiniRow,
  SeeAll,
  Segmented,
  TipsCard,
  Track,
  useCardLooks,
} from "@/components/wm";
import {
  FLOW_COLORS,
  HatchedAreaChart,
  TickGauge,
} from "@/components/charts/bento-charts";
import { bucketDays, useBerandaFlow, type FlowRange } from "./use-beranda-flow";
import { FlowBars } from "./flow-bars";
import { useShell } from "@/components/shell/shell-context";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { formatAxisCompact } from "@/lib/format";
import { canRecordTransaction } from "@/lib/nav";
import { vizByIndex, vizTint } from "@/lib/viz-colors";
import { describeDelta, deltaTone, type DeltaDirection } from "@/lib/delta";
import {
  monthCompareCaption,
  selectMonthComparison,
  type MonthCompareBase,
  type MonthComparison,
  type MonthMetric,
} from "@/lib/month-compare";
import { goalPace } from "@/lib/goals-utils";
import type { BerandaMember, MoneyFormatters } from "./use-beranda-data";

/* ───────────── pure helpers (unit-tested) ───────────── */

/**
 * Change of the latest month against its like-for-like base (see
 * `selectMonthComparison`): the same day-of-month window of the prior month
 * while the month is running, the full prior month otherwise. `pct` is the
 * magnitude; `dir` is the direction (flat when it rounds to 0%), at the same
 * whole-percent precision Laporan prints, so both screens agree.
 */
export function monthDelta(
  series: readonly number[] | undefined,
  metric: MonthMetric,
  base?: MonthCompareBase,
): { dir: DeltaDirection; pct: number; comparison: MonthComparison } | null {
  const comparison = selectMonthComparison(series, metric, base);
  if (!comparison) return null;
  const change = describeDelta(
    comparison.previous,
    comparison.current,
    "higher-better",
    0,
  );
  return change && { dir: change.dir, pct: Math.abs(change.pct), comparison };
}

/** "2026-09" → "Sep" in the viewer's locale; any other label passes through. */
export function monthLabel(raw: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) return raw;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString(
    locale,
    { month: "short" },
  );
}

/** Current month and year, e.g. "Oktober 2026" (long) or "Okt 2026" (short). */
export function monthName(locale: string, style: "long" | "short"): string {
  return new Date().toLocaleDateString(locale, {
    month: style,
    year: "numeric",
  });
}

/**
 * Due date label (year only when it is not this year) plus whole days overdue
 * (0 when the date is today or later).
 */
export function dueInfo(
  due: Date,
  now: Date,
  locale: string,
): { label: string; overdueDays: number } {
  // `due` is a stored UTC calendar-day (matches the UTC-pin pattern used
  // elsewhere in this file); `now` is the real current moment and must stay
  // on LOCAL getters — using UTC getters for "now" would roll "today" back
  // a day for part of the morning in Indonesia's positive UTC offsets,
  // the mirror image of the bug being fixed here.
  const startOfUTC = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const startOfLocal = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const overdueDays = Math.max(
    0,
    Math.round((startOfLocal(now) - startOfUTC(due)) / 86_400_000),
  );
  const label = due.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...(due.getUTCFullYear() !== now.getFullYear() && {
      year: "numeric",
    }),
  });
  return { label, overdueDays };
}

/** Split "Rp 1.234" / "≈ $ 12" into the small hero prefix and the number. */
export function splitCurrency(text: string): {
  prefix: string | null;
  amount: string;
} {
  const match = /^(-?)(Rp|≈\s*\S+)\s+(.*)$/.exec(text);
  return match
    ? { prefix: match[2], amount: `${match[1]}${match[3]}` }
    : { prefix: null, amount: text };
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/** Whole-months elapsed since `startDate`, clamped to the tenor (honest approximation). */
export function installmentProgress(
  liability: Pick<LiabilityDto, "startDate" | "tenorMonths">,
  now = new Date(),
): { current: number; total: number } | null {
  const { startDate, tenorMonths } = liability;
  if (!startDate || !tenorMonths || tenorMonths <= 0) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  const elapsed =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth()) +
    1;
  return {
    current: Math.min(Math.max(elapsed, 1), tenorMonths),
    total: tenorMonths,
  };
}

/* ───────────── hero ───────────── */

/** "42 / 60 jt": current and target in the target's unit so the pair never mixes jt and M. */
export function goalPair(current: number, target: number): string {
  const [div, unit] =
    target >= 1e9
      ? [1e9, "M"]
      : target >= 1e6
        ? [1e6, "jt"]
        : target >= 1e3
          ? [1e3, "rb"]
          : [1, ""];
  const n = (value: number) =>
    (value / div).toFixed(1).replace(/\.0$/, "").replace(".", ",");
  return `${n(current)} / ${n(target)}${unit ? ` ${unit}` : ""}`;
}

type ChartMode = "bars" | "line";

export function BerandaHeroCard({
  netWorth,
  currentMonth,
  cashflow,
  monthCompare,
  fmt,
}: {
  netWorth: number;
  currentMonth: DashboardSummaryDto["currentMonth"] | undefined;
  cashflow: DashboardSummaryDto["cashflow"] | undefined;
  monthCompare?: MonthCompareBase;
  fmt: MoneyFormatters;
}) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const [mode, setMode] = useState<ChartMode>("bars");
  const [range, setRange] = useState<FlowRange>(7);
  const flow = useBerandaFlow(range);
  const localeTag = t.beranda.dateLocale;
  const negative = netWorth < 0;
  const days = bucketDays(flow.window, range, flow.today, (date) =>
    range === 7
      ? date.toLocaleDateString(localeTag, { weekday: "short" })
      : date.getDate() % 5 === 0
        ? String(date.getDate())
        : "",
  );
  const income = cashflow?.income ?? [];
  const expense = cashflow?.expense ?? [];
  const saved = cashflow
    ? income.map((value, index) => value - (expense[index] ?? 0))
    : undefined;

  const kpi = (
    label: string,
    value: number,
    series: number[] | undefined,
    metric: MonthMetric,
  ) => {
    const delta = monthDelta(series, metric, monthCompare);
    return (
      <HeroKpi
        label={label}
        value={fmt.money(value)}
        delta={
          delta && (
            <Delta
              dir={delta.dir}
              tone={deltaTone(
                delta.dir,
                metric === "expense" ? "lower-better" : "higher-better",
              )}
              value={`${Math.round(delta.pct)}%`}
              suffix={monthCompareCaption(
                delta.comparison,
                {
                  window: v2.compareWindow,
                  fullMonth: v2.compareFullMonth,
                  lastMonth: v2.vsLastMonth,
                },
                localeTag,
              )}
            />
          )
        }
      />
    );
  };

  return (
    <BentoHero
      area="main"
      className="beranda-hero"
      currency={splitCurrency(fmt.money(netWorth)).prefix}
      value={
        <span data-negative={negative || undefined}>
          {splitCurrency(fmt.money(netWorth)).amount}
        </span>
      }
      caption={
        negative ? `${v2.heroCaption} · ${v2.heroNegative}` : v2.heroCaption
      }
      controls={
        <div className="beranda-hero-ctrl">
          <div className="flex items-center gap-1.5">
            <select
              className="wm-sel"
              aria-label={v2.rangeAria}
              value={range}
              onChange={(event) =>
                setRange(Number(event.target.value) as FlowRange)
              }
            >
              <option value={7}>{v2.range7}</option>
              <option value={30}>{v2.range30}</option>
            </select>
            <button
              type="button"
              className="wm-ibtn"
              aria-pressed={mode === "bars"}
              aria-label={v2.chartBars}
              onClick={() => setMode("bars")}
            >
              <BarChart3 aria-hidden="true" />
            </button>
            <button
              type="button"
              className="wm-ibtn"
              aria-pressed={mode === "line"}
              aria-label={v2.chartLine}
              onClick={() => setMode("line")}
            >
              <LineChartIcon aria-hidden="true" />
            </button>
          </div>
          {mode === "bars" && (
            <div className="wm-legend" aria-hidden="true">
              <span>
                <i style={{ background: FLOW_COLORS.income }} />
                {v2.income}
              </span>
              <span>
                <i style={{ background: FLOW_COLORS.expense }} />
                {v2.expense}
              </span>
            </div>
          )}
        </div>
      }
      chart={
        mode === "bars" ? (
          <FlowBars
            days={days}
            format={fmt.moneyCompact}
            formatFull={fmt.money}
            labels={{ income: v2.income, expense: v2.expense }}
            ariaLabel={v2.flowAria}
          />
        ) : (
          <HatchedAreaChart
            labels={days.map((day) => day.label)}
            values={days.map((day) => day.net)}
            format={fmt.moneyCompact}
            formatFull={fmt.money}
            axis={formatAxisCompact}
            floor={Math.min(0, ...days.map((day) => day.net))}
            ariaLabel={v2.flowAria}
          />
        )
      }
      kpis={
        <>
          {kpi(v2.income, currentMonth?.income ?? 0, income, "income")}
          {kpi(
            v2.expenseMonth.replace("{month}", monthName(localeTag, "short")),
            currentMonth?.expense ?? 0,
            expense,
            "expense",
          )}
          {kpi(v2.saved, currentMonth?.net ?? 0, saved, "net")}
        </>
      }
    />
  );
}

/* ───────────── wallet ───────────── */

/** Horizontal card rail with prev/next arrows that page one card at a time. */
function CardRail({
  label,
  prevLabel,
  nextLabel,
  children,
}: {
  label: string;
  prevLabel: string;
  nextLabel: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  };
  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const page = (dir: 1 | -1) => {
    const el = ref.current;
    const card = el?.querySelector<HTMLElement>(".wm-pcard-link, .wm-pcard");
    if (!el || !card) return;
    el.scrollBy({ left: dir * (card.offsetWidth + 12), behavior: "smooth" });
  };
  return (
    <div className="wm-rail">
      <div
        ref={ref}
        className="wm-pcards"
        tabIndex={0}
        aria-label={label}
        onScroll={sync}
      >
        {children}
      </div>
      {!edges.start && (
        <button
          type="button"
          className="wm-rail-btn"
          data-side="prev"
          aria-label={prevLabel}
          onClick={() => page(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          className="wm-rail-btn"
          data-side="next"
          aria-label={nextLabel}
          onClick={() => page(1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const MEMBER_TINTS = [
  ["var(--wm-ghost)", "var(--wm-ink)"],
  [vizTint(2), "var(--wm-ink)"],
  [vizTint(4), "var(--wm-ink)"],
  [vizTint(3), "var(--wm-ink)"],
  ["var(--wm-card-2)", "var(--wm-ink)"],
] as const;

export function memberTint(index: number) {
  const [background, color] = MEMBER_TINTS[index % MEMBER_TINTS.length];
  return { background, color };
}

export function WalletCard({
  accounts,
  members,
  selfUserId,
  fmt,
}: {
  accounts: AccountDto[];
  members: BerandaMember[];
  selfUserId: string | undefined;
  fmt: MoneyFormatters;
}) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const router = useRouter();
  const { setTxnOpen } = useShell();
  const { access } = useMyAccess();
  const { lookFor } = useCardLooks(accounts);
  const ordered = [...accounts].sort(
    (a, b) => Number(b.balance) - Number(a.balance),
  );
  const people = [...members]
    .sort(
      (a, b) =>
        Number(b.userId === selfUserId) - Number(a.userId === selfUserId),
    )
    .slice(0, 5);
  const actions = [
    canRecordTransaction(access) && {
      label: v2.actRecord,
      short: v2.actRecordShort,
      icon: Plus,
      run: () => setTxnOpen(true),
      primary: true,
    },
    {
      label: v2.actHistory,
      icon: History,
      run: () => router.push("/transaksi"),
    },
    {
      label: v2.actBudget,
      icon: ClipboardList,
      run: () => router.push("/anggaran"),
    },
    {
      label: v2.actReport,
      icon: BarChart3,
      run: () => router.push("/laporan"),
    },
  ].filter(Boolean) as {
    label: string;
    short?: string;
    icon: typeof Plus;
    run: () => void;
    primary?: boolean;
  }[];

  return (
    <BentoCard
      className="beranda-wallet"
      title={v2.accountsTitle}
      caption={v2.accountsCap}
      action={
        <GhostButton onClick={() => router.push("/rekening")}>
          {v2.addAccount}
        </GhostButton>
      }
    >
      {ordered.length === 0 ? (
        <p className="wm-cap mt-4">{v2.noAccounts}</p>
      ) : (
        <CardRail
          label={v2.accountsScroll}
          prevLabel={v2.prevAccount}
          nextLabel={v2.nextAccount}
        >
          {ordered.map((account) => (
            <Link key={account.id} href="/rekening" className="wm-pcard-link">
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
        </CardRail>
      )}
      <div className="beranda-actions">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              className="beranda-act"
              data-primary={action.primary || undefined}
              aria-label={action.label}
              onClick={action.run}
            >
              <span className="beranda-act-dot">
                <Icon aria-hidden="true" />
              </span>
              <span className="beranda-act-label">
                {action.short ?? action.label}
              </span>
            </button>
          );
        })}
      </div>
      {people.length > 0 && (
        <>
          <div className="beranda-fam-head">
            <h2>{v2.membersTitle}</h2>
            <button
              type="button"
              className="beranda-kebab"
              aria-label={v2.manageMembers}
              onClick={() => router.push("/akun")}
            >
              <MoreVertical aria-hidden="true" />
            </button>
          </div>
          <ul className="beranda-fam">
            {people.map((member, index) => {
              const self = member.userId === selfUserId;
              return (
                <li key={member.id}>
                  <span
                    className="wm-avatar"
                    data-self={self || undefined}
                    style={memberTint(index)}
                  >
                    {initials(member.name)}
                  </span>
                  <span className="truncate">
                    {self ? v2.you : member.name.split(" ")[0]}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </BentoCard>
  );
}

/* ───────────── monthly limit ───────────── */

export function LimitCard({
  budgets,
  fmt,
}: {
  budgets: BudgetDto[];
  fmt: MoneyFormatters;
}) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const router = useRouter();
  const monthly = budgets.filter((budget) => budget.period === "monthly");
  const limit = monthly.reduce((sum, budget) => sum + budget.limitAmount, 0);
  const spent = monthly.reduce((sum, budget) => sum + budget.spentAmount, 0);
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  return (
    <BentoCard
      className="beranda-limit"
      title={v2.limitTitle}
      caption={v2.limitCap.replace(
        "{month}",
        monthName(t.beranda.dateLocale, "long"),
      )}
      action={
        <GhostButton onClick={() => router.push("/anggaran")}>
          {limit > 0 ? v2.limitEdit : v2.makeBudget}
        </GhostButton>
      }
    >
      {limit > 0 ? (
        <HatchedBar
          value={pct}
          fill={pct > 100 ? "bad" : pct > 85 ? "orange" : "lime"}
          label={v2.limitAria
            .replace("{spent}", fmt.money(spent))
            .replace("{limit}", fmt.money(limit))}
          start={v2.limitSpent.replace("{amount}", fmt.money(spent))}
          end={fmt.money(limit)}
        />
      ) : (
        <p className="wm-cap mt-4">{v2.noBudget}</p>
      )}
    </BentoCard>
  );
}

/* ───────────── attention (tips card) ───────────── */

const MOSAIC = [
  "",
  "",
  "",
  "b",
  "b",
  "a",
  "",
  "",
  "b",
  "a",
  "c",
  "a",
  "",
  "b",
  "a",
  "a",
  "b",
  "a",
] as const;

export function AttentionTips({
  pendingApprovalsCount,
  nearestDueLiability,
}: {
  pendingApprovalsCount: number;
  nearestDueLiability: LiabilityDto | undefined;
}) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const more = (href: string, label: string) => (
    <Link href={href} className="beranda-more">
      {label}
      <ChevronRight aria-hidden="true" />
    </Link>
  );
  if (pendingApprovalsCount > 0) {
    return (
      <TipsCard
        className="beranda-tips"
        title={v2.approvalsTitle.replace(
          "{count}",
          String(pendingApprovalsCount),
        )}
        mosaic={MOSAIC}
        action={more("/persetujuan", v2.openApprovals)}
      >
        {t.beranda.pendingApprovalsNotice}
      </TipsCard>
    );
  }
  if (nearestDueLiability) {
    const { label: due, overdueDays } = dueInfo(
      new Date(
        (nearestDueLiability.nextDueDate ?? nearestDueLiability.dueDate)!,
      ),
      new Date(),
      t.beranda.dateLocale,
    );
    const progress = installmentProgress(nearestDueLiability);
    return (
      <TipsCard
        className="beranda-tips"
        title={(overdueDays > 0 ? v2.dueOverdue : v2.dueTitle)
          .replace("{name}", nearestDueLiability.name)
          .replace("{date}", due)
          .replace("{days}", String(overdueDays))}
        mosaic={MOSAIC}
        action={more("/liabilitas", v2.openLiabilities)}
      >
        {progress
          ? t.beranda.liabilityInstallmentProgress
              .replace("{n}", String(progress.current))
              .replace("{total}", String(progress.total))
          : undefined}
      </TipsCard>
    );
  }
  // Nothing to act on: render nothing rather than a full card holding one
  // reassuring sentence — it took a primary bento slot while carrying no
  // decision. The limit card widens into the space (beranda.css `:has`).
  return null;
}

/* ───────────── allocation · health · goals · history ───────────── */

type SpendRow = { label: string; value: number };

/**
 * Rows of the spending bento from the API's month-to-date breakdown
 * (`currentMonth.expenseByCategory`) — the same accumulation that produces
 * the hero's `currentMonth.expense`, so the rows always sum to it. Top six
 * named categories, then one "other" row holding the remainder plus every
 * category-less expense.
 */
export function spendRows(
  breakdown: readonly { categoryName: string | null; amount: number }[],
  otherLabel: string,
): SpendRow[] {
  const named = breakdown
    .flatMap((item) =>
      item.categoryName !== null && item.amount > 0
        ? [{ label: item.categoryName, value: item.amount }]
        : [],
    )
    .sort((a, b) => b.value - a.value);
  const uncategorized = breakdown
    .filter((item) => item.categoryName === null)
    .reduce((sum, item) => sum + item.amount, 0);
  const top = named.slice(0, 6);
  const other =
    named.slice(6).reduce((sum, item) => sum + item.value, 0) + uncategorized;
  return other > 0 ? [...top, { label: otherLabel, value: other }] : top;
}

export function SpendingBento({
  currentMonth,
  fmt,
}: {
  currentMonth: DashboardSummaryDto["currentMonth"] | undefined;
  fmt: MoneyFormatters;
}) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const localeTag = t.beranda.dateLocale;
  // Headline and rows both come from the dashboard summary's month-to-date
  // expense (COA direction EXPENSE) — never from a paged transaction list.
  const total = currentMonth?.expense ?? 0;
  const rows = spendRows(
    currentMonth?.expenseByCategory ?? [],
    v2.uncategorized,
  );
  return (
    <BentoCard
      className="beranda-spend"
      title={v2.spendTitle}
      caption={v2.spendCap.replace("{month}", monthName(localeTag, "long"))}
    >
      <p className="wm-mid">{fmt.money(total)}</p>
      {total > 0 ? (
        <>
          <div className="beranda-segbar" role="img" aria-label={v2.spendTitle}>
            {rows.map((row, index) => (
              <i
                key={`${row.label}-${index}`}
                title={row.label}
                style={{
                  flex: row.value,
                  background: vizByIndex(index),
                }}
              />
            ))}
          </div>
          <ul className="beranda-cats">
            {rows.map((row, index) => (
              <li key={`${row.label}-${index}`}>
                <i
                  style={{
                    background: vizByIndex(index),
                  }}
                />
                <span className="truncate">{row.label}</span>
                <span className="wm-num">
                  {Math.max(1, Math.round((row.value / total) * 100))}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="wm-cap mt-3">{v2.noSpend}</p>
      )}
    </BentoCard>
  );
}

export function HealthBento({ fmt }: { fmt: MoneyFormatters }) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const flow = useBerandaFlow(30);
  const inc = Number(flow.windowSummary?.totalIncome ?? 0);
  const net = Number(flow.windowSummary?.netBalance ?? 0);
  const ratio = inc > 0 ? (net / inc) * 100 : 0;
  // A gauge clamped at 0 read as "0% saved" while the figure above it was a
  // deficit — two answers to one question. In deficit (or with no income)
  // the card states the shortfall in words instead of drawing a gauge.
  const deficit = net < 0 || inc <= 0;
  return (
    <BentoCard
      className="beranda-health"
      title={v2.healthTitle}
      caption={`${v2.healthCap} · ${v2.days30}`}
    >
      <p className="wm-mid" data-tone={net < 0 ? "bad" : undefined}>
        {fmt.money(net)}
      </p>
      {deficit ? (
        <p className="beranda-deficit">
          {inc <= 0
            ? v2.healthNoIncome
            : v2.healthDeficit.replace(
                "{pct}",
                String(Math.round(Math.abs(ratio))),
              )}
        </p>
      ) : (
        <TickGauge value={Math.min(100, ratio)} label={v2.savedShare} />
      )}
      <p className="beranda-note">{v2.health30Note}</p>
    </BentoCard>
  );
}

export function GoalsBento({
  goals,
  fmt,
}: {
  goals: GoalDto[];
  fmt: MoneyFormatters;
}) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const router = useRouter();
  const active = goals.filter((goal) => goal.status !== "achieved").slice(0, 4);
  return (
    <BentoCard
      className="beranda-goals"
      title={v2.goalsTitle}
      action={
        <GhostButton onClick={() => router.push("/tujuan")}>
          {v2.addGoal}
        </GhostButton>
      }
    >
      {active.length === 0 ? (
        <p className="wm-cap mt-4">{t.beranda.noGoals}</p>
      ) : (
        <ul className="beranda-goal-list">
          {active.map((goal) => {
            const date = goal.targetDate
              ? new Date(goal.targetDate).toLocaleDateString(
                  t.beranda.dateLocale,
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                )
              : null;
            const pace = goalPace(goal);
            const paceLabel = {
              done: v2.goalPaceDone,
              onTrack: v2.goalPaceOnTrack,
              late: v2.goalPaceLate,
            }[pace];
            return (
              <li key={goal.id}>
                <button
                  type="button"
                  className="beranda-goal"
                  onClick={() => router.push("/tujuan")}
                >
                  <span className="wm-ic" aria-hidden="true">
                    <GoalIcon icon={goal.icon} name={goal.name} />
                  </span>
                  <span className="min-w-0">
                    <span className="beranda-goal-t">
                      <b>{goal.name}</b>
                      <small
                        className="wm-num"
                        title={`${fmt.money(goal.currentAmount)} / ${fmt.money(goal.targetAmount)}`}
                      >
                        {goalPair(goal.currentAmount, goal.targetAmount)}
                      </small>
                    </span>
                    <Track
                      value={goal.progressPercent}
                      fill={pace === "late" ? "orange" : "lime"}
                    />
                    <small>
                      <b className="beranda-goal-pace" data-pace={pace}>
                        {paceLabel}
                      </b>
                      {" · "}
                      {[
                        goal.remainingAmount > 0
                          ? v2.goalLeft.replace(
                              "{amount}",
                              fmt.money(goal.remainingAmount),
                            )
                          : v2.goalDone,
                        date,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BentoCard>
  );
}

const TX_ICON = {
  income: Wallet,
  expense: ShoppingBag,
  transfer: ArrowUpDown,
} as const;

export function HistoryBento({ fmt }: { fmt: MoneyFormatters }) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const router = useRouter();
  const [range, setRange] = useState<FlowRange>(7);
  const flow = useBerandaFlow(range);
  const rows = [...flow.window]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 7);
  return (
    <BentoCard
      className="beranda-hist"
      title={v2.historyTitle}
      action={
        <Segmented
          label={v2.rangeAria}
          value={String(range) as "7" | "30"}
          onChange={(value) => setRange(Number(value) as FlowRange)}
          options={[
            { value: "7", label: v2.range7 },
            { value: "30", label: v2.range30 },
          ]}
        />
      }
    >
      {rows.length === 0 ? (
        <p className="wm-cap mt-4">{t.beranda.noTransactions}</p>
      ) : (
        <MiniList label={v2.historyTitle}>
          {rows.map((tx) => {
            const inflow = tx.type === "income";
            const Icon =
              TX_ICON[tx.type as keyof typeof TX_ICON] ?? ArrowUpDown;
            const amount = Math.abs(Number(tx.amount));
            return (
              <MiniRow
                key={tx.id}
                icon={<Icon aria-hidden="true" />}
                title={tx.description || tx.categoryName || tx.type}
                meta={[
                  new Date(tx.occurredAt).toLocaleDateString(
                    t.beranda.dateLocale,
                    { day: "numeric", month: "short", timeZone: "UTC" },
                  ),
                  tx.accountName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                amount={
                  <span
                    className={inflow ? "wm-pos" : undefined}
                  >{`${inflow ? "+" : tx.type === "expense" ? "-" : ""}${fmt.money(amount)}`}</span>
                }
                onClick={() => router.push("/transaksi")}
              />
            );
          })}
        </MiniList>
      )}
      <SeeAll href="/transaksi">{v2.seeAllHistory}</SeeAll>
    </BentoCard>
  );
}
