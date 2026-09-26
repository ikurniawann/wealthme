"use client";

import { useState } from "react";

import { useLocale } from "@/hooks/use-locale";
import { formatNumber, formatRupiah, parseRupiah } from "@/lib/format";
import { formatBps } from "@/components/tax/format-bps";
import { useTaxSession, useTerPreview } from "@/components/tax/use-tax-api";

import { MAX_TAX_INPUT, toClampedDigitString } from "./digits";
import { useReportTaxRules } from "./tax-rules-context";

import type {
  DtpEmployment,
  DtpReason,
  DtpSector,
  TaxMaritalStatus,
  TerMonthDto,
} from "@wealthme/contracts";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const SECTOR_OPTIONS: (DtpSector | "none")[] = [
  "none",
  "alas_kaki",
  "tekstil_pakaian",
  "furnitur",
  "kulit",
  "pariwisata",
];

function isApiError(e: unknown): e is { status: number; message: string } {
  return !!e && typeof e === "object" && "status" in e;
}

// Task 9 (sub-plan L) — monthly PPh 21 TER withholding + the December
// Pasal 17 true-up, plus the PPh 21 DTP incentive fieldset. Status and
// dependents are owned by the calculator above (one source of truth); this
// panel only owns the monthly-gross schedule and the DTP inputs.
export function TerPanel({
  taxYear,
  maritalStatus,
  dependents,
  defaultMonthlyGross,
}: {
  taxYear: number;
  maritalStatus: TaxMaritalStatus;
  dependents: number;
  defaultMonthlyGross: string;
}) {
  const { t } = useLocale();
  const { fgId } = useTaxSession();
  const [editMonths, setEditMonths] = useState(false);
  const [singleGross, setSingleGross] = useState(
    formatNumber(Number(defaultMonthlyGross)),
  );
  const [monthGrosses, setMonthGrosses] = useState<string[]>(() =>
    MONTHS.map(() => formatNumber(Number(defaultMonthlyGross))),
  );
  const [sector, setSector] = useState<DtpSector | "none">("none");
  const [employment, setEmployment] = useState<DtpEmployment>("permanent");
  const [dailyWage, setDailyWage] = useState("");
  const [nikValidated, setNikValidated] = useState(false);

  const monthlyGross = editMonths
    ? monthGrosses.map((g) => toClampedDigitString(g, MAX_TAX_INPUT))
    : MONTHS.map(() => toClampedDigitString(singleGross, MAX_TAX_INPUT));

  const req = {
    taxYear,
    maritalStatus,
    dependents,
    monthlyGross,
    dtp: {
      sector: sector === "none" ? null : sector,
      employment,
      dailyWage:
        employment === "non_permanent" && dailyWage !== ""
          ? toClampedDigitString(dailyWage, MAX_TAX_INPUT)
          : null,
      nikValidated,
    },
  };

  // Task 10 carry (Task 9 review) — before any gross is entered, all 12
  // months are still "0"; skip the request entirely rather than show 12
  // rows of Rp 0 (an honest empty state instead).
  const isEmpty = monthlyGross.every((g) => g === "0");
  const {
    data: result,
    error,
    isError,
    isFetching,
  } = useTerPreview(!fgId || isEmpty ? null : req);
  const notApplicable = isError && isApiError(error) && error.status === 422;
  useReportTaxRules("ter", result?.rules ?? []);

  function renderDtpCell(row: TerMonthDto) {
    if (!row.dtp) return "—";
    if (row.dtp.eligible) {
      return (
        <>
          <div className="mono">{formatRupiah(Number(row.dtp.amount))}</div>
          <div className="text-[10px] text-muted-foreground">
            {t.tax.ter.dtpEligible}
          </div>
        </>
      );
    }
    return row.dtp.reasons[0]
      ? t.tax.ter.dtpReasons[row.dtp.reasons[0] as DtpReason]
      : "—";
  }

  function updateMonth(idx: number, value: string) {
    const digits =
      value === ""
        ? ""
        : formatNumber(Math.min(parseRupiah(value), MAX_TAX_INPUT));
    setMonthGrosses((prev) => prev.map((g, i) => (i === idx ? digits : g)));
  }

  return (
    <div className="space-y-4">
      <div className="field">
        <label htmlFor="ter-monthly-gross" className="label">
          {t.tax.ter.monthlyGrossLabel}
        </label>
        <input
          id="ter-monthly-gross"
          type="text"
          inputMode="numeric"
          value={singleGross}
          disabled={editMonths}
          onChange={(e) =>
            setSingleGross(
              e.target.value === ""
                ? ""
                : formatNumber(
                    Math.min(parseRupiah(e.target.value), MAX_TAX_INPUT),
                  ),
            )
          }
          className="input disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setEditMonths((v) => !v)}
          className="hint text-primary hover:underline"
        >
          {t.tax.ter.editMonthsToggle}
        </button>
      </div>

      {editMonths && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {MONTHS.map((m, idx) => (
            <div className="field" key={m}>
              <label htmlFor={`ter-month-${m}`} className="label">
                {m}
              </label>
              <input
                id={`ter-month-${m}`}
                type="text"
                inputMode="numeric"
                value={monthGrosses[idx]}
                onChange={(e) => updateMonth(idx, e.target.value)}
                className="input"
              />
            </div>
          ))}
        </div>
      )}

      <fieldset className="rounded-[12px] border border-border p-3.5">
        <legend className="mb-2 text-[12.5px] font-semibold">
          {t.tax.ter.dtpTitle}
        </legend>
        <div className="tax-calculator-grid grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div className="field">
            <label htmlFor="ter-dtp-sector" className="label">
              {t.tax.ter.dtpSectorLabel}
            </label>
            <select
              id="ter-dtp-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value as DtpSector | "none")}
              className="select"
            >
              {SECTOR_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {t.tax.ter.dtpSectors[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="label">{t.tax.ter.dtpEmploymentLabel}</span>
            <div className="flex items-center gap-4 pt-0.5">
              <label className="flex items-center gap-1.5 text-[13px]">
                <input
                  type="radio"
                  name="ter-dtp-employment"
                  checked={employment === "permanent"}
                  onChange={() => setEmployment("permanent")}
                  className="accent-primary"
                />
                {t.tax.ter.dtpEmployment.permanent}
              </label>
              <label className="flex items-center gap-1.5 text-[13px]">
                <input
                  type="radio"
                  name="ter-dtp-employment"
                  checked={employment === "non_permanent"}
                  onChange={() => setEmployment("non_permanent")}
                  className="accent-primary"
                />
                {t.tax.ter.dtpEmployment.non_permanent}
              </label>
            </div>
          </div>
          {employment === "non_permanent" && (
            <div className="field">
              <label htmlFor="ter-daily-wage" className="label">
                {t.tax.ter.dtpDailyWageLabel}
              </label>
              <input
                id="ter-daily-wage"
                type="text"
                inputMode="numeric"
                value={dailyWage}
                onChange={(e) =>
                  setDailyWage(
                    e.target.value === ""
                      ? ""
                      : formatNumber(
                          Math.min(parseRupiah(e.target.value), MAX_TAX_INPUT),
                        ),
                  )
                }
                className="input"
              />
            </div>
          )}
          {/* Task 10 carry — full-width regardless of whether the daily-wage
              field beside it is rendered, so this never becomes an orphan
              half row when `employment === "permanent"`. */}
          <div className="field flex items-center gap-2 pt-5 md:col-span-2">
            <input
              id="ter-dtp-nik"
              type="checkbox"
              checked={nikValidated}
              onChange={(e) => setNikValidated(e.target.checked)}
              className="size-4 accent-primary"
            />
            <label htmlFor="ter-dtp-nik" className="text-[13px]">
              {t.tax.ter.dtpNikLabel}
            </label>
          </div>
        </div>
      </fieldset>

      {maritalStatus === "KI" && <div className="hint">{t.tax.ter.kiNote}</div>}

      {!fgId ? (
        <div className="notice notice--info">{t.tax.ter.noFamilyNote}</div>
      ) : isEmpty ? (
        <div className="notice notice--info">{t.tax.ter.emptyStateNote}</div>
      ) : notApplicable ? (
        <div className="notice notice--info">{t.tax.ter.notApplicable}</div>
      ) : isFetching && !result ? (
        <div className="hint">{t.tax.ter.loadingLabel}</div>
      ) : (
        result && (
          <div className="table-wrap">
            <div className="mb-2 text-[12.5px] text-muted-foreground">
              {t.tax.ter.categoryPrefix}
              <strong>{result.category}</strong>
            </div>
            <table className="table table--num">
              <thead>
                <tr>
                  <th>{t.tax.ter.colMonth}</th>
                  <th>{t.tax.ter.colGross}</th>
                  <th>{t.tax.ter.colRate}</th>
                  <th>{t.tax.ter.colWithheld}</th>
                  <th>{t.tax.ter.colDtp}</th>
                </tr>
              </thead>
              <tbody>
                {result.months.map((row) => {
                  const isDecember = row.month === 12;
                  const withheldNum = Number(row.withholding);
                  const isNegative = withheldNum < 0;
                  return (
                    <tr key={row.month}>
                      <td>
                        {isDecember ? t.tax.ter.decemberLabel : row.month}
                      </td>
                      <td className="mono">
                        {formatRupiah(Number(row.gross))}
                      </td>
                      <td>{formatBps(row.rateBps)}</td>
                      <td className={isNegative ? "mono text-success" : "mono"}>
                        {isNegative
                          ? `(${formatRupiah(Math.abs(withheldNum))})`
                          : formatRupiah(withheldNum)}
                      </td>
                      <td>{renderDtpCell(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>{t.tax.ter.dtpTotalPrefix}</td>
                  <td className="mono">
                    {formatRupiah(Number(result.dtpTotal))}
                  </td>
                </tr>
              </tfoot>
            </table>
            {result.isRefund && (
              <div className="hint">{t.tax.ter.refundNote}</div>
            )}
          </div>
        )
      )}
    </div>
  );
}
