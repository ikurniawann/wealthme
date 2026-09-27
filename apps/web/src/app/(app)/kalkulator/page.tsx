"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { toast } from "sonner";
import { SectionCard } from "@/components/wm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
// EPIC-025 N3-E2 — J3 FOLD: investment projection chart, pure client-side
// computation (same year-by-year compounding this tab already runs for the
// result card) — no fetch needed.
import { TrendChart } from "@/components/charts/apex-presets";
import { formatManualDate } from "@/components/consolidated-total-card";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  formatRupiah,
  parseRupiah,
  formatAmountInput,
  formatNumber,
} from "@/lib/format";
import type {
  Pph21ResultDto,
  RetirementCalcResultDto,
  ZakatResultDto,
} from "@wealthme/contracts";

// Sample participant names for the Split Group calculator preview —
// example data the user overwrites, not translatable UI copy.
const GROUP_NAMES = [
  "Andi",
  "Budi",
  "Citra",
  "Dani",
  "Eka",
  "Fani",
  "Gilang",
  "Hana",
  "Indra",
  "Joko",
];

type TabKey =
  | "zakat"
  | "pph21"
  | "investasi"
  | "kredit"
  | "pensiun"
  | "tabungan"
  | "splitgroup";

const TAB_KEYS: TabKey[] = [
  "zakat",
  "pph21",
  "investasi",
  "kredit",
  "pensiun",
  "tabungan",
  "splitgroup",
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

/* EPIC-025 N3 fidelity follow-up — every calculator now pairs its input
   card with a dedicated "Hasil" card (prototype's `grid--sidebar` 2-col
   layout). Kept as tabs (one calculator visible at a time) rather than
   stacking all calculators on one page: the prototype ALSO shows one panel
   at a time (`.calc-panel[hidden]` toggled by its own tab bar) — only the
   result placement (separate card vs inline) differed from the live app. */
function CalcLayout({ input, hasil }: { input: ReactNode; hasil: ReactNode }) {
  // EPIC-026 Wave 4 — prototype's `grid--sidebar` is 2fr/1fr
  // (app.css:748), not equal halves.
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      {input}
      {hasil}
    </div>
  );
}

