import {
  BadRequestException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { TerNotApplicableError } from "../tax-engine/ter.engine";

import type { PphOpResult } from "../tax-engine/pph-op.engine";
import type { TerYearResult } from "../tax-engine/ter.engine";
import type { UmkmResult } from "../tax-engine/umkm.engine";
import type { TaxRuleRef } from "../tax-rules/tax-rule.types";
import type {
  PphOpResultDto,
  PpnPreviewResultDto,
  TaxRuleRefDto,
  TerPreviewResultDto,
  UmkmResultDto,
} from "@wealthme/contracts";

const s = (v: bigint) => v.toString();

export const toRuleRefDtos = (refs: readonly TaxRuleRef[]): TaxRuleRefDto[] =>
  refs.map((r) => ({ ...r }));

export function toPphOpResultDto(r: PphOpResult): PphOpResultDto {
  return {
    taxYear: r.taxYear,
    ptkp: s(r.ptkp),
    biayaJabatan: s(r.biayaJabatan),
    pensionDeduction: s(r.pensionDeduction),
    freelanceNet: s(r.freelanceNet),
    neto: s(r.neto),
    zakatApplied: s(r.zakatApplied),
    pkp: s(r.pkp),
    brackets: r.brackets.map((b) => ({
      from: s(b.from),
      upTo: b.upTo === null ? null : s(b.upTo),
      rateBps: b.rateBps,
      label: b.label,
      taxable: s(b.taxable),
      tax: s(b.tax),
    })),
    tax: s(r.tax),
    withheld: s(r.withheld),
    balance: s(r.balance),
    rules: toRuleRefDtos(r.rules),
  };
}

export function toTerResultDto(r: TerYearResult): TerPreviewResultDto {
  return {
    category: r.category,
    months: r.months.map((m) => ({
      month: m.month,
      gross: s(m.gross),
      category: m.category,
      rateBps: m.rateBps,
      withholding: s(m.withholding),
      dtp: m.dtp
        ? {
            eligible: m.dtp.eligible,
            reasons: m.dtp.reasons,
            amount: s(m.dtp.amount),
          }
        : null,
    })),
    annualTax: s(r.annualTax),
    withheldJanNov: s(r.withheldJanNov),
    december: s(r.december),
    isRefund: r.isRefund,
    dtpTotal: s(r.dtpTotal),
    rules: toRuleRefDtos(r.rules),
  };
}

export function toUmkmResultDto(
  r: UmkmResult,
  taxYear: number,
  firstRegisteredYear: number | null,
  saved: boolean,
): UmkmResultDto {
  return {
    taxYear,
    months: r.months.map((m) => ({
      month: m.month,
      omzet: s(m.omzet),
      cumulative: s(m.cumulative),
      taxable: s(m.taxable),
      tax: m.tax === null ? null : s(m.tax),
      eligible: m.eligible,
    })),
    totalOmzet: s(r.totalOmzet),
    totalTax: s(r.totalTax),
    exceedsCeiling: r.exceedsCeiling,
    ineligibleReason: r.ineligibleReason,
    firstRegisteredYear,
    saved,
    rules: toRuleRefDtos(r.rules),
  };
}

export function toPpnResultDto(r: {
  priceExcludingPpn: bigint;
  dpp: bigint;
  ppn: bigint;
  totalWithPpn: bigint;
  nominalBps: number;
  effectiveBps: number;
  rules: TaxRuleRef[];
}): PpnPreviewResultDto {
  return {
    priceExcludingPpn: s(r.priceExcludingPpn),
    dpp: s(r.dpp),
    ppn: s(r.ppn),
    totalWithPpn: s(r.totalWithPpn),
    nominalBps: r.nominalBps,
    effectiveBps: r.effectiveBps,
    rules: toRuleRefDtos(r.rules),
  };
}

export function mapEngineError(e: unknown): never {
  if (e instanceof TerNotApplicableError)
    throw new UnprocessableEntityException(e.message);
  if (e instanceof RangeError) throw new BadRequestException(e.message);
  throw e;
}
