import { BentoCard } from "@/components/wm";
import { useMoney } from "@/hooks/use-money";
import { useLocale } from "@/hooks/use-locale";
import type { BankReportDto } from "@wealthme/contracts";
import "./sections-a.css";

/* ───────────────────────── Section: Bank ───────────────────────── */

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
  const maxTotal = Math.max(...banks.map((b) => b.income + b.expense), 1);

  return (
    <div className={"space-y-3.5 " + loadingClass}>
      <BentoCard title={t.laporan.bank.balancePerAccountTitle}>
        {banks.length > 0 ? (
          banks.map((b) => (
            <div key={b.accountName} className="lap-a-bank-row">
              <span className="lap-a-bank-chip" aria-hidden="true">
                {b.institution?.slice(0, 3).toUpperCase() ??
                  b.accountName.slice(0, 3).toUpperCase()}
              </span>
              <span className="lap-a-bank-meta">
                <span className="lap-a-bank-name">{b.accountName}</span>
                <span className="lap-a-bank-sub">{b.institution ?? "—"}</span>
              </span>
              <span className="lap-a-bank-balance">
                {money.format(b.balance)}
              </span>
            </div>
          ))
        ) : (
          <div className="lap-a-empty">
            <b>{t.laporan.bank.emptyAccounts}</b>
          </div>
        )}
      </BentoCard>
      {banks.length > 0 && (
        <BentoCard title={t.laporan.bank.inOutTitle}>
          {banks.map((b) => {
            const inPct = (b.income / maxTotal) * 100;
            const outPct = (b.expense / maxTotal) * 100;
            return (
              <div key={b.accountName} className="lap-a-bank-inout">
                <div className="lap-a-bank-inout-head">
                  <span className="lap-a-bank-inout-name">{b.accountName}</span>
                  <span className="lap-a-bank-inout-amt">
                    <span style={{ color: "var(--wm-lime)" }}>
                      +{money.formatCompact(b.income)}
                    </span>{" "}
                    <span style={{ color: "var(--wm-orange)" }}>
                      -{money.formatCompact(b.expense)}
                    </span>
                  </span>
                </div>
                <div
                  className="lap-a-bank-inout-bar"
                  role="img"
                  aria-label={`${b.accountName}: ${t.common.income} ${money.format(b.income)}, ${t.common.expense} ${money.format(b.expense)}`}
                >
                  <i
                    style={{ width: `${inPct}%`, background: "var(--wm-lime)" }}
                  />
                  <i
                    style={{
                      width: `${outPct}%`,
                      background: "var(--wm-orange)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </BentoCard>
      )}
    </div>
  );
}
