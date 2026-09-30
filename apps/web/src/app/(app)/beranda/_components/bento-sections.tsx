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
  FlowStackChart,
  HatchedAreaChart,
  TickGauge,
} from "@/components/charts/bento-charts";
import {
  bucketDays,
  spendByCategory,
  useBerandaFlow,
  type FlowRange,
} from "./use-beranda-flow";
import { useShell } from "@/components/shell/shell-context";
import { useLocale } from "@/hooks/use-locale";
import { useMyAccess } from "@/hooks/use-my-access";
import { canRecordTransaction } from "@/lib/nav";
import type { BerandaMember, MoneyFormatters } from "./use-beranda-data";

/* ───────────── pure helpers (unit-tested) ───────────── */

/** Month-over-month change of the last two points, or null when there is no base to compare. */
export function monthDelta(
  series: readonly number[] | undefined,
): { dir: "up" | "down"; pct: number } | null {
  if (!series || series.length < 2) return null;
  const cur = series[series.length - 1];
  const prev = series[series.length - 2];
  if (!prev) return null;
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  return { dir: pct >= 0 ? "up" : "down", pct: Math.abs(pct) };
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

/** Axis ticks: "12 jt" / "1,5 M" without the currency prefix. */
export function axisCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const trim = (n: number) =>
    n.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (abs >= 1e9) return `${sign}${trim(abs / 1e9)} M`;
  if (abs >= 1e6) return `${sign}${trim(abs / 1e6)} jt`;
  if (abs >= 1e3) return `${sign}${trim(abs / 1e3)} rb`;
  return `${sign}${Math.round(abs)}`;
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

const pctFmt = (value: number, locale: string) =>
  value.toLocaleString(locale, { maximumFractionDigits: 1 });

/* ───────────── hero ───────────── */

/** The latest day with any money movement (the column the hero highlights), else the last day. */
export function lastActive(
  days: readonly { income: number; expense: number; savings: number }[],
): number {
  for (let i = days.length - 1; i >= 0; i -= 1)
    if (days[i].income || days[i].expense || days[i].savings) return i;
  return days.length - 1;
}

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
  fmt,
}: {
  netWorth: number;
  currentMonth: DashboardSummaryDto["currentMonth"] | undefined;
  cashflow: DashboardSummaryDto["cashflow"] | undefined;
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
    upIsGood: boolean,
  ) => {
    const delta = monthDelta(series);
    return (
      <HeroKpi
        label={label}
        value={fmt.money(value)}
        short={fmt.moneyCompact(value)}
        delta={
          delta && (
            <Delta
              dir={delta.dir}
              good={(delta.dir === "up") === upIsGood}
              value={`${pctFmt(delta.pct, localeTag)}%`}
              suffix={v2.vsLastMonth}
            />
          )
        }
      />
    );
  };

  return (
    <BentoHero
      area="main"
      valueAs="h1"
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
          <div className="wm-legend" aria-hidden="true">
            <span>
              <i style={{ background: "var(--wm-yellow)" }} />
              {v2.savings}
            </span>
            <span>
              <i style={{ background: "var(--wm-lime)" }} />
              {v2.income}
            </span>
            <span>
              <i style={{ background: "var(--wm-orange)" }} />
              {v2.expense}
            </span>
          </div>
        </div>
      }
      chart={
        mode === "bars" ? (
          <FlowStackChart
            days={days}
            highlight={lastActive(days)}
            format={fmt.moneyCompact}
            axis={axisCompact}
            labels={{
              savings: v2.savings,
              income: v2.income,
              expense: v2.expense,
            }}
            ariaLabel={v2.flowAria}
          />
        ) : (
          <HatchedAreaChart
            labels={days.map((day) => day.label)}
            values={days.map((day) => day.income - day.expense)}
            format={fmt.moneyCompact}
            axis={axisCompact}
            floor={Math.min(0, ...days.map((day) => day.income - day.expense))}
            ariaLabel={v2.flowAria}
          />
        )
      }
      kpis={
        <>
          {kpi(v2.income, currentMonth?.income ?? 0, income, true)}
          {kpi(v2.expense, currentMonth?.expense ?? 0, expense, false)}
          {kpi(v2.saved, currentMonth?.net ?? 0, saved, true)}
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
    const card = el?.querySelector<HTMLElement>(".wm-pcard");
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
  ["var(--wm-lime-soft)", "var(--wm-ink)"],
  ["#f6e7c9", "#5a3d07"],
  ["#dce9f7", "#123b63"],
  ["#ebddf3", "#472062"],
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
  const { lookFor } = useCardLooks();
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
      icon: Plus,
      run: () => setTxnOpen(true),
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
  ].filter(Boolean) as { label: string; icon: typeof Plus; run: () => void }[];

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
                balance={fmt.moneyCompact(Number(account.balance))}
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
              onClick={action.run}
            >
              <span>
                <Icon aria-hidden="true" />
              </span>
              {action.label}
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
      caption={v2.limitCap}
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
    const due = new Date(
      (nearestDueLiability.nextDueDate ?? nearestDueLiability.dueDate)!,
    ).toLocaleDateString(t.beranda.dateLocale, {
      day: "numeric",
      month: "short",
    });
    const progress = installmentProgress(nearestDueLiability);
    return (
      <TipsCard
        className="beranda-tips"
        title={v2.dueTitle
          .replace("{name}", nearestDueLiability.name)
          .replace("{date}", due)}
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
  return (
    <TipsCard className="beranda-tips" title={v2.calmTitle} mosaic={MOSAIC}>
      {v2.calmBody}
    </TipsCard>
  );
}

