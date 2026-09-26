"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  LiabilityPrepaymentPreviewDto,
  PrepaymentMode,
} from "@wealthme/contracts";

import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput, formatRupiah } from "@/lib/format";

import { extractApiErrorMessage } from "./api-error";
import { DEFAULT_PREPAYMENT_PENALTY_PERCENT } from "./kpr-presets";

const MODES: readonly PrepaymentMode[] = [
  "reduce_tenor",
  "reduce_installment",
  "full",
];

function rupiah(value: string | null): string {
  return value === null ? "—" : formatRupiah(Number(value));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="t-xs t-muted">{label}</dt>
      <dd className="mono text-[13.5px] font-bold">{value}</dd>
    </div>
  );
}

// The amount is IDR-only on purpose: a read-only simulation of an IDR loan (see revisi-k plan, Global Constraints).
export function KprPrepaymentSimulator({
  familyGroupId,
  liabilityId,
  token,
}: {
  familyGroupId: string;
  liabilityId: string;
  token: string | undefined;
}) {
  const { t } = useLocale();
  const k = t.liabilitas.kpr;
  const [mode, setMode] = useState<PrepaymentMode>("reduce_tenor");
  const [amount, setAmount] = useState("");
  const [penaltyPercent, setPenaltyPercent] = useState(
    DEFAULT_PREPAYMENT_PENALTY_PERCENT,
  );
  const [search, setSearch] = useState<string | null>(null);

  const previewQuery = useQuery<LiabilityPrepaymentPreviewDto>({
    queryKey: [
      "liabilities",
      familyGroupId,
      "prepayment-preview",
      liabilityId,
      search,
    ],
    queryFn: ({ signal }) =>
      apiFetch<LiabilityPrepaymentPreviewDto>(
        `/family-groups/${familyGroupId}/liabilities/${liabilityId}/prepayment-preview?${search ?? ""}`,
        { token, signal },
      ),
    enabled: Boolean(token && search),
    retry: false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({
      mode,
      penaltyPercent: penaltyPercent.trim().replace(",", "."),
    });
    if (mode !== "full") {
      const digits = amount.replace(/\D/g, "");
      if (!digits) return;
      params.set("amount", digits);
    }
    setSearch(params.toString());
  }

  const result = previewQuery.data;

  return (
    <section
      className="rounded-lg border p-3.5"
      aria-labelledby="kpr-prepay-title"
    >
      <div id="kpr-prepay-title" className="mb-1 text-[12.5px] font-bold">
        {k.prepayTitle}
      </div>
      <div className="notice notice--info">{k.prepaySimulationNote}</div>

      <form className="mt-2" onSubmit={handleSubmit}>
        <fieldset className="field mt-0">
          <legend className="label">{k.prepayModeLabel}</legend>
          <div className="segmented">
            {MODES.map((m) => (
              <label key={m} className="segmented__item">
                <input
                  type="radio"
                  name="kpr-prepay-mode"
                  value={m}
                  checked={mode === m}
                  onChange={() => setMode(m)}
                />{" "}
                {k.prepayModes[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field-row mt-2">
          {mode !== "full" && (
            <div className="field mt-0">
              <label className="label" htmlFor="kpr-prepay-amount">
                {k.prepayAmountLabel}
              </label>
              <input
                id="kpr-prepay-amount"
                className="input mono"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              />
            </div>
          )}
          <div className="field mt-0">
            <label className="label" htmlFor="kpr-prepay-penalty">
              {k.prepayPenaltyLabel}
            </label>
            <input
              id="kpr-prepay-penalty"
              className="input mono"
              inputMode="decimal"
              aria-describedby="kpr-prepay-penalty-hint"
              value={penaltyPercent}
              onChange={(e) => setPenaltyPercent(e.target.value)}
            />
          </div>
        </div>
        <div className="hint" id="kpr-prepay-penalty-hint">
          {k.prepayPenaltyHint}
        </div>
        <button type="submit" className="btn btn--outline btn--sm mt-2">
          {k.prepaySubmit}
        </button>
      </form>

      {previewQuery.isError && (
        <div className="mt-2 text-[12px] text-destructive">
          {extractApiErrorMessage(previewQuery.error, k.prepayFailed)}
        </div>
      )}
      {result && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-muted p-3.5">
            <Stat
              label={k.prepayResultPenalty}
              value={rupiah(result.penalty)}
            />
            <Stat
              label={k.prepayResultCashOut}
              value={rupiah(result.cashOutNow)}
            />
            <Stat
              label={k.prepayResultInstallment}
              value={`${rupiah(result.installmentBefore)} → ${rupiah(result.installmentAfter)}`}
            />
            <Stat
              label={k.prepayResultTenor}
              value={`${result.remainingMonthsBefore} → ${result.remainingMonthsAfter}${k.prepayResultMonthsSuffix}`}
            />
            <Stat
              label={k.prepayResultInterestSaved}
              value={rupiah(result.interestSaved)}
            />
            <Stat
              label={k.prepayResultNetSaving}
              value={rupiah(result.netSaving)}
            />
          </dl>
          {result.assumesCurrentFloatingRate && (
            <div className="hint">{k.prepayEstimateNote}</div>
          )}
        </>
      )}
    </section>
  );
}
