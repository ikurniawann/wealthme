# Revisi G — Liabilitas Interest Engine (flat / efektif / anuitas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make liability interest follow how each Indonesian product really works (credit card = monthly rate on the outstanding balance, kendaraan/multiguna = flat on the original principal, KPR = annuity with a fixed rate first and then a floating rate). Store tenor, start date, and installment. Show the server-computed installment schedule on `/liabilitas`.

**Architecture:** All interest math lives in the pure BigInt module `apps/api/src/liabilities/amortisation.util.ts`: `computeInstallment`, a method-aware `splitPayment`, `rateForPeriod`, `monthsElapsed`, and `buildSchedule`. One additive Prisma migration adds `InterestMethod` and six nullable or defaulted columns on `liabilities`, so existing rows stay `efektif` and keep today's behaviour. `LiabilitiesService` picks a default method per type, computes and stores `installmentAmount`, which also becomes `minimumPayment` for flat/anuitas. `pay()` splits by method, and a new read-only `GET …/liabilities/:id/schedule` serves the projection. The web form shows fields based on the liability type. The Detail dialog renders the API schedule, so the web does no schedule or installment math of its own.

**Tech Stack:** NestJS 10, Prisma 5 (PostgreSQL), class-validator, Jest, and supertest for the API. Next.js 16 App Router, React 19, TanStack Query, Jest, and Testing Library for the web. `@wealthme/contracts` is the shared type package. The workspace uses pnpm.

**Spec:** `docs/superpowers/plans/2026-09-25-revisi-besar-catalog.md` — item 12 (Liabilitas — interest must reflect how KK / kendaraan / KPR actually work), sub-plan G.

## Global Constraints

- Work only inside the worktree `/home/stealth/Projects/wealthme-web-revisi-ab` on branch `feat/revisi-ab-calculators-quickfixes`.
- Never edit protected files: `apps/web/src/app/globals.css`, `apps/web/src/app/design-system.css`, `apps/web/src/lib/*`, `apps/web/src/components/ui/*`, `apps/web/src/components/wm/*`, `apps/web/src/components/charts/*`, `apps/web/src/components/shell/*`, `apps/web/src/app/layout.tsx`, `packages/config/*`.
- Every new user-visible string goes into **all three** of `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts` (dictionaries use `satisfies I18nDictionary`).
- Controllers keep the repo convention for DTO classes consumed by `@Body()`: value import preceded by `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`.
- Money is BigInt on the API and digit-strings over the wire; interest math stays in BigInt/fixed-point with round-half-up exactly like `amortisation.util.ts` today — no floats.
- Migrations are additive only. After a schema change run `pnpm exec prisma generate` from `apps/api`; rebuild contracts with `pnpm --filter @wealthme/contracts build` when new contract types are imported.
- Run tests locally only as the focused jest commands each task names. No `next build`, no full `turbo` runs.
- Lint every file you touch: `pnpm exec eslint <files>` from the owning app dir must exit 0.
- Commit messages: Conventional Commits, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code comments: none unless the WHY is non-obvious; one line max.
- The husky post-commit hook prints "post-commit script failed (code 1)" (graphify); the commit still lands. Never use `--no-verify`.

## Review Focus

1. **Flat loan already paid off:** when `remainingBalance` is 0, flat interest must be 0. It must never be `totalDebt × rate`, which would charge interest on a finished loan. Test: Task 1, "flat: no interest once the balance is 0".
2. **0% anuitas (promo KPR or family loan):** the installment must be `principal / tenor` with no division by zero. Test: Task 1, "anuitas at 0%".
3. **Notes-only PATCH on a liability with a user-overridden installment:** it must keep the stored installment and must not recompute it from tenor and rate. Test: Task 4, "a notes-only PATCH keeps the stored (possibly user-overridden) installment".
4. **Liability past its tenor, or with a start date in the future:** the schedule must show one payoff row, not an empty or negative schedule. Elapsed months are clamped at 0. Tests: Task 2, "monthsElapsed never goes negative"; Task 5, "past its tenor".
5. **Installment smaller than the interest due, or open-ended with a tiny installment:** the schedule stops after one no-progress row or at 600 rows. It never loops forever or returns a negative principal. Tests: Task 2, "stops after one row…" and "caps at 600 rows".

## Out of scope (deliberately untouched)

- `/liabilitas` Pay dialog's principal/interest _preview_ and the 6-month payoff projection chart keep their existing client-side efektif estimate (`computeAmortisationPreview`, labelled "Estimasi"). The real split is server-side in `pay()`; aligning the preview is a follow-up.
- Native `<input type="date">` for the new "Tanggal Akad" field matches the existing due-date input; catalog item 3 (sub-plan C) migrates all date inputs.

## File Map

| File                                                                                                                           | Responsibility                                | Tasks   |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------- |
| `apps/api/src/liabilities/amortisation.util.ts`                                                                                | Pure BigInt interest math                     | 1, 2    |
| `apps/api/src/liabilities/amortisation.util.spec.ts`                                                                           | Golden bank-style schedules                   | 1, 2    |
| `apps/api/prisma/schema.prisma` + `apps/api/prisma/migrations/20260925210000_revisi_g_liability_interest_method/migration.sql` | Additive columns + enum                       | 3       |
| `apps/api/src/liabilities/dto/{create,update}-liability.dto.ts`, `dto/create-liability.dto.spec.ts`                            | Request validation                            | 3       |
| `apps/api/src/liabilities/dto/liability-response.dto.ts`                                                                       | Response + schedule DTO classes               | 3, 5    |
| `packages/contracts/src/liabilities/index.ts`                                                                                  | Wire types for web                            | 3       |
| `apps/api/src/liabilities/liabilities.service.ts` + `.spec.ts`                                                                 | Mapping, defaults, installment, pay, schedule | 3, 4, 5 |
| `apps/api/src/liabilities/liabilities.controller.ts` + `.spec.ts`                                                              | `GET :id/schedule`                            | 5       |
| `apps/web/src/app/(app)/liabilitas/page.tsx` + `liabilitas.test.tsx`                                                           | Type-driven form, Detail schedule             | 3, 6, 7 |
| `apps/web/src/app/(app)/anggaran/obligations-section.test.tsx`                                                                 | Fixture gains new required fields             | 3       |
| `apps/web/src/i18n/{types,id,en}.ts`                                                                                           | New labels                                    | 6, 7    |

---

### Task 1: `computeInstallment` + method-aware `splitPayment` (golden specs)

**Files:**

- Modify: `apps/api/src/liabilities/amortisation.util.ts:20-84`
- Test: `apps/api/src/liabilities/amortisation.util.spec.ts` (import line 1; append after line 156)

**Interfaces:**

- Consumes: nothing.
- Produces (all exported from `./amortisation.util`):
  - `type InterestMethod = "efektif" | "flat" | "anuitas"` (string-identical to the Prisma enum added in Task 3).
  - `SplitPaymentInput` gains `method?: InterestMethod` (default `"efektif"`) and `originalPrincipal?: bigint` (required when `method === "flat"`, else throws `Error("flat interest needs originalPrincipal")`).
  - `computeInstallment(input: { method: InterestMethod; principal: bigint; annualInterestRatePercent: string; tenorMonths: number; rateIsMonthly?: boolean }): bigint` — throws `RangeError` when `tenorMonths` is not an integer ≥ 1.
  - `defaultInterestMethod(liabilityType: string): InterestMethod` — `kpr→anuitas`, `kendaraan|pinjaman_pribadi→flat`, anything else `efektif`.
  - Internal (not exported, reused by Task 2): `rateDenominator(rateIsMonthly)`, `monthlyInterestDue({ method, originalPrincipal, balance, rateScaled, denominator })`.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/liabilities/amortisation.util.spec.ts`, replace line 1:

```ts
import { splitPayment } from "./amortisation.util";
```

with:

```ts
import {
  computeInstallment,
  defaultInterestMethod,
  splitPayment,
} from "./amortisation.util";
```

Append at the end of the file (after the closing `});` on line 156):

```ts
describe("computeInstallment — revisi G", () => {
  it("anuitas: KPR Rp 500 jt @ 8%/yr over 240 bln -> Rp 4.182.200/bln", () => {
    // Hand check: r = 0.08/12 = 0.0066667, (1+r)^240 = 4.926803, A = 500e6 × r × 4.926803 / 3.926803 = 4,182,200.34.
    expect(
      computeInstallment({
        method: "anuitas",
        principal: 500_000_000n,
        annualInterestRatePercent: "8.00",
        tenorMonths: 240,
      }),
    ).toBe(4_182_200n);
  });

  it("flat: kendaraan Rp 200 jt @ 6%/yr flat over 36 bln -> Rp 6.555.556/bln", () => {
    // Hand check: interest 200e6 × 6% / 12 = 1,000,000; principal 200e6 / 36 = 5,555,555.56; sum 6,555,555.56.
    expect(
      computeInstallment({
        method: "flat",
        principal: 200_000_000n,
        annualInterestRatePercent: "6",
        tenorMonths: 36,
      }),
    ).toBe(6_555_556n);
  });

  it("efektif: first month = principal/tenor + interest on the full principal", () => {
    // 120e6 / 12 = 10,000,000 principal; 120e6 × 1% = 1,200,000 interest.
    expect(
      computeInstallment({
        method: "efektif",
        principal: 120_000_000n,
        annualInterestRatePercent: "12",
        tenorMonths: 12,
      }),
    ).toBe(11_200_000n);
  });

  it("anuitas at 0%: principal / tenor, no division by zero", () => {
    expect(
      computeInstallment({
        method: "anuitas",
        principal: 120_000_000n,
        annualInterestRatePercent: "0",
        tenorMonths: 12,
      }),
    ).toBe(10_000_000n);
  });

  it("anuitas with a per-month rate (rateIsMonthly) skips the /12", () => {
    // r = 1%/month, n = 12: A = 12e6 × 0.01 × 1.01^12 / (1.01^12 − 1) = 1,066,185.46.
    expect(
      computeInstallment({
        method: "anuitas",
        principal: 12_000_000n,
        annualInterestRatePercent: "1",
        tenorMonths: 12,
        rateIsMonthly: true,
      }),
    ).toBe(1_066_185n);
  });

  it("returns 0 for a zero principal", () => {
    expect(
      computeInstallment({
        method: "flat",
        principal: 0n,
        annualInterestRatePercent: "6",
        tenorMonths: 36,
      }),
    ).toBe(0n);
  });

  it.each([0, -1, 1.5])("rejects tenorMonths %p", (tenorMonths) => {
    expect(() =>
      computeInstallment({
        method: "anuitas",
        principal: 1_000_000n,
        annualInterestRatePercent: "8",
        tenorMonths,
      }),
    ).toThrow(RangeError);
  });
});

describe("splitPayment per interest method — revisi G", () => {
  it("kartu kredit: Rp 10 jt outstanding @ 2.25%/bln -> interest Rp 225.000", () => {
    const result = splitPayment({
      paymentAmount: 500_000n,
      remainingBalance: 10_000_000n,
      annualInterestRatePercent: "2.25",
      rateIsMonthly: true,
    });
    expect(result.interest).toBe(225_000n);
    expect(result.principal).toBe(275_000n);
  });

  it("flat: interest is on the ORIGINAL principal, not the remaining balance", () => {
    // 200e6 × 6% / 12 = 1,000,000 (efektif on the 150e6 balance would be 750,000).
    const result = splitPayment({
      method: "flat",
      originalPrincipal: 200_000_000n,
      paymentAmount: 6_555_556n,
      remainingBalance: 150_000_000n,
      annualInterestRatePercent: "6.00",
    });
    expect(result.interest).toBe(1_000_000n);
    expect(result.principal).toBe(5_555_556n);
  });

  it("flat: no interest once the balance is 0", () => {
    const result = splitPayment({
      method: "flat",
      originalPrincipal: 200_000_000n,
      paymentAmount: 1_000_000n,
      remainingBalance: 0n,
      annualInterestRatePercent: "6.00",
    });
    expect(result.interest).toBe(0n);
    expect(result.principal).toBe(0n);
  });

  it("flat without originalPrincipal is a programming error", () => {
    expect(() =>
      splitPayment({
        method: "flat",
        paymentAmount: 1_000_000n,
        remainingBalance: 1_000_000n,
        annualInterestRatePercent: "6",
      }),
    ).toThrow("flat interest needs originalPrincipal");
  });

  it("anuitas: month 1 of the KPR 500 jt / 8% / 240 schedule", () => {
    // 500e6 × 0.08 / 12 = 3,333,333.33 -> 3,333,333; principal 4,182,200 − 3,333,333.
    const result = splitPayment({
      method: "anuitas",
      paymentAmount: 4_182_200n,
      remainingBalance: 500_000_000n,
      annualInterestRatePercent: "8.00",
    });
    expect(result.interest).toBe(3_333_333n);
    expect(result.principal).toBe(848_867n);
  });
});

