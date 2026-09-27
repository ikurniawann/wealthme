"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useLocale } from "@/hooks/use-locale";
import { Button } from "@/components/ui/button";
import { AdvancedDisclosure } from "@/components/crud/advanced-disclosure";
import { formatNumber, formatRupiah, parseRupiah } from "@/lib/format";
import {
  useSaveUmkmYear,
  useUmkmPreview,
  useUmkmYear,
} from "@/components/tax/use-tax-api";

import { extractApiErrorMessage } from "./api-error";
import { MAX_TAX_INPUT, toClampedDigitString } from "./digits";
import { useReportTaxRules } from "./tax-rules-context";

import type { UmkmPreviewRequestDto } from "@wealthme/contracts";

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

// Task 10 (sub-plan L) — the UMKM 0.5% final-tax monthly-omzet calculator.
// The web never recomputes the tax itself: every number rendered comes from
// `UmkmResultDto` (the shared BE engine's preview), this component only
// owns the 12 monthly-input strings + the optional first-registered-year.
export function UmkmPanel({
  taxYear,
  canManage,
}: {
  taxYear: number;
  canManage: boolean;
}) {
  const { t } = useLocale();
  const { data: saved } = useUmkmYear(taxYear);
  const [omzet, setOmzet] = useState<string[]>(() => Array(12).fill(""));
  const [firstYear, setFirstYear] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  // Prefill once from the saved row, never overwriting what the user is
  // already typing (mirrors `page.tsx`'s own `zakatTouched` pattern).
  useEffect(() => {
    if (prefilled || !saved) return;
    // Syncing local input state from a server-fetched query result (an
    // external system), not deriving it from other React state — same
    // pattern as `page.tsx`'s own `zakatTouched` effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOmzet(saved.months.map((m) => formatNumber(Number(m.omzet))));
    setFirstYear(
      saved.firstRegisteredYear ? String(saved.firstRegisteredYear) : "",
    );
    setPrefilled(true);
  }, [saved, prefilled]);

  // Task 9's TER panel set the precedent here (its own monthly-gross array
  // is likewise not debounced, flagged as a real-but-minor UX gap rather
  // than fixed): debouncing an array-valued request needs a
  // stringify/debounce/parse round trip, and every keystroke firing its own
  // preview request is a cosmetic/perf issue, not a correctness one — the
  // server is still the only thing that computes a tax number.
  const request: UmkmPreviewRequestDto = useMemo(
    () => ({
      taxYear,
      monthlyOmzet: omzet.map((v) => toClampedDigitString(v, MAX_TAX_INPUT)),
      firstRegisteredYear: firstYear === "" ? null : Number(firstYear),
    }),
    [taxYear, omzet, firstYear],
  );

  const {
    data: result,
    isPending: isResultPending,
    isError: isResultError,
  } = useUmkmPreview(request);
  useReportTaxRules("umkm", result?.rules ?? []);
  const saveMutation = useSaveUmkmYear();
  const isOmzetEmpty = omzet.every((v) => v === "" || v === "0");
  const hasSavedData = !!saved && saved.months.some((m) => Number(m.omzet) > 0);

  function updateMonth(idx: number, value: string) {
    const digits =
      value === ""
        ? ""
        : formatNumber(Math.min(parseRupiah(value), MAX_TAX_INPUT));
    setOmzet((prev) => prev.map((v, i) => (i === idx ? digits : v)));
  }

  function handleSave() {
    saveMutation.mutate(
      { year: taxYear, dto: request },
      {
        onSuccess: () => toast.success(t.tax.umkm.saved),
        onError: (err) =>
          toast.error(extractApiErrorMessage(err, t.tax.umkm.saveFailed)),
      },
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="text-xs text-muted-foreground">{t.tax.umkm.subtitle}</div>

      <AdvancedDisclosure
        label={t.tax.umkm.disclosureLabel}
        defaultOpen={hasSavedData}
      >
        {/* Step 0 (taste-skill) — a compact 12-cell grid: 3×4 at 1440,
            2×6 at 390, not a 12-row form. */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {MONTHS.map((idx) => (
            <div className="field" key={idx}>
              <label htmlFor={`umkm-month-${idx}`} className="label">
                {t.tax.umkm.monthLabels[idx]}
              </label>
              <input
                id={`umkm-month-${idx}`}
                type="text"
                inputMode="numeric"
                value={omzet[idx] ?? ""}
                onChange={(e) => updateMonth(idx, e.target.value)}
                className="input"
              />
            </div>
          ))}
        </div>

        <div className="field">
          <label htmlFor="umkm-first-year" className="label">
            {t.tax.umkm.firstYearLabel}
          </label>
          <input
            id="umkm-first-year"
            type="text"
            inputMode="numeric"
            value={firstYear}
            onChange={(e) =>
              setFirstYear(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            className="input"
          />
          {/* Always shown, per PP 55/2022 Pasal 59 ayat 2 — explains the
              7-year clock to anyone registered before 2018, whether or not
              they filled the field in above. */}
          <div className="hint">{t.tax.umkm.pre2018Note}</div>
        </div>

        <div className="notice notice--info">{t.tax.umkm.noTimeLimitNote}</div>
        {result?.exceedsCeiling && (
          <div className="notice notice--warning">
            {t.tax.umkm.exceedsCeiling}
          </div>
        )}

        {isOmzetEmpty ? (
          <div className="notice notice--info">{t.tax.umkm.emptyStateNote}</div>
        ) : isResultError ? (
          <div className="notice notice--warning">
            {t.tax.umkm.loadFailedLabel}
          </div>
        ) : isResultPending ? (
          <div className="hint">{t.tax.umkm.loadingLabel}</div>
        ) : (
          result && (
            <div className="table-wrap">
              <table className="table table--num">
                <thead>
                  <tr>
                    <th></th>
                    <th>{t.tax.umkm.colOmzet}</th>
                    <th>{t.tax.umkm.colCumulative}</th>
                    <th>{t.tax.umkm.colTaxable}</th>
                    <th>{t.tax.umkm.colTax}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.months.map((row) => (
                    <tr key={row.month}>
                      <td>{t.tax.umkm.monthLabels[row.month - 1]}</td>
                      <td className="mono">
                        {formatRupiah(Number(row.omzet))}
                      </td>
                      <td className="mono">
                        {formatRupiah(Number(row.cumulative))}
                      </td>
                      <td className="mono">
                        {formatRupiah(Number(row.taxable))}
                      </td>
                      <td className="mono">
                        {row.tax === null ? (
                          <span className="text-warning">
                            {t.tax.umkm.ineligible}
                          </span>
                        ) : (
                          formatRupiah(Number(row.tax))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>{t.tax.umkm.totalPrefix}</td>
                    <td className="mono">
                      {formatRupiah(Number(result.totalTax))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        )}
      </AdvancedDisclosure>

      <Button
        onClick={handleSave}
        disabled={!canManage || saveMutation.isPending}
        className="h-auto px-4 py-2.5"
      >
        {t.tax.umkm.save}
      </Button>
    </div>
  );
}
