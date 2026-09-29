import type { ReactNode } from "react";

export type TransactionSummaryItem = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  detail?: ReactNode;
  detailClassName?: string;
};

export function TransactionSummary({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: TransactionSummaryItem[];
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="rounded-xl border border-border bg-card p-3 text-card-foreground sm:p-4"
    >
      <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/60 pb-2 last:border-b-0 last:pb-0 sm:block sm:border-0 sm:p-0"
          >
            <div className="text-xs font-medium text-muted-foreground">
              {item.label}
            </div>
            <div
              className={`mono min-w-0 break-words text-right text-sm font-extrabold sm:mt-1 sm:text-left ${item.valueClassName ?? ""}`}
            >
              {item.value}
            </div>
            {item.detail && (
              <div
                className={`w-full text-[11px] font-semibold sm:mt-1 ${item.detailClassName ?? "text-muted-foreground"}`}
              >
                {item.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
