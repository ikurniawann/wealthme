"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import { useSession } from "@/lib/auth-compat";
import { toast } from "sonner";
import { SectionCard } from "@/components/wm";
import { Button } from "@/components/ui/button";
import { formatManualDate } from "@/components/consolidated-total-card";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
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

const FIELD_CLASS =
  "w-full rounded-md border bg-background px-3.5 py-2.5 text-[13.5px] outline-none transition-colors focus:border-primary focus:bg-card";

// Sample participant names for the Split Group calculator preview — mock
// data (like `lib/data`'s USER name), not translatable UI copy.
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
    <div className="mt-4 rounded-[14px] border border-primary/30 bg-accent p-[18px] text-center">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[26px] font-black text-primary-strong">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">{detail}</div>
    </div>
  );
}

/* ─────────────────────────── Zakat Maal ─────────────────────────── */

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

  return (
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
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.zakat.fieldInvestments}>
          <input
            type="text"
            inputMode="numeric"
            value={investments}
            onChange={(e) => setInvestments(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.zakat.fieldGold}>
          <input
            type="text"
            inputMode="numeric"
            value={gold}
            onChange={(e) => setGold(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.zakat.fieldLiabilities}>
          <input
            type="text"
            inputMode="numeric"
            value={liabilities}
            onChange={(e) => setLiabilities(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
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
      {result && (
        <>
          <ResultCard
            label={
              // E1 — a snapshot alone can never confirm haul, so the label
              // never asserts "wajib" unless the server also confirms
              // `isObligated` (nisab met AND haul confirmed above).
              !result.meetsNisab
                ? t.kalkulator.zakat.resultNotObligated
                : result.isObligated
                  ? t.kalkulator.zakat.resultObligated
                  : t.kalkulator.zakat.resultEstimated
            }
            value={formatRupiah(result.zakat)}
            detail={
              <>
                {t.kalkulator.zakat.detailZakatablePrefix}{" "}
                <strong className="text-foreground">
                  {formatRupiah(result.zakatable)}
                </strong>{" "}
                {t.kalkulator.zakat.detailNisabPrefix}{" "}
                <strong className="text-foreground">
                  {formatRupiah(result.nisab)}
                </strong>
              </>
            }
          />
          {!result.meetsNisab && (
            <p className="mt-2 text-center text-[12px] text-muted-foreground">
              {t.kalkulator.zakat.belowNisabPrefix}
              {formatRupiah(result.nisab)}
              {t.kalkulator.zakat.belowNisabSuffix}
            </p>
          )}
          {result.meetsNisab && !result.isObligated && (
            <p className="mt-2 text-center text-[12px] text-muted-foreground">
              {t.kalkulator.zakat.estimateNote}
            </p>
          )}
          <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
            {result.nisabSource === "family"
              ? `${t.kalkulator.zakat.nisabSourceFamilyPrefix}${formatRupiah(familyGoldPrice ?? 0)}${t.kalkulator.zakat.nisabSourceFamilyMidfix}${t.consolidatedTotal.manualLabelPrefix}${
                  familyGoldPriceUpdatedAt
                    ? formatManualDate(familyGoldPriceUpdatedAt, locale)
                    : ""
                }${t.kalkulator.zakat.nisabSourceFamilySuffix}`
              : t.kalkulator.zakat.nisabSourceIndicative}
          </p>
        </>
      )}
    </SectionCard>
  );
}

/* ─────────────────────────── PPh 21 ─────────────────────────── */

function Pph21Tab({ token }: { token: string | undefined }) {
  const { t } = useLocale();
  const [gross, setGross] = useState("120.000.000");
  const [zakatPaid, setZakatPaid] = useState("0");
  const [result, setResult] = useState<Pph21ResultDto | null>(null);
  const [loading, setLoading] = useState(false);
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
    <SectionCard title={t.kalkulator.pph21.cardTitle}>
      <div className="-mt-1 mb-3.5 text-[12px] text-muted-foreground">
        {t.kalkulator.pph21.ptkpNote}
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label={t.kalkulator.pph21.fieldGross}>
          <input
            type="text"
            inputMode="numeric"
            value={gross}
            onChange={(e) => setGross(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.pph21.fieldZakatPaid}>
          <input
            type="text"
            inputMode="numeric"
            value={zakatPaid}
            onChange={(e) => setZakatPaid(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
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
      {result && (
        <>
          <ResultCard
            label={t.kalkulator.pph21.resultLabel}
            value={formatRupiah(result.totalTax)}
            detail={
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
          <div className="mt-3.5 space-y-1.5">
            <div className="text-[12px] font-semibold text-muted-foreground mb-1">
              {t.kalkulator.pph21.deductionHeading}
            </div>
            <div className="flex justify-between rounded-md border px-3.5 py-2">
              <span className="text-[13px]">
                {t.kalkulator.pph21.laborCostLabel}
              </span>
              <span className="text-[13px] font-bold text-destructive">
                −{formatRupiah(result.biayaJabatan)}
              </span>
            </div>
            <div className="flex justify-between rounded-md border px-3.5 py-2">
              <span className="text-[13px]">
                {t.kalkulator.pph21.ptkpLabel}
              </span>
              <span className="text-[13px] font-bold text-destructive">
                −{formatRupiah(result.ptkp)}
              </span>
            </div>
            {result.zakatDeduction > 0 && (
              <div className="flex justify-between rounded-md border px-3.5 py-2">
                <span className="text-[13px]">
                  {t.kalkulator.pph21.zakatLabel}
                </span>
                <span className="text-[13px] font-bold text-destructive">
                  −{formatRupiah(result.zakatDeduction)}
                </span>
              </div>
            )}
            {result.taxBreakdown.length > 0 && (
              <>
                <div className="text-[12px] font-semibold text-muted-foreground mt-2 mb-1">
                  {t.kalkulator.pph21.progressiveHeading}
                </div>
                {result.taxBreakdown.map((b) => (
                  <div
                    key={b.bracket}
                    className="flex justify-between rounded-md border px-3.5 py-2"
                  >
                    <span className="text-[13px]">
                      {b.bracket} ({(b.rate * 100).toFixed(0)}%)
                    </span>
                    <span className="text-[13px] font-bold text-primary">
                      {formatRupiah(b.tax)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </SectionCard>
  );
}

/* ─────────────────────────── Investasi ─────────────────────────── */

function InvestasiTab() {
  const { t } = useLocale();
  const [modal, setModal] = useState("50.000.000");
  const [monthly, setMonthly] = useState("2.000.000");
  const [rate, setRate] = useState("12");
  const [years, setYears] = useState("10");

  const { fv, totalModal, profit } = useMemo(() => {
    const m = parseRupiah(modal);
    const mo = parseRupiah(monthly);
    const r = Number(rate) / 100 / 12;
    const n = Number(years) * 12;
    const factor = Math.pow(1 + r, n);
    const fvCalc = r === 0 ? m + mo * n : m * factor + (mo * (factor - 1)) / r;
    const totalModalCalc = m + mo * n;
    return {
      fv: fvCalc,
      totalModal: totalModalCalc,
      profit: fvCalc - totalModalCalc,
    };
  }, [modal, monthly, rate, years]);

  return (
    <SectionCard title={t.kalkulator.investasi.cardTitle}>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label={t.kalkulator.investasi.fieldInitialCapital}>
          <input
            type="text"
            inputMode="numeric"
            value={modal}
            onChange={(e) => setModal(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.investasi.fieldMonthlyDeposit}>
          <input
            type="text"
            inputMode="numeric"
            value={monthly}
            onChange={(e) => setMonthly(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.investasi.fieldAnnualReturn}>
          <input
            type="number"
            min={0}
            max={100}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.investasi.fieldDuration}>
          <input
            type="number"
            min={1}
            max={50}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
      <ResultCard
        label={t.kalkulator.investasi.resultLabel}
        value={formatRupiah(fv)}
        detail={
          <>
            {t.kalkulator.investasi.detailTotalCapitalPrefix}{" "}
            <strong className="text-foreground">
              {formatRupiah(totalModal)}
            </strong>{" "}
            {t.kalkulator.investasi.detailProfitPrefix}{" "}
            <strong className="text-success">{formatRupiah(profit)}</strong>
          </>
        }
      />
    </SectionCard>
  );
}

/* ─────────────────────────── Kredit / KPR ─────────────────────────── */

function KreditTab() {
  const { t } = useLocale();
  const [pinjaman, setPinjaman] = useState("500.000.000");
  const [bunga, setBunga] = useState("7");
  const [tenor, setTenor] = useState("20");
  const [dp, setDp] = useState("20");

  const { cicilan, pokok, total } = useMemo(() => {
    const p = parseRupiah(pinjaman);
    const pokokCalc = p * (1 - Number(dp) / 100);
    const r = Number(bunga) / 100 / 12;
    const n = Number(tenor) * 12;
    const factor = Math.pow(1 + r, n);
    const cicilanCalc =
      r === 0 ? pokokCalc / n : (pokokCalc * r * factor) / (factor - 1);
    return { cicilan: cicilanCalc, pokok: pokokCalc, total: cicilanCalc * n };
  }, [pinjaman, bunga, tenor, dp]);

  return (
    <SectionCard title={t.kalkulator.kredit.cardTitle}>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label={t.kalkulator.kredit.fieldLoanAmount}>
          <input
            type="text"
            inputMode="numeric"
            value={pinjaman}
            onChange={(e) => setPinjaman(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.kredit.fieldAnnualInterest}>
          <input
            type="number"
            min={0}
            max={50}
            value={bunga}
            onChange={(e) => setBunga(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.kredit.fieldTenor}>
          <input
            type="number"
            min={1}
            max={30}
            value={tenor}
            onChange={(e) => setTenor(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.kredit.fieldDownPayment}>
          <input
            type="number"
            min={0}
            max={100}
            value={dp}
            onChange={(e) => setDp(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
      <ResultCard
        label={t.kalkulator.kredit.resultLabel}
        value={formatRupiah(cicilan)}
        detail={
          <>
            {t.kalkulator.kredit.detailPrincipalPrefix}{" "}
            <strong className="text-foreground">{formatRupiah(pokok)}</strong>{" "}
            {t.kalkulator.kredit.detailTotalPaymentPrefix}{" "}
            <strong className="text-destructive">{formatRupiah(total)}</strong>
          </>
        }
      />
    </SectionCard>
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
    <SectionCard title={t.kalkulator.pensiun.cardTitle}>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label={t.kalkulator.pensiun.fieldCurrentAge}>
          <input
            type="number"
            value={now}
            onChange={(e) => setNow(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.pensiun.fieldRetireAge}>
          <input
            type="number"
            value={retire}
            onChange={(e) => setRetire(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.pensiun.fieldCurrentMonthlyExpense}>
          <input
            type="text"
            inputMode="numeric"
            value={monthly}
            onChange={(e) => setMonthly(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.pensiun.fieldInvestmentReturn}>
          <input
            type="number"
            value={ret}
            onChange={(e) => setRet(e.target.value)}
            className={FIELD_CLASS}
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
      {result && (
        <>
          <ResultCard
            label={t.kalkulator.pensiun.resultLabel}
            value={formatRupiah(result.projectedValue)}
            detail={
              <>
                {t.kalkulator.pensiun.detailMonthlyInvestmentNeededPrefix}{" "}
                <strong className="text-primary">
                  {formatRupiah(result.monthlyContribution)}
                </strong>
              </>
            }
          />
          {/* E3 (LOW) — the target is 20× current annual expenses (a ~5%
              withdrawal rate), more aggressive than the common 25×/4% rule.
              Disclose the basis rather than leaving the multiplier hidden. */}
          <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
            {t.kalkulator.pensiun.targetBasisNote}
          </p>
        </>
      )}
    </SectionCard>
  );
}

/* ─────────────────────────── Tabungan ─────────────────────────── */

function TabunganTab() {
  const { t } = useLocale();
  const [target, setTarget] = useState("100.000.000");
  const [current, setCurrent] = useState("10.000.000");
  const [bunga, setBunga] = useState("4");
  const [setor, setSetor] = useState("3.000.000");

  const { bln, label } = useMemo(() => {
    const targetAmount = parseRupiah(target);
    const r = Number(bunga) / 100 / 12;
    const s = parseRupiah(setor);
    let saldo = parseRupiah(current);
    let months = 0;
    while (saldo < targetAmount && months < 600) {
      saldo = saldo * (1 + r) + s;
      months++;
    }
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const targetLabel = `${t.kalkulator.months[d.getMonth()]} ${d.getFullYear()}`;
    return { bln: months, label: targetLabel };
  }, [target, current, bunga, setor, t]);

  return (
    <SectionCard title={t.kalkulator.tabungan.cardTitle}>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label={t.kalkulator.tabungan.fieldTarget}>
          <input
            type="text"
            inputMode="numeric"
            value={target}
            onChange={(e) => setTarget(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.tabungan.fieldCurrentBalance}>
          <input
            type="text"
            inputMode="numeric"
            value={current}
            onChange={(e) => setCurrent(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.tabungan.fieldAnnualInterest}>
          <input
            type="number"
            value={bunga}
            onChange={(e) => setBunga(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.tabungan.fieldMonthlyDeposit}>
          <input
            type="text"
            inputMode="numeric"
            value={setor}
            onChange={(e) => setSetor(formatAmountInput(e.target.value))}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
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
    </SectionCard>
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

  const { per, grand, count } = useMemo(() => {
    const totalAmount = parseRupiah(total);
    const p = Math.max(1, Number(people) || 0);
    const grandCalc =
      totalAmount +
      (totalAmount * Number(tax)) / 100 +
      (totalAmount * Number(tip)) / 100;
    return { per: Math.round(grandCalc / p), grand: grandCalc, count: p };
  }, [total, people, tax, tip]);

  const breakdownCount = Math.min(count, 10);

  return (
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
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.splitgroup.fieldPeopleCount}>
          <input
            type="number"
            min={1}
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.splitgroup.fieldTaxService}>
          <input
            type="number"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <Field label={t.kalkulator.splitgroup.fieldExtraTip}>
          <input
            type="number"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
      </div>
      <ResultCard
        label={t.kalkulator.splitgroup.resultLabel}
        value={formatRupiah(per)}
        detail={
          <>
            {t.kalkulator.splitgroup.detailTotalWithTaxPrefix}{" "}
            <strong className="text-primary">{formatRupiah(grand)}</strong>
          </>
        }
      />
      <div className="mt-3.5 space-y-1.5">
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
      <Button
        className="mt-3.5 w-full"
        onClick={() => router.push("/splitbill")}
      >
        <Share2 className="size-4" />{" "}
        {t.kalkulator.splitgroup.createSplitBillButton}
      </Button>
    </SectionCard>
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
      <div className="hide-scrollbar flex gap-2 overflow-x-auto">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              "shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap transition-colors " +
              (tab === key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/70")
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
