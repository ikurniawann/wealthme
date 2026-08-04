import { Injectable } from "@nestjs/common";

import type {
  InvestmentCalcRequestDto,
  InvestmentCalcResultDto,
  KprCalcRequestDto,
  KprCalcResultDto,
  Pph21RequestDto,
  Pph21ResultDto,
  RetirementCalcRequestDto,
  RetirementCalcResultDto,
  TaxBracketDto,
  ZakatRequestDto,
  ZakatResultDto,
} from "@wealthme/contracts";

/** Nisab = 85 g gold × Rp 1,100,000 / g */
const GOLD_PRICE_PER_GRAM = 1_100_000;
const NISAB_GRAMS = 85;
const NISAB = NISAB_GRAMS * GOLD_PRICE_PER_GRAM; // Rp 93,500,000

/** PTKP TK/0 per UU HPP */
const PTKP = 54_000_000;
/** Biaya jabatan rate (5%) and cap */
const BIAYA_JABATAN_RATE = 0.05;
const BIAYA_JABATAN_MAX = 6_000_000;

/** PPh 21 progressive brackets (UU HPP 2021) */
const TAX_BRACKETS: { limit: number; rate: number; label: string }[] = [
  { limit: 60_000_000, rate: 0.05, label: "0 – 60 Juta" },
  { limit: 250_000_000, rate: 0.15, label: "60 – 250 Juta" },
  { limit: 500_000_000, rate: 0.25, label: "250 – 500 Juta" },
  { limit: 5_000_000_000, rate: 0.3, label: "500 Juta – 5 Miliar" },
  { limit: Infinity, rate: 0.35, label: "> 5 Miliar" },
];

@Injectable()
export class CalculatorsService {
  calculateZakat(dto: ZakatRequestDto): ZakatResultDto {
    const zakatable = Math.max(
      0,
      dto.cash + dto.investments + dto.gold - dto.liabilities,
    );
    const isObligated = zakatable >= NISAB;
    const zakat = isObligated ? zakatable * 0.025 : 0;

    return { zakatable, nisab: NISAB, zakat, isObligated };
  }

  calculatePph21(dto: Pph21RequestDto): Pph21ResultDto {
    const gross = dto.grossIncome;
    const zakatDeduction = dto.zakatPaid ?? 0;
    const ptkp = dto.ptkp ?? PTKP;

    const biayaJabatan = Math.min(
      gross * BIAYA_JABATAN_RATE,
      BIAYA_JABATAN_MAX,
    );
    // PKP (taxable income) is rounded down to the nearest Rp 1,000 per DJP
    // rounding practice for PPh 21.
    const pkpRaw = Math.max(0, gross - biayaJabatan - ptkp - zakatDeduction);
    const pkp = Math.floor(pkpRaw / 1000) * 1000;

    const taxBreakdown = this.computeTaxBrackets(pkp);
    const totalTax = taxBreakdown.reduce((sum, b) => sum + b.tax, 0);
    const effectiveRate = gross > 0 ? totalTax / gross : 0;

    return {
      grossIncome: gross,
      biayaJabatan,
      ptkp,
      zakatDeduction,
      pkp,
      taxBreakdown,
      totalTax,
      effectiveRate,
    };
  }

  calculateInvestment(dto: InvestmentCalcRequestDto): InvestmentCalcResultDto {
    const n = dto.compoundsPerYear ?? 12;
    const r = dto.rate / n;
    const periods = n * dto.years;
    const factor = Math.pow(1 + r, periods);

    const futureValue =
      r === 0
        ? dto.pv + dto.pmt * periods
        : dto.pv * factor + (dto.pmt * (factor - 1)) / r;

    const totalContributions = dto.pv + dto.pmt * periods;
    const totalInterest = futureValue - totalContributions;

    return { futureValue, totalContributions, totalInterest };
  }

  calculateKpr(dto: KprCalcRequestDto): KprCalcResultDto {
    const r = dto.annualRate / 12;
    const n = dto.years * 12;
    const factor = Math.pow(1 + r, n);

    const monthlyPayment =
      r === 0 ? dto.principal / n : (dto.principal * r * factor) / (factor - 1);

    const totalPayment = monthlyPayment * n;
    const totalInterest = totalPayment - dto.principal;

    return { monthlyPayment, totalPayment, totalInterest };
  }

  calculateRetirement(dto: RetirementCalcRequestDto): RetirementCalcResultDto {
    const existing = dto.existingAmount ?? 0;
    const r = dto.annualRate / 12;
    const n = dto.years * 12;
    const factor = Math.pow(1 + r, n);

    // Future value of existing savings
    const fvExisting = existing * factor;
    // Remaining target to fund via contributions
    const remaining = Math.max(0, dto.targetAmount - fvExisting);

    // PMT = remaining × r / ((1+r)^n - 1)   [future value of annuity]
    const monthlyContribution =
      n <= 0 ? 0 : r === 0 ? remaining / n : (remaining * r) / (factor - 1);

    const totalContributions = monthlyContribution * n;
    const projectedValue =
      r === 0
        ? fvExisting + totalContributions
        : fvExisting + totalContributions * factor;

    return { monthlyContribution, totalContributions, projectedValue };
  }

  private computeTaxBrackets(pkp: number): TaxBracketDto[] {
    const breakdown: TaxBracketDto[] = [];
    let remaining = pkp;
    let previousLimit = 0;

    for (const bracket of TAX_BRACKETS) {
      if (remaining <= 0) break;
      const bandWidth =
        bracket.limit === Infinity
          ? remaining
          : Math.min(remaining, bracket.limit - previousLimit);
      const taxableAmount = Math.min(remaining, bandWidth);
      const tax = taxableAmount * bracket.rate;

      breakdown.push({
        bracket: bracket.label,
        taxableAmount,
        rate: bracket.rate,
        tax,
      });

      remaining -= taxableAmount;
      previousLimit = bracket.limit;
    }

    return breakdown;
  }
}