/* ───────────── allocation · health · goals · history ───────────── */

const SPEND_COLORS = [
  "var(--wm-lime)",
  "var(--wm-yellow)",
  "var(--wm-orange)",
  "var(--wm-ink)",
  "#a9d86e",
  "var(--wm-sky)",
  "var(--wm-ghost)",
];

export function SpendingBento({ fmt }: { fmt: MoneyFormatters }) {
  const { t } = useLocale();
  const v2 = t.beranda.v2;
  const flow = useBerandaFlow(7);
  const cats = spendByCategory(flow.month, v2.uncategorized);
  const total = cats.reduce((sum, cat) => sum + cat.value, 0);
  const top = cats.slice(0, 6);
  const rest = cats.slice(6).reduce((sum, cat) => sum + cat.value, 0);
  const rows =
    rest > 0 ? [...top, { label: v2.uncategorized, value: rest }] : top;
  return (
    <BentoCard
      className="beranda-spend"
      title={v2.spendTitle}
      caption={v2.spendCap}
    >
      <p className="wm-mid">{fmt.money(total)}</p>
      {total > 0 ? (
        <>
          <div className="beranda-segbar" role="img" aria-label={v2.spendTitle}>
            {rows.map((row, index) => (
              <i
                key={row.label}
                title={row.label}
                style={{
                  flex: row.value,
                  background: SPEND_COLORS[index % SPEND_COLORS.length],
                }}
              />
            ))}
          </div>
          <ul className="beranda-cats">
            {rows.map((row, index) => (
              <li key={row.label}>
                <i
                  style={{
                    background: SPEND_COLORS[index % SPEND_COLORS.length],
                  }}
                />
                <span className="truncate">{row.label}</span>
                <span className="wm-num">
                  {Math.max(1, Math.round((row.value / total) * 100))}%
                </span>
              </li>
            ))}
          </ul>
          {flow.monthTotal > flow.month.length && (
            <p className="wm-cap mt-auto pt-2">
              {v2.partial.replace("{n}", String(flow.month.length))}
            </p>
          )}
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
  const rate = inc > 0 ? Math.max(0, Math.min(100, (net / inc) * 100)) : 0;
  return (
    <BentoCard
      className="beranda-health"
      title={v2.healthTitle}
      caption={v2.healthCap}
      action={<span className="beranda-pill">{v2.days30}</span>}
    >
      <p className="wm-mid">{fmt.money(net)}</p>
      <TickGauge
        value={rate}
        ariaLabel={`${Math.round(rate)}% ${v2.savedShare}`}
      >
        <b>{Math.round(rate)}%</b>
        <small>{v2.savedShare}</small>
      </TickGauge>
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
                  { day: "numeric", month: "short", year: "numeric" },
                )
              : null;
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
                      <small className="wm-num">
                        {goalPair(goal.currentAmount, goal.targetAmount)}
                      </small>
                    </span>
                    <Track
                      value={goal.progressPercent}
                      fill={goal.progressPercent >= 50 ? "lime" : "orange"}
                    />
                    <small>
                      {[
                        goal.remainingAmount > 0
                          ? v2.goalLeft.replace(
                              "{amount}",
                              fmt.moneyCompact(goal.remainingAmount),
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
                    { day: "numeric", month: "short" },
                  ),
                  tx.accountName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                amount={
                  <span
                    className={inflow ? "wm-pos" : undefined}
                  >{`${inflow ? "+" : tx.type === "expense" ? "−" : ""}${fmt.moneyCompact(amount).replace("Rp ", "")}`}</span>
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
