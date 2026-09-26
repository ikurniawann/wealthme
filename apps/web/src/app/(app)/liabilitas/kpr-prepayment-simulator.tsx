"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  FxInput,
  LiabilityPrepaymentPreviewDto,
  LiabilityPrepaymentRecordResultDto,
  PrepaymentMode,
  RecordLiabilityPrepaymentDto,
} from "@wealthme/contracts";

import {
  MoneyInput,
  moneyDigits,
  useControlledMoneyField,
} from "@/components/money";
import type { MoneyField, ResolvedMoney } from "@/components/money";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import { extractApiErrorMessage } from "./api-error";
import { DEFAULT_PREPAYMENT_PENALTY_PERCENT } from "./kpr-presets";

const MODES: readonly PrepaymentMode[] = [
  "reduce_tenor",
  "reduce_installment",
  "full",
];

type AccountOption = { id: string; name: string; institution: string | null };
type PrepaymentRequest = Pick<
  RecordLiabilityPrepaymentDto,
  "mode" | "amount" | "penaltyPercent"
>;
// The API DTO doesn't carry `fxInputs` (see other pages' *WithFx locals,
// e.g. asuransi/page.tsx) — the server converts and overwrites `amount`.
type RecordPrepaymentWithFx = RecordLiabilityPrepaymentDto & {
  fxInputs?: FxInput[];
};

function rupiah(value: string | null): string {
  return value === null ? "—" : formatRupiah(Number(value));
}

function toSearch(request: PrepaymentRequest): string {
  const params = new URLSearchParams({
    mode: request.mode,
    penaltyPercent:
      request.penaltyPercent ?? DEFAULT_PREPAYMENT_PENALTY_PERCENT,
  });
  if (request.amount !== undefined) params.set("amount", request.amount);
  return params.toString();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="t-xs t-muted">{label}</dt>
      <dd className="mono text-[13.5px] font-bold">{value}</dd>
    </div>
  );
}

