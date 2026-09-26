"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { LiabilityFloatingRateDto } from "@wealthme/contracts";

import { useLocale } from "@/hooks/use-locale";
import type { Locale } from "@/i18n";
import { apiFetch } from "@/lib/api-client";
import { DateField } from "@/components/wm";

import { extractApiErrorMessage } from "./api-error";

function formatDay(isoDate: string, locale: Locale): string {
  const [year = 1970, month = 1, day = 1] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(
    locale === "id" ? "id-ID" : "en-US",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

export function KprFloatingRatesPanel({
  familyGroupId,
  liabilityId,
  token,
  onChanged,
}: {
  familyGroupId: string;
  liabilityId: string;
  token: string | undefined;
  onChanged: () => void;
}) {
  const { t, locale } = useLocale();
  const k = t.liabilitas.kpr;
  const [effectiveDate, setEffectiveDate] = useState("");
  const [ratePercent, setRatePercent] = useState("");
  const path = `/family-groups/${familyGroupId}/liabilities/${liabilityId}/floating-rates`;

  const ratesQuery = useQuery<LiabilityFloatingRateDto[]>({
    queryKey: ["liabilities", familyGroupId, "floating-rates", liabilityId],
    queryFn: ({ signal }) =>
      apiFetch<LiabilityFloatingRateDto[]>(path, { token, signal }),
    enabled: Boolean(token),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      apiFetch<LiabilityFloatingRateDto>(path, {
        method: "POST",
        token,
        body: JSON.stringify({
          effectiveDate,
          ratePercent: ratePercent.trim().replace(",", "."),
        }),
      }),
    onSuccess: () => {
      setEffectiveDate("");
      setRatePercent("");
      toast.success(k.historySaved);
      onChanged();
    },
    onError: (err: unknown) =>
      toast.error(extractApiErrorMessage(err, k.historySaveFailed)),
  });

  const deleteMutation = useMutation({
    mutationFn: (rateId: string) =>
      apiFetch<void>(`${path}/${rateId}`, { method: "DELETE", token }),
    onSuccess: () => {
      toast.success(k.historyDeleted);
      onChanged();
    },
    onError: (err: unknown) =>
      toast.error(extractApiErrorMessage(err, k.historySaveFailed)),
  });

  const canAdd = Boolean(effectiveDate && ratePercent.trim());
  const rates = ratesQuery.data ?? [];

  return (
    <section
      className="rounded-lg border p-3.5"
      aria-labelledby="kpr-floating-title"
    >
      <div id="kpr-floating-title" className="mb-1 text-[12.5px] font-bold">
        {k.historyTitle}
      </div>
      <div className="hint mt-0">{k.historyHint}</div>

      {ratesQuery.isError ? (
        <div className="mt-2 text-[12px] text-destructive">
          {k.historyLoadFailed}
        </div>
      ) : rates.length === 0 ? (
        <div className="mt-2 text-[12px] text-muted-foreground">
          {ratesQuery.isLoading ? "…" : k.historyEmpty}
        </div>
      ) : (
        <ul className="mt-2 divide-y">
          {rates.map((rate) => (
            <li
              key={rate.id}
              className="flex items-center justify-between py-1.5 text-[12.5px]"
            >
              <span>
                <span className="mono font-semibold">{rate.ratePercent}%</span>
                {" · "}
                {formatDay(rate.effectiveDate, locale)}
                {rate.effectivePeriod !== null && (
                  <span className="t-muted">
                    {" · "}
                    {k.historyFromPeriodPrefix}
                    {rate.effectivePeriod}
                  </span>
                )}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                aria-label={`${k.historyDeleteButton} ${rate.effectiveDate}`}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(rate.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="field-row mt-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (canAdd) addMutation.mutate();
        }}
      >
        <div className="field mt-0">
          <label className="label" htmlFor="kpr-floating-date">
            {k.historyDateLabel}
          </label>
          <DateField
            id="kpr-floating-date"
            value={effectiveDate}
            locale={locale}
            label={k.historyDateLabel}
            onChange={setEffectiveDate}
          />
        </div>
        <div className="field mt-0">
          <label className="label" htmlFor="kpr-floating-rate">
            {k.historyRateLabel}
          </label>
          <input
            id="kpr-floating-rate"
            className="input mono"
            inputMode="decimal"
            value={ratePercent}
            onChange={(e) => setRatePercent(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn--outline btn--sm"
          disabled={!canAdd || addMutation.isPending}
        >
          {k.historyAddButton}
        </button>
      </form>
    </section>
  );
}
