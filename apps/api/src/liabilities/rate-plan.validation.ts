import { BadRequestException } from "@nestjs/common";

import {
  parseRateScaledByHundred,
  type InterestMethod,
} from "./amortisation.util";

import type { RatePeriodKind, RateSegment } from "./rate-plan.util";

export type KprSchemeValue =
  | "konvensional"
  | "berjenjang"
  | "flpp"
  | "syariah_murabahah"
  | "syariah_mmq";

export const MAX_KPR_RATE_PERCENT = "30.00";
// Kepmen PKP No. 1722/KPTS/M/2026 — FLPP tenor up to 40 years.
export const FLPP_MAX_TENOR_MONTHS = 480;
const FIXED_FULL_TENOR_SCHEMES: ReadonlySet<KprSchemeValue> = new Set([
  "flpp",
  "syariah_murabahah",
]);

export interface RatePeriodInput {
  kind: RatePeriodKind;
  months?: number | null;
  ratePercent: string;
}

export function assertKprRate(ratePercent: string, field: string): void {
  if (
    parseRateScaledByHundred(ratePercent) >
    parseRateScaledByHundred(MAX_KPR_RATE_PERCENT)
  ) {
    throw new BadRequestException(
      `${field} must be between 0 and ${MAX_KPR_RATE_PERCENT}`,
    );
  }
}

export function validateKprScheme(
  type: string,
  scheme: KprSchemeValue | null | undefined,
): KprSchemeValue | null {
  if (scheme && type !== "kpr") {
    throw new BadRequestException("Skema KPR hanya untuk liabilitas KPR");
  }
  return scheme ?? null;
}

/** Checks a submitted period list against the loan's terms and returns it as engine segments. */
export function validateRatePeriods(input: {
  type: string;
  interestMethod: InterestMethod;
  tenorMonths: number | null;
  kprScheme: KprSchemeValue | null;
  periods: RatePeriodInput[];
  hasFloatingHistory: boolean;
}): RateSegment[] {
  if (input.type !== "kpr") {
    throw new BadRequestException("Periode bunga hanya untuk KPR");
  }
  if (input.interestMethod !== "anuitas") {
    throw new BadRequestException("Periode bunga KPR memakai metode anuitas");
  }
  if (input.tenorMonths === null) {
    throw new BadRequestException("Isi tenor sebelum periode bunga");
  }
  const lastIndex = input.periods.length - 1;
  const segments = input.periods.map((period, index): RateSegment => {
    const months = period.months ?? null;
    if ((index === lastIndex) !== (months === null)) {
      throw new BadRequestException(
        "Hanya periode terakhir yang berlaku sampai akhir tenor",
      );
    }
    assertKprRate(period.ratePercent, `ratePeriods[${index}].ratePercent`);
    return { kind: period.kind, months, ratePercent: period.ratePercent };
  });
  const boundedMonths = segments.reduce((sum, s) => sum + (s.months ?? 0), 0);
  if (boundedMonths >= input.tenorMonths) {
    throw new BadRequestException(
      "Total periode bertenggat harus lebih pendek dari tenor",
    );
  }
  if (
    input.kprScheme !== null &&
    FIXED_FULL_TENOR_SCHEMES.has(input.kprScheme) &&
    (segments.length !== 1 || segments[0]?.kind !== "fixed")
  ) {
    throw new BadRequestException(
      "Skema ini berbunga/margin tetap sepanjang tenor — satu periode fixed",
    );
  }
  if (input.kprScheme === "flpp" && input.tenorMonths > FLPP_MAX_TENOR_MONTHS) {
    throw new BadRequestException("Tenor FLPP maksimal 480 bulan (40 tahun)");
  }
  if (
    input.hasFloatingHistory &&
    !segments.some((s) => s.kind === "floating")
  ) {
    throw new BadRequestException(
      "Hapus riwayat bunga floating sebelum menghapus periode floating",
    );
  }
  return segments;
}

/** Same periods, comparing rates by value ("5.5" equals "5.50"). */
export function sameSegments(a: RateSegment[], b: RateSegment[]): boolean {
  return (
    a.length === b.length &&
    a.every((segment, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        segment.kind === other.kind &&
        segment.months === other.months &&
        parseRateScaledByHundred(segment.ratePercent) ===
          parseRateScaledByHundred(other.ratePercent)
      );
    })
  );
}
