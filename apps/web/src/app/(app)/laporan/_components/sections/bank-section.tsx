import { SectionCard } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { formatJuta } from "@/lib/laporan-utils";
import { useLocale } from "@/hooks/use-locale";
import type { BankReportDto } from "@wealthme/contracts";
import { ActItem, BarRow } from "../atoms";

/* ───────────────────────── Section: Bank ───────────────────────── */

const BANK_COLORS = [
  "var(--success)",
  "var(--brand-cyan)",
  "var(--warning)",
  "var(--primary)",
  "#8B5CF6",
];

export function BankSection({
  bankReport,
  isLoading,
}: {
  bankReport?: BankReportDto;
  isLoading?: boolean;
}) {
  const { t } = useLocale();
  const money = useMoney();
  const loadingClass = isLoading ? "opacity-50 pointer-events-none" : "";
  const banks = bankReport?.banks ?? [];
  const maxIncome = Math.max(...banks.map((b) => b.income), 1);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <div className="text-[15px] font-bold">{t.laporan.bank.title}</div>
      <SectionCard title={t.laporan.bank.balancePerAccountTitle}>
        {banks.length > 0 ? (
          banks.map((b, i) => (
            <ActItem
              key={b.accountName}
              icon={
                b.institution?.slice(0, 3).toUpperCase() ??
                b.accountName.slice(0, 3).toUpperCase()
              }
              iconBg="#DBEAFE"
              iconColor="#0061AF"
              iconSize="11px"
              name={b.accountName}
              cat={b.institution ?? "—"}
              right={
                <div className="text-[13px] font-bold">
                  {money.format(b.balance)}
                </div>
              }
              last={i === banks.length - 1}
            />
          ))
        ) : (
          <div className="py-4 text-center text-[12px] text-muted-foreground">
            {t.laporan.bank.emptyAccounts}
          </div>
        )}
      </SectionCard>
      {banks.length > 0 && (
        <SectionCard title={t.laporan.bank.inOutTitle}>
          <div className="flex flex-col gap-2.5">
            {banks.map((b, i) => (
              <BarRow
                key={b.accountName}
                label={b.accountName}
                right={
                  <>
                    <span className="font-bold text-success">
                      +{formatJuta(b.income)}
                    </span>
                    <span className="font-bold text-destructive">
                      -{formatJuta(b.expense)}
                    </span>
                  </>
                }
                value={
                  maxIncome > 0 ? Math.round((b.income / maxIncome) * 100) : 0
                }
                color={BANK_COLORS[i % BANK_COLORS.length] ?? "var(--primary)"}
              />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
