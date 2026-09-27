import type {
  KprScheme,
  LiabilityDto,
  LiabilityRatePeriodDto,
  RatePeriodKind,
} from "@wealthme/contracts";

export type KprPresetId =
  | "manual"
  | "flpp_tapak"
  | "flpp_rusun"
  | "konvensional"
  | "berjenjang"
  | "syariah_murabahah"
  | "syariah_mmq";

/** Where a shown rate came from; "user" once typed or loaded from a saved liability. */
export type RateSource = "official" | "example" | "user";

export interface RatePeriodDraft {
  kind: RatePeriodKind;
  /** Digits; ignored on the last period, which runs to maturity. */
  months: string;
  ratePercent: string;
  source: RateSource;
}

export interface KprPlanDraft {
  presetId: KprPresetId;
  scheme: KprScheme | null;
  periods: RatePeriodDraft[];
}

interface KprPreset {
  id: KprPresetId;
  scheme: KprScheme | null;
  source: RateSource;
  periods: ReadonlyArray<Omit<RatePeriodDraft, "source">>;
}

export const MAX_RATE_PERIODS = 10;
// Research: commonly 1-3% of the prepaid principal (docs/research/2026-09-26-kpr-indonesia.md §6).
export const DEFAULT_PREPAYMENT_PENALTY_PERCENT = "1.00";
const MAX_RATE_PERCENT = 30;
const RATE_PATTERN = /^\d{1,2}(\.\d{1,2})?$/;

const MANUAL: KprPreset = {
  id: "manual",
  scheme: null,
  source: "user",
  periods: [{ kind: "fixed", months: "", ratePercent: "" }],
};

// Figures: docs/research/2026-09-26-kpr-indonesia.md §1, §2, §4, §5 (2026). Only FLPP is official.
export const KPR_PRESETS: readonly KprPreset[] = [
  MANUAL,
  {
    id: "flpp_tapak",
    scheme: "flpp",
    source: "official",
    periods: [{ kind: "fixed", months: "", ratePercent: "5.00" }],
  },
  {
    id: "flpp_rusun",
    scheme: "flpp",
    source: "official",
    periods: [{ kind: "fixed", months: "", ratePercent: "6.00" }],
  },
  {
    id: "konvensional",
    scheme: "konvensional",
    source: "example",
    periods: [
      { kind: "fixed", months: "36", ratePercent: "2.75" },
      { kind: "floating", months: "", ratePercent: "11.00" },
    ],
  },
  {
    id: "berjenjang",
    scheme: "berjenjang",
    source: "example",
    periods: [
      { kind: "fixed", months: "24", ratePercent: "3.50" },
      { kind: "fixed", months: "12", ratePercent: "5.50" },
      { kind: "floating", months: "", ratePercent: "11.00" },
    ],
  },
  // KPR flat — user decision 2026-09-27: murabahah's margin is fixed for the
  // whole tenor with an equal installment (no re-annuitising balance), so
  // selecting this preset switches Metode Bunga to flat (page.tsx); the
  // single period here is still kept as the draft's margin/rate value.
  {
    id: "syariah_murabahah",
    scheme: "syariah_murabahah",
    source: "example",
    periods: [{ kind: "fixed", months: "", ratePercent: "6.00" }],
  },
  {
    id: "syariah_mmq",
    scheme: "syariah_mmq",
    source: "example",
    periods: [
      { kind: "fixed", months: "12", ratePercent: "3.30" },
      { kind: "floating", months: "", ratePercent: "11.00" },
    ],
  },
];

export function presetById(id: KprPresetId): KprPreset {
  return KPR_PRESETS.find((preset) => preset.id === id) ?? MANUAL;
}

export function draftFromPreset(id: KprPresetId): KprPlanDraft {
  const preset = presetById(id);
  return {
    presetId: preset.id,
    scheme: preset.scheme,
    periods: preset.periods.map((period) => ({
      ...period,
      source: preset.source,
    })),
  };
}

function ownPeriod(
  kind: RatePeriodKind,
  months: number | null,
  ratePercent: string,
): RatePeriodDraft {
  return {
    kind,
    months: months === null ? "" : String(months),
    ratePercent,
    source: "user",
  };
}

function presetIdFor(liability: LiabilityDto): KprPresetId {
  if (liability.kprScheme === null) return "manual";
  if (liability.kprScheme !== "flpp") return liability.kprScheme;
  return Number(liability.ratePeriods[0]?.ratePercent) === 6
    ? "flpp_rusun"
    : "flpp_tapak";
}

/** A saved liability's rates are the user's own numbers, never labelled as examples. */
export function draftFromLiability(liability: LiabilityDto): KprPlanDraft {
  const base = {
    presetId: presetIdFor(liability),
    scheme: liability.kprScheme,
  };
  if (liability.ratePeriods.length > 0) {
    return {
      ...base,
      periods: liability.ratePeriods.map((p) =>
        ownPeriod(p.kind, p.months, p.ratePercent),
      ),
    };
  }
  if (liability.fixedRateMonths !== null && liability.floatingRate !== null) {
    return {
      ...base,
      periods: [
        ownPeriod("fixed", liability.fixedRateMonths, liability.interestRate),
        ownPeriod("floating", null, liability.floatingRate),
      ],
    };
  }
  return {
    ...base,
    periods: [
      ownPeriod(
        "fixed",
        null,
        Number(liability.interestRate) > 0 ? liability.interestRate : "",
      ),
    ],
  };
}

/** Wire body for the periods, or null while any period is incomplete. */
export function toRatePeriodsBody(
  periods: RatePeriodDraft[],
): LiabilityRatePeriodDto[] | null {
  const lastIndex = periods.length - 1;
  const body = periods.map((period, index) => ({
    kind: period.kind,
    months: index === lastIndex ? null : Number(period.months),
    ratePercent: period.ratePercent.trim().replace(",", "."),
  }));
  const valid =
    body.length > 0 &&
    body.every(
      (p) =>
        RATE_PATTERN.test(p.ratePercent) &&
        Number(p.ratePercent) <= MAX_RATE_PERCENT &&
        (p.months === null || (Number.isInteger(p.months) && p.months >= 1)),
    );
  return valid ? body : null;
}