export function KprPrepaymentSimulator({
  familyGroupId,
  liabilityId,
  token,
  onRecorded,
  makeIdempotencyKey = () => crypto.randomUUID(),
}: {
  familyGroupId: string;
  liabilityId: string;
  token: string | undefined;
  onRecorded: () => void;
  makeIdempotencyKey?: () => string;
}) {
  const { t } = useLocale();
  const k = t.liabilitas.kpr;
  const [mode, setMode] = useState<PrepaymentMode>("reduce_tenor");
  const [amountState, setAmountState] = useState<{
    raw: string;
    currency: MoneyField["currency"] | null;
  }>({ raw: "", currency: null });
  const amountField = useControlledMoneyField({
    raw: amountState.raw,
    currency: amountState.currency,
    onChange: (next) => {
      setAmountState(next);
      setSimulated(null);
      setConfirming(false);
    },
  });
  const [penaltyPercent, setPenaltyPercent] = useState(
    DEFAULT_PREPAYMENT_PENALTY_PERCENT,
  );
  // The request the shown result was computed for, the fx origin (if any) of
  // its amount, and the key that records it at most once.
  const [simulated, setSimulated] = useState<{
    request: PrepaymentRequest;
    fx: ResolvedMoney["fx"];
    idempotencyKey: string;
  } | null>(null);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [confirming, setConfirming] = useState(false);

  const base = `/family-groups/${familyGroupId}/liabilities/${liabilityId}`;
  const search = simulated ? toSearch(simulated.request) : null;

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
        `${base}/prepayment-preview?${search ?? ""}`,
        { token, signal },
      ),
    enabled: Boolean(token && search),
    retry: false,
  });
  const result = previewQuery.data;

  const accountsQuery = useQuery<AccountOption[]>({
    queryKey: queryKeys.accounts.all(familyGroupId),
    queryFn: ({ signal }) =>
      apiFetch<AccountOption[]>(`/family-groups/${familyGroupId}/accounts`, {
        token,
        signal,
      }),
    enabled: Boolean(token && result),
  });

  const recordMutation = useMutation({
    mutationFn: (body: RecordPrepaymentWithFx) =>
      apiFetch<LiabilityPrepaymentRecordResultDto>(`${base}/prepay`, {
        method: "POST",
        token,
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success(k.recordSaved);
      setConfirming(false);
      setSimulated(null);
      onRecorded();
    },
    onError: (err: unknown) =>
      toast.error(extractApiErrorMessage(err, k.recordFailed)),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = mode === "full" ? "" : moneyDigits(amountField);
    // Pending guard — a foreign amount whose IDR conversion hasn't resolved
    // yet can't be simulated against a rate we don't have.
    if (mode !== "full" && (!digits || amountField.resolved.isPending)) {
      return;
    }
    setConfirming(false);
    setSimulated({
      request: {
        mode,
        penaltyPercent: penaltyPercent.trim().replace(",", "."),
        ...(mode === "full" ? {} : { amount: digits }),
      },
      fx: mode === "full" ? null : amountField.resolved.fx,
      idempotencyKey: makeIdempotencyKey(),
    });
  }

  function handleRecord() {
    if (!simulated || !sourceAccountId || recordMutation.isPending) return;
    recordMutation.mutate({
      ...simulated.request,
      sourceAccountId,
      idempotencyKey: simulated.idempotencyKey,
      ...(simulated.fx
        ? { fxInputs: [{ field: "amount", ...simulated.fx }] }
        : {}),
    });
  }

  // M1 — the shown result (and any open confirmation) is only valid for the
  // request it was simulated for. Any input change invalidates it, so
  // "Catat pelunasan" can never record a stale mode/amount/penalty.
  function updateMode(next: PrepaymentMode) {
    setMode(next);
    setSimulated(null);
    setConfirming(false);
  }
  function updatePenaltyPercent(next: string) {
    setPenaltyPercent(next);
    setSimulated(null);
    setConfirming(false);
  }

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
          <legend className="label" id="kpr-prepay-mode-label">
            {k.prepayModeLabel}
          </legend>
          <div
            className="segmented flex w-full"
            role="radiogroup"
            aria-labelledby="kpr-prepay-mode-label"
          >
            {MODES.map((m, index) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                tabIndex={mode === m ? 0 : -1}
                className="segmented__item flex-1"
                onClick={() => updateMode(m)}
                onKeyDown={(e) => {
                  if (
                    e.key !== "ArrowRight" &&
                    e.key !== "ArrowLeft" &&
                    e.key !== "ArrowDown" &&
                    e.key !== "ArrowUp"
                  ) {
                    return;
                  }
                  e.preventDefault();
                  const delta =
                    e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
                  const next =
                    MODES[(index + delta + MODES.length) % MODES.length];
                  if (next) updateMode(next);
                  (
                    e.currentTarget
                      .closest('[role="radiogroup"]')
                      ?.querySelectorAll('[role="radio"]')[
                      (index + delta + MODES.length) % MODES.length
                    ] as HTMLElement | undefined
                  )?.focus();
                }}
              >
                {k.prepayModes[m]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="field-row mt-2">
          {mode !== "full" && (
            <div className="field mt-0">
              <label className="label" htmlFor="kpr-prepay-amount">
                {k.prepayAmountLabel}
              </label>
              <MoneyInput id="kpr-prepay-amount" field={amountField} />
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
              onChange={(e) => updatePenaltyPercent(e.target.value)}
            />
          </div>
        </div>
        <div className="hint" id="kpr-prepay-penalty-hint">
          {k.prepayPenaltyHint}
        </div>
        <button
          type="submit"
          className="btn btn--outline btn--sm mt-2"
          disabled={mode !== "full" && amountField.resolved.isPending}
        >
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
          {result.mode === "reduce_tenor" &&
            result.assumesCurrentFloatingRate && (
              <div className="hint">{k.prepayReduceTenorNextTierNote}</div>
            )}

          <div className="mt-3 rounded-lg border p-3">
            <div className="field mt-0">
              <label className="label" htmlFor="kpr-prepay-account">
                {k.recordAccountLabel}
              </label>
              <select
                id="kpr-prepay-account"
                className="select"
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
              >
                <option value="">{k.recordAccountPlaceholder}</option>
                {(accountsQuery.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.institution ? `${a.name} · ${a.institution}` : a.name}
                  </option>
                ))}
              </select>
            </div>
            {confirming ? (
              <div className="notice notice--warning mt-2" role="alert">
                <span>
                  {k.recordConfirmPrefix}
                  <strong className="mono">{rupiah(result.cashOutNow)}</strong>
                  {k.recordConfirmBreakdown}
                </span>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={recordMutation.isPending}
                    onClick={handleRecord}
                  >
                    {k.recordConfirmButton}
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    disabled={recordMutation.isPending}
                    onClick={() => setConfirming(false)}
                  >
                    {k.recordCancelButton}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--sm mt-2"
                disabled={!sourceAccountId}
                onClick={() => setConfirming(true)}
              >
                {k.recordButton}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
