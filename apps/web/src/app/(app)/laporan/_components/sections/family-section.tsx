import { MoneyStat, SectionCard, StatusBadge } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { NetWorthDto, ReportSummaryDto } from "@wealthme/contracts";
import type { FamilyMember } from "../types";
import { ActItem } from "../atoms";

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
      <div className="text-[15px] font-bold">{t.laporan.family.title}</div>

      <SectionCard title={t.laporan.family.consolidationTitle}>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MoneyStat
            label={t.laporan.family.totalNetWorthLabel}
            value={
              netWorth
                ? money.format(parseFloat(netWorth.netWorth) || 0)
                : "Rp ·"
            }
            valueClass="text-primary"
          />
          <MoneyStat
            label={t.laporan.totalIncomeLabel}
            value={summary ? money.format(summary.totalIncome) : "Rp ·"}
            valueClass="text-success"
          />
          <MoneyStat
            label={t.laporan.totalExpenseLabel}
            value={summary ? money.format(summary.totalExpense) : "Rp ·"}
            valueClass="text-destructive"
          />
          <MoneyStat
            label={t.laporan.surplusLabel}
            value={summary ? money.format(summary.netSavings) : "Rp ·"}
            valueClass="text-success"
          />
        </div>
      </SectionCard>

      {netWorthRows.length > 0 && (
        <SectionCard title={t.laporan.family.wealthCompositionTitle}>
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
                    "mono text-[13px] font-bold " +
                    (row.neg ? "text-destructive" : "text-foreground")
                  }
                >
                  {row.neg ? "-" : ""}
                  {money.format(parseFloat(row.value) || 0)}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={`${t.laporan.family.membersTitlePrefix} (${memberList.length})`}
      >
        {memberList.length > 0 ? (
          memberList.map((m, i) => (
            <ActItem
              key={m.id}
              icon={m.name.slice(0, 2).toUpperCase()}
              iconBg="#EEF2FF"
              iconColor="#4F46E5"
              iconSize="12px"
              name={m.name}
              cat={m.email}
              right={
                <StatusBadge variant={ROLE_VARIANTS[m.role] ?? "info"}>
                  {t.common.roleLabels[m.role] ?? m.role}
                </StatusBadge>
              }
              last={i === memberList.length - 1}
            />
          ))
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.family.emptyMembers}
          </div>
        )}
      </SectionCard>

      <div className="rounded-[12px] border border-primary/20 bg-accent p-3.5 text-[12px] text-muted-foreground">
        {t.laporan.family.noteConsolidation}
      </div>
    </div>
  );
}