function Headline({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: ReactNode;
}) {
  // EPIC-026 Wave 4 — prototype's Hasil headline is `t-2xl mono t-black
  // t-primary` (26px, kalkulator.html:89).
  return (
    <div>
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className="mono mt-0.5 text-[26px] font-black text-primary">
        {value}
      </div>
      {note && (
        <div className="mt-1.5 text-[12.5px] text-muted-foreground">{note}</div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  // EPIC-026 Wave 4 — prototype renders result details as borderless
  // `.table` rows separated by a bottom border (app.css:1725), not
  // rounded chips.
  return (
    <div className="flex items-center justify-between gap-2 border-b py-2.5 last:border-b-0">
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "mono text-[12.5px] font-bold text-right",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ResultCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-primary/30 bg-accent p-[18px] text-center">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[26px] font-black text-primary-strong">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function EmptyHasil({ note }: { note: string }) {
  return (
    <div className="flex h-full min-h-[140px] items-center justify-center rounded-md border border-dashed p-6 text-center text-[12.5px] text-muted-foreground">
      {note}
    </div>
  );
}

/* ─────────────────────────── Zakat Maal ─────────────────────────── */

// EPIC-025 N3 fidelity follow-up — deliberately KEPT as "Zakat Maal", not
// renamed/replaced with the prototype's "Perpuluhan" panel: `@wealthme/
// contracts`'s calculators module documents these as intentionally
// non-interchangeable (EPIC-023 F2/US-DON-6 — "its OWN arithmetic, not
// zakat relabelled"), and Perpuluhan already has its own real calculator
// on `/donation`. Renaming this tab to Perpuluhan would either duplicate
// that feature or silently swap zakat's nisab/haul-aware math (backed by
// `/calculators/zakat`) for an unrelated 10%-of-income rule — a functional
// regression the task's own "unless that would regress a tested behaviour"
// carve-out exists for.
function ZakatTab({ token }: { token: string | undefined }) {
  const { t, locale } = useLocale();
  const [cash, setCash] = useState("50.000.000");
  const [investments, setInvestments] = useState("30.000.000");
  const [gold, setGold] = useState("0");
  const [liabilities, setLiabilities] = useState("0");
  const [haulConfirmed, setHaulConfirmed] = useState(false);
  const [result, setResult] = useState<ZakatResultDto | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const {
    pricePerGram: familyGoldPrice,
    updatedAt: familyGoldPriceUpdatedAt,
    hasPrice: hasFamilyGoldPrice,
  } = useGoldPrice();

  async function handleCalculate() {
    if (!token) {
      toast.error(t.kalkulator.sessionExpired);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await apiFetch<ZakatResultDto>("/calculators/zakat", {
        method: "POST",
        token,
        signal: ctrl.signal,
        body: JSON.stringify({
          cash: parseRupiah(cash),
          investments: parseRupiah(investments),
          gold: parseRupiah(gold),
          liabilities: parseRupiah(liabilities),
          haulConfirmed,
          // E2 — nisab derives from the family's own gold price when set;
          // the BE falls back to an indicative constant when omitted.
          goldPricePerGram: hasFamilyGoldPrice
            ? (familyGoldPrice ?? undefined)
            : undefined,
        }),
      });
      if (!ctrl.signal.aborted) setResult(res);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(t.kalkulator.zakat.errorCalculate);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  const resultLabel = !result
    ? null
    : !result.meetsNisab
      ? t.kalkulator.zakat.resultNotObligated
      : result.isObligated
        ? t.kalkulator.zakat.resultObligated
        : t.kalkulator.zakat.resultEstimated;

  return (
    <CalcLayout
      input={
        <SectionCard title={t.kalkulator.zakat.cardTitle}>
          <div className="-mt-1 mb-3.5 text-[12px] text-muted-foreground">
            {t.kalkulator.zakat.nisabAutoNote}
          </div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label={t.kalkulator.zakat.fieldCash}>
              <input
                type="text"
                inputMode="numeric"
                value={cash}
                onChange={(e) => setCash(formatAmountInput(e.target.value))}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.zakat.fieldInvestments}>
              <input
                type="text"
                inputMode="numeric"
                value={investments}
                onChange={(e) =>
                  setInvestments(formatAmountInput(e.target.value))
                }
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.zakat.fieldGold}>
              <input
                type="text"
                inputMode="numeric"
                value={gold}
                onChange={(e) => setGold(formatAmountInput(e.target.value))}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.zakat.fieldLiabilities}>
              <input
                type="text"
                inputMode="numeric"
                value={liabilities}
                onChange={(e) =>
                  setLiabilities(formatAmountInput(e.target.value))
                }
                className="input"
              />
            </Field>
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <input
              id="kalkulator-zakat-haul"
              type="checkbox"
              checked={haulConfirmed}
              onChange={(e) => setHaulConfirmed(e.target.checked)}
              className="size-4 accent-primary"
            />
            <label
              htmlFor="kalkulator-zakat-haul"
              className="text-[12.5px] text-muted-foreground"
            >
              {t.kalkulator.zakat.haulCheckboxLabel}
            </label>
          </div>
          <Button
            className="mt-4 w-full"
            onClick={handleCalculate}
            disabled={loading}
          >
            {loading
              ? t.kalkulator.calculating
              : t.kalkulator.zakat.calculateButton}
          </Button>
        </SectionCard>
      }
      hasil={
        <SectionCard title={t.kalkulator.hasilCardTitle}>
          {!result ? (
            <EmptyHasil note={t.kalkulator.zakat.calculateButton} />
          ) : (
            <div className="space-y-3">
              <Headline
                label={resultLabel ?? ""}
                value={formatRupiah(result.zakat)}
              />
              <div className="space-y-1.5">
                <Row
                  label={t.kalkulator.zakat.detailZakatablePrefix.replace(
                    ":",
                    "",
                  )}
                  value={formatRupiah(result.zakatable)}
                />
                <Row
                  label={t.kalkulator.zakat.detailNisabPrefix.replace(
                    /[·:]/g,
                    "",
                  )}
                  value={formatRupiah(result.nisab)}
                />
              </div>
              {!result.meetsNisab && (
                <p className="text-center text-[12px] text-muted-foreground">
                  {t.kalkulator.zakat.belowNisabPrefix}
                  {formatRupiah(result.nisab)}
                  {t.kalkulator.zakat.belowNisabSuffix}
                </p>
              )}
              {result.meetsNisab && !result.isObligated && (
                <p className="text-center text-[12px] text-muted-foreground">
                  {t.kalkulator.zakat.estimateNote}
                </p>
              )}
              <p className="text-center text-[11px] text-muted-foreground/80">
                {result.nisabSource === "family"
                  ? `${t.kalkulator.zakat.nisabSourceFamilyPrefix}${formatRupiah(familyGoldPrice ?? 0)}${t.kalkulator.zakat.nisabSourceFamilyMidfix}${t.consolidatedTotal.manualLabelPrefix}${
                      familyGoldPriceUpdatedAt
                        ? formatManualDate(familyGoldPriceUpdatedAt, locale)
                        : ""
                    }${t.kalkulator.zakat.nisabSourceFamilySuffix}`
                  : t.kalkulator.zakat.nisabSourceIndicative}
              </p>
            </div>
          )}
        </SectionCard>
      }
    />
  );
}

/* ─────────────────────────── PPh 21 ─────────────────────────── */

function Pph21Tab({ token }: { token: string | undefined }) {
  const { t } = useLocale();
  const [gross, setGross] = useState("120.000.000");
  const [zakatPaid, setZakatPaid] = useState("0");
  const [result, setResult] = useState<Pph21ResultDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [bracketDialogOpen, setBracketDialogOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleCalculate() {
    if (!token) {
      toast.error(t.kalkulator.sessionExpired);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await apiFetch<Pph21ResultDto>("/calculators/pph21", {
        method: "POST",
        token,
        signal: ctrl.signal,
        body: JSON.stringify({
          grossIncome: parseRupiah(gross),
          zakatPaid: parseRupiah(zakatPaid),
        }),
      });
      if (!ctrl.signal.aborted) setResult(res);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(t.kalkulator.pph21.errorCalculate);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <>
      <CalcLayout
        input={
          <SectionCard
            title={t.kalkulator.pph21.cardTitle}
            action={
              <button
                type="button"
                onClick={() => setBracketDialogOpen(true)}
                className="cursor-pointer text-[12px] font-semibold text-primary hover:underline"
              >
                {t.kalkulator.pph21.bracketDialogLinkLabel}
              </button>
            }
          >
            <div className="-mt-1 mb-3.5 text-[12px] text-muted-foreground">
              {t.kalkulator.pph21.ptkpNote}
            </div>
            <div className="mb-3.5 rounded-md border bg-secondary/50 px-3.5 py-2.5 text-[12px] text-muted-foreground">
              {t.kalkulator.pph21.typingNote}
            </div>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <Field label={t.kalkulator.pph21.fieldGross}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={gross}
                  onChange={(e) => setGross(formatAmountInput(e.target.value))}
                  className="input"
                />
              </Field>
              <Field label={t.kalkulator.pph21.fieldZakatPaid}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={zakatPaid}
                  onChange={(e) =>
                    setZakatPaid(formatAmountInput(e.target.value))
                  }
                  className="input"
                />
              </Field>
            </div>
            <Button
              className="mt-4 w-full"
              onClick={handleCalculate}
              disabled={loading}
            >
              {loading
                ? t.kalkulator.calculating
                : t.kalkulator.pph21.calculateButton}
            </Button>
          </SectionCard>
        }
        hasil={
          <SectionCard title={t.kalkulator.hasilCardTitle}>
            {!result ? (
              <EmptyHasil note={t.kalkulator.pph21.calculateButton} />
            ) : (
              <div className="space-y-3.5">
                <Headline
                  label={t.kalkulator.pph21.resultLabel}
                  value={formatRupiah(result.totalTax)}
                  note={
                    <>
                      {t.kalkulator.pph21.detailPkpPrefix}{" "}
                      <strong className="text-foreground">
                        {formatRupiah(result.pkp)}
                      </strong>{" "}
                      {t.kalkulator.pph21.detailEffectiveRatePrefix}{" "}
                      <strong className="text-primary">
                        {(result.effectiveRate * 100).toFixed(2)}%
                      </strong>
                    </>
                  }
                />
                <div className="space-y-1.5">
                  <div className="text-[12px] font-semibold text-muted-foreground mb-1">
                    {t.kalkulator.pph21.deductionHeading}
                  </div>
                  <Row
                    label={t.kalkulator.pph21.laborCostLabel}
                    value={`−${formatRupiah(result.biayaJabatan)}`}
                    valueClassName="text-destructive"
                  />
                  <Row
                    label={t.kalkulator.pph21.ptkpLabel}
                    value={`−${formatRupiah(result.ptkp)}`}
                    valueClassName="text-destructive"
                  />
                  {result.zakatDeduction > 0 && (
                    <Row
                      label={t.kalkulator.pph21.zakatLabel}
                      value={`−${formatRupiah(result.zakatDeduction)}`}
                      valueClassName="text-destructive"
                    />
                  )}
                </div>
              </div>
            )}
          </SectionCard>
        }
      />
      <Pph21BracketDialog
        open={bracketDialogOpen}
        onOpenChange={setBracketDialogOpen}
        result={result}
      />
    </>
  );
}

function Pph21BracketDialog({
  open,
  onOpenChange,
  result,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: Pph21ResultDto | null;
}) {
  const { t } = useLocale();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* EPIC-026 Wave 8 — #dlg-pph is the prototype's default 480px
          `.dialog` (kalkulator.html:340), not a bespoke 560px box. */}
      <DialogContent>
        <DialogTitle>{t.kalkulator.pph21.bracketDialogTitle}</DialogTitle>
        <DialogDescription>
          {t.kalkulator.pph21.bracketDialogDesc}
        </DialogDescription>
        {!result || result.taxBreakdown.length === 0 ? (
          <DialogBody>
            <p className="text-[13px] text-muted-foreground">
              {t.kalkulator.pph21.bracketDialogEmptyNote}
            </p>
          </DialogBody>
        ) : (
          <DialogBody>
            <div className="w-full overflow-x-auto">
              <table className="min-w-[420px] w-full text-left text-[12.5px]">
                <thead>
                  <tr className="text-[11.5px] text-muted-foreground">
                    <th className="pb-2 font-semibold">
                      {t.kalkulator.pph21.bracketDialogBracketHeader}
                    </th>
                    <th className="pb-2 font-semibold">
                      {t.kalkulator.pph21.bracketDialogRateHeader}
                    </th>
                    <th className="pb-2 text-right font-semibold">
                      {t.kalkulator.pph21.bracketDialogTaxableHeader}
                    </th>
                    <th className="pb-2 text-right font-semibold">
                      {t.kalkulator.pph21.bracketDialogTaxHeader}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.taxBreakdown.map((b) => (
                    <tr key={b.bracket} className="border-t">
                      <td className="py-2">{b.bracket}</td>
                      <td className="mono py-2">
                        {(b.rate * 100).toFixed(0)}%
                      </td>
                      <td className="mono py-2 text-right">
                        {formatRupiah(b.taxableAmount)}
                      </td>
                      <td className="mono py-2 text-right font-bold text-primary">
                        {formatRupiah(b.tax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-[13px] font-bold">
                {t.kalkulator.pph21.bracketDialogTotalLabel}
              </span>
              <span className="mono text-[15px] font-bold">
                {formatRupiah(result.totalTax)}
              </span>
            </div>
          </DialogBody>
        )}
        {/* Prototype `.dialog__footer` (kalkulator.html:360-365). Its second
            button, "Simpan Perhitungan", is deliberately NOT reproduced: the
            prototype only fires a toast, and this app has no endpoint that
            persists a PPh 21 calculation — a Save button that saves nothing
            would be dishonest UI. Only the outline Tutup survives. */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.kalkulator.pph21.bracketDialogCloseButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Investasi ─────────────────────────── */

function InvestasiTab() {
  const { t } = useLocale();
  const [modal, setModal] = useState("50.000.000");
  const [monthly, setMonthly] = useState("2.000.000");
  const [years, setYears] = useState("10");
  const [rate, setRate] = useState("12");

  const { fv, totalModal, profit, projectionCategories, projectionValues } =
    useMemo(() => {
      const m = parseRupiah(modal);
      const mo = parseRupiah(monthly);
      const r = Number(rate) / 100 / 12;
      // EPIC-025 N3-E2 hotfix — `n` feeds the ResultCard's fv/totalModal/
      // profit; it must stay UNCLAMPED so an invalid/empty `years` field
      // (0 or NaN) surfaces the same way it always did (fv === m, or a
      // visibly broken number), not silently forced to a fake 1-year
      // result. Only the projection CHART's loop bound is clamped
      // separately (`chartMonths` below) so the chart never renders an
      // empty series — that clamp must never leak into the money math.
      const n = Number(years) * 12;
      const factor = Math.pow(1 + r, n);
      const fvCalc =
        r === 0 ? m + mo * n : m * factor + (mo * (factor - 1)) / r;
      const totalModalCalc = m + mo * n;

      // EPIC-025 N3-E2 — J3 FOLD: year-by-year compounding, ported from
      // `docs/prototype/pages/kalkulator.html`'s `hitungInvestasi()`. Pure
      // client-side re-derivation of the same formula used for `fv` above —
      // no fetch, no second source of truth to drift from the result card.
      const chartMonths = Math.max(1, n);
      const series: number[] = [];
      let value = m;
      series.push(Math.round(value));
      for (let month = 1; month <= chartMonths; month += 1) {
        value = value * (1 + r) + mo;
        if (month % 12 === 0) series.push(Math.round(value));
      }
      const categories = series.map(
        (_, idx) => `${t.kalkulator.investasi.projectionYearPrefix}${idx}`,
      );

      return {
        fv: fvCalc,
        totalModal: totalModalCalc,
        profit: fvCalc - totalModalCalc,
        projectionCategories: categories,
        projectionValues: series,
      };
    }, [modal, monthly, rate, years, t]);

  return (
    <CalcLayout
      input={
        <SectionCard title={t.kalkulator.investasi.cardTitle}>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label={t.kalkulator.investasi.fieldInitialCapital}>
              <input
                type="text"
                inputMode="numeric"
                value={modal}
                onChange={(e) => setModal(formatAmountInput(e.target.value))}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.investasi.fieldMonthlyDeposit}>
              <input
                type="text"
                inputMode="numeric"
                value={monthly}
                onChange={(e) => setMonthly(formatAmountInput(e.target.value))}
                className="input"
              />
            </Field>
            {/* EPIC-025 N3 fidelity follow-up — field order swapped to match
                the prototype: Jangka Waktu before Imbal Hasil. */}
            <Field label={t.kalkulator.investasi.fieldDuration}>
              <input
                type="number"
                min={1}
                max={50}
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.investasi.fieldReturnRateLabel}>
              <input
                type="number"
                min={0}
                max={100}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="input"
              />
              <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                {t.kalkulator.investasi.returnRateHint}
              </div>
            </Field>
          </div>
        </SectionCard>
      }
      hasil={
        <SectionCard title={t.kalkulator.hasilCardTitle}>
          <div className="space-y-3.5">
            <Headline
              label={t.kalkulator.investasi.resultLabel}
              value={formatRupiah(fv)}
              note={
                <span className="text-success">
                  {t.kalkulator.investasi.detailProfitPrefix.replace(
                    /[·:]/g,
                    "",
                  )}{" "}
                  {formatRupiah(profit)}
                </span>
              }
            />
            {/* EPIC-025 N3-E2 — J3 FOLD: projection chart, pure client-side
                computation from the same series computed above. Height
                bumped from the prototype's 190 to 220 so the plotted area
                doesn't read as visually squashed inside the card. */}
            <TrendChart
              categories={projectionCategories}
              series={[
                {
                  name: t.kalkulator.investasi.projectionSeriesLabel,
                  data: projectionValues,
                },
              ]}
              height={220}
              ariaLabel={`${t.kalkulator.investasi.projectionChartTitle}: ${formatRupiah(projectionValues[0] ?? 0)} → ${formatRupiah(fv)}`}
            />
            <div className="space-y-1.5">
              <Row
                label={t.kalkulator.investasi.rowTotalDepositLabel}
                value={formatRupiah(totalModal)}
              />
              <Row
                label={t.kalkulator.investasi.rowGrowthLabel}
                value={`+${formatRupiah(profit)}`}
                valueClassName="text-success"
              />
            </div>
          </div>
        </SectionCard>
      }
    />
  );
}

/* ─────────────────────────── Kredit / KPR ─────────────────────────── */

// EPIC-025 N3 fidelity follow-up — restructured to the prototype's KPR
// model: Harga Properti + DP entered as a Rupiah amount (with a live "% of
// price" note) instead of Jumlah Pinjaman + DP(%). Same annuity math
// (pokok = harga − dp), just entered the way a real mortgage is quoted.
function KreditTab() {
  const { t } = useLocale();
  const [harga, setHarga] = useState("1.500.000.000");
  const [dp, setDp] = useState("300.000.000");
  const [bunga, setBunga] = useState("9.5");
  const [tenor, setTenor] = useState("15");

  const { cicilan, pokok, total, totalInterest, n, dpPct } = useMemo(() => {
    const h = parseRupiah(harga);
    const dpAmount = parseRupiah(dp);
    const pokokCalc = Math.max(0, h - dpAmount);
    const r = Number(bunga) / 100 / 12;
    const nCalc = Math.max(1, Number(tenor)) * 12;
    const factor = Math.pow(1 + r, nCalc);
    const cicilanCalc =
      r === 0 ? pokokCalc / nCalc : (pokokCalc * r * factor) / (factor - 1);
    const totalCalc = cicilanCalc * nCalc;
    return {
      cicilan: cicilanCalc,
      pokok: pokokCalc,
      total: totalCalc,
      totalInterest: totalCalc - pokokCalc,
      n: nCalc,
      dpPct: h > 0 ? (dpAmount / h) * 100 : 0,
    };
  }, [harga, dp, bunga, tenor]);

  return (
    <CalcLayout
      input={
        <SectionCard title={t.kalkulator.kredit.cardTitleAlt}>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label={t.kalkulator.kredit.fieldPropertyPrice}>
              <input
                type="text"
                inputMode="numeric"
                value={harga}
                onChange={(e) => setHarga(formatAmountInput(e.target.value))}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.kredit.fieldDownPaymentAmount}>
              <input
                type="text"
                inputMode="numeric"
                value={dp}
                onChange={(e) => setDp(formatAmountInput(e.target.value))}
                className="input"
              />
              <div className="mt-1.5 text-[11.5px] text-muted-foreground">
                {dpPct.toFixed(1).replace(".", ",")}
                {t.kalkulator.kredit.dpPercentSuffix}
              </div>
            </Field>
            <Field label={t.kalkulator.kredit.fieldAnnualInterest}>
              <input
                type="number"
                min={0}
                max={50}
                step={0.05}
                value={bunga}
                onChange={(e) => setBunga(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.kredit.fieldTenor}>
              <input
                type="number"
                min={1}
                max={30}
                value={tenor}
                onChange={(e) => setTenor(e.target.value)}
                className="input"
              />
            </Field>
          </div>
        </SectionCard>
      }
      hasil={
        <SectionCard title={t.kalkulator.hasilCardTitle}>
          <div className="space-y-3.5">
            <Headline
              label={t.kalkulator.kredit.resultLabel}
              value={formatRupiah(cicilan)}
            />
            <div className="space-y-1.5">
              <Row
                label={t.kalkulator.kredit.rowPrincipalLabel}
                value={formatRupiah(pokok)}
              />
              <Row
                label={t.kalkulator.kredit.rowTotalInterestLabel}
                value={formatRupiah(totalInterest)}
                valueClassName="text-destructive"
              />
              <Row
                label={t.kalkulator.kredit.rowTotalPaymentLabel}
                value={formatRupiah(total)}
              />
              <Row
                label={t.kalkulator.kredit.rowInstallmentCountLabel}
                value={`${formatNumber(n)}${t.kalkulator.kredit.installmentCountSuffix}`}
              />
            </div>
            <div className="flex items-start gap-2 rounded-[10px] border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[12.5px]">
              <span>⚠️</span>
              <span>
                {t.kalkulator.kredit.ruleWarningNote}{" "}
                {t.kalkulator.kredit.minIncomeNotePrefix}
                <strong>{formatRupiah(cicilan / 0.3)}</strong>
                {t.kalkulator.kredit.minIncomeNoteSuffix}
              </span>
            </div>
          </div>
        </SectionCard>
      }
    />
  );
}

/* ─────────────────────────── Pensiun ─────────────────────────── */

function PensiunTab({ token }: { token: string | undefined }) {
  const { t } = useLocale();
  const [now, setNow] = useState("30");
  const [retire, setRetire] = useState("55");
  const [monthly, setMonthly] = useState("10.000.000");
  const [ret, setRet] = useState("10");
  const [result, setResult] = useState<RetirementCalcResultDto | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // E3 — this used to run a loan-amortisation formula client-side, which
  // overstates the required monthly saving by ~12× (it divides by a much
  // smaller denominator than the sinking-fund formula a savings goal needs).
  // The BE's `/calculators/retirement` already implements the correct
  // sinking-fund PMT, so this tab now calls it instead of duplicating math.
  async function handleCalculate() {
    if (!token) {
      toast.error(t.kalkulator.sessionExpired);
      return;
    }
    const years = Number(retire) - Number(now);
    if (!Number.isFinite(years) || years < 1) {
      toast.error(t.kalkulator.pensiun.invalidAgeRangeError);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    try {
      const res = await apiFetch<RetirementCalcResultDto>(
        "/calculators/retirement",
        {
          method: "POST",
          token,
          signal: ctrl.signal,
          body: JSON.stringify({
            // 20 years of the current monthly expense — same target basis
            // the page always used, just funded via the correct formula now.
            targetAmount: parseRupiah(monthly) * 12 * 20,
            years,
            annualRate: Number(ret) / 100,
          }),
        },
      );
      if (!ctrl.signal.aborted) setResult(res);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(t.kalkulator.pensiun.errorCalculate);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  return (
    <CalcLayout
      input={
        <SectionCard title={t.kalkulator.pensiun.cardTitle}>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label={t.kalkulator.pensiun.fieldCurrentAge}>
              <input
                type="number"
                value={now}
                onChange={(e) => setNow(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.pensiun.fieldRetireAge}>
              <input
                type="number"
                value={retire}
                onChange={(e) => setRetire(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.pensiun.fieldCurrentMonthlyExpense}>
              <input
                type="text"
                inputMode="numeric"
                value={monthly}
                onChange={(e) => setMonthly(formatAmountInput(e.target.value))}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.pensiun.fieldInvestmentReturn}>
              <input
                type="number"
                value={ret}
                onChange={(e) => setRet(e.target.value)}
                className="input"
              />
            </Field>
          </div>
          <Button
            className="mt-4 w-full"
            onClick={handleCalculate}
            disabled={loading}
          >
            {loading
              ? t.kalkulator.calculating
              : t.kalkulator.pensiun.calculateButton}
          </Button>
        </SectionCard>
      }
      hasil={
        <SectionCard title={t.kalkulator.hasilCardTitle}>
          {!result ? (
            <EmptyHasil note={t.kalkulator.pensiun.calculateButton} />
          ) : (
            <div className="space-y-3.5">
              <Headline
                label={t.kalkulator.pensiun.resultLabel}
                value={formatRupiah(result.projectedValue)}
              />
              <div className="space-y-1.5">
                <Row
                  label={t.kalkulator.pensiun.rowMonthlyContributionLabel}
                  value={formatRupiah(result.monthlyContribution)}
                  valueClassName="text-primary"
                />
                <Row
                  label={t.kalkulator.pensiun.rowTotalContributionsLabel}
                  value={formatRupiah(result.totalContributions)}
                />
                <Row
                  label={t.kalkulator.pensiun.rowProjectedValueLabel}
                  value={formatRupiah(result.projectedValue)}
                />
              </div>
              {/* E3 (LOW) — the target is 20× current annual expenses (a ~5%
                  withdrawal rate), more aggressive than the common 25×/4%
                  rule. Disclose the basis rather than leaving the
                  multiplier hidden. */}
              <p className="text-center text-[11px] text-muted-foreground/80">
                {t.kalkulator.pensiun.targetBasisNote}
              </p>
            </div>
          )}
        </SectionCard>
      }
    />
  );
}

/* ─────────────────────────── Tabungan ─────────────────────────── */

function TabunganTab() {
  const { t } = useLocale();
  const [target, setTarget] = useState("100.000.000");
  const [current, setCurrent] = useState("10.000.000");
  const [bunga, setBunga] = useState("4");
  const [setor, setSetor] = useState("3.000.000");

  const { bln, label, unreachable } = useMemo(() => {
    const targetAmount = parseRupiah(target);
    const r = Number(bunga) / 100 / 12;
    const s = parseRupiah(setor);
    let saldo = parseRupiah(current);
    let months = 0;
    while (saldo < targetAmount && months < 600) {
      saldo = saldo * (1 + r) + s;
      months++;
    }
    // fix-round1 — a zero (or too-small) monthly deposit with a target
    // above the current balance never actually reaches it; the loop above
    // caps at 600 either way, so "still short after 600 months" is the
    // only reliable signal, not `months === 600` (a real 50-year plan
    // could legitimately land there).
    const unreachable = saldo < targetAmount;
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const targetLabel = `${t.kalkulator.months[d.getMonth()]} ${d.getFullYear()}`;
    return { bln: months, label: targetLabel, unreachable };
  }, [target, current, bunga, setor, t]);

  return (
    <CalcLayout
      input={
        <SectionCard title={t.kalkulator.tabungan.cardTitle}>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label={t.kalkulator.tabungan.fieldTarget}>
              <input
                type="text"
                inputMode="numeric"
                value={target}
                onChange={(e) => setTarget(formatAmountInput(e.target.value))}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.tabungan.fieldCurrentBalance}>
              <input
                type="text"
                inputMode="numeric"
                value={current}
                onChange={(e) => setCurrent(formatAmountInput(e.target.value))}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.tabungan.fieldAnnualInterest}>
              <input
                type="number"
                value={bunga}
                onChange={(e) => setBunga(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.tabungan.fieldMonthlyDeposit}>
              <input
                type="text"
                inputMode="numeric"
                value={setor}
                onChange={(e) => setSetor(formatAmountInput(e.target.value))}
                className="input"
              />
              {unreachable && (
                <p className="mt-1 text-[12px] text-destructive" role="alert">
                  {t.kalkulator.tabungan.unreachableError}
                </p>
              )}
            </Field>
          </div>
        </SectionCard>
      }
      hasil={
        <SectionCard title={t.kalkulator.hasilCardTitle}>
          {unreachable ? (
            <EmptyHasil note={t.kalkulator.tabungan.unreachableError} />
          ) : (
            <ResultCard
              label={t.kalkulator.tabungan.resultLabel}
              value={`±${formatNumber(bln)} ${t.kalkulator.tabungan.resultValueSuffix}`}
              detail={
                <>
                  {t.kalkulator.tabungan.detailTargetReachedPrefix}{" "}
                  <strong className="text-primary">{label}</strong>
                </>
              }
            />
          )}
        </SectionCard>
      }
    />
  );
}

/* ─────────────────────────── Split Group ─────────────────────────── */

function SplitGroupTab() {
  const { t } = useLocale();
  const router = useRouter();
  const [total, setTotal] = useState("1.250.000");
  const [people, setPeople] = useState("5");
  const [tax, setTax] = useState("10");
  const [tip, setTip] = useState("0");

  // fix-round1 — 0/negative was silently clamped to 1 person, hiding a
  // typo (e.g. an accidental "-5" or a cleared field) behind a plausible
  // "per orang" figure computed for 1 person instead of the group.
  const invalidPeopleCount = !(Number(people) > 0);

  const { per, grand, count } = useMemo(() => {
    const totalAmount = parseRupiah(total);
    const p = invalidPeopleCount ? 1 : Number(people);
    const grandCalc =
      totalAmount +
      (totalAmount * Number(tax)) / 100 +
      (totalAmount * Number(tip)) / 100;
    return { per: Math.round(grandCalc / p), grand: grandCalc, count: p };
  }, [total, people, tax, tip, invalidPeopleCount]);

  const breakdownCount = Math.min(count, 10);

  return (
    <CalcLayout
      input={
        <SectionCard title={t.kalkulator.splitgroup.cardTitle}>
          <div className="-mt-1 mb-3.5 text-[12px] text-muted-foreground">
            {t.kalkulator.splitgroup.description}
          </div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label={t.kalkulator.splitgroup.fieldTotalBill}>
              <input
                type="text"
                inputMode="numeric"
                value={total}
                onChange={(e) => setTotal(formatAmountInput(e.target.value))}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.splitgroup.fieldPeopleCount}>
              <input
                type="number"
                min={1}
                value={people}
                onChange={(e) => setPeople(e.target.value)}
                className="input"
              />
              {invalidPeopleCount && (
                <p className="mt-1 text-[12px] text-destructive" role="alert">
                  {t.kalkulator.splitgroup.invalidPeopleError}
                </p>
              )}
            </Field>
            <Field label={t.kalkulator.splitgroup.fieldTaxService}>
              <input
                type="number"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t.kalkulator.splitgroup.fieldExtraTip}>
              <input
                type="number"
                value={tip}
                onChange={(e) => setTip(e.target.value)}
                className="input"
              />
            </Field>
          </div>
          <Button
            className="mt-3.5 w-full"
            onClick={() => router.push("/splitbill")}
            disabled={invalidPeopleCount}
          >
            <Share2 className="size-4" />{" "}
            {t.kalkulator.splitgroup.createSplitBillButton}
          </Button>
        </SectionCard>
      }
      hasil={
        <SectionCard title={t.kalkulator.hasilCardTitle}>
          {invalidPeopleCount ? (
            <EmptyHasil note={t.kalkulator.splitgroup.invalidPeopleError} />
          ) : (
            <div className="space-y-3.5">
              <ResultCard
                label={t.kalkulator.splitgroup.resultLabel}
                value={formatRupiah(per)}
                detail={
                  <>
                    {t.kalkulator.splitgroup.detailTotalWithTaxPrefix}{" "}
                    <strong className="text-primary">
                      {formatRupiah(grand)}
                    </strong>
                  </>
                }
              />
              <div className="space-y-1.5">
                {GROUP_NAMES.slice(0, breakdownCount).map((name) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-md border px-3.5 py-2.5"
                  >
                    <span className="text-[13px] font-semibold">{name}</span>
                    <span className="text-[13px] font-bold text-primary">
                      {formatRupiah(per)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      }
    />
  );
}

/* ─────────────────────────── Page ─────────────────────────── */

export default function KalkulatorPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<TabKey>("investasi");
  const { data: session } = useSession();
  const token = session?.accessToken as string | undefined;

  return (
    <div className="space-y-4">
      {/* EPIC-026 Wave 4 — prototype `page-lead` uses `section-title`
          (17px extrabold, kalkulator.html:20), not 21px. */}
      <div>
        <h1 className="text-[17px] font-extrabold tracking-tight">
          {t.kalkulator.pageTitle}
        </h1>
      </div>

      {/* EPIC-026 Wave 4 — prototype `.tab` pills: bordered `bg-card`
          idle, primary fill when selected (app.css:2308, 2492). Tab SET
          stays the app's real 7 calculators (zakat kept over perpuluhan
          per the documented contracts carve-out; tabungan/splitgroup are
          real shipped features — dropping them would be a functional
          regression, out of this presentation wave's scope). */}
      <div
        className="hide-scrollbar scroll-fade-x flex gap-[7px] overflow-x-auto max-[399px]:flex-wrap max-[399px]:overflow-visible max-[399px]:[mask-image:none] max-[399px]:[-webkit-mask-image:none]"
        role="group"
        aria-label="Pilih kalkulator"
      >
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={
              "shrink-0 cursor-pointer rounded-full border px-[13px] py-[7px] text-[12.5px] font-semibold whitespace-nowrap transition-colors " +
              (tab === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-secondary/70")
            }
          >
            {t.kalkulator.tabs[key]}
          </button>
        ))}
      </div>

      {tab === "zakat" && <ZakatTab token={token} />}
      {tab === "pph21" && <Pph21Tab token={token} />}
      {tab === "investasi" && <InvestasiTab />}
      {tab === "kredit" && <KreditTab />}
      {tab === "pensiun" && <PensiunTab token={token} />}
      {tab === "tabungan" && <TabunganTab />}
      {tab === "splitgroup" && <SplitGroupTab />}
    </div>
  );
}