describe("defaultInterestMethod — revisi G", () => {
  it.each([
    ["kpr", "anuitas"],
    ["kendaraan", "flat"],
    ["pinjaman_pribadi", "flat"],
    ["kartu_kredit", "efektif"],
    ["lainnya", "efektif"],
  ])("%s -> %s", (type, method) => {
    expect(defaultInterestMethod(type)).toBe(method);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/amortisation.util.spec.ts`
Expected: FAIL. The suite fails to compile with `Module '"./amortisation.util"' has no exported member 'computeInstallment'` (under isolated transpilation the error is `computeInstallment is not a function`).

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/liabilities/amortisation.util.ts`, replace lines 20-26 (the `SplitPaymentInput` interface) with:

```ts
export type InterestMethod = "efektif" | "flat" | "anuitas";

export interface SplitPaymentInput {
  /** EPIC-033 p20 — true for kartu_kredit: the rate is already per month. */
  rateIsMonthly?: boolean;
  /** Defaults to "efektif"; "anuitas" splits like "efektif", only its installment is fixed. */
  method?: InterestMethod;
  /** Required for "flat": interest accrues on the original principal every month. */
  originalPrincipal?: bigint;
  paymentAmount: bigint;
  remainingBalance: bigint;
  annualInterestRatePercent: string;
}

export interface InstallmentInput {
  method: InterestMethod;
  principal: bigint;
  annualInterestRatePercent: string;
  tenorMonths: number;
  rateIsMonthly?: boolean;
}
```

Replace lines 52-84 (from `/** Round-half-up division …` to the end of `splitPayment`) with:

```ts
/** Round-half-up division for non-negative BigInt operands. */
function roundHalfUpDivide(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

function rateDenominator(rateIsMonthly: boolean | undefined): bigint {
  return rateIsMonthly ? PER_MONTH_RATE_DENOMINATOR : MONTHLY_RATE_DENOMINATOR;
}

function monthlyInterestDue(input: {
  method: InterestMethod;
  originalPrincipal: bigint | undefined;
  balance: bigint;
  rateScaled: bigint;
  denominator: bigint;
}): bigint {
  if (input.balance <= 0n) return 0n;
  if (input.method === "flat") {
    if (input.originalPrincipal === undefined) {
      throw new Error("flat interest needs originalPrincipal");
    }
    return roundHalfUpDivide(
      input.originalPrincipal * input.rateScaled,
      input.denominator,
    );
  }
  return roundHalfUpDivide(input.balance * input.rateScaled, input.denominator);
}

/**
 * Splits a liability payment into its interest and principal components.
 *
 * - `interest = round-half-up(base * monthlyRate)` where `base` is the
 *   original principal for "flat" and the remaining balance otherwise,
 *   capped at `paymentAmount` so principal never goes negative.
 * - `principal = paymentAmount - interest`, capped at `remainingBalance` so
 *   the balance never goes negative.
 */
export function splitPayment(input: SplitPaymentInput): SplitPaymentResult {
  const interestDue = monthlyInterestDue({
    method: input.method ?? "efektif",
    originalPrincipal: input.originalPrincipal,
    balance: input.remainingBalance,
    rateScaled: parseRateScaledByHundred(input.annualInterestRatePercent),
    denominator: rateDenominator(input.rateIsMonthly),
  });

  const interest =
    interestDue > input.paymentAmount ? input.paymentAmount : interestDue;

  const principalRaw = input.paymentAmount - interest;
  const principal =
    principalRaw > input.remainingBalance
      ? input.remainingBalance
      : principalRaw;

  return { interest, principal };
}

/**
 * Monthly installment for a new loan of `principal` over `tenorMonths`.
 * flat: (P + P·r·n) / n. anuitas: P·r·(1+r)^n / ((1+r)^n − 1).
 * efektif: the FIRST month of an equal-principal loan, P/n + P·r.
 */
export function computeInstallment(input: InstallmentInput): bigint {
  if (!Number.isInteger(input.tenorMonths) || input.tenorMonths < 1) {
    throw new RangeError("tenorMonths must be a positive integer");
  }
  const principal = input.principal;
  if (principal <= 0n) return 0n;
  const n = BigInt(input.tenorMonths);
  const rate = parseRateScaledByHundred(input.annualInterestRatePercent);
  const denominator = rateDenominator(input.rateIsMonthly);

  switch (input.method) {
    case "flat":
      return roundHalfUpDivide(
        principal * denominator + principal * rate * n,
        denominator * n,
      );
    case "anuitas": {
      if (rate === 0n) return roundHalfUpDivide(principal, n);
      // With r = rate/denominator the annuity formula becomes an exact integer ratio.
      const growth = (denominator + rate) ** n;
      return roundHalfUpDivide(
        principal * rate * growth,
        denominator * (growth - denominator ** n),
      );
    }
    case "efektif":
      return (
        roundHalfUpDivide(principal, n) +
        roundHalfUpDivide(principal * rate, denominator)
      );
  }
}

export function defaultInterestMethod(liabilityType: string): InterestMethod {
  switch (liabilityType) {
    case "kpr":
      return "anuitas";
    case "kendaraan":
    case "pinjaman_pribadi":
      return "flat";
    default:
      return "efektif";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities/amortisation.util.spec.ts`
Expected: PASS — the original 11 EPIC-023 tests plus the 19 new ones (30 total), all green.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/amortisation.util.ts src/liabilities/amortisation.util.spec.ts`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/amortisation.util.ts apps/api/src/liabilities/amortisation.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): per-method installment and interest split (efektif, flat, anuitas)

computeInstallment covers flat (interest on original principal), anuitas
(exact integer annuity formula) and efektif; splitPayment learns flat.
Pure BigInt with round-half-up, golden-tested against bank-style figures.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Schedule builder — `buildSchedule`, `rateForPeriod`, `monthsElapsed`

**Files:**

- Modify: `apps/api/src/liabilities/amortisation.util.ts` (append after `defaultInterestMethod` from Task 1)
- Test: `apps/api/src/liabilities/amortisation.util.spec.ts` (extend the import; append)

**Interfaces:**

- Consumes: Task 1 `computeInstallment`, `InterestMethod`, internal `rateDenominator`, `monthlyInterestDue`, `parseRateScaledByHundred`, `roundHalfUpDivide`.
- Produces (exported):
  - `MAX_SCHEDULE_ROWS = 600`.
  - `interface RatePeriodInput { period: number; baseRatePercent: string; fixedRateMonths: number | null; floatingRatePercent: string | null }`.
  - `rateForPeriod(input: RatePeriodInput): string`. It returns the floating rate only when both fixed-rate fields are set and `period > fixedRateMonths`.
  - `monthsElapsed(start: Date, now: Date): number`. It counts whole UTC months and never returns a negative number.
  - `interface ScheduleInput { method: InterestMethod; remainingBalance: bigint; originalPrincipal: bigint; annualInterestRatePercent: string; rateIsMonthly?: boolean; installmentAmount: bigint | null; remainingMonths: number | null; firstPeriod: number; fixedRateMonths: number | null; floatingRatePercent: string | null }`.
  - `interface ScheduleRow { period: number; installment: bigint; interest: bigint; principal: bigint; remaining: bigint }`.
  - `buildSchedule(input: ScheduleInput): ScheduleRow[]`.

- [ ] **Step 1: Write the failing tests**

Extend the import at the top of `amortisation.util.spec.ts` to:

```ts
import {
  buildSchedule,
  computeInstallment,
  defaultInterestMethod,
  monthsElapsed,
  rateForPeriod,
  splitPayment,
} from "./amortisation.util";
```

Append at the end of the file:

```ts
describe("rateForPeriod / monthsElapsed — revisi G", () => {
  const kpr = {
    baseRatePercent: "8.00",
    fixedRateMonths: 36,
    floatingRatePercent: "11.00",
  };

  it("uses the fixed rate through the last fixed month and the floating rate after", () => {
    expect(rateForPeriod({ ...kpr, period: 36 })).toBe("8.00");
    expect(rateForPeriod({ ...kpr, period: 37 })).toBe("11.00");
  });

  it("stays on the base rate when no floating rate is set", () => {
    expect(
      rateForPeriod({ ...kpr, floatingRatePercent: null, period: 100 }),
    ).toBe("8.00");
  });

  it("counts whole months, minus one when the day of month has not come yet", () => {
    const start = new Date("2025-09-10T00:00:00.000Z");
    expect(monthsElapsed(start, new Date("2026-09-25T00:00:00.000Z"))).toBe(12);
    expect(monthsElapsed(start, new Date("2026-09-05T00:00:00.000Z"))).toBe(11);
    expect(monthsElapsed(start, start)).toBe(0);
  });

  it("monthsElapsed never goes negative for a future start date", () => {
    expect(
      monthsElapsed(
        new Date("2027-01-01T00:00:00.000Z"),
        new Date("2026-09-25T00:00:00.000Z"),
      ),
    ).toBe(0);
  });
});

describe("buildSchedule — revisi G golden schedules", () => {
  const NO_FLOAT = { fixedRateMonths: null, floatingRatePercent: null };

  it("anuitas: KPR 500 jt / 8% / 240 bln, fixed installment 4.182.200, pays off exactly", () => {
    const rows = buildSchedule({
      method: "anuitas",
      remainingBalance: 500_000_000n,
      originalPrincipal: 500_000_000n,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      remainingMonths: 240,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(240);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 4_182_200n,
      interest: 3_333_333n,
      principal: 848_867n,
      remaining: 499_151_133n,
    });
    // 499,151,133 × 0.08/12 = 3,327,674.22 -> 3,327,674.
    expect(rows[1]).toEqual({
      period: 2,
      installment: 4_182_200n,
      interest: 3_327_674n,
      principal: 854_526n,
      remaining: 498_296_607n,
    });
    expect(rows[239]).toEqual({
      period: 240,
      installment: 4_182_420n,
      interest: 27_698n,
      principal: 4_154_722n,
      remaining: 0n,
    });
    expect(rows.reduce((sum, r) => sum + r.principal, 0n)).toBe(500_000_000n);
  });

  it("anuitas KPR: fixed 8% for 36 bln, then floating 11% re-amortised over the remaining 204 bln", () => {
    const rows = buildSchedule({
      method: "anuitas",
      remainingBalance: 500_000_000n,
      originalPrincipal: 500_000_000n,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      remainingMonths: 240,
      firstPeriod: 1,
      fixedRateMonths: 36,
      floatingRatePercent: "11.00",
    });
    expect(rows).toHaveLength(240);
    expect(rows[35]).toEqual({
      period: 36,
      installment: 4_182_200n,
      interest: 3_111_079n,
      principal: 1_071_121n,
      remaining: 465_590_716n,
    });
    // 465,590,716 × 0.11/12 = 4,267,914.90 -> 4,267,915.
    expect(rows[36]).toEqual({
      period: 37,
      installment: 5_053_432n,
      interest: 4_267_915n,
      principal: 785_517n,
      remaining: 464_805_199n,
    });
    expect(rows[239]?.remaining).toBe(0n);
  });

  it("anuitas mid-life: continues from period 13 with the current balance", () => {
    const rows = buildSchedule({
      method: "anuitas",
      remainingBalance: 489_431_673n,
      originalPrincipal: 500_000_000n,
      annualInterestRatePercent: "8.00",
      installmentAmount: 4_182_200n,
      remainingMonths: 228,
      firstPeriod: 13,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(228);
    expect(rows[0]).toEqual({
      period: 13,
      installment: 4_182_200n,
      interest: 3_262_878n,
      principal: 919_322n,
      remaining: 488_512_351n,
    });
    expect(rows[227]).toEqual({
      period: 240,
      installment: 4_182_420n,
      interest: 27_698n,
      principal: 4_154_722n,
      remaining: 0n,
    });
  });

  it("flat: kendaraan 200 jt / 6% / 36 bln — constant 1.000.000 interest, last row absorbs rounding", () => {
    const rows = buildSchedule({
      method: "flat",
      remainingBalance: 200_000_000n,
      originalPrincipal: 200_000_000n,
      annualInterestRatePercent: "6",
      installmentAmount: 6_555_556n,
      remainingMonths: 36,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(36);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 6_555_556n,
      interest: 1_000_000n,
      principal: 5_555_556n,
      remaining: 194_444_444n,
    });
    expect(rows[35]).toEqual({
      period: 36,
      installment: 6_555_540n,
      interest: 1_000_000n,
      principal: 5_555_540n,
      remaining: 0n,
    });
  });

  it("efektif kartu kredit: open-ended, min. bayar 800.000 on 8 jt @ 2.25%/bln", () => {
    const rows = buildSchedule({
      method: "efektif",
      remainingBalance: 8_000_000n,
      originalPrincipal: 30_000_000n,
      annualInterestRatePercent: "2.25",
      rateIsMonthly: true,
      installmentAmount: 800_000n,
      remainingMonths: null,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 800_000n,
      interest: 180_000n,
      principal: 620_000n,
      remaining: 7_380_000n,
    });
    expect(rows[11]).toEqual({
      period: 12,
      installment: 366_622n,
      interest: 8_067n,
      principal: 358_555n,
      remaining: 0n,
    });
  });

  it("efektif with a tenor and no installment: equal principal, declining interest", () => {
    const rows = buildSchedule({
      method: "efektif",
      remainingBalance: 12_000_000n,
      originalPrincipal: 12_000_000n,
      annualInterestRatePercent: "12",
      installmentAmount: null,
      remainingMonths: 12,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({
      period: 1,
      installment: 1_120_000n,
      interest: 120_000n,
      principal: 1_000_000n,
      remaining: 11_000_000n,
    });
    expect(rows[11]).toEqual({
      period: 12,
      installment: 1_010_000n,
      interest: 10_000n,
      principal: 1_000_000n,
      remaining: 0n,
    });
  });

  it("stops after one row when the installment does not cover the interest", () => {
    const rows = buildSchedule({
      method: "efektif",
      remainingBalance: 100_000_000n,
      originalPrincipal: 100_000_000n,
      annualInterestRatePercent: "12",
      installmentAmount: 500_000n,
      remainingMonths: null,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toEqual([
      {
        period: 1,
        installment: 500_000n,
        interest: 500_000n,
        principal: 0n,
        remaining: 100_000_000n,
      },
    ]);
  });

  it("caps at 600 rows for an open-ended tiny installment", () => {
    const rows = buildSchedule({
      method: "efektif",
      remainingBalance: 1_000_000_000_000n,
      originalPrincipal: 1_000_000_000_000n,
      annualInterestRatePercent: "0",
      installmentAmount: 1n,
      remainingMonths: null,
      firstPeriod: 1,
      ...NO_FLOAT,
    });
    expect(rows).toHaveLength(600);
  });

  it("returns no rows when neither an installment nor a tenor is known", () => {
    expect(
      buildSchedule({
        method: "efektif",
        remainingBalance: 5_000_000n,
        originalPrincipal: 5_000_000n,
        annualInterestRatePercent: "10",
        installmentAmount: null,
        remainingMonths: null,
        firstPeriod: 1,
        ...NO_FLOAT,
      }),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/amortisation.util.spec.ts`
Expected: FAIL. The suite reports `has no exported member 'buildSchedule'` (and `monthsElapsed`, `rateForPeriod`).

- [ ] **Step 3: Write minimal implementation**

Append to `apps/api/src/liabilities/amortisation.util.ts`:

```ts
export const MAX_SCHEDULE_ROWS = 600;

export interface RatePeriodInput {
  period: number;
  baseRatePercent: string;
  fixedRateMonths: number | null;
  floatingRatePercent: string | null;
}

function isFloatingPeriod(input: RatePeriodInput): boolean {
  return (
    input.fixedRateMonths !== null &&
    input.floatingRatePercent !== null &&
    input.period > input.fixedRateMonths
  );
}

export function rateForPeriod(input: RatePeriodInput): string {
  return isFloatingPeriod(input) && input.floatingRatePercent !== null
    ? input.floatingRatePercent
    : input.baseRatePercent;
}

/** Whole installment months between `start` and `now` (UTC), never negative. */
export function monthsElapsed(start: Date, now: Date): number {
  const months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth()) -
    (now.getUTCDate() < start.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
}

export interface ScheduleInput {
  method: InterestMethod;
  remainingBalance: bigint;
  originalPrincipal: bigint;
  annualInterestRatePercent: string;
  rateIsMonthly?: boolean;
  /** Fixed monthly payment (flat/anuitas installment or efektif minimumPayment); null = none. */
  installmentAmount: bigint | null;
  /** Installments left on the contract; null = open-ended (e.g. a credit card). */
  remainingMonths: number | null;
  /** Contract period number of the next installment, 1-based. */
  firstPeriod: number;
  fixedRateMonths: number | null;
  floatingRatePercent: string | null;
}

export interface ScheduleRow {
  period: number;
  installment: bigint;
  interest: bigint;
  principal: bigint;
  remaining: bigint;
}

export function buildSchedule(input: ScheduleInput): ScheduleRow[] {
  const maxRows = Math.min(
    MAX_SCHEDULE_ROWS,
    input.remainingMonths ?? MAX_SCHEDULE_ROWS,
  );
  const equalPrincipal =
    input.method === "efektif" &&
    input.installmentAmount === null &&
    input.remainingMonths !== null
      ? roundHalfUpDivide(input.remainingBalance, BigInt(input.remainingMonths))
      : null;
  if (input.installmentAmount === null && equalPrincipal === null) return [];

  const denominator = rateDenominator(input.rateIsMonthly);
  const rows: ScheduleRow[] = [];
  let balance = input.remainingBalance;
  let installment = input.installmentAmount ?? 0n;
  let floatingRecomputed = false;

  for (let i = 0; i < maxRows && balance > 0n; i += 1) {
    const ratePeriod: RatePeriodInput = {
      period: input.firstPeriod + i,
      baseRatePercent: input.annualInterestRatePercent,
      fixedRateMonths: input.fixedRateMonths,
      floatingRatePercent: input.floatingRatePercent,
    };
    const ratePercent = rateForPeriod(ratePeriod);
    if (
      input.method === "anuitas" &&
      !floatingRecomputed &&
      isFloatingPeriod(ratePeriod) &&
      input.remainingMonths !== null
    ) {
      // Banks re-amortise the outstanding balance over the remaining tenor once the fixed period ends.
      installment = computeInstallment({
        method: "anuitas",
        principal: balance,
        annualInterestRatePercent: ratePercent,
        tenorMonths: input.remainingMonths - i,
        rateIsMonthly: input.rateIsMonthly,
      });
      floatingRecomputed = true;
    }

    const interestDue = monthlyInterestDue({
      method: input.method,
      originalPrincipal: input.originalPrincipal,
      balance,
      rateScaled: parseRateScaledByHundred(ratePercent),
      denominator,
    });
    const payoff = balance + interestDue;
    const isLastPeriod =
      input.remainingMonths !== null && i === input.remainingMonths - 1;
    const scheduled =
      equalPrincipal !== null ? equalPrincipal + interestDue : installment;
    const payment = isLastPeriod || scheduled > payoff ? payoff : scheduled;
    const interest = interestDue > payment ? payment : interestDue;
    const principal = payment - interest;
    balance -= principal;

    rows.push({
      period: ratePeriod.period,
      installment: payment,
      interest,
      principal,
      remaining: balance,
    });
    if (principal === 0n) break;
  }
  return rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities/amortisation.util.spec.ts`
Expected: PASS — 43 tests (Task 1’s 30 + 13 new).

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/amortisation.util.ts src/liabilities/amortisation.util.spec.ts`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/amortisation.util.ts apps/api/src/liabilities/amortisation.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): pure installment schedule builder with KPR fixed-to-floating

buildSchedule projects {period, installment, interest, principal, remaining}
from the current balance for every method; anuitas re-amortises at the
floating rate once the fixed period ends. Capped at 600 rows.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Schema + migration + DTOs + contracts + response mapping

**Files:**

- Modify: `apps/api/prisma/schema.prisma:109-115` (add enum after `LiabilityType`) and `:1191` (after `currency` in `model Liability`)
- Create: `apps/api/prisma/migrations/20260925210000_revisi_g_liability_interest_method/migration.sql`
- Modify: `apps/api/src/liabilities/dto/create-liability.dto.ts`, `apps/api/src/liabilities/dto/update-liability.dto.ts`, `apps/api/src/liabilities/dto/liability-response.dto.ts:3-24`
- Create: `apps/api/src/liabilities/dto/create-liability.dto.spec.ts`
- Modify: `apps/api/src/liabilities/liabilities.service.ts:58-113` (`LiabilityRow`, `toLiabilityDto`)
- Modify: `apps/api/src/liabilities/liabilities.service.spec.ts:113-125` (`BASE`) + new describe
- Modify: `packages/contracts/src/liabilities/index.ts`
- Modify: `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx:64-85`, `apps/web/src/app/(app)/anggaran/obligations-section.test.tsx:81-99`

**Interfaces:**

- Consumes: Task 1 `InterestMethod` type (for `LiabilityRow`).
- Produces:
  - Prisma: `enum InterestMethod { efektif flat anuitas }`. The `Liability` model gains `interestMethod` (default `efektif`), `tenorMonths Int?`, `startDate DateTime?`, `installmentAmount BigInt?`, `fixedRateMonths Int?`, and `floatingRate Decimal(5,2)?`.
  - API request DTOs (create and update) gain the optional fields `interestMethod`, `tenorMonths` (int 1..600), `startDate` (ISO), `installmentAmount` (digit string), `fixedRateMonths` (int 1..600), and `floatingRate` (decimal string).
  - `LiabilityResponseDto` gains `interestMethod: string`, `tenorMonths: number | null`, `startDate: string | null`, `installmentAmount: string | null`, `fixedRateMonths: number | null`, and `floatingRate: string | null`.
  - Contracts gain `InterestMethod`, the same six fields on `LiabilityDto` (required) and on `Create/UpdateLiabilityDto` (optional), plus `LiabilityScheduleRowDto { period: number; installment: string; interest: string; principal: string; remaining: string }` and `LiabilityScheduleDto { liabilityId: string; interestMethod: InterestMethod; installmentAmount: string | null; rows: LiabilityScheduleRowDto[] }`. Tasks 5-7 use these.

- [ ] **Step 1: Write the failing tests**

(a) Create `apps/api/src/liabilities/dto/create-liability.dto.spec.ts`:

```ts
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateLiabilityDto } from "./create-liability.dto";
import { UpdateLiabilityDto } from "./update-liability.dto";

const BASE = {
  name: "Cicilan Mobil",
  type: "kendaraan",
  totalDebt: "200000000",
  remainingBalance: "200000000",
};

async function invalidProps(
  cls: typeof CreateLiabilityDto | typeof UpdateLiabilityDto,
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((e) => e.property);
}

describe("Create/UpdateLiabilityDto — revisi G interest terms", () => {
  it("accepts a full flat/anuitas term set", async () => {
    expect(
      await invalidProps(CreateLiabilityDto, {
        ...BASE,
        interestMethod: "anuitas",
        tenorMonths: 240,
        startDate: "2026-01-15T00:00:00.000Z",
        installmentAmount: "4182200",
        fixedRateMonths: 36,
        floatingRate: "11.00",
      }),
    ).toEqual([]);
  });

  it.each([
    ["interestMethod", "bunga"],
    ["tenorMonths", 0],
    ["tenorMonths", 601],
    ["tenorMonths", 1.5],
    ["startDate", "kemarin"],
    ["installmentAmount", "-5"],
    ["fixedRateMonths", 0],
    ["floatingRate", "11,5"],
  ])("CreateLiabilityDto rejects %s = %p", async (field, value) => {
    expect(
      await invalidProps(CreateLiabilityDto, { ...BASE, [field]: value }),
    ).toContain(field);
  });

  it("UpdateLiabilityDto validates the same fields", async () => {
    expect(
      await invalidProps(UpdateLiabilityDto, { tenorMonths: 0 }),
    ).toContain("tenorMonths");
    expect(
      await invalidProps(UpdateLiabilityDto, { interestMethod: "flat" }),
    ).toEqual([]);
  });
});
```

(b) In `apps/api/src/liabilities/liabilities.service.spec.ts`, extend `BASE` (lines 113-125) by adding these properties after `currency: "IDR",`:

```ts
  interestMethod: "efektif",
  tenorMonths: null,
  startDate: null,
  installmentAmount: null,
  fixedRateMonths: null,
  floatingRate: null,
```

Then add a new block directly after the `describe("paymentRatio", …)` block closes (before `describe("paidThisPeriod", …)`):

```ts
describe("interest terms in the response (revisi G)", () => {
  it("maps interestMethod, tenor, start date, installment and KPR floating terms to wire values", async () => {
    prisma.liability.findMany.mockResolvedValue([
      {
        ...BASE,
        type: "kpr",
        totalDebt: BigInt(500_000_000),
        remainingBalance: BigInt(500_000_000),
        interestMethod: "anuitas",
        tenorMonths: 240,
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        installmentAmount: BigInt(4_182_200),
        fixedRateMonths: 36,
        floatingRate: { toString: () => "11" },
      },
    ]);

    const [dto] = await service.findAll("fg-1");

    expect(dto).toEqual(
      expect.objectContaining({
        interestMethod: "anuitas",
        tenorMonths: 240,
        startDate: "2026-01-15T00:00:00.000Z",
        installmentAmount: "4182200",
        fixedRateMonths: 36,
        floatingRate: "11",
      }),
    );
  });

  it("maps a legacy efektif row with no terms to nulls", async () => {
    prisma.liability.findMany.mockResolvedValue([
      {
        ...BASE,
        totalDebt: BigInt(10_000_000),
        remainingBalance: BigInt(5_000_000),
      },
    ]);

    const [dto] = await service.findAll("fg-1");

    expect(dto).toEqual(
      expect.objectContaining({
        interestMethod: "efektif",
        tenorMonths: null,
        startDate: null,
        installmentAmount: null,
        fixedRateMonths: null,
        floatingRate: null,
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/dto/create-liability.dto.spec.ts src/liabilities/liabilities.service.spec.ts -t "revisi G"`
Expected: FAIL. In the DTO spec, `it.each` rows report `expect(received).toContain(expected)` because the unknown fields are not validated. In the service spec, `objectContaining` reports `interestMethod` as `undefined`.

- [ ] **Step 3a: Schema + migration**

In `apps/api/prisma/schema.prisma`, directly after the `enum LiabilityType { … }` block (ends line 115) add:

```prisma

enum InterestMethod {
  efektif
  flat
  anuitas
}
```

In `model Liability`, directly after the line `  currency            String        @default("IDR")` add:

```prisma
  // Revisi G (catalog 12) — per-product interest engine; legacy rows stay efektif.
  interestMethod      InterestMethod @default(efektif)
  tenorMonths         Int?
  startDate           DateTime?
  installmentAmount   BigInt?
  fixedRateMonths     Int?
  floatingRate        Decimal?      @db.Decimal(5, 2)
```

Create `apps/api/prisma/migrations/20260925210000_revisi_g_liability_interest_method/migration.sql`. If a sibling sub-plan already committed a migration with this timestamp, bump the timestamp to the next free minute.

```sql
-- Revisi G (catalog item 12): per-product interest method, tenor, installment and KPR fixed/floating terms.
CREATE TYPE "InterestMethod" AS ENUM ('efektif', 'flat', 'anuitas');

ALTER TABLE "liabilities"
  ADD COLUMN "interestMethod" "InterestMethod" NOT NULL DEFAULT 'efektif',
  ADD COLUMN "tenorMonths" INTEGER,
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "installmentAmount" BIGINT,
  ADD COLUMN "fixedRateMonths" INTEGER,
  ADD COLUMN "floatingRate" DECIMAL(5,2);
```

Run (from `apps/api`): `pnpm exec prisma generate`
Expected: `✔ Generated Prisma Client`.

- [ ] **Step 3b: Request DTOs**

In `apps/api/src/liabilities/dto/create-liability.dto.ts`, replace the two import statements (lines 1-11) with:

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InterestMethod, LiabilityType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
```

and add before the class's closing `}` (after the `currency` property):

```ts

  @ApiPropertyOptional({
    enum: InterestMethod,
    description:
      "Defaults per type on create: kpr→anuitas, kendaraan/pinjaman_pribadi→flat, otherwise efektif",
  })
  @IsOptional()
  @IsEnum(InterestMethod)
  interestMethod?: InterestMethod;

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  tenorMonths?: number;

  @ApiPropertyOptional({ description: "Loan start (akad) date, ISO 8601" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "Monthly installment override as numeric string; computed for flat/anuitas when omitted",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "installmentAmount must be a numeric string" })
  installmentAmount?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 600,
    description: "KPR fixed-rate period in months",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  fixedRateMonths?: number;

  @ApiPropertyOptional({
    description: "Annual rate after the fixed period, e.g. '11.00'",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "floatingRate must be a decimal string",
  })
  floatingRate?: string;
```

In `apps/api/src/liabilities/dto/update-liability.dto.ts`, replace the two import statements (lines 1-10) with:

```ts
import { ApiPropertyOptional } from "@nestjs/swagger";
import { InterestMethod, LiabilityType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
```

and add the same six properties before the class's closing `}` (identical decorators, with `@ApiPropertyOptional({ enum: InterestMethod })` for `interestMethod`):

```ts

  @ApiPropertyOptional({ enum: InterestMethod })
  @IsOptional()
  @IsEnum(InterestMethod)
  interestMethod?: InterestMethod;

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  tenorMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: "installmentAmount must be a numeric string" })
  installmentAmount?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 600 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  fixedRateMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: "floatingRate must be a decimal string",
  })
  floatingRate?: string;
```

- [ ] **Step 3c: Response DTO + mapping**

In `apps/api/src/liabilities/dto/liability-response.dto.ts`, insert after `@ApiProperty() currency!: string;` (line 20) inside `LiabilityResponseDto`:

```ts
  @ApiProperty({ enum: ["efektif", "flat", "anuitas"] })
  interestMethod!: string;
  @ApiProperty({ nullable: true, type: Number }) tenorMonths!: number | null;
  @ApiProperty({ nullable: true, type: String }) startDate!: string | null;
  @ApiProperty({ nullable: true, type: String })
  installmentAmount!: string | null;
  @ApiProperty({ nullable: true, type: Number })
  fixedRateMonths!: number | null;
  @ApiProperty({ nullable: true, type: String }) floatingRate!: string | null;
```

In `apps/api/src/liabilities/liabilities.service.ts`:

1. Replace line 28 `import { splitPayment } from "./amortisation.util";` with:

```ts
import { splitPayment, type InterestMethod } from "./amortisation.util";
```

2. In `type LiabilityRow` (lines 58-75), add after `currency: string;`:

```ts
  interestMethod: InterestMethod;
  tenorMonths: number | null;
  startDate: Date | null;
  installmentAmount: bigint | null;
  fixedRateMonths: number | null;
  floatingRate: { toString(): string } | null;
```

3. In `toLiabilityDto`, add after `currency: liability.currency,` (line 109):

```ts
    interestMethod: liability.interestMethod,
    tenorMonths: liability.tenorMonths,
    startDate: liability.startDate?.toISOString() ?? null,
    installmentAmount: liability.installmentAmount?.toString() ?? null,
    fixedRateMonths: liability.fixedRateMonths,
    floatingRate: liability.floatingRate?.toString() ?? null,
```

- [ ] **Step 3d: Contracts**

In `packages/contracts/src/liabilities/index.ts`:

After the `LiabilityType` union add:

```ts
export type InterestMethod = "efektif" | "flat" | "anuitas";
```

In `interface LiabilityDto`, after `currency: string;` add:

```ts
// Revisi G — per-product interest terms.
interestMethod: InterestMethod;
tenorMonths: number | null;
startDate: string | null;
installmentAmount: string | null;
fixedRateMonths: number | null;
floatingRate: string | null;
```

In **both** `interface CreateLiabilityDto` and `interface UpdateLiabilityDto`, after `currency?: string;` add:

```ts
  interestMethod?: InterestMethod;
  tenorMonths?: number;
  startDate?: string;
  installmentAmount?: string;
  fixedRateMonths?: number;
  floatingRate?: string;
```

Append at the end of the file:

```ts
export interface LiabilityScheduleRowDto {
  period: number;
  installment: string;
  interest: string;
  principal: string;
  remaining: string;
}

export interface LiabilityScheduleDto {
  liabilityId: string;
  interestMethod: InterestMethod;
  installmentAmount: string | null;
  rows: LiabilityScheduleRowDto[];
}
```

Run (repo root): `pnpm --filter @wealthme/contracts build`
Expected: build succeeds; `packages/contracts/dist/index.d.ts` contains `LiabilityScheduleDto`.

- [ ] **Step 3e: Web fixtures satisfy the new required fields**

In `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx`, inside `baseLiability` add after `currency: "IDR",` (line 80):

```ts
    interestMethod: "efektif",
    tenorMonths: null,
    startDate: null,
    installmentAmount: null,
    fixedRateMonths: null,
    floatingRate: null,
```

In `apps/web/src/app/(app)/anggaran/obligations-section.test.tsx`, inside `DUE_LIABILITY` add the same six lines after `currency: "IDR",` (line 96).

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS — every suite in `src/liabilities` green (the new DTO spec has 10 tests; the 2 mapping tests pass; all pre-existing service/controller/util tests still pass).

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(liabilitas|anggaran)"`
Expected: PASS — unchanged test counts, all green.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/dto/create-liability.dto.ts src/liabilities/dto/update-liability.dto.ts src/liabilities/dto/liability-response.dto.ts src/liabilities/dto/create-liability.dto.spec.ts src/liabilities/liabilities.service.ts src/liabilities/liabilities.service.spec.ts`
Expected: exit 0.

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/liabilitas/liabilitas.test.tsx" "src/app/(app)/anggaran/obligations-section.test.tsx"`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260925210000_revisi_g_liability_interest_method apps/api/src/liabilities/dto apps/api/src/liabilities/liabilities.service.ts apps/api/src/liabilities/liabilities.service.spec.ts packages/contracts/src/liabilities/index.ts "apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx" "apps/web/src/app/(app)/anggaran/obligations-section.test.tsx"
git commit -m "$(cat <<'EOF'
feat(liabilities): store interest method, tenor, start date and installment

Additive migration: InterestMethod enum (default efektif keeps legacy rows
unchanged) plus tenorMonths, startDate, installmentAmount, fixedRateMonths,
floatingRate. DTOs validate them; responses and contracts expose them.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Service — per-type defaults, installment computation, method-aware `pay()`

**Files:**

- Modify: `apps/api/src/liabilities/liabilities.service.ts` (imports line 28; helpers after `guardBigInt` ~line 122; `create`/`runCreate` ~233-294; `update`/`runUpdate` ~296-410; `runPayment` `splitPayment` call ~648-653)
- Test: `apps/api/src/liabilities/liabilities.service.spec.ts` (new describe before the file's final `});`)

**Interfaces:**

- Consumes: Task 1 `computeInstallment`, `defaultInterestMethod`, `splitPayment({ method, originalPrincipal })`; Task 2 `rateForPeriod`, `monthsElapsed`; Task 3 columns/DTO fields.
- Produces:
  - `create()` fills in `interestMethod` from `defaultInterestMethod(type)` when it is omitted. For flat/anuitas it stores `installmentAmount` as the override if one is given, otherwise `computeInstallment(totalDebt, interestRate, tenorMonths)` when a tenor is known, otherwise `null`. For efektif it always stores `null`. When `installmentAmount` is not null it also becomes `minimumPayment`, which drives the FIXED budget line and the Pay preset.
  - `update()` re-resolves `installmentAmount` only when the PATCH touches `type`, `interestMethod`, `tenorMonths`, `interestRate`, `totalDebt` or `installmentAmount`. Otherwise it keeps the stored value.
  - `kartu_kredit` combined with a non-`efektif` method returns `400 BadRequestException("Kartu kredit hanya mendukung metode bunga efektif")`.
  - `pay()` splits by `interestMethod`, using `totalDebt` as the flat base and the KPR rate that applies to the current period (the floating rate after `fixedRateMonths` from `startDate`).
  - Module helper `currentPeriod(startDate: Date | null, now: Date): number` (reused by Task 5).

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/liabilities/liabilities.service.spec.ts`, insert immediately before the file's final line `});` (which closes `describe("LiabilitiesService", …)`):

```ts
describe("interest engine (revisi G)", () => {
  function mockPrincipalCategorySelfHeal() {
    prisma.coaAccount.findFirst.mockResolvedValue({
      id: "coa-5",
      code: "50001",
      name: "Utang",
    });
    prisma.category.create.mockResolvedValue({ id: "cat-principal" });
    prisma.category.findUniqueOrThrow.mockResolvedValue({
      coaAccountId: "coa-5",
    });
  }

  beforeEach(() => {
    prisma.liability.create.mockResolvedValue({
      ...BASE,
      id: "lid-new",
      totalDebt: BigInt(1),
      remainingBalance: BigInt(1),
      principalCategoryId: null,
    });
  });

  it("create: kendaraan defaults to flat, computes the 6.555.556 installment and uses it as minimumPayment", async () => {
    mockPrincipalCategorySelfHeal();

    await service.create("fg-1", {
      name: "Cicilan Mobil",
      type: "kendaraan" as never,
      totalDebt: "200000000",
      remainingBalance: "200000000",
      interestRate: "6",
      tenorMonths: 36,
      startDate: "2026-01-15T00:00:00.000Z",
    });

    expect(prisma.liability.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        interestMethod: "flat",
        tenorMonths: 36,
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        installmentAmount: BigInt(6_555_556),
        minimumPayment: BigInt(6_555_556),
      }),
    });
    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          limitAmount: BigInt(6_555_556),
        }),
      }),
    );
  });

  it("create: kpr defaults to anuitas and stores the fixed/floating terms", async () => {
    mockPrincipalCategorySelfHeal();

    await service.create("fg-1", {
      name: "KPR BTN",
      type: "kpr" as never,
      totalDebt: "500000000",
      remainingBalance: "500000000",
      interestRate: "8.00",
      tenorMonths: 240,
      fixedRateMonths: 36,
      floatingRate: "11.00",
    });

    expect(prisma.liability.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        interestMethod: "anuitas",
        installmentAmount: BigInt(4_182_200),
        minimumPayment: BigInt(4_182_200),
        fixedRateMonths: 36,
        floatingRate: "11.00",
      }),
    });
  });

  it("create: a user-supplied installmentAmount overrides the computed one", async () => {
    mockPrincipalCategorySelfHeal();

    await service.create("fg-1", {
      name: "KTA",
      type: "pinjaman_pribadi" as never,
      interestMethod: "anuitas" as never,
      totalDebt: "50000000",
      remainingBalance: "50000000",
      interestRate: "12",
      tenorMonths: 24,
      installmentAmount: "2400000",
    });

    expect(prisma.liability.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        interestMethod: "anuitas",
        installmentAmount: BigInt(2_400_000),
        minimumPayment: BigInt(2_400_000),
      }),
    });
  });

  it("create: lainnya defaults to efektif and keeps the user's minimumPayment (no installment)", async () => {
    mockPrincipalCategorySelfHeal();

    await service.create("fg-1", {
      name: "Pinjaman Keluarga",
      type: "lainnya" as never,
      totalDebt: "10000000",
      remainingBalance: "10000000",
      minimumPayment: "1500000",
      tenorMonths: 12,
    });

    expect(prisma.liability.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        interestMethod: "efektif",
        installmentAmount: null,
        minimumPayment: BigInt(1_500_000),
      }),
    });
  });

  it("create: rejects a non-efektif method for a credit card before touching the DB", async () => {
    await expect(
      service.create("fg-1", {
        name: "Kartu Kredit BCA",
        type: "kartu_kredit" as never,
        interestMethod: "flat" as never,
        totalDebt: "30000000",
        remainingBalance: "8000000",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.liability.create).not.toHaveBeenCalled();
  });

  const FLAT_CAR = {
    ...BASE,
    type: "kendaraan",
    interestMethod: "flat",
    totalDebt: BigInt(200_000_000),
    remainingBalance: BigInt(150_000_000),
    interestRate: { toString: () => "6.00" },
    tenorMonths: 24,
    installmentAmount: BigInt(9_333_333),
    minimumPayment: BigInt(9_333_333),
    principalCategoryId: "cat-principal",
  };

  it("update: changing the tenor of a flat loan recomputes installment and minimumPayment", async () => {
    prisma.liability.findUnique.mockResolvedValue(FLAT_CAR);
    prisma.liability.findUniqueOrThrow.mockResolvedValue(FLAT_CAR);
    prisma.liability.update.mockResolvedValue(FLAT_CAR);
    prisma.category.findUniqueOrThrow.mockResolvedValue({
      coaAccountId: "coa-5",
    });

    await service.update("fg-1", "lid-1", { tenorMonths: 36 });

    expect(prisma.liability.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenorMonths: 36,
          installmentAmount: BigInt(6_555_556),
          minimumPayment: BigInt(6_555_556),
        }),
      }),
    );
  });

  it("update: a notes-only PATCH keeps the stored (possibly user-overridden) installment", async () => {
    const overridden = {
      ...FLAT_CAR,
      tenorMonths: 36,
      installmentAmount: BigInt(7_000_000),
      minimumPayment: BigInt(7_000_000),
    };
    prisma.liability.findUnique.mockResolvedValue(overridden);
    prisma.liability.findUniqueOrThrow.mockResolvedValue(overridden);
    prisma.liability.update.mockResolvedValue(overridden);
    prisma.category.findUniqueOrThrow.mockResolvedValue({
      coaAccountId: "coa-5",
    });

    await service.update("fg-1", "lid-1", { notes: "servis rutin" });

    expect(prisma.liability.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          installmentAmount: BigInt(7_000_000),
          minimumPayment: BigInt(7_000_000),
          notes: "servis rutin",
        }),
      }),
    );
  });

  it("update: rejects switching a credit card to flat", async () => {
    const card = { ...BASE, type: "kartu_kredit", principalCategoryId: null };
    prisma.liability.findUnique.mockResolvedValue(card);
    prisma.liability.findUniqueOrThrow.mockResolvedValue(card);

    await expect(
      service.update("fg-1", "lid-1", { interestMethod: "flat" as never }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.liability.update).not.toHaveBeenCalled();
  });

  const ACCOUNT = {
    id: "acc-1",
    familyGroupId: "fg-1",
    type: "bank",
    balance: BigInt(50_000_000),
    name: "BCA",
  };

  it("pay: flat charges interest on the original principal (totalDebt), not the remaining balance", async () => {
    prisma.liability.findUnique.mockResolvedValue({
      ...FLAT_CAR,
      tenorMonths: 36,
      installmentAmount: BigInt(6_555_556),
      minimumPayment: BigInt(6_555_556),
    });
    prisma.account.findUnique.mockResolvedValue(ACCOUNT);
    prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
    prisma.liability.update.mockResolvedValue(FLAT_CAR);

    await service.pay("fg-1", "lid-1", {
      sourceAccountId: "acc-1",
      amount: "6555556",
    });

    expect(prisma.liability.update).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-1" },
      data: { remainingBalance: { decrement: BigInt(5_555_556) } },
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: "cat-interest",
          amount: BigInt(1_000_000),
        }),
      }),
    );
  });

  it("pay: anuitas past its fixed period charges the floating rate", async () => {
    const kpr = {
      ...BASE,
      type: "kpr",
      interestMethod: "anuitas",
      totalDebt: BigInt(500_000_000),
      remainingBalance: BigInt(465_590_716),
      interestRate: { toString: () => "8.00" },
      tenorMonths: 240,
      startDate: new Date("2020-01-15T00:00:00.000Z"),
      installmentAmount: BigInt(4_182_200),
      minimumPayment: BigInt(4_182_200),
      fixedRateMonths: 36,
      floatingRate: { toString: () => "11.00" },
      principalCategoryId: "cat-principal",
    };
    prisma.liability.findUnique.mockResolvedValue(kpr);
    prisma.account.findUnique.mockResolvedValue(ACCOUNT);
    prisma.category.findFirst.mockResolvedValueOnce({ id: "cat-interest" });
    prisma.liability.update.mockResolvedValue(kpr);

    await service.pay("fg-1", "lid-1", {
      sourceAccountId: "acc-1",
      amount: "5053432",
    });

    // 465,590,716 × 0.11/12 = 4,267,914.90 -> 4,267,915 (at 8% it would be 3,103,938).
    expect(prisma.liability.update).toHaveBeenCalledWith({
      where: { id: "lid-1", familyGroupId: "fg-1" },
      data: { remainingBalance: { decrement: BigInt(785_517) } },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/liabilities.service.spec.ts -t "interest engine"`
Expected: FAIL. Four tests fail for different reasons:

- The create tests report `interestMethod` missing from the `data` passed to `liability.create`.
- The credit-card rejection test reports `Received function did not throw` / `rejects` got a resolved value.
- The flat pay test reports `decrement: 5805556` instead of `5555556`, because interest is computed on the 150 jt balance (750.000).
- The floating pay test reports `decrement: 1949494` instead of `785517`, because the 8% fixed rate is still applied.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/liabilities/liabilities.service.ts`:

1. Replace the import from Task 3 (`import { splitPayment, type InterestMethod } from "./amortisation.util";`) with:

```ts
import {
  computeInstallment,
  defaultInterestMethod,
  monthsElapsed,
  rateForPeriod,
  splitPayment,
  type InterestMethod,
} from "./amortisation.util";
```

2. Directly after the `guardBigInt` function (ends ~line 122) add:

```ts
function assertMethodAllowed(type: string, method: InterestMethod): void {
  if (type === "kartu_kredit" && method !== "efektif") {
    throw new BadRequestException(
      "Kartu kredit hanya mendukung metode bunga efektif",
    );
  }
}

function resolveInstallment(terms: {
  method: InterestMethod;
  totalDebt: bigint;
  interestRate: string;
  tenorMonths: number | null;
  override: bigint | undefined;
}): bigint | null {
  if (terms.method === "efektif") return null;
  if (terms.override !== undefined) return terms.override;
  if (terms.tenorMonths === null) return null;
  return computeInstallment({
    method: terms.method,
    principal: terms.totalDebt,
    annualInterestRatePercent: terms.interestRate,
    tenorMonths: terms.tenorMonths,
  });
}

function currentPeriod(startDate: Date | null, now: Date): number {
  return startDate ? monthsElapsed(startDate, now) + 1 : 1;
}
```

3. In `create()`, replace the `minimumPayment` const and the `runSerializableWithRetry` call (lines ~242-252) with:

```ts
const interestMethod = dto.interestMethod ?? defaultInterestMethod(dto.type);
assertMethodAllowed(dto.type, interestMethod);
const installmentAmount = resolveInstallment({
  method: interestMethod,
  totalDebt,
  interestRate: dto.interestRate ?? "0",
  tenorMonths: dto.tenorMonths ?? null,
  override: dto.installmentAmount
    ? guardBigInt("installmentAmount", dto.installmentAmount)
    : undefined,
});
// A fixed installment IS the monthly obligation: it drives the budget line and the Pay preset.
const minimumPayment =
  installmentAmount ??
  (dto.minimumPayment
    ? guardBigInt("minimumPayment", dto.minimumPayment)
    : BigInt(0));

const liability = await runSerializableWithRetry(this.prisma, (tx) =>
  this.runCreate(tx, familyGroupId, dto, {
    totalDebt,
    remainingBalance,
    minimumPayment,
    installmentAmount,
    interestMethod,
  }),
);
```

4. In `runCreate`, extend the `amounts` parameter type with:

```ts
installmentAmount: bigint | null;
interestMethod: InterestMethod;
```

and in its `tx.liability.create({ data: { … } })`, add after `currency: dto.currency ?? "IDR",`:

```ts
        interestMethod: amounts.interestMethod,
        tenorMonths: dto.tenorMonths ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        installmentAmount: amounts.installmentAmount,
        fixedRateMonths: dto.fixedRateMonths ?? null,
        floatingRate: dto.floatingRate ?? null,
```

5. In `update()`, after the `minimumPayment` const (~line 324) add:

```ts
const installmentAmount = dto.installmentAmount
  ? guardBigInt("installmentAmount", dto.installmentAmount)
  : undefined;
```

and pass it in the `runUpdate` amounts object: `{ totalDebt, remainingBalance, minimumPayment, installmentAmount }`.

6. In `runUpdate`, extend the `amounts` type with `installmentAmount: bigint | undefined;`. Then replace the line `const minimumPayment = amounts.minimumPayment ?? existing.minimumPayment;` with:

```ts
const type = dto.type ?? existing.type;
const interestMethod = dto.interestMethod ?? existing.interestMethod;
assertMethodAllowed(type, interestMethod);
const tenorMonths = dto.tenorMonths ?? existing.tenorMonths;
const termsChanged = [
  dto.type,
  dto.interestMethod,
  dto.tenorMonths,
  dto.interestRate,
  dto.totalDebt,
  dto.installmentAmount,
].some((value) => value !== undefined);
const installmentAmount = termsChanged
  ? resolveInstallment({
      method: interestMethod,
      totalDebt,
      interestRate: dto.interestRate ?? existing.interestRate.toString(),
      tenorMonths,
      override: amounts.installmentAmount,
    })
  : existing.installmentAmount;
const minimumPayment =
  installmentAmount ?? amounts.minimumPayment ?? existing.minimumPayment;
```

In the same method's `tx.liability.update({ data: { … } })`, replace `type: dto.type ?? existing.type,` with `type,` and add after `currency: dto.currency ?? existing.currency,`:

```ts
        interestMethod,
        tenorMonths,
        startDate:
          dto.startDate !== undefined
            ? new Date(dto.startDate)
            : existing.startDate,
        installmentAmount,
        fixedRateMonths: dto.fixedRateMonths ?? existing.fixedRateMonths,
        floatingRate: dto.floatingRate ?? existing.floatingRate,
```

7. In `runPayment`, replace the `splitPayment({ … })` call (~lines 648-653) with:

```ts
const { interest, principal } = splitPayment({
  paymentAmount,
  remainingBalance: liability.remainingBalance,
  annualInterestRatePercent: rateForPeriod({
    period: currentPeriod(liability.startDate, new Date()),
    baseRatePercent: liability.interestRate.toString(),
    fixedRateMonths: liability.fixedRateMonths,
    floatingRatePercent: liability.floatingRate?.toString() ?? null,
  }),
  rateIsMonthly: liability.type === "kartu_kredit",
  method: liability.interestMethod,
  originalPrincipal: liability.totalDebt,
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS. All suites are green, including the 10 new "interest engine" tests and every pre-existing create/update/pay/purchase test. Existing fixtures spread `BASE`, which Task 3 made `efektif` with null terms.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/liabilities.service.ts src/liabilities/liabilities.service.spec.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities/liabilities.service.ts apps/api/src/liabilities/liabilities.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(liabilities): default interest method per type and split payments by method

kpr defaults to anuitas and kendaraan/pinjaman_pribadi to flat; the
installment is computed (or user-overridden) and becomes minimumPayment.
pay() charges flat interest on totalDebt and the KPR floating rate once
the fixed period ends. Credit cards stay efektif.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `GET /family-groups/:familyGroupId/liabilities/:id/schedule`

**Files:**

- Modify: `apps/api/src/liabilities/dto/liability-response.dto.ts` (append schedule DTO classes)
- Modify: `apps/api/src/liabilities/liabilities.service.ts` (import `buildSchedule`; add `getSchedule` after `getSummary`)
- Modify: `apps/api/src/liabilities/liabilities.controller.ts:27-30` (import) and after `getSummary` handler (~line 71)
- Test: `apps/api/src/liabilities/liabilities.service.spec.ts`, `apps/api/src/liabilities/liabilities.controller.spec.ts`

**Interfaces:**

- Consumes: Task 2 `buildSchedule`, `monthsElapsed`; Task 4 `currentPeriod`-style logic; Task 3 columns.
- Produces:
  - `LiabilitiesService.getSchedule(familyGroupId: string, id: string, now?: Date): Promise<LiabilityScheduleResponseDto>`.
  - `GET /family-groups/:familyGroupId/liabilities/:id/schedule` responds `200 { liabilityId, interestMethod, installmentAmount: string|null, rows: [{ period, installment, interest, principal, remaining }] }`. Money fields are digit strings. There are at most 600 rows (`tenorMonths` when set). The read is gated by `read Liability`, returns `404` when the id is not found in this family group, and does no DB writes. Tasks 6-7 consume this shape through contracts `LiabilityScheduleDto`.

- [ ] **Step 1: Write the failing tests**

(a) In `liabilities.service.spec.ts`, add inside `describe("LiabilitiesService", …)` right after the Task 4 `describe("interest engine (revisi G)", …)` block:

```ts
describe("getSchedule (revisi G)", () => {
  const NOW = new Date("2026-09-25T00:00:00.000Z");

  it("throws NotFoundException for a liability outside this family group", async () => {
    prisma.liability.findUnique.mockResolvedValue(null);

    await expect(service.getSchedule("fg-1", "lid-x", NOW)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.liability.findUnique).toHaveBeenCalledWith({
      where: { id: "lid-x", familyGroupId: "fg-1" },
    });
  });

  it("anuitas 12 months into a 240-month KPR continues from period 13 on the current balance", async () => {
    prisma.liability.findUnique.mockResolvedValue({
      ...BASE,
      type: "kpr",
      interestMethod: "anuitas",
      totalDebt: BigInt(500_000_000),
      remainingBalance: BigInt(489_431_673),
      interestRate: { toString: () => "8.00" },
      tenorMonths: 240,
      startDate: new Date("2025-09-10T00:00:00.000Z"),
      installmentAmount: BigInt(4_182_200),
      minimumPayment: BigInt(4_182_200),
    });

    const schedule = await service.getSchedule("fg-1", "lid-1", NOW);

    expect(schedule.liabilityId).toBe("lid-1");
    expect(schedule.interestMethod).toBe("anuitas");
    expect(schedule.installmentAmount).toBe("4182200");
    expect(schedule.rows).toHaveLength(228);
    expect(schedule.rows[0]).toEqual({
      period: 13,
      installment: "4182200",
      interest: "3262878",
      principal: "919322",
      remaining: "488512351",
    });
    expect(schedule.rows[227]).toEqual({
      period: 240,
      installment: "4182420",
      interest: "27698",
      principal: "4154722",
      remaining: "0",
    });
    expect(prisma.liability.update).not.toHaveBeenCalled();
  });

  it("kartu kredit: open-ended schedule from minimumPayment at the monthly rate", async () => {
    prisma.liability.findUnique.mockResolvedValue({
      ...BASE,
      type: "kartu_kredit",
      totalDebt: BigInt(30_000_000),
      remainingBalance: BigInt(8_000_000),
      minimumPayment: BigInt(800_000),
      interestRate: { toString: () => "2.25" },
    });

    const schedule = await service.getSchedule("fg-1", "lid-1", NOW);

    expect(schedule.rows).toHaveLength(12);
    expect(schedule.rows[0]?.interest).toBe("180000");
    expect(schedule.rows[11]?.remaining).toBe("0");
  });

  it("past its tenor: a single payoff row, never an empty or negative schedule", async () => {
    prisma.liability.findUnique.mockResolvedValue({
      ...BASE,
      type: "kendaraan",
      interestMethod: "flat",
      totalDebt: BigInt(200_000_000),
      remainingBalance: BigInt(5_555_540),
      interestRate: { toString: () => "6.00" },
      tenorMonths: 36,
      startDate: new Date("2023-01-15T00:00:00.000Z"),
      installmentAmount: BigInt(6_555_556),
      minimumPayment: BigInt(6_555_556),
    });

    const schedule = await service.getSchedule("fg-1", "lid-1", NOW);

    expect(schedule.rows).toEqual([
      {
        period: 36,
        installment: "6555540",
        interest: "1000000",
        principal: "5555540",
        remaining: "0",
      },
    ]);
  });

  it("returns no rows when there is neither an installment, a min. payment nor a tenor", async () => {
    prisma.liability.findUnique.mockResolvedValue({
      ...BASE,
      totalDebt: BigInt(5_000_000),
      remainingBalance: BigInt(5_000_000),
      minimumPayment: BigInt(0),
    });

    const schedule = await service.getSchedule("fg-1", "lid-1", NOW);

    expect(schedule.rows).toEqual([]);
  });
});
```

(b) In `liabilities.controller.spec.ts`:

- Change line 77 `const readRoutes = ["findAll", "getSummary"] as const;` to:

```ts
const readRoutes = ["findAll", "getSummary", "getSchedule"] as const;
```

- Replace the import block lines 17-28 (`import "reflect-metadata";` … `import type { ExecutionContext } from "@nestjs/common";`) with:

```ts
import "reflect-metadata";

import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";

import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";

import { LiabilitiesController } from "./liabilities.controller";
import { LiabilitiesService } from "./liabilities.service";

import type { ExecutionContext } from "@nestjs/common";
```

- Append at the end of the file:

```ts
describe("LiabilitiesController — GET :id/schedule over HTTP", () => {
  it("routes to getSchedule with the family group and liability ids", async () => {
    const service = {
      getSchedule: jest.fn().mockResolvedValue({
        liabilityId: "lid-1",
        interestMethod: "flat",
        installmentAmount: "6555556",
        rows: [],
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [LiabilitiesController],
      providers: [{ provide: LiabilitiesService, useValue: service }],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer())
      .get("/family-groups/fg-1/liabilities/lid-1/schedule")
      .expect(200);

    expect(service.getSchedule).toHaveBeenCalledWith("fg-1", "lid-1");
    expect(res.body.installmentAmount).toBe("6555556");
    await app.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/liabilities/liabilities.service.spec.ts src/liabilities/liabilities.controller.spec.ts -t "getSchedule|schedule|PERMISSION|DENIAL"`
Expected: FAIL. The service tests report `service.getSchedule is not a function`. The controller permission tests fail because `controller[handler]` is `undefined`, so `getHandler` gives no `@CheckAbility` metadata. The HTTP test gets `404` instead of `200`.

- [ ] **Step 3: Write minimal implementation**

(a) Append to `apps/api/src/liabilities/dto/liability-response.dto.ts`:

```ts
export class LiabilityScheduleRowDto {
  @ApiProperty() period!: number;
  @ApiProperty() installment!: string;
  @ApiProperty() interest!: string;
  @ApiProperty() principal!: string;
  @ApiProperty() remaining!: string;
}

export class LiabilityScheduleResponseDto {
  @ApiProperty() liabilityId!: string;
  @ApiProperty({ enum: ["efektif", "flat", "anuitas"] })
  interestMethod!: string;
  @ApiProperty({ nullable: true, type: String })
  installmentAmount!: string | null;
  @ApiProperty({ type: [LiabilityScheduleRowDto] })
  rows!: LiabilityScheduleRowDto[];
}
```

(b) In `liabilities.service.ts`, add `buildSchedule,` to the `./amortisation.util` import list (alphabetically first). Extend the `./dto/liability-response.dto` type import to:

```ts
import type {
  LiabilityResponseDto,
  LiabilityScheduleResponseDto,
  LiabilitySummaryResponseDto,
} from "./dto/liability-response.dto";
```

Add this method directly after `getSummary()`:

```ts

  /** Read-only projection from the liability's current state; nothing is persisted. */
  async getSchedule(
    familyGroupId: string,
    id: string,
    now: Date = new Date(),
  ): Promise<LiabilityScheduleResponseDto> {
    const liability = await this.prisma.liability.findUnique({
      where: { id, familyGroupId },
    });
    if (!liability) {
      throw new NotFoundException("Liability not found");
    }

    const elapsed = liability.startDate
      ? monthsElapsed(liability.startDate, now)
      : 0;
    const tenor = liability.tenorMonths;
    const rows = buildSchedule({
      method: liability.interestMethod,
      remainingBalance: liability.remainingBalance,
      originalPrincipal: liability.totalDebt,
      annualInterestRatePercent: liability.interestRate.toString(),
      rateIsMonthly: liability.type === "kartu_kredit",
      installmentAmount:
        liability.installmentAmount ??
        (liability.minimumPayment > BigInt(0)
          ? liability.minimumPayment
          : null),
      remainingMonths: tenor === null ? null : Math.max(1, tenor - elapsed),
      firstPeriod: tenor === null ? elapsed + 1 : Math.min(elapsed + 1, tenor),
      fixedRateMonths: liability.fixedRateMonths,
      floatingRatePercent: liability.floatingRate?.toString() ?? null,
    });

    return {
      liabilityId: liability.id,
      interestMethod: liability.interestMethod,
      installmentAmount: liability.installmentAmount?.toString() ?? null,
      rows: rows.map((row) => ({
        period: row.period,
        installment: row.installment.toString(),
        interest: row.interest.toString(),
        principal: row.principal.toString(),
        remaining: row.remaining.toString(),
      })),
    };
  }
```

(c) In `liabilities.controller.ts`, replace lines 27-30 with:

```ts
import {
  LiabilityResponseDto,
  LiabilityScheduleResponseDto,
  type LiabilitySummaryResponseDto,
} from "./dto/liability-response.dto";
```

and add after the `getSummary` handler (after line 71):

```ts

  @Get(":id/schedule")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Liability"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOperation({
    summary:
      "Projected installment schedule from the liability's current state (read-only, max 600 rows)",
  })
  @ApiResponse({ status: 200, type: LiabilityScheduleResponseDto })
  @ApiResponse({ status: 404, description: "Liability not found" })
  getSchedule(
    @Param("familyGroupId") familyGroupId: string,
    @Param("id") id: string,
  ): Promise<LiabilityScheduleResponseDto> {
    return this.liabilitiesService.getSchedule(familyGroupId, id);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/liabilities`
Expected: PASS — all suites green (service +5, controller +1 HTTP test; permission/denial tests now also cover `getSchedule`).

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/liabilities/liabilities.controller.ts src/liabilities/liabilities.controller.spec.ts src/liabilities/liabilities.service.ts src/liabilities/liabilities.service.spec.ts src/liabilities/dto/liability-response.dto.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/liabilities
git commit -m "$(cat <<'EOF'
feat(liabilities): GET :id/schedule projects the installment schedule

Pure read from the current balance, tenor, start date and method (max 600
rows); read-Liability gated, tenant-scoped 404, no DB writes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Web — type-driven add/edit form + installment from the response

**Files:**

- Modify: `apps/web/src/app/(app)/liabilitas/page.tsx` (imports 53-57; constants 247-254; `LiabilityBody` 377-388; `LiabilityModal` 390-696)
- Modify: `apps/web/src/i18n/types.ts` (type alias after `LiabilitasTypeId` ~line 204; keys after `payRemainingAfterLabel: string;` line 1893), `apps/web/src/i18n/id.ts` (after line 2004), `apps/web/src/i18n/en.ts` (after line 1967)
- Test: `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx`

**Interfaces:**

- Consumes: Task 3 contracts `InterestMethod`, `LiabilityDto.{interestMethod,tenorMonths,startDate,installmentAmount,fixedRateMonths,floatingRate}`; Task 4 server behaviour. The server computes the installment and returns it in the POST/PATCH response.
- Produces:
  - The form sends `interestMethod` on every save. For flat/anuitas it also sends `tenorMonths`, `startDate`, and `installmentAmount` (only if the user typed an override). For KPR it sends `fixedRateMonths` and `floatingRate`. It sends `minimumPayment` only for efektif.
  - The success toast appends `Angsuran/bulan: Rp X` when the response has `installmentAmount`.
  - i18n keys under `t.liabilitas`: `interestMethodLabels`, `rateLabels`, `fieldRateMonthlyLabel`, `fieldRateFixedLabel`, `fieldInterestMethodLabel`, `fieldTenorLabel`, `fieldStartDateLabel`, `fieldInstallmentLabel`, `fieldInstallmentHint`, `fieldFixedRateMonthsLabel`, `fieldFloatingRateLabel`, `toastInstallmentPrefix`. Task 7 reuses `interestMethodLabels` and `fieldInterestMethodLabel`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx`:

(a) Change the `@testing-library/react` import (lines 16-21) to also import `fireEvent`:

```ts
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
```

(b) After `let payOutcome: "ok" | "conflict" = "ok";` (line 90) add:

```ts
let postBodies: Record<string, unknown>[] = [];
let createdInstallment: string | null = null;
```

(c) Inside `mockApiFetch`, insert as the **first** branch (before `if (url === \`/family-groups/${FAMILY_GROUP_ID}/liabilities\`)`):

```ts
if (
  method === "POST" &&
  url === `/family-groups/${FAMILY_GROUP_ID}/liabilities`
) {
  const body = options?.body
    ? (JSON.parse(options.body) as Record<string, unknown>)
    : {};
  postBodies.push(body);
  return Promise.resolve(
    baseLiability({
      ...(body as Partial<LiabilityDto>),
      id: "liab-new",
      installmentAmount: createdInstallment,
    }),
  );
}
```

(d) In `beforeEach`, after `payOutcome = "ok";` add:

```ts
postBodies = [];
createdInstallment = null;
```

(e) Append these tests inside the top-level `describe`, before its closing `});`:

```tsx
async function openAddDialog(user: ReturnType<typeof userEvent.setup>) {
  const [addButton] = await screen.findAllByRole("button", {
    name: /tambah liabilitas/i,
  });
  await user.click(addButton!);
  return within(await screen.findByRole("dialog"));
}

it("kartu kredit (default): monthly-rate label and min. bayar, no tenor fields", async () => {
  const user = userEvent.setup();
  render(<LiabilitasPage />);
  const dialog = await openAddDialog(user);

  expect(dialog.getByLabelText("Bunga/Bulan (%)")).toBeInTheDocument();
  expect(
    dialog.getByLabelText("Min. Bayar (Rp, opsional)"),
  ).toBeInTheDocument();
  expect(dialog.queryByLabelText("Tenor (bulan)")).not.toBeInTheDocument();
  expect(dialog.queryByLabelText("Metode Bunga")).not.toBeInTheDocument();
});

it("kendaraan: flat rate + tenor + start date, no min. bayar; POSTs flat terms and toasts the computed installment", async () => {
  createdInstallment = "6555556";
  const user = userEvent.setup();
  render(<LiabilitasPage />);
  const dialog = await openAddDialog(user);

  await user.type(dialog.getByLabelText("Nama"), "Cicilan Mobil");
  await user.selectOptions(dialog.getByLabelText("Jenis"), "kendaraan");
  expect(
    dialog.queryByLabelText("Min. Bayar (Rp, opsional)"),
  ).not.toBeInTheDocument();
  expect(dialog.queryByLabelText("Metode Bunga")).not.toBeInTheDocument();
  await user.type(
    dialog.getByLabelText("Total Utang / Limit (Rp)"),
    "200000000",
  );
  await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "200000000");
  await user.type(dialog.getByLabelText("Bunga Flat/Tahun (%)"), "6");
  await user.type(dialog.getByLabelText("Tenor (bulan)"), "36");
  fireEvent.change(dialog.getByLabelText("Tanggal Akad"), {
    target: { value: "2026-01-15" },
  });
  await user.click(dialog.getByRole("button", { name: /simpan liabilitas/i }));

  await waitFor(() => expect(postBodies).toHaveLength(1));
  expect(postBodies[0]).toEqual(
    expect.objectContaining({
      type: "kendaraan",
      interestMethod: "flat",
      interestRate: "6",
      tenorMonths: 36,
      startDate: new Date("2026-01-15").toISOString(),
      totalDebt: "200000000",
    }),
  );
  expect(postBodies[0]).not.toHaveProperty("minimumPayment");
  expect(postBodies[0]).not.toHaveProperty("installmentAmount");
  await waitFor(() =>
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("6.555.556"),
    ),
  );
});

it("kpr: anuitas with fixed period + floating rate", async () => {
  const user = userEvent.setup();
  render(<LiabilitasPage />);
  const dialog = await openAddDialog(user);

  await user.type(dialog.getByLabelText("Nama"), "KPR BTN");
  await user.selectOptions(dialog.getByLabelText("Jenis"), "kpr");
  await user.type(
    dialog.getByLabelText("Total Utang / Limit (Rp)"),
    "500000000",
  );
  await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "500000000");
  await user.type(dialog.getByLabelText("Bunga Fixed/Tahun (%)"), "8");
  await user.type(dialog.getByLabelText("Tenor (bulan)"), "240");
  await user.type(dialog.getByLabelText("Masa Bunga Fixed (bulan)"), "36");
  await user.type(dialog.getByLabelText("Bunga Floating/Tahun (%)"), "11");
  await user.click(dialog.getByRole("button", { name: /simpan liabilitas/i }));

  await waitFor(() => expect(postBodies).toHaveLength(1));
  expect(postBodies[0]).toEqual(
    expect.objectContaining({
      type: "kpr",
      interestMethod: "anuitas",
      interestRate: "8",
      tenorMonths: 240,
      fixedRateMonths: 36,
      floatingRate: "11",
    }),
  );
});

it("pinjaman pribadi: method select offers only flat/anuitas and sends a typed installment override", async () => {
  const user = userEvent.setup();
  render(<LiabilitasPage />);
  const dialog = await openAddDialog(user);

  await user.type(dialog.getByLabelText("Nama"), "KTA");
  await user.selectOptions(dialog.getByLabelText("Jenis"), "pinjaman_pribadi");
  const methodSelect = dialog.getByLabelText("Metode Bunga");
  expect(
    within(methodSelect)
      .getAllByRole("option")
      .map((o) => o.textContent),
  ).toEqual(["Flat", "Anuitas"]);
  await user.selectOptions(methodSelect, "anuitas");
  await user.type(
    dialog.getByLabelText("Total Utang / Limit (Rp)"),
    "50000000",
  );
  await user.type(dialog.getByLabelText("Sisa Tagihan (Rp)"), "50000000");
  await user.type(dialog.getByLabelText("Bunga Anuitas/Tahun (%)"), "12");
  await user.type(dialog.getByLabelText("Tenor (bulan)"), "24");
  await user.type(dialog.getByLabelText("Angsuran/Bulan (Rp)"), "2400000");
  await user.click(dialog.getByRole("button", { name: /simpan liabilitas/i }));

  await waitFor(() => expect(postBodies).toHaveLength(1));
  expect(postBodies[0]).toEqual(
    expect.objectContaining({
      type: "pinjaman_pribadi",
      interestMethod: "anuitas",
      tenorMonths: 24,
      installmentAmount: "2400000",
    }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/liabilitas"`
Expected: FAIL. The 4 new tests fail with `Unable to find a label with the text of: Bunga/Bulan (%)` (or `Tenor (bulan)` / `Metode Bunga`). The 6 existing tests still pass.

- [ ] **Step 3a: i18n**

`apps/web/src/i18n/types.ts` — after the `LiabilitasTypeId` union (ends ~line 204) add:

```ts
/** Revisi G — `/liabilitas` interest method ids (mirrors Prisma `InterestMethod`). */
type LiabilitasInterestMethodId = "efektif" | "flat" | "anuitas";
```

and inside `liabilitas: { … }`, after `payRemainingAfterLabel: string;` (line 1893) add:

```ts
// Revisi G — per-product interest terms in the add/edit form.
interestMethodLabels: Record<LiabilitasInterestMethodId, string>;
rateLabels: Record<LiabilitasInterestMethodId, string>;
fieldRateMonthlyLabel: string;
fieldRateFixedLabel: string;
fieldInterestMethodLabel: string;
fieldTenorLabel: string;
fieldStartDateLabel: string;
fieldInstallmentLabel: string;
fieldInstallmentHint: string;
fieldFixedRateMonthsLabel: string;
fieldFloatingRateLabel: string;
toastInstallmentPrefix: string;
```

`apps/web/src/i18n/id.ts` — after `payRemainingAfterLabel: "Sisa pokok setelah bayar",` (line 2004) add:

```ts
    interestMethodLabels: {
      efektif: "Efektif (saldo menurun)",
      flat: "Flat",
      anuitas: "Anuitas",
    },
    rateLabels: {
      efektif: "Bunga Efektif/Tahun (%)",
      flat: "Bunga Flat/Tahun (%)",
      anuitas: "Bunga Anuitas/Tahun (%)",
    },
    fieldRateMonthlyLabel: "Bunga/Bulan (%)",
    fieldRateFixedLabel: "Bunga Fixed/Tahun (%)",
    fieldInterestMethodLabel: "Metode Bunga",
    fieldTenorLabel: "Tenor (bulan)",
    fieldStartDateLabel: "Tanggal Akad",
    fieldInstallmentLabel: "Angsuran/Bulan (Rp)",
    fieldInstallmentHint:
      "Kosongkan agar dihitung otomatis dari pokok, bunga, dan tenor.",
    fieldFixedRateMonthsLabel: "Masa Bunga Fixed (bulan)",
    fieldFloatingRateLabel: "Bunga Floating/Tahun (%)",
    toastInstallmentPrefix: "Angsuran/bulan: ",
```

`apps/web/src/i18n/en.ts` — after `payRemainingAfterLabel: "Remaining principal after payment",` (line 1967) add:

```ts
    interestMethodLabels: {
      efektif: "Effective (declining balance)",
      flat: "Flat",
      anuitas: "Annuity",
    },
    rateLabels: {
      efektif: "Effective Rate/Year (%)",
      flat: "Flat Rate/Year (%)",
      anuitas: "Annuity Rate/Year (%)",
    },
    fieldRateMonthlyLabel: "Interest/Month (%)",
    fieldRateFixedLabel: "Fixed Rate/Year (%)",
    fieldInterestMethodLabel: "Interest Method",
    fieldTenorLabel: "Tenor (months)",
    fieldStartDateLabel: "Start Date",
    fieldInstallmentLabel: "Installment/Month (Rp)",
    fieldInstallmentHint:
      "Leave empty to compute it from principal, rate, and tenor.",
    fieldFixedRateMonthsLabel: "Fixed-Rate Period (months)",
    fieldFloatingRateLabel: "Floating Rate/Year (%)",
    toastInstallmentPrefix: "Monthly installment: ",
```

- [ ] **Step 3b: Page constants and body type**

In `page.tsx`, change the contracts import (lines 53-57) to:

```ts
import type {
  InterestMethod,
  LiabilityDto,
  LiabilityType,
  NetWorthDto,
} from "@wealthme/contracts";
```

After `type LiabilityTypeValue = LiabilityType;` (line 254) add:

```ts
const DEFAULT_INTEREST_METHOD: Record<LiabilityTypeValue, InterestMethod> = {
  kartu_kredit: "efektif",
  pinjaman_pribadi: "flat",
  kpr: "anuitas",
  kendaraan: "flat",
  lainnya: "efektif",
};

// Types without an entry have exactly one method, so no selector is shown.
const INTEREST_METHOD_OPTIONS: Partial<
  Record<LiabilityTypeValue, readonly InterestMethod[]>
> = {
  pinjaman_pribadi: ["flat", "anuitas"],
  lainnya: ["efektif", "flat", "anuitas"],
};
```

In `interface LiabilityBody` (lines 377-388) add after `notes?: string;`:

```ts
  interestMethod: InterestMethod;
  tenorMonths?: number;
  startDate?: string;
  installmentAmount?: string;
  fixedRateMonths?: number;
  floatingRate?: string;
```

- [ ] **Step 3c: `LiabilityModal` state, submit, and toast**

After the `notes` state (line 431) add:

```ts
const [interestMethod, setInterestMethod] = useState<InterestMethod>(
  editing?.interestMethod ?? DEFAULT_INTEREST_METHOD.kartu_kredit,
);
const [tenorMonths, setTenorMonths] = useState(
  editing?.tenorMonths ? String(editing.tenorMonths) : "",
);
const [startDate, setStartDate] = useState(
  editing?.startDate ? editing.startDate.slice(0, 10) : "",
);
// Empty = let the server compute it; a PATCH without it recomputes from the terms.
const [installmentAmount, setInstallmentAmount] = useState("");
const [fixedRateMonths, setFixedRateMonths] = useState(
  editing?.fixedRateMonths ? String(editing.fixedRateMonths) : "",
);
const [floatingRate, setFloatingRate] = useState(editing?.floatingRate ?? "");

const methodOptions = INTEREST_METHOD_OPTIONS[type];
const usesTenor = interestMethod !== "efektif";
const rateLabel =
  type === "kartu_kredit"
    ? t.liabilitas.fieldRateMonthlyLabel
    : type === "kpr"
      ? t.liabilitas.fieldRateFixedLabel
      : t.liabilitas.rateLabels[interestMethod];
```

Replace the mutation's `onSuccess` (lines 448-454) with:

```ts
    onSuccess: (saved: LiabilityDto) => {
      invalidateLiabilityRelatedQueries(queryClient, familyGroupId);
      const base = editing
        ? t.liabilitas.toastUpdated
        : t.liabilitas.toastAdded;
      toast.success(
        saved.installmentAmount
          ? `${base} · ${t.liabilitas.toastInstallmentPrefix}${formatRupiah(Number(saved.installmentAmount))}`
          : base,
      );
      onClose();
    },
```

In `handleSubmit`, replace the `mutation.mutate({ … });` call (lines 491-507) with:

```ts
const tenorDigits = toDigits(tenorMonths);
const fixedDigits = toDigits(fixedRateMonths);
mutation.mutate({
  name: name.trim(),
  institution: institution.trim() || undefined,
  type,
  totalDebt: totalDigits,
  remainingBalance: remainDigits,
  // Review round 2 (MEDIUM) — send "0" explicitly so a cleared field persists as 0.
  minimumPayment: usesTenor ? undefined : toDigits(minimumPayment) || "0",
  interestRate: toDecimalString(interestRate),
  dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
  autoAdvanceDueDate: dueDate ? autoAdvanceDueDate : undefined,
  notes: notes.trim() || undefined,
  interestMethod,
  tenorMonths: usesTenor && tenorDigits ? Number(tenorDigits) : undefined,
  startDate:
    usesTenor && startDate ? new Date(startDate).toISOString() : undefined,
  installmentAmount: usesTenor
    ? toDigits(installmentAmount) || undefined
    : undefined,
  fixedRateMonths:
    type === "kpr" && fixedDigits ? Number(fixedDigits) : undefined,
  floatingRate: type === "kpr" ? toDecimalString(floatingRate) : undefined,
});
```

Replace the type `<select>`'s `onChange` (line 564) with:

```tsx
                onChange={(e) => {
                  const next = e.target.value as LiabilityTypeValue;
                  setType(next);
                  setInterestMethod(DEFAULT_INTEREST_METHOD[next]);
                }}
```

- [ ] **Step 3d: `LiabilityModal` fields**

Replace the whole `<div className="field-row mt-3">` block containing the min-payment and interest-rate inputs (lines 607-634) with:

```tsx
{
  methodOptions && (
    <div className="field">
      <label className="label" htmlFor="liability-interest-method">
        {t.liabilitas.fieldInterestMethodLabel}
      </label>
      <select
        id="liability-interest-method"
        className="select"
        value={interestMethod}
        onChange={(e) => setInterestMethod(e.target.value as InterestMethod)}
      >
        {methodOptions.map((method) => (
          <option key={method} value={method}>
            {t.liabilitas.interestMethodLabels[method]}
          </option>
        ))}
      </select>
    </div>
  );
}

<div className="field-row mt-3">
  {!usesTenor && (
    <div className="field mt-0">
      <label className="label" htmlFor="liability-min-payment">
        {t.liabilitas.fieldMinPaymentLabel}
      </label>
      <input
        id="liability-min-payment"
        className="input mono"
        placeholder={t.liabilitas.fieldMinPaymentPlaceholder}
        inputMode="numeric"
        value={minimumPayment}
        onChange={(e) => setMinimumPayment(formatNum(e.target.value))}
      />
    </div>
  )}
  <div className="field mt-0">
    <label className="label" htmlFor="liability-interest-rate">
      {rateLabel}
    </label>
    <input
      id="liability-interest-rate"
      className="input mono"
      placeholder={t.liabilitas.fieldInterestRatePlaceholder}
      inputMode="decimal"
      value={interestRate}
      onChange={(e) => setInterestRate(e.target.value)}
    />
  </div>
  {usesTenor && (
    <div className="field mt-0">
      <label className="label" htmlFor="liability-tenor">
        {t.liabilitas.fieldTenorLabel}
      </label>
      <input
        id="liability-tenor"
        className="input mono"
        inputMode="numeric"
        placeholder="36"
        value={tenorMonths}
        onChange={(e) => setTenorMonths(e.target.value.replace(/\D/g, ""))}
      />
    </div>
  )}
</div>;

{
  usesTenor && (
    <div className="field-row mt-3">
      <div className="field mt-0">
        <label className="label" htmlFor="liability-start-date">
          {t.liabilitas.fieldStartDateLabel}
        </label>
        <input
          id="liability-start-date"
          type="date"
          className="input"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>
      <div className="field mt-0">
        <label className="label" htmlFor="liability-installment">
          {t.liabilitas.fieldInstallmentLabel}
        </label>
        <input
          id="liability-installment"
          className="input mono"
          inputMode="numeric"
          aria-describedby="liability-installment-hint"
          placeholder={
            editing?.installmentAmount
              ? formatNum(editing.installmentAmount)
              : ""
          }
          value={installmentAmount}
          onChange={(e) => setInstallmentAmount(formatNum(e.target.value))}
        />
        <div className="hint" id="liability-installment-hint">
          {t.liabilitas.fieldInstallmentHint}
        </div>
      </div>
    </div>
  );
}

{
  type === "kpr" && (
    <div className="field-row mt-3">
      <div className="field mt-0">
        <label className="label" htmlFor="liability-fixed-months">
          {t.liabilitas.fieldFixedRateMonthsLabel}
        </label>
        <input
          id="liability-fixed-months"
          className="input mono"
          inputMode="numeric"
          placeholder="36"
          value={fixedRateMonths}
          onChange={(e) =>
            setFixedRateMonths(e.target.value.replace(/\D/g, ""))
          }
        />
      </div>
      <div className="field mt-0">
        <label className="label" htmlFor="liability-floating-rate">
          {t.liabilitas.fieldFloatingRateLabel}
        </label>
        <input
          id="liability-floating-rate"
          className="input mono"
          inputMode="decimal"
          placeholder="11"
          value={floatingRate}
          onChange={(e) => setFloatingRate(e.target.value)}
        />
      </div>
    </div>
  );
}
```

`fieldInterestRateLabel` stays in the dictionaries but the page no longer reads it. Leave the key in place, since removing it is out of scope.

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/liabilitas"`
Expected: PASS — 10 tests (6 existing incl. the unchanged KK PATCH body, 4 new).

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/liabilitas/page.tsx" "src/app/(app)/liabilitas/liabilitas.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/liabilitas/page.tsx" "apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(liabilitas): type-driven interest form (KK, kendaraan, KPR, pinjaman)

KK keeps bunga/bulan + min. bayar; kendaraan asks flat rate, tenor and akad
date; KPR adds the fixed period and floating rate; pinjaman picks flat or
anuitas. The server-computed installment is shown in the save toast.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Web — Detail dialog renders the server schedule

**Files:**

- Modify: `apps/web/src/app/(app)/liabilitas/page.tsx` (delete `computeAmortisationSchedule` + its interface/comment, lines 149-199; `LiabilityDetailDialog` ~932-1193; call site ~1774)
- Modify: `apps/web/src/i18n/types.ts`, `id.ts`, `en.ts` (liabilitas block)
- Test: `apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx`

**Interfaces:**

- Consumes: Task 5 `GET …/liabilities/:id/schedule` shape via contracts `LiabilityScheduleDto` / `LiabilityScheduleRowDto` (Task 3); Task 6 i18n `interestMethodLabels`, `fieldInterestMethodLabel`.
- Produces:
  - `LiabilityDetailDialog` props gain `familyGroupId: string | undefined; token: string | undefined`.
  - The dialog queries `["liabilities", familyGroupId, "schedule", item.id]`. Because this key starts with `queryKeys.liabilities.all`, the existing invalidation after create/edit/delete/pay already refreshes it.
  - New i18n keys: `amortisationScheduleHeaderInstallment`, `amortisationScheduleLoading`, `amortisationScheduleError`, `detailTenorLabel`, `tenorMonthsSuffix`. The value of `amortisationUnavailableNote` changes.

- [ ] **Step 1: Write the failing tests**

In `liabilitas.test.tsx`:

(a) Change the contracts type import (line 24) to:

```ts
import type {
  LiabilityDto,
  LiabilityScheduleRowDto,
} from "@wealthme/contracts";
```

(b) After `let createdInstallment: string | null = null;` add:

```ts
const SCHEDULE_ROWS: LiabilityScheduleRowDto[] = [
  {
    period: 1,
    installment: "800000",
    interest: "180000",
    principal: "620000",
    remaining: "7380000",
  },
  {
    period: 2,
    installment: "7546050",
    interest: "166050",
    principal: "7380000",
    remaining: "0",
  },
];
let scheduleRows: LiabilityScheduleRowDto[] = SCHEDULE_ROWS;
let scheduleOutcome: "ok" | "error" = "ok";
```

(c) In `mockApiFetch`, directly after the `if (url === \`/family-groups/${FAMILY_GROUP_ID}/liabilities\`) { … }` branch add:

```ts
if (url === `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/schedule`) {
  if (scheduleOutcome === "error") {
    return Promise.reject({ status: 500, message: "boom" });
  }
  return Promise.resolve({
    liabilityId: "liab-1",
    interestMethod: "efektif",
    installmentAmount: null,
    rows: scheduleRows,
  });
}
```

(d) In `beforeEach` add:

```ts
scheduleRows = SCHEDULE_ROWS;
scheduleOutcome = "ok";
```

(e) In the existing test "opens the Detail dialog with the liability's info and a labeled amortisation estimate", replace the final disclaimer assertion (the `expect(dialog.getByText(/estimasi kasar berdasarkan sisa saldo/i)).toBeInTheDocument();` statement) with:

```ts
expect(
  await dialog.findByText(/estimasi kasar berdasarkan sisa saldo/i),
).toBeInTheDocument();
expect(dialog.getByText("Efektif (saldo menurun)")).toBeInTheDocument();
```

(f) Append inside the top-level `describe`:

```tsx
it("renders the server-computed schedule in the Detail dialog", async () => {
  const user = userEvent.setup();
  render(<LiabilitasPage />);

  await user.click(await screen.findByRole("button", { name: "Detail" }));
  const dialog = within(await screen.findByRole("dialog"));
  const table = await dialog.findByRole("table");

  expect(mockApiFetch).toHaveBeenCalledWith(
    `/family-groups/${FAMILY_GROUP_ID}/liabilities/liab-1/schedule`,
    expect.any(Object),
  );
  expect(
    within(table).getByRole("columnheader", { name: "Angsuran" }),
  ).toBeInTheDocument();
  const rows = within(table).getAllByRole("row");
  expect(rows).toHaveLength(3);
  expect(within(rows[2]!).getByText("Rp 7.546.050")).toBeInTheDocument();
  expect(dialog.getByText("Estimasi lunas dalam ~2 bulan")).toBeInTheDocument();
});

it("shows the unavailable note when the server returns no rows", async () => {
  scheduleRows = [];
  const user = userEvent.setup();
  render(<LiabilitasPage />);

  await user.click(await screen.findByRole("button", { name: "Detail" }));
  const dialog = within(await screen.findByRole("dialog"));

  expect(
    await dialog.findByText(
      "Atur min. bayar atau tenor untuk melihat jadwal amortisasi.",
    ),
  ).toBeInTheDocument();
  expect(dialog.queryByRole("table")).not.toBeInTheDocument();
});

it("shows an error instead of a fabricated schedule when the request fails", async () => {
  scheduleOutcome = "error";
  const user = userEvent.setup();
  render(<LiabilitasPage />);

  await user.click(await screen.findByRole("button", { name: "Detail" }));
  const dialog = within(await screen.findByRole("dialog"));

  expect(
    await dialog.findByText("Jadwal amortisasi gagal dimuat."),
  ).toBeInTheDocument();
  expect(dialog.queryByRole("table")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/liabilitas"`
Expected: FAIL. The 3 new tests fail: the schedule URL is never requested, `Unable to find role="columnheader" and name "Angsuran"`, and the new note or error text is missing. The updated Detail test fails on `Efektif (saldo menurun)`.

- [ ] **Step 3a: i18n**

`types.ts` — after `toastInstallmentPrefix: string;` (Task 6) add:

```ts
amortisationScheduleHeaderInstallment: string;
amortisationScheduleLoading: string;
amortisationScheduleError: string;
detailTenorLabel: string;
tenorMonthsSuffix: string;
```

`id.ts` — after `toastInstallmentPrefix: "Angsuran/bulan: ",` add:

```ts
    amortisationScheduleHeaderInstallment: "Angsuran",
    amortisationScheduleLoading: "Memuat jadwal…",
    amortisationScheduleError: "Jadwal amortisasi gagal dimuat.",
    detailTenorLabel: "Tenor",
    tenorMonthsSuffix: " bulan",
```

and change the value of `amortisationUnavailableNote` from `"Atur min. bayar untuk melihat estimasi amortisasi."` to:

```ts
    amortisationUnavailableNote:
      "Atur min. bayar atau tenor untuk melihat jadwal amortisasi.",
```

`en.ts` — after `toastInstallmentPrefix: "Monthly installment: ",` add:

```ts
    amortisationScheduleHeaderInstallment: "Installment",
    amortisationScheduleLoading: "Loading schedule…",
    amortisationScheduleError: "Could not load the amortisation schedule.",
    detailTenorLabel: "Tenor",
    tenorMonthsSuffix: " months",
```

and change `amortisationUnavailableNote` from `"Set a minimum payment to see the amortisation estimate."` to:

```ts
    amortisationUnavailableNote:
      "Set a minimum payment or a tenor to see the amortisation schedule.",
```

- [ ] **Step 3b: Page**

1. Change the contracts import (as left by Task 6) to:

```ts
import type {
  InterestMethod,
  LiabilityDto,
  LiabilityScheduleDto,
  LiabilityType,
  NetWorthDto,
} from "@wealthme/contracts";
```

2. Delete the now-unused client schedule: the comment block starting `// EPIC-026 Wave 5 — the prototype's Detail dialog shows a "Jadwal`, `interface AmortisationScheduleRow { … }`, and `function computeAmortisationSchedule(…) { … }` (lines 149-199). Keep `computeAmortisationPreview` (still used by the Pay dialog and `projectRemainingBalance`) and `formatScheduleDate`.

3. `LiabilityDetailDialog`: extend its props:

```tsx
function LiabilityDetailDialog({
  item,
  familyGroupId,
  token,
  onClose,
  onPay,
}: {
  item: LiabilityDto | null;
  familyGroupId: string | undefined;
  token: string | undefined;
  onClose: () => void;
  /** Prototype `dlg-lia-detail` footer's "Bayar Cicilan" (liabilitas.html:412)
   *  — closes Detail and hands off to the existing real pay flow. */
  onPay: (item: LiabilityDto) => void;
}) {
```

Replace the body lines from `const minimumPayment = item ? Number(BigInt(item.minimumPayment)) : 0;` through the end of the `const schedule = item ? computeAmortisationSchedule(…) : [];` statement (lines ~949-967) with:

```tsx
const minimumPayment = item ? Number(BigInt(item.minimumPayment)) : 0;
const interestRatePercent = item ? parseFloat(item.interestRate) || 0 : 0;
const scheduleQuery = useQuery<LiabilityScheduleDto>({
  // Prefix of queryKeys.liabilities.all, so every liability mutation refreshes it.
  queryKey: ["liabilities", familyGroupId ?? "", "schedule", item?.id ?? ""],
  enabled: Boolean(item && familyGroupId && token),
  queryFn: ({ signal }) => {
    if (!item || !familyGroupId) throw new Error("liability not selected");
    return apiFetch<LiabilityScheduleDto>(
      `/family-groups/${familyGroupId}/liabilities/${item.id}/schedule`,
      { token, signal },
    );
  },
});
const scheduleRows = scheduleQuery.data?.rows ?? [];
const firstRow = scheduleRows[0];
const paysOff = scheduleRows[scheduleRows.length - 1]?.remaining === "0";
const anchor = item?.dueDate ? new Date(item.dueDate) : new Date();
```

4. Replace the JSX comment above the first stats grid (the `{/* Prototype's \`grid grid--4\` headline figures. The prototype's … (Honest UI). \*/}` block) with:

```tsx
{
  /* Prototype's `grid grid--4` headline figures. */
}
```

5. Replace the second grid (`{/* Prototype's second \`grid grid--3\` row … \*/}`plus its`<div className="grid grid-cols-2 gap-3">…</div>`, lines ~1027-1052) with:

```tsx
<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
  <div>
    <div className="t-xs t-muted mb-[3px]">
      {t.liabilitas.detailNextDueLabel}
    </div>
    <div className="text-[13px] font-semibold">
      {item.dueDate ? formatLocaleDate(item.dueDate, locale) : "—"}
    </div>
  </div>
  <div>
    <div className="t-xs t-muted mb-[3px]">
      {t.liabilitas.detailStatusLabel}
    </div>
    <StatusBadge variant={item.paidThisPeriod ? "success" : "gray"}>
      {item.paidThisPeriod
        ? t.liabilitas.detailPaidThisPeriodLabel
        : t.liabilitas.detailNotPaidThisPeriodLabel}
    </StatusBadge>
  </div>
  <div>
    <div className="t-xs t-muted mb-[3px]">
      {t.liabilitas.fieldInterestMethodLabel}
    </div>
    <div className="text-[13px] font-semibold">
      {t.liabilitas.interestMethodLabels[item.interestMethod]}
    </div>
  </div>
  <div>
    <div className="t-xs t-muted mb-[3px]">{t.liabilitas.detailTenorLabel}</div>
    <div className="text-[13px] font-semibold">
      {item.tenorMonths
        ? `${item.tenorMonths}${t.liabilitas.tenorMonthsSuffix}`
        : "—"}
    </div>
  </div>
</div>
```

6. Replace the whole amortisation card (`<div className="rounded-lg border p-3.5">` … its closing `</div>`, lines ~1054-1158) with:

```tsx
<div className="rounded-lg border p-3.5">
  <div className="mb-2 text-[12.5px] font-bold">
    {t.liabilitas.amortisationTitle}
  </div>
  {scheduleQuery.isError ? (
    <div className="text-[12px] text-destructive">
      {t.liabilitas.amortisationScheduleError}
    </div>
  ) : scheduleQuery.isLoading ? (
    <div className="text-[12px] text-muted-foreground">
      {t.liabilitas.amortisationScheduleLoading}
    </div>
  ) : firstRow ? (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="t-xs t-muted">
            {t.liabilitas.amortisationMonthlyPrincipalLabel}
          </div>
          <div className="mono text-[13.5px] font-bold">
            {formatRupiah(Number(firstRow.principal))}
          </div>
        </div>
        <div>
          <div className="t-xs t-muted">
            {t.liabilitas.amortisationMonthlyInterestLabel}
          </div>
          <div
            className="mono text-[13.5px] font-bold"
            style={{ color: "var(--danger)" }}
          >
            {formatRupiah(Number(firstRow.interest))}
          </div>
        </div>
      </div>
      {paysOff ? (
        <div className="mt-2.5 text-[12.5px] font-semibold text-success">
          {t.liabilitas.amortisationEstimatedPayoffPrefix}
          {scheduleRows.length}
          {t.liabilitas.amortisationEstimatedPayoffSuffix}
        </div>
      ) : (
        <div className="mt-2.5 text-[12px] text-destructive">
          {t.liabilitas.amortisationNoPayoffNote}
        </div>
      )}
      <div className="mt-3">
        <div className="section-title mb-2 text-[13px]">
          {t.liabilitas.amortisationScheduleTitle} ({scheduleRows.length}
          {t.liabilitas.amortisationScheduleCountSuffix})
        </div>
        <div className="table-wrap max-h-80 overflow-y-auto">
          <table className="table table--num">
            <thead>
              <tr>
                <th>{t.liabilitas.amortisationScheduleHeaderIndex}</th>
                <th>{t.liabilitas.amortisationScheduleHeaderDate}</th>
                <th>{t.liabilitas.amortisationScheduleHeaderInstallment}</th>
                <th>{t.liabilitas.amortisationScheduleHeaderPrincipal}</th>
                <th>{t.liabilitas.amortisationScheduleHeaderInterest}</th>
                <th>{t.liabilitas.loanRemainingPrincipalLabel}</th>
              </tr>
            </thead>
            <tbody>
              {scheduleRows.map((row, index) => (
                <tr key={row.period}>
                  <td className="mono">{row.period}</td>
                  <td className="whitespace-nowrap">
                    {formatScheduleDate(
                      new Date(
                        anchor.getFullYear(),
                        anchor.getMonth() + index,
                        anchor.getDate(),
                      ),
                      locale,
                    )}
                  </td>
                  <td className="mono whitespace-nowrap">
                    {formatRupiah(Number(row.installment))}
                  </td>
                  <td className="mono whitespace-nowrap">
                    {formatRupiah(Number(row.principal))}
                  </td>
                  <td className="mono whitespace-nowrap">
                    {formatRupiah(Number(row.interest))}
                  </td>
                  <td className="mono whitespace-nowrap">
                    {formatRupiah(Number(row.remaining))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="hint">{t.liabilitas.amortisationDisclaimer}</div>
    </>
  ) : (
    <div className="text-[12px] text-muted-foreground">
      {t.liabilitas.amortisationUnavailableNote}
    </div>
  )}
</div>
```

The headline grid still reads `minimumPayment` and `interestRatePercent` (lines ~1014, ~1022), so both consts stay.

7. At the call site (~line 1774), pass the session values:

```tsx
      <LiabilityDetailDialog
        item={detailItem}
        familyGroupId={familyGroupId}
        token={token}
        onClose={() => setDetailItem(null)}
```

(the `onPay` prop stays as is).

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/liabilitas"`
Expected: PASS — 13 tests.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/liabilitas/page.tsx" "src/app/(app)/liabilitas/liabilitas.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0. In particular, `computeAmortisationSchedule` and `AmortisationScheduleRow` must not be reported as unused, because Step 3b.2 deletes them.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/liabilitas/page.tsx" "apps/web/src/app/(app)/liabilitas/liabilitas.test.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(liabilitas): detail shows the server-computed amortisation schedule

The Detail dialog fetches GET :id/schedule (flat/efektif/anuitas, KPR
floating) instead of rolling a client-side efektif estimate, adds the
installment column, method and tenor, and surfaces load errors honestly.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage (catalog item 12 + binding decisions):**

| Requirement                                                                                                                                                           | Task                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `enum InterestMethod`, `interestMethod @default(efektif)`, `tenorMonths`, `startDate`, `installmentAmount`, `fixedRateMonths`, `floatingRate`; one additive migration | 3                              |
| Contracts + DTOs + response mapping                                                                                                                                   | 3 (schedule DTO class 5)       |
| `computeInstallment` for anuitas/flat/efektif, BigInt round-half-up                                                                                                   | 1                              |
| `splitPayment` with `method` (flat needs `totalDebt`)                                                                                                                 | 1                              |
| Golden: KPR 500 jt/8%/240 ≈ 4.182.xxx (exact 4.182.200), kendaraan 200 jt flat 6%/36 = 6.555.556, KK 10 jt @ 2,25%/bln = 225.000; hand cross-check comments           | 1, 2                           |
| Bank-style schedule per product (incl. KPR fixed→floating)                                                                                                            | 2                              |
| `create/update` compute installment for flat/anuitas, user override                                                                                                   | 4                              |
| Defaults per type (kpr→anuitas, kendaraan→flat, pinjaman_pribadi→flat, lainnya→efektif), KK stays efektif + monthly rate                                              | 1 (`defaultInterestMethod`), 4 |
| `pay()` passes method + totalDebt                                                                                                                                     | 4                              |
| `GET …/liabilities/:lid/schedule`, pure, ≤ `tenorMonths`, cap 600                                                                                                     | 5                              |
| Web type-driven form (KK, kendaraan, KPR, pinjaman) + i18n                                                                                                            | 6                              |
| Installment shown from the create/update response; schedule table in the detail from GET schedule; no duplicated client math                                          | 6, 7                           |
| Tests in `liabilitas.test.tsx` with its existing mocks                                                                                                                | 3, 6, 7                        |

**Judgment calls:**

- `splitPayment` does **not** take `installmentAmount`. The split depends only on the amount actually paid, so passing the stored installment would be an unused parameter. Flat/anuitas behaviour comes from `method` and `originalPrincipal`. `pay()` also uses the KPR floating rate once the fixed period ends, which the binding decision did not list but the catalog's "KPR = anuitas (fixed→floating)" requires.
- For flat/anuitas, `installmentAmount` also becomes `minimumPayment`. This keeps the per-liability FIXED budget line, the card's "Cicilan/Bulan", and the Pay preset consistent without changes to those areas. The form hides min. bayar for those methods.
- The form fixes the method for KK (efektif), kendaraan (flat) and KPR (anuitas), and offers a selector only for `pinjaman_pribadi` (flat/anuitas) and `lainnya` (all three).
- When a PATCH omits `installmentAmount` but changes the terms, the installment is recomputed. The edit form therefore starts the override field empty and shows the saved value as its placeholder.
- The schedule date column is a display-only calendar offset from `dueDate` or today. No schedule math happens on the client.

**Placeholder scan:** no TBD, TODO, "handle edge cases" or "similar to Task N" remain. Every code step includes its code. The migration timestamp has an explicit collision rule.

**Type consistency:** these names are identical across Tasks 1–7: `InterestMethod`, `computeInstallment`, `splitPayment({ method, originalPrincipal })`, `rateForPeriod`, `monthsElapsed`, `buildSchedule`, `ScheduleRow`, `MAX_SCHEDULE_ROWS`, `resolveInstallment`, `assertMethodAllowed`, `currentPeriod`, `getSchedule(familyGroupId, id, now?)`, `LiabilityScheduleResponseDto` / contracts `LiabilityScheduleDto` (`liabilityId`, `interestMethod`, `installmentAmount`, `rows[].{period, installment, interest, principal, remaining}`), and the i18n keys.

**Review Focus:** each of the 5 lines has a named test in its owning task (1, 1, 4, 2 + 5, 2).
