import { Injectable } from "@nestjs/common";

import {
  PPH21_DEFAULT_PTKP,
  computePkp,
  computeTaxBrackets,
  sumTaxRounded,
} from "../common/utils/pph21.util";

import type {
  InvestmentCalcRequestDto,
  InvestmentCalcResultDto,
  KprCalcRequestDto,
  KprCalcResultDto,
  Pph21RequestDto,
  Pph21ResultDto,
  RetirementCalcRequestDto,
  RetirementCalcResultDto,
  ZakatRequestDto,
  ZakatResultDto,
} from "@wealthme/contracts";

/**
 * Indicative fallback nisab gold price (Rp/g) — used ONLY when the family
 * has not set `FamilyGroup.goldPricePerGram` (EPIC-021 Group F). Whenever a
 * caller supplies `goldPricePerGram`, nisab is derived from that instead —
 * see E2 (EPIC-022 Group E): this constant must never be the only source of
 * truth for nisab, and the result always reports which source was used via
 * `nisabSource` so the UI can label it honestly.
 */
const INDICATIVE_GOLD_PRICE_PER_GRAM = 1_100_000;
const NISAB_GRAMS = 85;

@Injectable()
export class CalculatorsService {
  calculateZakat(dto: ZakatRequestDto): ZakatResultDto {
    const goldPricePerGram =
      dto.goldPricePerGram && dto.goldPricePerGram > 0
        ? dto.goldPricePerGram
        : INDICATIVE_GOLD_PRICE_PER_GRAM;
    const nisabSource: ZakatResultDto["nisabSource"] =
      dto.goldPricePerGram && dto.goldPricePerGram > 0
        ? "family"
        : "indicative";
    const nisab = NISAB_GRAMS * goldPricePerGram;

    const zakatable = Math.max(
      0,
      dto.cash + dto.investments + dto.gold - dto.liabilities,
    );
    // E1 (EPIC-022 Group E): a snapshot alone can only tell us whether nisab
    // is met, never whether haul (the 1-lunar-year holding period) has been
    // fulfilled — that is not data this calculator has. `isObligated` is
    // therefore true ONLY when the caller explicitly confirms haul; when
    // nisab is met but haul is not confirmed, `zakat` still reports the
    // estimated amount (useful to plan for) but `isObligated` stays false so
    // no caller can present it as a settled religious obligation.
    const meetsNisab = zakatable >= nisab;
    const isObligated = meetsNisab && dto.haulConfirmed === true;
    const zakat = meetsNisab ? zakatable * 0.025 : 0;

    return { zakatable, nisab, zakat, meetsNisab, isObligated, nisabSource };
  }

  calculatePph21(dto: Pph21RequestDto): Pph21ResultDto {
    const gross = dto.grossIncome;
    const zakatDeduction = dto.zakatPaid ?? 0;
    const ptkp = dto.ptkp ?? PPH21_DEFAULT_PTKP;

    const { biayaJabatan, pkp } = computePkp(gross, ptkp, zakatDeduction);
    const taxBreakdown = computeTaxBrackets(pkp);
    const totalTax = sumTaxRounded(taxBreakdown);
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

    // PMT = remaining × r / ((1+r)^n - 1)   [sinking-fund / future value of
    // an ordinary annuity solved for the payment — NOT loan amortisation,
    // which divides by a much smaller denominator and overstates the
    // required contribution by an order of magnitude (E3, EPIC-022 Group E)]
    const monthlyContribution =
      n <= 0 ? 0 : r === 0 ? remaining / n : (remaining * r) / (factor - 1);

    // E3 (EPIC-022 Group E): `projectedValue` is the future value of the
    // contribution stream itself — PMT × ((1+r)^n − 1) / r — not the whole
    // stream re-compounded by `factor` as if every instalment were deposited
    // at t=0. By construction this equals `remaining` (and so, together with
    // `fvExisting`, equals the target whenever the target is reachable).
    const fvContributions =
      r === 0
        ? monthlyContribution * n
        : (monthlyContribution * (factor - 1)) / r;
    const totalContributions = monthlyContribution * n;
    const projectedValue = fvExisting + fvContributions;

    return { monthlyContribution, totalContributions, projectedValue };
  }
}
