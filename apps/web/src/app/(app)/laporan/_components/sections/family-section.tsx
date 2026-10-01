import { BentoCard, BentoTile, BentoTiles, StatusBadge } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { NetWorthDto, ReportSummaryDto } from "@wealthme/contracts";
import type { FamilyMember } from "../types";
import "./sections-a.css";

// EPIC-023 Task C retry (six-reviewer finding) — covers all six roles; the
// previous map only covered 3 and its "admin" key never matched the real
// enum value `admin_staff`, so admin_staff/spouse/dependant/operational all
// silently fell back to the `?? "info"` default below. Text labels now come
// from the shared `t.common.roleLabels` (see i18n/types.ts's `MemberRoleId`)
// instead of a page-local partial map.
const ROLE_VARIANTS: Record<
  string,
  "success" | "info" | "purple" | "warning" | "gray"
> = {
  owner: "success",
  spouse: "purple",
  admin_staff: "info",
  member: "gray",
  dependant: "warning",
  operational: "warning",
};

/* ───────────────────────── Section: Group Family ───────────────────────── */

export function FamilySection({
  members,
  netWorth,
  summary,
  isLoading,
}: {
  members?: FamilyMember[];
  netWorth?: NetWorthDto;
  summary?: ReportSummaryDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const memberList = members ?? [];

  const netWorthRows = netWorth
    ? [
        {
          label: t.laporan.family.rowAccountsCash,
          value: netWorth.accountsTotal,
          neg: false,
        },
        {
          label: t.laporan.family.rowInvestments,
          value: netWorth.investmentsTotal,
          neg: false,
        },
        {
          label: t.laporan.family.rowOtherAssets,
          value: netWorth.assetsTotal,
          neg: false,
        },
        {
          label: t.laporan.family.rowLiabilities,
          value: netWorth.liabilitiesTotal,
          neg: true,
        },
      ]
    : [];

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <BentoCard title={t.laporan.family.consolidationTitle}>
        <BentoTiles>
          <BentoTile
            title={t.laporan.family.totalNetWorthLabel}
            value={
              <span
                className="lap-a-kpi-value"
                style={{ color: "var(--primary)" }}
              >
                {netWorth
                  ? money.format(parseFloat(netWorth.netWorth ?? "0") || 0)
                  : "Rp ·"}
              </span>
            }
          />
          <BentoTile
            title={t.laporan.totalIncomeLabel}
            value={
              <span
                className="lap-a-kpi-value"
                style={{ color: "var(--wm-lime)" }}
              >
                {summary ? money.format(summary.totalIncome ?? 0) : "Rp ·"}
              </span>
            }
          />
          <BentoTile
            title={t.laporan.totalExpenseLabel}
            value={
              <span
                className="lap-a-kpi-value"
                style={{ color: "var(--wm-orange)" }}
              >
                {summary ? money.format(summary.totalExpense ?? 0) : "Rp ·"}
              </span>
            }
          />
          <BentoTile
            title={t.laporan.surplusLabel}
            value={
              <span
                className="lap-a-kpi-value"
                style={{ color: "var(--wm-lime)" }}
              >
                {summary ? money.format(summary.netSavings ?? 0) : "Rp ·"}
              </span>
            }
          />
        </BentoTiles>
      </BentoCard>

      {netWorthRows.length > 0 && (
        <BentoCard title={t.laporan.family.wealthCompositionTitle}>
          <div className="flex flex-col">
            {netWorthRows.map((row, i) => (
              <div
                key={row.label}
                className={
                  "flex items-center justify-between py-2.5 " +
                  (i === netWorthRows.length - 1
                    ? ""
                    : "border-b border-border")
                }
              >
                <span className="text-[13px] font-semibold">{row.label}</span>
                <span
                  className={
                    "lap-a-amt text-[13px] font-bold " +
                    (row.neg ? "text-destructive" : "text-foreground")
                  }
                >
                  {row.neg ? "-" : ""}
                  {money.format(parseFloat(row.value ?? "0") || 0)}
                </span>
              </div>
            ))}
          </div>
        </BentoCard>
      )}

      <BentoCard
        title={`${t.laporan.family.membersTitlePrefix} (${memberList.length})`}
      >
        {memberList.length > 0 ? (
          memberList.map((m) => {
            const roleLabel = t.common.roleLabels[m.role] ?? m.role;
            return (
              <div key={m.id} className="lap-a-member-row">
                <span
                  className="lap-a-bank-chip"
                  style={{ background: "#EEF2FF", color: "#4F46E5" }}
                  aria-hidden="true"
                >
                  {m.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="lap-a-bank-meta">
                  <span className="lap-a-bank-name">{m.name}</span>
                  {/* Never show the member's raw email/username (it can be
                      an internal `member-...@members.internal` placeholder
                      for dependant/operational accounts) — the relationship
                      role already says more to a family reader. */}
                  <span className="lap-a-bank-sub">{roleLabel}</span>
                </span>
                <StatusBadge variant={ROLE_VARIANTS[m.role] ?? "info"}>
                  {roleLabel}
                </StatusBadge>
              </div>
            );
          })
        ) : (
          <div className="lap-a-empty">
            <b>{t.laporan.family.emptyMembers}</b>
          </div>
        )}
      </BentoCard>

      <div className="rounded-[12px] border border-primary/20 bg-accent p-3.5 text-[12px] text-muted-foreground">
        {t.laporan.family.noteConsolidation}
      </div>
    </div>
  );
}
