# Revisi D — Investasi & Aset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Value emas holdings from the family gold price, add "Emas" as a physical asset type, make every investment quantity speak its instrument's unit (lot⇄lembar, unit, gram, coin), let Beli **and** Jual use the Lot/Lembar toggle, and turn the holding detail pop-up into a wide two-column view with a date-filtered buy/sell history.

**Architecture:** API: one shared valuation helper (`common/utils/investment-value.util.ts`) learns "emas follows `FamilyGroup.goldPricePerGram` when set", and all three valuation paths (`InvestmentsService.findAll`, `DashboardService` net worth, `ReportsService` balance sheet) read the gold price through the investment's `familyGroup` relation — no extra query and no divergence between /investasi, /ringkasan and /laporan. Schema: one additive enum migration (`AssetType.emas`). Web: a new page-local pure module `investasi/instrument-units.ts` (`UNIT_BY_TYPE` + helpers) drives the add/edit form, the holdings list, the detail history and `BuySellModal`; a second pure module `investasi/history-filter.ts` filters the detail history by date; all copy lives in `i18n/{types,id,en}.ts`.

**Tech Stack:** NestJS 10 + Prisma 5 + class-validator + Jest/ts-jest (API); Next.js 16 App Router + React 19 + TanStack Query + Jest (next/jest, SWC) + Testing Library (web); `@wealthme/contracts` (tsup → `dist`, consumed by web from `dist`); pnpm workspace.

**Spec:** `docs/superpowers/plans/2026-09-25-revisi-besar-catalog.md` — items 8, 8b, 9, 10, 11.

## Global Constraints

- Work only inside the worktree `/home/stealth/Projects/wealthme-web-revisi-ab` on branch `feat/revisi-ab-calculators-quickfixes`.
- Never edit protected files: `apps/web/src/app/globals.css`, `apps/web/src/app/design-system.css`, `apps/web/src/lib/*`, `apps/web/src/components/ui/*`, `apps/web/src/components/wm/*`, `apps/web/src/components/charts/*`, `apps/web/src/components/shell/*`, `apps/web/src/app/layout.tsx`, `packages/config/*`.
- Every new user-visible string goes into **all three** of `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts` (dictionaries use `satisfies I18nDictionary`).
- Controllers keep the repo convention for DTO classes consumed by `@Body()`: a value import preceded by `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`.
- Money/quantity math: never float-round stored values; reuse the existing exact-decimal helpers (`divideBy100`, `canonicalizeSahamQuantity`, `convertQuantityDisplay`, `formatDecimalRupiah`, etc.) already in `investasi/` and the API's BigInt/Decimal handling.
- Run tests locally only as the focused jest commands each task names (from `apps/api` or `apps/web`). No `next build`, no full `turbo` runs. After a Prisma schema change run `pnpm exec prisma generate` from `apps/api` and rebuild contracts with `pnpm --filter @wealthme/contracts build` (the web imports `@wealthme/contracts` from `dist`).
- Lint every file you touch: `pnpm exec eslint <files>` from the owning app dir must exit 0.
- Commit messages: Conventional Commits, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code comments: none unless the WHY is non-obvious; one line max.
- The husky post-commit hook prints "post-commit script failed (code 1)" (graphify); the commit still lands. Never use `--no-verify`.

## Review Focus

1. **Family gold price unset or zero** — an emas holding must fall back to its last manual price (then cost basis), never be valued at Rp 0. Pinned in Task 1 (`goldPricePerGram: null` and `BigInt(0)` cases).
2. **/investasi vs /ringkasan vs /laporan disagreeing on an emas holding** — dashboard net worth and the balance sheet must use the same gold-priced value as `InvestmentsService`. Pinned in Task 1 (parity spec).
3. **Odd lots in Beli/Jual** — `0.07` lot must reach the API as exactly `"7"` lembar (no `7.000000000000001`). Pinned in Task 4.
4. **Date-filter day boundaries in WIB** — a transaction at 01:30 WIB (18:30 UTC the previous day) belongs to the WIB day, and both `from` and `to` days are inclusive. Pinned in Task 6 (`history-filter.test.ts`).
5. **Filter leaking between holdings** — a date range applied on one holding's detail must not pre-filter the next holding opened. Pinned in Task 6.

---

## File Structure

| File                                                                                                       | Responsibility                                                                  | Tasks      |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------- |
| `apps/api/src/common/utils/investment-value.util.ts`                                                       | Shared valuation basis; adds `familyGoldUnitPrice` + `FAMILY_GOLD_PRICE_SOURCE` | 1          |
| `apps/api/src/investments/investments.service.ts`                                                          | `findAll` values emas from the family gold price, labels provenance             | 1          |
| `apps/api/src/dashboard/dashboard.service.ts`, `apps/api/src/reports/reports.service.ts`                   | Select `type` + `familyGroup.goldPricePerGram` so the shared helper sees it     | 1          |
| `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20260925190000_asset_type_emas/migration.sql` | `AssetType.emas`                                                                | 2          |
| `packages/contracts/src/assets/index.ts`                                                                   | `AssetTypeId` + default rate for `emas`                                         | 2          |
| `apps/web/src/app/(app)/aset/page.tsx`, `components/crud/crud-config.ts`, `app/(app)/quickinput/page.tsx`  | Emas in the asset type selects/maps                                             | 2          |
| `apps/web/src/app/(app)/investasi/instrument-units.ts` (new)                                               | `UNIT_BY_TYPE` + unit/decimal/step/format helpers                               | 3          |
| `apps/web/src/app/(app)/investasi/history-filter.ts` (new)                                                 | Pure date-range filter over `occurredAt` (local day)                            | 6          |
| `apps/web/src/app/(app)/investasi/page.tsx`                                                                | Form, list, BuySellModal, detail dialog                                         | 3, 4, 5, 6 |
| `apps/web/src/i18n/{types,id,en}.ts`                                                                       | All new copy                                                                    | 2–6        |

---

### Task 1: API — emas valued from the family gold price (all three valuation paths)

**Files:**

- Modify: `apps/api/src/common/utils/investment-value.util.ts` (whole file, 27 lines)
- Modify: `apps/api/src/investments/investments.service.ts` (imports `:15-16`; `findAll` include `:133-138`; valuation `:223-225`; provenance `:280-296`)
- Modify: `apps/api/src/dashboard/dashboard.service.ts:345-352` (investment `select`)
- Modify: `apps/api/src/reports/reports.service.ts:859-868` (investment `select`)
- Test: `apps/api/src/common/utils/investment-value.util.spec.ts`, `apps/api/src/investments/investments.service.spec.ts` (new `describe` before `describe("setManualPrice()"` at `:775`), `apps/api/src/reports/reports-dashboard-networth-parity.spec.ts` (new `it` at the end of the `describe`)

**Interfaces:**

- Consumes: `FamilyGroup.goldPricePerGram BigInt?`, `FamilyGroup.goldPriceUpdatedAt DateTime?` (`schema.prisma:461-462`), `Investment.familyGroup` relation.
- Produces:
  - `export const FAMILY_GOLD_PRICE_SOURCE = "family-gold-price"` — the `InvestmentDto.latestPriceSource` value for a gold-priced emas holding. Task 5's web label map keys on this exact string.
  - `export function familyGoldUnitPrice(inv: { type?: string; familyGroup?: { goldPricePerGram: bigint | null } | null }): Decimal | null`
  - `investmentPositionValue(inv: { type?: string; quantity: Decimal; costBasisPerUnit: Decimal; prices: { price: Decimal }[]; familyGroup?: { goldPricePerGram: bigint | null } | null }): Decimal`
  - For `type === "emas"` with a positive family gold price, `InvestmentDto.currentPrice` = gold price per gram, `latestPriceSource = "family-gold-price"`, `latestPriceAsOf`/`latestPriceRecordedAt` = `goldPriceUpdatedAt` ISO (or `null`), `latestPriceDelayed = false`.

- [ ] **Step 1: Write the failing tests**

(a) Append to `apps/api/src/common/utils/investment-value.util.spec.ts` (change the import line to `import { familyGoldUnitPrice, investmentPositionValue } from "./investment-value.util";`):

```ts
describe("emas follows the family gold price (Revisi D item 11)", () => {
  const gold = { goldPricePerGram: BigInt(1_500_000) };

  it("values emas at quantity × family gold price, ignoring the stored price", () => {
    const result = investmentPositionValue({
      type: "emas",
      quantity: new Decimal("2.5"),
      costBasisPerUnit: new Decimal(1_000_000),
      prices: [{ price: new Decimal(1_200_000) }],
      familyGroup: gold,
    });
    expect(result.toString()).toBe("3750000");
  });

  it("falls back to the latest stored price when the family gold price is unset", () => {
    const result = investmentPositionValue({
      type: "emas",
      quantity: new Decimal("2.5"),
      costBasisPerUnit: new Decimal(1_000_000),
      prices: [{ price: new Decimal(1_200_000) }],
      familyGroup: { goldPricePerGram: null },
    });
    expect(result.toString()).toBe("3000000");
  });

  it("never applies the gold price to a non-emas holding", () => {
    const result = investmentPositionValue({
      type: "lainnya",
      quantity: new Decimal("2.5"),
      costBasisPerUnit: new Decimal(1_000_000),
      prices: [{ price: new Decimal(1_200_000) }],
      familyGroup: gold,
    });
    expect(result.toString()).toBe("3000000");
  });

  it("treats a zero gold price as unset", () => {
    expect(
      familyGoldUnitPrice({
        type: "emas",
        familyGroup: { goldPricePerGram: BigInt(0) },
      }),
    ).toBeNull();
  });
});
```

(b) In `apps/api/src/investments/investments.service.spec.ts`, insert this block inside the outer `describe("InvestmentsService P&L", …)`, directly before `describe("setManualPrice()", () => {` (`:775`):

```ts
describe("findAll() — emas valued from the family gold price (Revisi D item 11)", () => {
  const GOLD_UPDATED_AT = new Date("2026-09-20T03:00:00.000Z");
  const MANUAL_AT = new Date("2026-09-01T03:00:00.000Z");
  const MANUAL_PRICE = {
    id: "p-manual",
    investmentId: "inv-emas",
    price: new Decimal("1300000"),
    source: "manual",
    asOf: MANUAL_AT,
    delayed: false,
    recordedAt: MANUAL_AT,
  };

  function emasRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "inv-emas",
      familyGroupId: "fg-1",
      ticker: "ANTM",
      name: "Logam Mulia",
      type: "emas",
      quantity: new Decimal("10.5"),
      costBasisPerUnit: new Decimal("1200000"),
      currency: "IDR",
      notes: null,
      interestRatePct: null,
      purchasedAt: null,
      maturityDate: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      prices: [MANUAL_PRICE],
      familyGroup: {
        goldPricePerGram: BigInt(1_500_000),
        goldPriceUpdatedAt: GOLD_UPDATED_AT,
      },
      ...overrides,
    };
  }

  it("values emas at quantity × family gold price and labels the source", async () => {
    mockPrisma.investment.findMany.mockResolvedValue([emasRow()]);

    const [result] = await service.findAll("fg-1");

    expect(result?.currentPrice).toBe("1500000");
    expect(result?.currentValue).toBe("15750000");
    expect(result?.returnRp).toBe("3150000");
    expect(result?.returnPct).toBe(25);
    expect(result?.latestPriceSource).toBe("family-gold-price");
    expect(result?.latestPriceAsOf).toBe(GOLD_UPDATED_AT.toISOString());
    expect(result?.latestPriceRecordedAt).toBe(GOLD_UPDATED_AT.toISOString());
    expect(result?.latestPriceDelayed).toBe(false);
    expect(mockMarketData.getPrice).not.toHaveBeenCalled();
    expect(mockPrisma.investmentPrice.create).not.toHaveBeenCalled();
  });

  it("reads the gold price through the familyGroup relation (no extra query)", async () => {
    mockPrisma.investment.findMany.mockResolvedValue([]);

    await service.findAll("fg-1");

    expect(mockPrisma.investment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          familyGroup: {
            select: { goldPricePerGram: true, goldPriceUpdatedAt: true },
          },
        }),
      }),
    );
  });

  it("falls back to the last manual price when the family gold price is unset", async () => {
    mockPrisma.investment.findMany.mockResolvedValue([
      emasRow({
        familyGroup: { goldPricePerGram: null, goldPriceUpdatedAt: null },
      }),
    ]);

    const [result] = await service.findAll("fg-1");

    expect(result?.currentPrice).toBe("1300000");
    expect(result?.currentValue).toBe("13650000");
    expect(result?.latestPriceSource).toBe("manual");
  });

  it("treats a zero family gold price as unset", async () => {
    mockPrisma.investment.findMany.mockResolvedValue([
      emasRow({
        familyGroup: {
          goldPricePerGram: BigInt(0),
          goldPriceUpdatedAt: GOLD_UPDATED_AT,
        },
      }),
    ]);

    const [result] = await service.findAll("fg-1");

    expect(result?.currentPrice).toBe("1300000");
  });

  it("never applies the family gold price to a non-emas holding", async () => {
    mockPrisma.investment.findMany.mockResolvedValue([
      emasRow({ type: "lainnya" }),
    ]);

    const [result] = await service.findAll("fg-1");

    expect(result?.currentPrice).toBe("1300000");
    expect(result?.latestPriceSource).toBe("manual");
  });

  it("getSummary totals the gold-priced value", async () => {
    mockPrisma.investment.findMany.mockResolvedValue([emasRow()]);

    const summary = await service.getSummary("fg-1");

    expect(summary.totalCurrentValue).toBe("15750000");
    expect(summary.totalCostBasis).toBe("12600000");
  });
});
```

(c) Append this `it` as the last test inside the `describe` in `apps/api/src/reports/reports-dashboard-networth-parity.spec.ts`:

```ts
it("both value an emas holding at the family gold price (Revisi D item 11)", async () => {
  const prisma = makeFakePrisma();
  prisma.investment.findMany.mockResolvedValue([
    {
      name: "Logam Mulia",
      ticker: "ANTM",
      type: "emas",
      quantity: new Decimal(10),
      costBasisPerUnit: new Decimal(1_000_000),
      prices: [{ price: new Decimal(1_100_000) }],
      familyGroup: { goldPricePerGram: 1_500_000n },
    },
  ]);

  const reportsMod: TestingModule = await Test.createTestingModule({
    providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  const reportsService = reportsMod.get(ReportsService);
  const dashboardMod: TestingModule = await Test.createTestingModule({
    providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  const dashboardService = dashboardMod.get(DashboardService);

  const balanceSheet = await reportsService.getBalanceSheet(
    FAMILY_GROUP_ID,
    new Date(),
    true,
  );
  const netWorth = await dashboardService.getNetWorth(FAMILY_GROUP_ID, true);

  expect(Number(netWorth.investmentsTotal)).toBe(15_000_000);
  expect(
    balanceSheet.assets.find((group) => group.category === "Investasi")?.amount,
  ).toBe(15_000_000);
  const calls = prisma.investment.findMany.mock.calls as [
    { select: Record<string, unknown> },
  ][];
  expect(calls.length).toBeGreaterThanOrEqual(2);
  for (const [args] of calls) {
    expect(args.select).toEqual(
      expect.objectContaining({
        type: true,
        familyGroup: { select: { goldPricePerGram: true } },
      }),
    );
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/common/utils/investment-value.util.spec.ts src/investments/investments.service.spec.ts src/reports/reports-dashboard-networth-parity.spec.ts`
Expected: FAIL — util spec: ts-jest `TS2305: Module './investment-value.util' has no exported member 'familyGoldUnitPrice'`; service spec: `currentPrice` expected `"1500000"` received `"1300000"`, and the `include` assertion misses `familyGroup`; parity spec: `investmentsTotal` expected `15000000` received `11000000`.

- [ ] **Step 3: Implement the shared helper**

Replace the whole of `apps/api/src/common/utils/investment-value.util.ts` with:

```ts
import { Decimal } from "@prisma/client/runtime/library";

export const FAMILY_GOLD_PRICE_SOURCE = "family-gold-price";

/** Revisi D item 11 — emas follows FamilyGroup.goldPricePerGram when the owner has set a positive one. */
export function familyGoldUnitPrice(inv: {
  type?: string;
  familyGroup?: { goldPricePerGram: bigint | null } | null;
}): Decimal | null {
  const perGram = inv.familyGroup?.goldPricePerGram ?? null;
  if (inv.type !== "emas" || perGram === null || perGram <= 0n) return null;
  return new Decimal(perGram.toString());
}

/**
 * The current position value for one investment holding: family gold price
 * (emas only, when set), else the latest recorded price, else cost basis —
 * × quantity. Shared by `InvestmentsService`, `DashboardService` and
 * `ReportsService` so /investasi, /ringkasan and /laporan never diverge.
 * `prices` is expected pre-ordered `recordedAt desc` with `take: 1`.
 */
export function investmentPositionValue(inv: {
  type?: string;
  quantity: Decimal;
  costBasisPerUnit: Decimal;
  prices: { price: Decimal }[];
  familyGroup?: { goldPricePerGram: bigint | null } | null;
}): Decimal {
  const price =
    familyGoldUnitPrice(inv) ?? inv.prices[0]?.price ?? inv.costBasisPerUnit;
  return price.times(inv.quantity);
}
```

- [ ] **Step 4: Implement in `InvestmentsService.findAll`**

1. Imports (`investments.service.ts:15-16`) — add after the `./market-data.port` import:

```ts
import {
  FAMILY_GOLD_PRICE_SOURCE,
  familyGoldUnitPrice,
} from "../common/utils/investment-value.util";
```

(Place it with the other `../common/utils/…` import at `:11` if the import-order lint rule requires; run eslint in Step 6 and follow its order.)

2. `findAll` `include` (`:133-138`) becomes:

```ts
      include: {
        prices: {
          orderBy: { recordedAt: "desc" },
          take: 1,
        },
        familyGroup: {
          select: { goldPricePerGram: true, goldPriceUpdatedAt: true },
        },
      },
```

3. Replace `let currentPrice = isDeposito ? null : (latestPrice?.price ?? null);` (`:225`) with:

```ts
const familyGoldPrice = familyGoldUnitPrice(inv);
const familyGoldAsOf = familyGoldPrice
  ? inv.familyGroup.goldPriceUpdatedAt
  : null;
let currentPrice = isDeposito
  ? null
  : (familyGoldPrice ?? latestPrice?.price ?? null);
```

4. Replace the four provenance fields (`latestPriceRecordedAt` … `latestPriceDelayed`, `:280-296`) with:

```ts
          latestPriceRecordedAt: isDeposito
            ? (depositoAsOf as Date).toISOString()
            : familyGoldPrice
              ? (familyGoldAsOf?.toISOString() ?? null)
              : (latestPrice?.recordedAt.toISOString() ?? null),
          latestPriceSource: isDeposito
            ? "computed-interest"
            : familyGoldPrice
              ? FAMILY_GOLD_PRICE_SOURCE
              : (latestPrice?.source ?? null),
          // EPIC-023 G1 (D15) — as-of time + delayed flag, so the UI can
          // label every automated price with its source and delay honestly.
          latestPriceAsOf: isDeposito
            ? (depositoAsOf as Date).toISOString()
            : familyGoldPrice
              ? (familyGoldAsOf?.toISOString() ?? null)
              : ((latestPrice?.asOf ?? latestPrice?.recordedAt)?.toISOString() ??
                null),
          latestPriceDelayed:
            isDeposito || familyGoldPrice
              ? false
              : (latestPrice?.delayed ?? null),
```

Keep the existing EPIC-024 C3 comment above `latestPriceRecordedAt` unchanged.

5. Update the `setManualPrice` docblock line (`:574`) `ONLY way a manual-only type (reksa_dana, obligasi, emas, lainnya) ever` → `ONLY way a manual-only type (reksa_dana, obligasi, lainnya — and emas while no family gold price is set) ever`.

- [ ] **Step 5: Implement in Dashboard + Reports selects**

`apps/api/src/dashboard/dashboard.service.ts:347-351` — the investment `select` becomes:

```ts
          select: {
            type: true,
            quantity: true,
            costBasisPerUnit: true,
            prices: { orderBy: { recordedAt: "desc" }, take: 1 },
            familyGroup: { select: { goldPricePerGram: true } },
          },
```

`apps/api/src/reports/reports.service.ts:861-867` — the investment `select` becomes:

```ts
          select: {
            name: true,
            ticker: true,
            type: true,
            quantity: true,
            costBasisPerUnit: true,
            prices: { orderBy: { recordedAt: "desc" }, take: 1 },
            familyGroup: { select: { goldPricePerGram: true } },
          },
```

Both call sites already pass the row straight to `investmentPositionValue(inv)`; no other change.

- [ ] **Step 6: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/common/utils/investment-value.util.spec.ts src/investments src/dashboard src/reports`
Expected: PASS — the 4 new util tests, 6 new service tests, 1 new parity test, and every pre-existing investments/dashboard/reports spec green.

- [ ] **Step 7: Lint**

Run (from `apps/api`): `pnpm exec eslint src/common/utils/investment-value.util.ts src/common/utils/investment-value.util.spec.ts src/investments/investments.service.ts src/investments/investments.service.spec.ts src/dashboard/dashboard.service.ts src/reports/reports.service.ts src/reports/reports-dashboard-networth-parity.spec.ts`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/common/utils/investment-value.util.ts apps/api/src/common/utils/investment-value.util.spec.ts apps/api/src/investments/investments.service.ts apps/api/src/investments/investments.service.spec.ts apps/api/src/dashboard/dashboard.service.ts apps/api/src/reports/reports.service.ts apps/api/src/reports/reports-dashboard-networth-parity.spec.ts
git commit -m "$(cat <<'EOF'
feat(investments): value emas holdings from the family gold price

Falls back to the last manual price when no gold price is set. Dashboard net
worth and the balance sheet read the same price via the shared helper.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: "Emas" as a physical asset type (schema, contracts, web)

**Files:**

- Modify: `apps/api/prisma/schema.prisma:75-81` (`enum AssetType`)
- Create: `apps/api/prisma/migrations/20260925190000_asset_type_emas/migration.sql`
- Create: `apps/api/src/assets/dto/asset-type-emas.dto.spec.ts`
- Modify: `packages/contracts/src/assets/index.ts:5-10` (`AssetTypeId`), `:58-65` (`DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT`)
- Modify: `apps/web/src/app/(app)/aset/page.tsx:89-95` (`ASSET_TYPE_ICON`), `:152-158` (`ASSET_TYPES`)
- Modify: `apps/web/src/components/crud/crud-config.ts:236-242` (aset `kategori` options), `apps/web/src/app/(app)/quickinput/page.tsx:175-181` (`ASSET_TYPE` map)
- Modify: `apps/web/src/i18n/types.ts:178-183` (`AsetTypeId`), `apps/web/src/i18n/id.ts:1766-1772`, `apps/web/src/i18n/en.ts:1734-1740` (`aset.assetTypeLabels`)
- Test: `apps/web/src/app/(app)/aset/aset.test.tsx` (inside `describe("AddAssetModal …")`), `apps/web/src/i18n/dictionary.test.ts:258-264`

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: Prisma `AssetType` includes `emas` (DB value `'emas'`); contracts `AssetTypeId` includes `"emas"`; `DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT.emas === 0`; `t.aset.assetTypeLabels.emas` = `"Emas"` / `"Gold"`. The migration is applied to the DEV DB by the controller (`prisma migrate deploy`) — do not run it here.

- [ ] **Step 1: Write the failing tests**

(a) Create `apps/api/src/assets/dto/asset-type-emas.dto.spec.ts`:

```ts
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateAssetDto } from "./create-asset.dto";
import { UpdateAssetDto } from "./update-asset.dto";

describe("Asset DTOs — AssetType.emas (Revisi D item 10)", () => {
  it("CreateAssetDto accepts type emas", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      name: "Logam Mulia 10 g",
      type: "emas",
      currentValue: "15000000",
    });
    expect(await validate(dto)).toEqual([]);
  });

  it("UpdateAssetDto accepts type emas", async () => {
    const dto = plainToInstance(UpdateAssetDto, { type: "emas" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "type")).toBe(false);
  });

  it("still rejects an unknown asset type", async () => {
    const dto = plainToInstance(CreateAssetDto, {
      name: "X",
      type: "saham",
      currentValue: "1",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "type")).toBe(true);
  });
});
```

(b) In `apps/web/src/app/(app)/aset/aset.test.tsx` add `within` to the `@testing-library/react` import, then add inside `describe("AddAssetModal (EPIC-023 Task H1 review, MEDIUM fix 4)", …)` after its last `it`:

```tsx
it("offers Emas as a physical asset type and posts type emas (Revisi D item 10)", async () => {
  const user = userEvent.setup();
  render(<AsetPage />);

  await user.click(screen.getByRole("button", { name: /tambah aset/i }));

  const typeSelect = await screen.findByLabelText("Kategori");
  expect(
    within(typeSelect).getByRole("option", { name: "Emas" }),
  ).toBeInTheDocument();
  await user.selectOptions(typeSelect, "emas");
  fireEvent.change(screen.getByLabelText("Nama Aset"), {
    target: { value: "Logam Mulia 10 g" },
  });
  fireEvent.change(screen.getByLabelText("Nilai Aset (Rp)"), {
    target: { value: "15000000" },
  });

  await user.click(screen.getByRole("button", { name: /simpan aset/i }));

  await waitFor(() => {
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FAMILY_GROUP_ID}/assets`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"type":"emas"'),
      }),
    );
  });
});
```

(c) In `apps/web/src/i18n/dictionary.test.ts:258-264`, the `assetTypeIds` array becomes:

```ts
const assetTypeIds = [
  "properti",
  "kendaraan",
  "elektronik",
  "perhiasan",
  "emas",
  "lainnya",
] as const;
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/assets/dto/asset-type-emas.dto.spec.ts`
Expected: FAIL — the two "accepts type emas" tests get a `type must be one of the following values` error.

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/aset" src/i18n/dictionary.test.ts`
Expected: FAIL — `Unable to find role="option" and name "Emas"`; dictionary test `expect(received).toBeTruthy()` on `assetTypeLabels.emas`.

- [ ] **Step 3: Schema + migration + generate**

`apps/api/prisma/schema.prisma` — `enum AssetType` becomes (append, matching how Postgres `ADD VALUE` orders it):

```prisma
enum AssetType {
  properti
  kendaraan
  elektronik
  perhiasan
  lainnya
  emas
}
```

Create `apps/api/prisma/migrations/20260925190000_asset_type_emas/migration.sql`:

```sql
-- Revisi D item 10 — additive: physical gold (batangan/koin simpanan) as its own asset type.
ALTER TYPE "AssetType" ADD VALUE 'emas';
```

Run (from `apps/api`): `pnpm exec prisma generate`
Expected: `✔ Generated Prisma Client`.

- [ ] **Step 4: Run the API test to verify it passes**

Run (from `apps/api`): `pnpm exec jest src/assets`
Expected: PASS — 3 new DTO tests and every pre-existing assets spec green.

- [ ] **Step 5: Contracts**

`packages/contracts/src/assets/index.ts`:

```ts
export type AssetTypeId =
  | "properti"
  | "kendaraan"
  | "elektronik"
  | "perhiasan"
  | "emas"
  | "lainnya";
```

and in `DEFAULT_ASSET_VALUE_CHANGE_RATE_PCT` add, after `perhiasan: 2, // mild appreciation`:

```ts
    emas: 0, // valued at the recorded figure; no appreciation assumed
```

Run (from repo root): `pnpm --filter @wealthme/contracts build`
Expected: tsup `Build success`.

- [ ] **Step 6: Web**

1. `apps/web/src/i18n/types.ts:178-183`:

```ts
type AsetTypeId =
  | "properti"
  | "kendaraan"
  | "elektronik"
  | "perhiasan"
  | "emas"
  | "lainnya";
```

2. `apps/web/src/i18n/id.ts` `aset.assetTypeLabels` — after `perhiasan: "Perhiasan",` add `emas: "Emas",`. `apps/web/src/i18n/en.ts` — after `perhiasan: "Jewelry",` add `emas: "Gold",`.

3. `apps/web/src/app/(app)/aset/page.tsx` — in `ASSET_TYPE_ICON` after the `perhiasan` line add:

```ts
  emas: { icon: Gem, chip: "bg-yellow-100 text-yellow-600" },
```

and `ASSET_TYPES` becomes:

```ts
const ASSET_TYPES = [
  "properti",
  "kendaraan",
  "elektronik",
  "perhiasan",
  "emas",
  "lainnya",
] as const satisfies readonly AssetTypeId[];
```

4. `apps/web/src/components/crud/crud-config.ts` aset `kategori` options become `["Properti", "Kendaraan", "Elektronik", "Perhiasan", "Emas", "Lainnya"]`.

5. `apps/web/src/app/(app)/quickinput/page.tsx` `ASSET_TYPE` map — after `Perhiasan: "perhiasan",` add `Emas: "emas",`.

- [ ] **Step 7: Run web tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/aset" src/i18n/dictionary.test.ts`
Expected: PASS — new test plus every pre-existing aset/dictionary test green.

- [ ] **Step 8: Lint**

Run (from `apps/api`): `pnpm exec eslint src/assets/dto/asset-type-emas.dto.spec.ts`
Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/aset/page.tsx" "src/app/(app)/aset/aset.test.tsx" "src/app/(app)/quickinput/page.tsx" src/components/crud/crud-config.ts src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts src/i18n/dictionary.test.ts`
Expected: both exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260925190000_asset_type_emas apps/api/src/assets/dto/asset-type-emas.dto.spec.ts packages/contracts/src/assets/index.ts "apps/web/src/app/(app)/aset" "apps/web/src/app/(app)/quickinput/page.tsx" apps/web/src/components/crud/crud-config.ts apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts apps/web/src/i18n/dictionary.test.ts
git commit -m "$(cat <<'EOF'
feat(assets): add Emas as a physical asset type

Additive enum migration (AssetType.emas), contracts, asset form, quick input
and i18n labels.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Web — `UNIT_BY_TYPE`: per-instrument quantity label, placeholder, decimals, list and history

**Files:**

- Create: `apps/web/src/app/(app)/investasi/instrument-units.ts`
- Create: `apps/web/src/app/(app)/investasi/instrument-units.test.ts`
- Modify: `apps/web/src/app/(app)/investasi/page.tsx` — imports `:46-57`; after `type Dict` (`:205`); `formatQuantityCell` `:239-292`; `AddInvestmentModal.handleSubmit` start `:535-537`; quantity field `:842-869`; detail history quantity `:1768-1771`
- Modify: `apps/web/src/i18n/types.ts`, `id.ts`, `en.ts` (end of the `investasi` block, after `historyRealizedPnlTemplate`)
- Test: `apps/web/src/app/(app)/investasi/investasi.test.tsx`

**Interfaces:**

- Consumes: `QuantityUnit`, `divideBy100` from `./quantity-conversion`.
- Produces (`instrument-units.ts`, used by Tasks 4 and 6):
  - `type InstrumentType = "saham" | "reksa_dana" | "obligasi" | "emas" | "kripto" | "lainnya" | "deposito"`
  - `UNIT_BY_TYPE: Record<InstrumentType, { kind: "shares" | "unit" | "gram" | "coin" | "nominal"; maxDecimals: number | null }>`
  - `maxQuantityDecimals(type: string, quantityUnit: QuantityUnit): number | null`
  - `quantityStep(type: string, quantityUnit: QuantityUnit): string`
  - `hasAtMostDecimals(value: string, max: number | null): boolean`
  - `interface UnitLabels { lot: string; lembar: string; unit: string; gram: string; coin: string }`
  - `quantityUnitLabel(type: string, quantityUnit: QuantityUnit, labels: UnitLabels): string`
  - `formatQuantity(value: string, type: string, quantityUnit?: QuantityUnit): string` (default `"lembar"`)
- Produces (`page.tsx`, module-level): `unitLabels(t: Dict): UnitLabels`; `quantityDecimalsError(t: Dict, type: string, quantity: string, quantityUnit: QuantityUnit): string | null`.
- Produces (test file helpers, reused by Tasks 4-6): `type ApiInit`, `holdingOf(overrides)`, `routeApi(routes)`, `postBodyTo(suffix)`, `openAddModal(user)`.
- Produces (i18n): `fieldQuantityLabelByType`, `fieldQuantityPlaceholderByType` (`Record<InvestasiTypeId, string>`), `quantityDecimalsErrorTemplate` (`{unit}`, `{max}`), `quantityWholeNumberErrorTemplate` (`{unit}`).

- [ ] **Step 1: Write the failing unit tests**

Create `apps/web/src/app/(app)/investasi/instrument-units.test.ts`:

```ts
import {
  UNIT_BY_TYPE,
  formatQuantity,
  hasAtMostDecimals,
  maxQuantityDecimals,
  quantityStep,
  quantityUnitLabel,
} from "./instrument-units";

const LABELS = {
  lot: "Lot",
  lembar: "Lembar",
  unit: "unit",
  gram: "gram",
  coin: "koin",
};

describe("UNIT_BY_TYPE (Revisi D item 9)", () => {
  it.each([
    ["saham", "shares", 0],
    ["reksa_dana", "unit", 4],
    ["obligasi", "unit", null],
    ["emas", "gram", 3],
    ["kripto", "coin", 8],
    ["lainnya", "unit", null],
    ["deposito", "nominal", null],
  ] as const)("%s → %s, %s dp", (type, kind, maxDecimals) => {
    expect(UNIT_BY_TYPE[type]).toEqual({ kind, maxDecimals });
  });
});

describe("maxQuantityDecimals / quantityStep", () => {
  it("saham allows 2 dp in lot and whole lembar", () => {
    expect(maxQuantityDecimals("saham", "lot")).toBe(2);
    expect(maxQuantityDecimals("saham", "lembar")).toBe(0);
    expect(quantityStep("saham", "lot")).toBe("0.01");
    expect(quantityStep("saham", "lembar")).toBe("1");
  });

  it("other types follow their own decimals; unrestricted types use any", () => {
    expect(quantityStep("emas", "lembar")).toBe("0.001");
    expect(quantityStep("reksa_dana", "lembar")).toBe("0.0001");
    expect(quantityStep("kripto", "lembar")).toBe("0.00000001");
    expect(quantityStep("lainnya", "lembar")).toBe("any");
  });

  it("an unknown type behaves like lainnya", () => {
    expect(maxQuantityDecimals("xyz", "lembar")).toBeNull();
  });
});

describe("hasAtMostDecimals", () => {
  it.each([
    ["1.234", 3, true],
    ["1.2345", 3, false],
    ["1.2340", 3, true],
    ["7", 0, true],
    ["7.5", 0, false],
    ["0.123456789", null, true],
    ["", 3, true],
  ] as const)("%s with max %s → %s", (value, max, ok) => {
    expect(hasAtMostDecimals(value, max)).toBe(ok);
  });
});

describe("quantityUnitLabel", () => {
  it.each([
    ["saham", "lot", "Lot"],
    ["saham", "lembar", "Lembar"],
    ["emas", "lembar", "gram"],
    ["kripto", "lembar", "koin"],
    ["reksa_dana", "lembar", "unit"],
    ["lainnya", "lembar", "unit"],
  ] as const)("%s (%s) → %s", (type, unit, label) => {
    expect(quantityUnitLabel(type, unit, LABELS)).toBe(label);
  });
});

describe("formatQuantity", () => {
  it("keeps grams to 3 dp with id-ID separators", () => {
    expect(formatQuantity("10.5", "emas")).toBe("10,5");
  });
  it("keeps reksa dana units to 4 dp", () => {
    expect(formatQuantity("1250.56789", "reksa_dana")).toBe("1.250,5679");
  });
  it("shows odd lots without rounding them to zero", () => {
    expect(formatQuantity("0.07", "saham", "lot")).toBe("0,07");
  });
  it("shows whole lembar", () => {
    expect(formatQuantity("1000", "saham")).toBe("1.000");
  });
});
```

- [ ] **Step 2: Write the failing page tests**

In `apps/web/src/app/(app)/investasi/investasi.test.tsx`:

1. Replace the `@testing-library/react` import (`:15`) with:

```tsx
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
```

2. Directly after the top-level `beforeEach(() => { jest.resetAllMocks(); queryClient.clear(); });` (`:134-137`) add the shared helpers:

```tsx
type ApiInit = { method?: string; token?: string; body?: string };
type RouteHandler = (path: string, init?: ApiInit) => unknown;

function holdingOf(overrides: Partial<InvestmentDto>): InvestmentDto {
  return { ...HOLDING, ...overrides };
}

// Layers path-suffix routes over whatever mockSession() installed.
function routeApi(routes: Record<string, unknown>) {
  const fallback = mockApiFetch.getMockImplementation();
  mockApiFetch.mockImplementation((path: string, init?: ApiInit) => {
    const hit = Object.keys(routes).find((suffix) => path.endsWith(suffix));
    if (hit !== undefined) {
      const route = routes[hit];
      return Promise.resolve(
        typeof route === "function"
          ? (route as RouteHandler)(path, init)
          : route,
      );
    }
    return fallback ? fallback(path, init) : Promise.resolve([]);
  });
}

function postBodyTo(suffix: string): Record<string, unknown> | undefined {
  const call = mockApiFetch.mock.calls.find(
    ([path, init]) =>
      String(path).endsWith(suffix) &&
      (init as ApiInit | undefined)?.method === "POST",
  );
  return call
    ? (JSON.parse((call[1] as ApiInit).body ?? "{}") as Record<string, unknown>)
    : undefined;
}

async function openAddModal(
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> {
  await user.click(
    await screen.findByRole("button", { name: /Catat Investasi/i }),
  );
  return screen.findByLabelText("Jenis");
}
```

3. Append at the end of the file:

```tsx
describe("InvestasiPage — quantity unit follows the instrument (Revisi D item 9)", () => {
  it.each([
    ["saham", "Jumlah Saham"],
    ["reksa_dana", "Jumlah Unit Penyertaan"],
    ["obligasi", "Jumlah Unit"],
    ["emas", "Berat Emas (gram)"],
    ["kripto", "Jumlah Koin"],
    ["lainnya", "Jumlah Unit"],
  ])("labels the %s quantity field %s", async (type, label) => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), type);

    expect(screen.getByLabelText(label)).toHaveAttribute("name", "quantity");
  });

  it("uses a gram step and an emas placeholder", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");

    const qty = screen.getByLabelText("Berat Emas (gram)");
    expect(qty).toHaveAttribute("step", "0.001");
    expect(qty).toHaveAttribute("placeholder", "contoh: 10.5");
  });

  it("rejects more than 3 decimals of gram without saving", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");
    fireEvent.change(screen.getByLabelText("Nama"), {
      target: { value: "Antam 10 g" },
    });
    fireEvent.change(screen.getByLabelText("Ticker"), {
      target: { value: "ANTM" },
    });
    const qty = screen.getByLabelText("Berat Emas (gram)");
    fireEvent.change(qty, { target: { value: "1.2345" } });
    fireEvent.change(screen.getByLabelText("Harga Beli per Unit (Rp)"), {
      target: { value: "1500000" },
    });
    fireEvent.submit(qty.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Jumlah gram maksimal 3 angka di belakang koma.",
      ),
    );
    expect(postBodyTo("/investments")).toBeUndefined();
  });

  it("shows an emas holding's grams without rounding", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        holdingOf({
          type: "emas",
          name: "Logam Mulia",
          ticker: "ANTM",
          quantity: "10.5",
        }),
      ],
    });
    render(<InvestasiPage />);

    expect(await screen.findByText("10,5 gram")).toBeInTheDocument();
  });

  it("shows buy/sell history quantities in the instrument's unit", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        holdingOf({
          type: "emas",
          name: "Logam Mulia",
          ticker: "ANTM",
          quantity: "10.5",
        }),
      ],
      "/investments/inv-1/transactions": [
        {
          id: "tx-1",
          investmentId: "inv-1",
          type: "buy",
          quantity: "2.5",
          pricePerUnit: "1400000",
          occurredAt: "2026-09-10T03:00:00.000Z",
          realizedPnl: null,
          createdAt: "2026-09-10T03:00:00.000Z",
        },
      ],
    });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.click(
      await screen.findByRole("button", { name: "Lihat Detail" }),
    );

    expect(await screen.findByText(/2,5 gram @/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/investasi"`
Expected: FAIL — `instrument-units.test.ts`: `Cannot find module './instrument-units'`; `investasi.test.tsx`: `Unable to find a label with the text of: Jumlah Saham` (current label is "Jumlah (lot/unit)"), `toast.error` not called, `Unable to find an element with the text: 10,5 gram` (currently rounds to "11 gram"). The two pre-existing F3 tests still pass.

- [ ] **Step 4: Create `instrument-units.ts`**

Create `apps/web/src/app/(app)/investasi/instrument-units.ts`:

```ts
import type { QuantityUnit } from "./quantity-conversion";

export type InstrumentType =
  | "saham"
  | "reksa_dana"
  | "obligasi"
  | "emas"
  | "kripto"
  | "lainnya"
  | "deposito";

export type InstrumentUnitKind =
  | "shares"
  | "unit"
  | "gram"
  | "coin"
  | "nominal";

export interface InstrumentUnitSpec {
  kind: InstrumentUnitKind;
  /** Max fraction digits of the stored quantity; null = unrestricted. */
  maxDecimals: number | null;
}

// Revisi D item 9 — one map for the form, list, detail and Beli/Jual. Saham is stored in lembar.
export const UNIT_BY_TYPE: Record<InstrumentType, InstrumentUnitSpec> = {
  saham: { kind: "shares", maxDecimals: 0 },
  reksa_dana: { kind: "unit", maxDecimals: 4 },
  obligasi: { kind: "unit", maxDecimals: null },
  emas: { kind: "gram", maxDecimals: 3 },
  kripto: { kind: "coin", maxDecimals: 8 },
  lainnya: { kind: "unit", maxDecimals: null },
  deposito: { kind: "nominal", maxDecimals: null },
};

function specFor(type: string): InstrumentUnitSpec {
  return UNIT_BY_TYPE[type as InstrumentType] ?? UNIT_BY_TYPE.lainnya;
}

/** Decimals allowed in what the user types; a lot keeps 2 so 0.07 lot = 7 lembar. */
export function maxQuantityDecimals(
  type: string,
  quantityUnit: QuantityUnit,
): number | null {
  const spec = specFor(type);
  if (spec.kind === "shares") return quantityUnit === "lot" ? 2 : 0;
  return spec.maxDecimals;
}

export function quantityStep(type: string, quantityUnit: QuantityUnit): string {
  const decimals = maxQuantityDecimals(type, quantityUnit);
  if (decimals === null) return "any";
  if (decimals === 0) return "1";
  return `0.${"0".repeat(decimals - 1)}1`;
}

export function hasAtMostDecimals(value: string, max: number | null): boolean {
  if (max === null) return true;
  const fraction = value.trim().split(".")[1] ?? "";
  return fraction.replace(/0+$/, "").length <= max;
}

export interface UnitLabels {
  lot: string;
  lembar: string;
  unit: string;
  gram: string;
  coin: string;
}

export function quantityUnitLabel(
  type: string,
  quantityUnit: QuantityUnit,
  labels: UnitLabels,
): string {
  switch (specFor(type).kind) {
    case "shares":
      return quantityUnit === "lot" ? labels.lot : labels.lembar;
    case "gram":
      return labels.gram;
    case "coin":
      return labels.coin;
    default:
      return labels.unit;
  }
}

/** Display only — never feeds a stored value. */
export function formatQuantity(
  value: string,
  type: string,
  quantityUnit: QuantityUnit = "lembar",
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("id-ID", {
    maximumFractionDigits: maxQuantityDecimals(type, quantityUnit) ?? 8,
  });
}
```

- [ ] **Step 5: Add the i18n keys (all three files)**

`apps/web/src/i18n/types.ts` — at the end of the `investasi` block, directly after `historyRealizedPnlTemplate: string;`:

```ts
fieldQuantityLabelByType: Record<InvestasiTypeId, string>;
fieldQuantityPlaceholderByType: Record<InvestasiTypeId, string>;
/** Template with `{unit}` and `{max}` placeholders. */
quantityDecimalsErrorTemplate: string;
/** Template with a `{unit}` placeholder. */
quantityWholeNumberErrorTemplate: string;
```

`apps/web/src/i18n/id.ts` — directly after `historyRealizedPnlTemplate: "P/L: {pnl}",` in `investasi`:

```ts
    fieldQuantityLabelByType: {
      saham: "Jumlah Saham",
      reksa_dana: "Jumlah Unit Penyertaan",
      obligasi: "Jumlah Unit",
      emas: "Berat Emas (gram)",
      kripto: "Jumlah Koin",
      lainnya: "Jumlah Unit",
      deposito: "Nominal",
    },
    fieldQuantityPlaceholderByType: {
      saham: "contoh: 10",
      reksa_dana: "contoh: 1250.5678",
      obligasi: "contoh: 10",
      emas: "contoh: 10.5",
      kripto: "contoh: 0.015",
      lainnya: "contoh: 10",
      deposito: "",
    },
    quantityDecimalsErrorTemplate:
      "Jumlah {unit} maksimal {max} angka di belakang koma.",
    quantityWholeNumberErrorTemplate: "Jumlah {unit} harus bilangan bulat.",
```

`apps/web/src/i18n/en.ts` — same position:

```ts
    fieldQuantityLabelByType: {
      saham: "Number of Shares",
      reksa_dana: "Fund Units",
      obligasi: "Units",
      emas: "Gold Weight (grams)",
      kripto: "Coin Amount",
      lainnya: "Units",
      deposito: "Nominal",
    },
    fieldQuantityPlaceholderByType: {
      saham: "e.g. 10",
      reksa_dana: "e.g. 1250.5678",
      obligasi: "e.g. 10",
      emas: "e.g. 10.5",
      kripto: "e.g. 0.015",
      lainnya: "e.g. 10",
      deposito: "",
    },
    quantityDecimalsErrorTemplate:
      "The {unit} quantity allows at most {max} decimal places.",
    quantityWholeNumberErrorTemplate:
      "The {unit} quantity must be a whole number.",
```

Keep the old `fieldQuantityLabel`/`fieldQuantityPlaceholder` keys: `laporan/_components/investment-dialogs.tsx:139` still uses `fieldQuantityLabel`.

- [ ] **Step 6: Wire the page**

1. Imports: remove `formatNumber,` from the `@/lib/format` import (`:48`; it becomes unused), and after the `./quantity-conversion` value import (`:53-57`) add:

```tsx
import {
  formatQuantity,
  hasAtMostDecimals,
  maxQuantityDecimals,
  quantityStep,
  quantityUnitLabel,
} from "./instrument-units";
```

and next to `import type { QuantityUnit } from "./quantity-conversion";` add `import type { UnitLabels } from "./instrument-units";`.

2. Directly after `type Dict = ReturnType<typeof useLocale>["t"];` (`:205`) add:

```tsx
function unitLabels(t: Dict): UnitLabels {
  return {
    lot: t.investasi.unitLot,
    lembar: t.investasi.unitLembar,
    unit: t.investasi.unitFundUnit,
    gram: t.investasi.unitGram,
    coin: t.investasi.unitCoinSuffix,
  };
}

function quantityDecimalsError(
  t: Dict,
  type: string,
  quantity: string,
  quantityUnit: QuantityUnit,
): string | null {
  const max = maxQuantityDecimals(type, quantityUnit);
  if (hasAtMostDecimals(quantity, max)) return null;
  const unit = quantityUnitLabel(
    type,
    quantityUnit,
    unitLabels(t),
  ).toLowerCase();
  return max === 0
    ? t.investasi.quantityWholeNumberErrorTemplate.replace("{unit}", unit)
    : t.investasi.quantityDecimalsErrorTemplate
        .replace("{unit}", unit)
        .replace("{max}", String(max));
}
```

3. Replace the whole `formatQuantityCell` function (`:243-292`, keep its comment above) with:

```tsx
function formatQuantityCell(h: InvestmentDto, t: Dict): ReactNode {
  const labels = unitLabels(t);
  if (h.type === "saham") {
    return (
      <>
        <div>
          {formatQuantity(divideBy100(h.quantity), h.type, "lot")}{" "}
          {labels.lot.toLowerCase()}
        </div>
        <div className="text-muted-foreground">
          {formatQuantity(h.quantity, h.type)} {labels.lembar.toLowerCase()}
        </div>
      </>
    );
  }
  if (h.type === "kripto") {
    return (
      <div>
        {formatQuantity(h.quantity, h.type)} {h.ticker}
      </div>
    );
  }
  if (h.type === "obligasi" || h.type === "deposito") {
    // Prototype shows the total nominal here, which equals this row's own
    // "Modal" column value (quantity × costBasisPerUnit) — not a separate,
    // invented figure.
    const nominal = parseFloat(h.costBasisPerUnit) * parseFloat(h.quantity);
    return (
      <div>
        {t.investasi.nominalPrefix}
        {formatRupiah(nominal)}
      </div>
    );
  }
  return (
    <div>
      {formatQuantity(h.quantity, h.type)}{" "}
      {quantityUnitLabel(h.type, "lembar", labels)}
    </div>
  );
}
```

4. In `AddInvestmentModal.handleSubmit` (`:535-537`), between `e.preventDefault();` and `setSubmitting(true);` insert:

```tsx
if (!isDeposito && !isEditingLots) {
  const decimalsError = quantityDecimalsError(
    t,
    form.type,
    form.quantity,
    form.quantityUnit,
  );
  if (decimalsError) {
    toast.error(decimalsError);
    return;
  }
}
```

5. The quantity field (`:842-869`): replace the `<label>` content and the `<input>`'s `step` and `placeholder` props:

```tsx
                    <label className="label" htmlFor="quantity">
                      {t.investasi.fieldQuantityLabelByType[form.type]}
                    </label>
                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      required
                      min="0"
                      step={quantityStep(form.type, form.quantityUnit)}
                      value={form.quantity}
                      onChange={handleChange}
                      disabled={isEditingLots}
                      placeholder={
                        form.type === "saham"
                          ? form.quantityUnit === "lot"
                            ? t.investasi.fieldQuantityLotPlaceholder
                            : t.investasi.fieldQuantityLembarPlaceholder
                          : t.investasi.fieldQuantityPlaceholderByType[form.type]
                      }
                      className="input mono disabled:cursor-not-allowed disabled:opacity-60"
                    />
```

6. Detail history quantity (`:1768-1771`) — the `<span className="mono">` becomes:

```tsx
<span className="mono">
  {formatQuantity(tx.quantity, detailHolding.type)}{" "}
  {quantityUnitLabel(detailHolding.type, "lembar", unitLabels(t)).toLowerCase()}{" "}
  @ {formatDecimalRupiah(tx.pricePerUnit)}
</span>
```

- [ ] **Step 7: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/investasi"`
Expected: PASS — `instrument-units.test.ts` (all rows), the 10 new page tests, the 2 pre-existing F3 tests, and `quantity-conversion.test.ts`.

- [ ] **Step 8: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/investasi/page.tsx" "src/app/(app)/investasi/instrument-units.ts" "src/app/(app)/investasi/instrument-units.test.ts" "src/app/(app)/investasi/investasi.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/src/app/(app)/investasi" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(investasi): quantity unit and decimals follow the instrument type

One UNIT_BY_TYPE map drives the form label/placeholder/step, the holdings
list and the buy/sell history (gram for emas, units for reksa dana, coins for
kripto, lot/lembar for saham). Fractional grams no longer round away.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Web — Lot⇄Lembar toggle in Beli **and** Jual (`BuySellModal`)

**Files:**

- Modify: `apps/web/src/app/(app)/investasi/page.tsx` — `BuySellModal` state (`:1105-1110`), `handleSubmit` (`:1127-1145`), quantity + price fields (`:1208-1238`)
- Modify: `apps/web/src/i18n/types.ts`, `id.ts`, `en.ts` (end of the `investasi` block)
- Test: `apps/web/src/app/(app)/investasi/investasi.test.tsx`

**Interfaces:**

- Consumes: Task 3 — `quantityStep`, `quantityUnitLabel`, `unitLabels(t)`, `quantityDecimalsError(t, type, quantity, quantityUnit)`; test helpers `holdingOf`, `routeApi`, `postBodyTo`, `ApiInit`. Existing `convertQuantityDisplay(value, from, to)`, `canonicalizeSahamQuantity(quantity, unit)` from `./quantity-conversion`.
- Produces: `POST …/investments/:id/transactions` body `quantity` is always canonical lembar for saham; i18n key `buySellPricePerLembarHint`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/app/(app)/investasi/investasi.test.tsx`:

```tsx
describe("InvestasiPage — Beli/Jual Lot⇄Lembar toggle (Revisi D item 8)", () => {
  const SAHAM = holdingOf({
    id: "inv-saham",
    ticker: "BBCA",
    name: "Bank Central Asia",
    type: "saham",
    quantity: "1000",
    costBasisPerUnit: "9000",
    currentPrice: "9500",
    currentValue: "9500000",
  });
  const EMAS = holdingOf({
    id: "inv-emas",
    ticker: "ANTM",
    name: "Logam Mulia",
    type: "emas",
    quantity: "10",
  });
  const TX_CREATED = {
    id: "tx-new",
    investmentId: "inv-saham",
    type: "sell",
    quantity: "500",
    pricePerUnit: "9500",
    occurredAt: "2026-09-25T00:00:00.000Z",
    realizedPnl: "250000",
    createdAt: "2026-09-25T00:00:00.000Z",
  };

  function setup() {
    mockSession("owner");
    routeApi({
      "/investments": [SAHAM, EMAS],
      "/transactions": (_path: string, init?: ApiInit) =>
        init?.method === "POST" ? TX_CREATED : [],
    });
    render(<InvestasiPage />);
  }

  async function openTrade(
    user: ReturnType<typeof userEvent.setup>,
    holdingName: string,
  ) {
    const row = (await screen.findByText(holdingName)).closest(
      "tr",
    ) as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Lihat Detail" }));
    await user.click(
      await screen.findByRole("button", { name: "Beli / Jual" }),
    );
  }

  function submitTrade(input: HTMLElement) {
    fireEvent.change(screen.getByLabelText("Harga per Unit (Rp)"), {
      target: { value: "9500" },
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
  }

  it("sells 5 lot as 500 lembar", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    await user.click(screen.getByRole("tab", { name: "Jual" }));
    expect(screen.getByRole("tab", { name: "Lot" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const qty = screen.getByLabelText("Jumlah (Lot)");
    fireEvent.change(qty, { target: { value: "5" } });
    submitTrade(qty);

    await waitFor(() =>
      expect(postBodyTo("/investments/inv-saham/transactions")).toEqual(
        expect.objectContaining({
          type: "sell",
          quantity: "500",
          pricePerUnit: "9500",
        }),
      ),
    );
  });

  it("buys in lembar without conversion", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    await user.click(screen.getByRole("tab", { name: "Lembar" }));
    const qty = screen.getByLabelText("Jumlah (Lembar)");
    fireEvent.change(qty, { target: { value: "250" } });
    submitTrade(qty);

    await waitFor(() =>
      expect(postBodyTo("/investments/inv-saham/transactions")).toEqual(
        expect.objectContaining({ type: "buy", quantity: "250" }),
      ),
    );
  });

  it("sends an odd lot as exact lembar (0.07 lot → 7)", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    const qty = screen.getByLabelText("Jumlah (Lot)");
    fireEvent.change(qty, { target: { value: "0.07" } });
    submitTrade(qty);

    await waitFor(() =>
      expect(postBodyTo("/investments/inv-saham/transactions")?.quantity).toBe(
        "7",
      ),
    );
  });

  it("converts the typed value when the unit is toggled", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    fireEvent.change(screen.getByLabelText("Jumlah (Lot)"), {
      target: { value: "5" },
    });
    await user.click(screen.getByRole("tab", { name: "Lembar" }));

    expect(screen.getByLabelText("Jumlah (Lembar)")).toHaveValue(500);
  });

  it("explains that the price stays per lembar", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Bank Central Asia");

    expect(
      screen.getByText("Harga tetap per lembar, walau jumlah diisi dalam lot."),
    ).toBeInTheDocument();
  });

  it("has no Lot/Lembar toggle for emas and labels the quantity in grams", async () => {
    const user = userEvent.setup();
    setup();
    await openTrade(user, "Logam Mulia");

    expect(screen.queryByRole("tab", { name: "Lot" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Jumlah (gram)")).toHaveAttribute(
      "step",
      "0.001",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/investasi/investasi.test.tsx" -t "Lot⇄Lembar"`
Expected: FAIL — `Unable to find role="tab" and name "Lot"` / `Unable to find a label with the text of: Jumlah (Lot)` (the label is still "Jumlah").

- [ ] **Step 3: Add the i18n key (all three files)**

`types.ts` — end of `investasi` block: `buySellPricePerLembarHint: string;`
`id.ts` — end of `investasi` block: `buySellPricePerLembarHint: "Harga tetap per lembar, walau jumlah diisi dalam lot.",`
`en.ts` — end of `investasi` block: `buySellPricePerLembarHint: "Price stays per share (lembar), even when the quantity is entered in lots.",`

- [ ] **Step 4: Implement in `BuySellModal`**

1. After `const [quantity, setQuantity] = useState("");` (`:1106`) add:

```tsx
const isSaham = holding?.type === "saham";
const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>("lot");
const effectiveUnit: QuantityUnit = isSaham ? quantityUnit : "lembar";
const unitLabel = holding
  ? quantityUnitLabel(holding.type, effectiveUnit, unitLabels(t))
  : "";

function handleQuantityUnitChange(nextUnit: QuantityUnit) {
  setQuantity((prev) => convertQuantityDisplay(prev, quantityUnit, nextUnit));
  setQuantityUnit(nextUnit);
}
```

2. In `handleSubmit`, replace `if (!holding) return;` + `setSubmitting(true);` (`:1129-1130`) with:

```tsx
if (!holding) return;
const decimalsError = quantityDecimalsError(
  t,
  holding.type,
  quantity,
  effectiveUnit,
);
if (decimalsError) {
  toast.error(decimalsError);
  return;
}
const canonicalQuantity = isSaham
  ? canonicalizeSahamQuantity(quantity, quantityUnit)
  : quantity;
setSubmitting(true);
```

and in the request body change `quantity,` to `quantity: canonicalQuantity,`.

3. Replace the quantity and price `field` blocks (`:1208-1238`) with:

```tsx
            {isSaham && (
              <div className="field">
                <span className="label">
                  {t.investasi.fieldQuantityUnitLabel}
                </span>
                <div
                  className="segmented"
                  role="tablist"
                  aria-label={t.investasi.fieldQuantityUnitLabel}
                >
                  {(["lot", "lembar"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      role="tab"
                      className="segmented__item"
                      aria-selected={quantityUnit === unit}
                      onClick={() => handleQuantityUnitChange(unit)}
                    >
                      {unit === "lot"
                        ? t.investasi.unitLot
                        : t.investasi.unitLembar}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="tx-quantity">
                {t.investasi.buySellFieldQuantityLabel} ({unitLabel})
              </label>
              <input
                id="tx-quantity"
                type="number"
                required
                min="0"
                step={
                  holding ? quantityStep(holding.type, effectiveUnit) : "any"
                }
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input mono"
              />
              {isSaham && (
                <div className="hint">{t.investasi.hintLotConversion}</div>
              )}
            </div>
            <div className="field">
              <label className="label" htmlFor="tx-price">
                {t.investasi.buySellFieldPriceLabel}
              </label>
              <input
                id="tx-price"
                type="text"
                inputMode="numeric"
                required
                value={pricePerUnit}
                onChange={(e) =>
                  setPricePerUnit(formatAmountInput(e.target.value))
                }
                className="input mono"
              />
              {isSaham && (
                <div className="hint">
                  {t.investasi.buySellPricePerLembarHint}
                </div>
              )}
            </div>
```

The modal is already re-keyed per holding (`key={`trade-${buySellHolding?.id ?? "none"}`}` at `:1587`), so the unit state resets for each holding.

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/investasi"`
Expected: PASS — 6 new tests plus everything from Task 3 and before.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/investasi/page.tsx" "src/app/(app)/investasi/investasi.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/investasi/page.tsx" "apps/web/src/app/(app)/investasi/investasi.test.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(investasi): Lot/Lembar toggle for both Beli and Jual

The transaction modal converts lot to canonical lembar at submit with the
same exact decimal helpers as the holding form; non-saham types show their
own unit.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Web — emas form uses the family gold price (no manual price field)

**Files:**

- Modify: `apps/web/src/app/(app)/investasi/page.tsx` — imports (`:3-57`); `AUTOMATED_PRICE_TYPES`/`isManualPriceType` (`:128-131`); `PRICE_SOURCE_LABEL_KEYS` (`:136-142`); `formatPriceSourceCell` (insert before the manual-priced branch at `:382`); `AddInvestmentModal` (`:453`, `:504-507`, type hint `:723-731`, valuation section `:991-1054`)
- Modify: `apps/web/src/i18n/types.ts` (`sourceLabels` union `:1553-1558`; end of `investasi` block), `id.ts`, `en.ts` (`sourceLabels`, `pricingSourceNoticeBody`, end of `investasi` block)
- Test: `apps/web/src/app/(app)/investasi/investasi.test.tsx`

**Interfaces:**

- Consumes: Task 1 — `InvestmentDto.latestPriceSource === "family-gold-price"` for a gold-priced emas row. `useGoldPrice()` from `@/hooks/use-gold-price` → `{ pricePerGram: number | null; updatedAt: string | null; hasPrice: boolean }` (fetches `GET /family-groups/:id/gold-price` → `{ pricePerGram: string | null; updatedAt: string | null }`). `formatManualDate(iso, locale)` (already imported). Task 3 test helpers `routeApi`, `openAddModal`, `holdingOf`.
- Produces: `FAMILY_PRICED_TYPES`; i18n keys `familyGoldPriceNote`, `familyGoldPriceHintTemplate` (`{price}`, `{date}`), `familyGoldPriceUnsetHint`, `familyGoldPriceLinkLabel`, `priceFamilyGoldBadgeTemplate` (`{date}`), `sourceLabels.familyGold`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/app/(app)/investasi/investasi.test.tsx`:

```tsx
describe("InvestasiPage — emas priced from the family gold price (Revisi D item 11)", () => {
  const GOLD = {
    pricePerGram: "1500000",
    updatedAt: "2026-09-20T03:00:00.000Z",
  };

  it("hides the manual price field for emas and points to Pengaturan › Harga Emas", async () => {
    mockSession("owner");
    routeApi({ "/gold-price": GOLD });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");

    expect(
      screen.queryByLabelText("Harga Saat Ini (Rp, opsional)"),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(
        /Harga dari Pengaturan › Harga Emas \(Rp 1\.500\.000\/gram, diperbarui .+\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Buka Pengaturan" }),
    ).toHaveAttribute("href", "/akun");
  });

  it("says the family gold price is unset when the owner has not set one", async () => {
    mockSession("owner");
    routeApi({ "/gold-price": { pricePerGram: null, updatedAt: null } });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "emas");

    expect(
      await screen.findByText(/Harga emas keluarga belum diatur/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Harga Saat Ini (Rp, opsional)"),
    ).not.toBeInTheDocument();
  });

  it("still offers the manual price field for reksa dana", async () => {
    mockSession("owner");
    routeApi({ "/gold-price": GOLD });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.selectOptions(await openAddModal(user), "reksa_dana");

    expect(
      screen.getByLabelText("Harga Saat Ini (Rp, opsional)"),
    ).toBeInTheDocument();
  });

  it("labels an emas row priced from the family gold price", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        holdingOf({
          type: "emas",
          name: "Logam Mulia",
          ticker: "ANTM",
          quantity: "10",
          currentPrice: "1500000",
          currentValue: "15000000",
          latestPriceSource: "family-gold-price",
          latestPriceAsOf: GOLD.updatedAt,
          latestPriceRecordedAt: GOLD.updatedAt,
          latestPriceDelayed: false,
        }),
      ],
    });
    render(<InvestasiPage />);

    expect(await screen.findByText("Rp 1.500.000 / gram")).toBeInTheDocument();
    expect(screen.getByText(/Harga emas keluarga ·/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/investasi/investasi.test.tsx" -t "family gold price"`
Expected: FAIL — the manual price field is still rendered for emas; no "Harga dari Pengaturan" text; the row badge reads "Harga manual · …" not "Harga emas keluarga · …".

- [ ] **Step 3: Add the i18n keys (all three files)**

`types.ts`:

- `sourceLabels` union (`:1556`) becomes `"yahooFinance" | "coinGecko" | "manual" | "mock" | "computedInterest" | "familyGold",`
- End of `investasi` block:

```ts
familyGoldPriceNote: string;
/** Template with `{price}` and `{date}` placeholders. */
familyGoldPriceHintTemplate: string;
familyGoldPriceUnsetHint: string;
familyGoldPriceLinkLabel: string;
/** Template with a `{date}` placeholder. */
priceFamilyGoldBadgeTemplate: string;
```

`id.ts`:

- In `investasi.sourceLabels` after `computedInterest: …,` add `familyGold: "Harga Emas Keluarga",`
- Replace the `pricingSourceNoticeBody` value with: `"Saham IDX diambil dari Yahoo Finance (kode .JK) dan kripto dari CoinGecko, keduanya delayed ±15 menit, bukan real-time. Emas mengikuti Harga Emas keluarga di Pengaturan. Reksa dana, obligasi, dan lainnya kamu isi manual dan selalu ditampilkan bersama tanggal penilaiannya; deposito dihitung dari bunganya."`
- End of `investasi` block:

```ts
    familyGoldPriceNote:
      "Harga emas mengikuti Harga Emas keluarga di Pengaturan, tidak perlu diinput per posisi.",
    familyGoldPriceHintTemplate:
      "Harga dari Pengaturan › Harga Emas ({price}/gram, diperbarui {date}).",
    familyGoldPriceUnsetHint:
      "Harga emas keluarga belum diatur. Sampai diatur di Pengaturan › Harga Emas, emas dinilai dengan harga manual terakhirnya.",
    familyGoldPriceLinkLabel: "Buka Pengaturan",
    priceFamilyGoldBadgeTemplate: "Harga emas keluarga · {date}",
```

`en.ts`:

- `sourceLabels`: `familyGold: "Family Gold Price",`
- `pricingSourceNoticeBody`: `"IDX stocks come from Yahoo Finance (.JK code) and crypto from CoinGecko, both delayed ±15 minutes, not real-time. Gold follows the family Gold Price in Settings. Mutual funds, bonds and other holdings you value manually, always shown with their valuation date; time deposits are computed from their interest."`
- End of `investasi` block:

```ts
    familyGoldPriceNote:
      "Gold follows the family Gold Price in Settings; no per-holding price entry needed.",
    familyGoldPriceHintTemplate:
      "Price from Settings › Gold Price ({price}/gram, updated {date}).",
    familyGoldPriceUnsetHint:
      "The family gold price isn't set yet. Until it is set in Settings › Gold Price, gold is valued at its last manual price.",
    familyGoldPriceLinkLabel: "Open Settings",
    priceFamilyGoldBadgeTemplate: "Family gold price · {date}",
```

- [ ] **Step 4: Implement**

1. Imports: add `import Link from "next/link";` after the `react` import, and `import { useGoldPrice } from "@/hooks/use-gold-price";` after `import { useCanManage } from "@/hooks/use-role-permissions";`.

2. Replace `:128-131` with:

```tsx
const AUTOMATED_PRICE_TYPES: readonly InvestmentType[] = ["saham", "kripto"];
// Revisi D item 11 — valued from FamilyGroup.goldPricePerGram (Pengaturan › Harga Emas).
const FAMILY_PRICED_TYPES: readonly InvestmentType[] = ["emas"];
function isManualPriceType(type: InvestmentType): boolean {
  return (
    !AUTOMATED_PRICE_TYPES.includes(type) && !FAMILY_PRICED_TYPES.includes(type)
  );
}
```

3. `PRICE_SOURCE_LABEL_KEYS` — add `"family-gold-price": "familyGold",` after the `"computed-interest"` entry.

4. `formatPriceSourceCell` — directly before `// Manual-priced types: reksa_dana, obligasi, emas, lainnya.` (`:382`) insert:

```tsx
if (h.latestPriceSource === "family-gold-price") {
  const goldAsOf = h.latestPriceAsOf ?? h.latestPriceRecordedAt;
  return (
    <>
      <div className="mono">
        {formatDecimalRupiah(h.currentPrice)} / {t.investasi.unitGram}
      </div>
      <div className="mt-0.5">
        <StatusBadge variant="warning">
          {goldAsOf
            ? t.investasi.priceFamilyGoldBadgeTemplate.replace(
                "{date}",
                formatManualDate(goldAsOf, locale),
              )
            : t.investasi.sourceLabels.familyGold}
        </StatusBadge>
      </div>
    </>
  );
}
```

and change that comment to `// Manual-priced types: reksa_dana, obligasi, lainnya (+ emas with no family gold price).`

5. `AddInvestmentModal`:
   - `:453` `const { t } = useLocale();` → `const { t, locale } = useLocale();`, and on the next line add `const goldPrice = useGoldPrice();`
   - After `const isDeposito = form.type === "deposito";` (`:505`) add `const isFamilyGoldPriced = FAMILY_PRICED_TYPES.includes(form.type);` (the existing `isManual` expression stays as is — `isManualPriceType("emas")` is now `false`).
   - Type hint (`:724-730`) becomes:

```tsx
{
  isDeposito
    ? t.investasi.depositoValuationNote
    : form.type === "saham"
      ? t.investasi.autoPriceNoteSaham
      : form.type === "kripto"
        ? t.investasi.autoPriceNoteKripto
        : isFamilyGoldPriced
          ? t.investasi.familyGoldPriceNote
          : t.investasi.manualPriceNote;
}
```

- Valuation section: change `) : isManual ? (` (`:996`) to insert a branch before it, so the chain reads `isDeposito ? (…) : isFamilyGoldPriced ? (…) : isManual ? (…) : (…)`. The new branch:

```tsx
              ) : isFamilyGoldPriced ? (
                <div className="notice notice--info">
                  <Info className="size-4 shrink-0" aria-hidden="true" />
                  <span>
                    <span>
                      {goldPrice.hasPrice && goldPrice.pricePerGram !== null
                        ? t.investasi.familyGoldPriceHintTemplate
                            .replace(
                              "{price}",
                              formatRupiah(goldPrice.pricePerGram),
                            )
                            .replace(
                              "{date}",
                              goldPrice.updatedAt
                                ? formatManualDate(goldPrice.updatedAt, locale)
                                : "—",
                            )
                        : t.investasi.familyGoldPriceUnsetHint}
                    </span>{" "}
                    <Link href="/akun" className="font-semibold text-primary">
                      {t.investasi.familyGoldPriceLinkLabel}
                    </Link>
                  </span>
                </div>
```

Because `isManual` is `false` for emas, `handleSubmit` never posts a manual `/price` for an emas holding.

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/investasi"`
Expected: PASS — 4 new tests plus all earlier ones.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/investasi/page.tsx" "src/app/(app)/investasi/investasi.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/investasi/page.tsx" "apps/web/src/app/(app)/investasi/investasi.test.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(investasi): emas uses the family gold price instead of a manual price

The form drops the manual price field for emas and links to Pengaturan ›
Harga Emas; rows priced from it carry a "Harga emas keluarga" badge.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Web — wide two-column detail dialog + date-filtered buy/sell history

**Files:**

- Create: `apps/web/src/app/(app)/investasi/history-filter.ts`
- Create: `apps/web/src/app/(app)/investasi/history-filter.test.ts`
- Modify: `apps/web/src/app/(app)/investasi/page.tsx` — imports; `InvestasiPage` state after `detailPrices` query (`:1430`); the detail `<DialogContent>` block (`:1608-1819`)
- Modify: `apps/web/src/i18n/types.ts`, `id.ts`, `en.ts` (end of the `investasi` block)
- Test: `apps/web/src/app/(app)/investasi/investasi.test.tsx`

**Interfaces:**

- Consumes: `DateRangeFilterField` from `@/components/wm/date-range-field` (props `from`, `to` as `YYYY-MM-DD` or `""`, `locale`, `label`, `cancelLabel`, `applyLabel`, `onApply(from, to)`; trigger button's accessible name is `"Semua tanggal"` when both are empty; its popover is `role="dialog"` named by `label`); Task 3 — `formatQuantity`, `quantityUnitLabel`, `unitLabels`; test helpers `routeApi`, `holdingOf`.
- Produces: `localDateKey(iso: string): string`; `filterByOccurredAt<T extends { occurredAt: string }>(rows: readonly T[], from: string, to: string): T[]`; i18n keys `historyFilterLabel`, `historyFilterApply`, `historyFilterClear`, `historyFilterEmpty`.

Width note: `components/ui/dialog.tsx:94-100` forbids plain `max-w-*` on `DialogContent` (`.dialog` sets `width: min(480px, …)`, so `max-w-4xl` alone would not widen it) and requires a `min-[769px]:` width. "4xl" is therefore `min-[769px]:w-[min(56rem,calc(100%-2rem))]` (56rem = Tailwind `max-w-4xl`); below 769px it stays the full-width bottom sheet.

- [ ] **Step 1: Write the failing unit tests**

Create `apps/web/src/app/(app)/investasi/history-filter.test.ts` (jest pins `TZ=Asia/Jakarta`, see `jest.config.ts`):

```ts
import { filterByOccurredAt, localDateKey } from "./history-filter";

const rows = [
  { id: "a", occurredAt: "2026-03-01T03:00:00.000Z" },
  { id: "b", occurredAt: "2026-03-01T18:30:00.000Z" },
  { id: "c", occurredAt: "2026-03-15T03:00:00.000Z" },
  { id: "d", occurredAt: "2026-03-31T16:59:00.000Z" },
];

describe("localDateKey", () => {
  it("uses the WIB calendar day, not the UTC one", () => {
    expect(localDateKey("2026-03-01T18:30:00.000Z")).toBe("2026-03-02");
  });
});

describe("filterByOccurredAt (Revisi D item 8b)", () => {
  it("returns everything when both bounds are empty", () => {
    expect(filterByOccurredAt(rows, "", "").map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("includes both the from day and the to day", () => {
    expect(
      filterByOccurredAt(rows, "2026-03-02", "2026-03-15").map((r) => r.id),
    ).toEqual(["b", "c"]);
  });

  it("puts a 23:59 WIB instant on its own WIB day", () => {
    expect(
      filterByOccurredAt(rows, "2026-03-31", "2026-03-31").map((r) => r.id),
    ).toEqual(["d"]);
  });

  it("supports an open-ended range", () => {
    expect(filterByOccurredAt(rows, "2026-03-15", "").map((r) => r.id)).toEqual(
      ["c", "d"],
    );
    expect(filterByOccurredAt(rows, "", "2026-03-01").map((r) => r.id)).toEqual(
      ["a"],
    );
  });
});
```

- [ ] **Step 2: Write the failing page tests**

Append to `apps/web/src/app/(app)/investasi/investasi.test.tsx`:

```tsx
describe("InvestasiPage — detail dialog layout + history date filter (Revisi D item 8b)", () => {
  const now = new Date();
  const dayIso = (day: number) =>
    new Date(now.getFullYear(), now.getMonth(), day, 10, 0).toISOString();
  const TXS = [
    {
      id: "tx-early",
      investmentId: "inv-1",
      type: "buy",
      quantity: "3",
      pricePerUnit: "100000",
      occurredAt: dayIso(2),
      realizedPnl: null,
      createdAt: dayIso(2),
    },
    {
      id: "tx-late",
      investmentId: "inv-1",
      type: "buy",
      quantity: "7",
      pricePerUnit: "100000",
      occurredAt: dayIso(20),
      realizedPnl: null,
      createdAt: dayIso(20),
    },
  ];

  async function applyRange(
    user: ReturnType<typeof userEvent.setup>,
    dialog: HTMLElement,
  ) {
    await user.click(
      within(dialog).getByRole("button", { name: "Semua tanggal" }),
    );
    const picker = screen.getByRole("dialog", { name: "Filter tanggal" });
    await user.click(within(picker).getByRole("button", { name: "10" }));
    await user.click(within(picker).getByRole("button", { name: "25" }));
    await user.click(within(picker).getByRole("button", { name: "Terapkan" }));
  }

  it("opens wide with a two-column body", async () => {
    mockSession("owner");
    routeApi({ "/investments/inv-1/transactions": TXS });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.click(
      await screen.findByRole("button", { name: "Lihat Detail" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Emas Batangan" });

    expect(dialog).toHaveClass("min-[769px]:w-[min(56rem,calc(100%-2rem))]");
    expect(dialog).not.toHaveClass("max-w-lg");
    expect(dialog.querySelector(".dialog__body")).toHaveClass("md:grid-cols-2");
    expect(within(dialog).getByText("Riwayat Harga")).toBeInTheDocument();
    expect(await within(dialog).findByText(/3 unit @/)).toBeInTheDocument();
    expect(within(dialog).getByText(/7 unit @/)).toBeInTheDocument();
  });

  it("filters the buy/sell history to the chosen range and clears back to all", async () => {
    mockSession("owner");
    routeApi({ "/investments/inv-1/transactions": TXS });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    await user.click(
      await screen.findByRole("button", { name: "Lihat Detail" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Emas Batangan" });
    await within(dialog).findByText(/3 unit @/);

    await applyRange(user, dialog);

    expect(within(dialog).queryByText(/3 unit @/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/7 unit @/)).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "Hapus filter" }),
    );

    expect(within(dialog).getByText(/3 unit @/)).toBeInTheDocument();
  });

  it("does not carry a filter over to another holding", async () => {
    mockSession("owner");
    routeApi({
      "/investments": [
        HOLDING,
        holdingOf({
          id: "inv-2",
          name: "Reksa Dana Pasar Uang",
          ticker: "RDPU",
          type: "reksa_dana",
        }),
      ],
      "/investments/inv-1/transactions": TXS,
    });
    const user = userEvent.setup();
    render(<InvestasiPage />);

    const [firstDetail] = await screen.findAllByRole("button", {
      name: "Lihat Detail",
    });
    await user.click(firstDetail as HTMLElement);
    const dialog = await screen.findByRole("dialog", { name: "Emas Batangan" });
    await within(dialog).findByText(/3 unit @/);
    await applyRange(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Tutup" }));

    const [, secondDetail] = await screen.findAllByRole("button", {
      name: "Lihat Detail",
    });
    await user.click(secondDetail as HTMLElement);
    const second = await screen.findByRole("dialog", {
      name: "Reksa Dana Pasar Uang",
    });

    expect(
      within(second).getByRole("button", { name: "Semua tanggal" }),
    ).toBeInTheDocument();
  });
});
```

If Base UI's popup does not expose the title as its accessible name in jsdom, locate it with `document.querySelector('[data-slot="dialog-content"]') as HTMLElement` instead of `findByRole("dialog", { name })` (same assertions).

- [ ] **Step 3: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/investasi/history-filter.test.ts" "src/app/\(app\)/investasi/investasi.test.tsx" -t "history|detail dialog|localDateKey"`
Expected: FAIL — `Cannot find module './history-filter'`; the dialog still has class `max-w-lg`; no "Semua tanggal" button in the dialog.

- [ ] **Step 4: Create `history-filter.ts`**

```ts
/** The local (WIB in production) calendar day of an ISO instant — the same day the list prints. */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  return [
    String(d.getFullYear()).padStart(4, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Inclusive on both ends; an empty bound is open. `from`/`to` are `YYYY-MM-DD`. */
export function filterByOccurredAt<T extends { occurredAt: string }>(
  rows: readonly T[],
  from: string,
  to: string,
): T[] {
  return rows.filter((row) => {
    const day = localDateKey(row.occurredAt);
    return (!from || day >= from) && (!to || day <= to);
  });
}
```

- [ ] **Step 5: Add the i18n keys (all three files)**

`types.ts` — end of `investasi` block:

```ts
historyFilterLabel: string;
historyFilterApply: string;
historyFilterClear: string;
historyFilterEmpty: string;
```

`id.ts`:

```ts
    historyFilterLabel: "Filter tanggal",
    historyFilterApply: "Terapkan",
    historyFilterClear: "Hapus filter",
    historyFilterEmpty: "Tidak ada transaksi pada rentang tanggal ini.",
```

`en.ts`:

```ts
    historyFilterLabel: "Date filter",
    historyFilterApply: "Apply",
    historyFilterClear: "Clear filter",
    historyFilterEmpty: "No transactions in this date range.",
```

- [ ] **Step 6: Implement the page changes**

1. Imports: after the `@/components/charts/…` imports add `import { DateRangeFilterField } from "@/components/wm/date-range-field";`, and after the `./instrument-units` import add `import { filterByOccurredAt } from "./history-filter";`.

2. In `InvestasiPage`, directly after the `detailPrices` `useQuery` (ends `:1430`) add:

```tsx
// Keyed by holding so a range never leaks into the next holding opened.
const [historyRange, setHistoryRange] = useState<{
  holdingId: string;
  from: string;
  to: string;
} | null>(null);
const activeHistoryRange =
  historyRange && historyRange.holdingId === detailHolding?.id
    ? historyRange
    : null;
const visibleTransactions = filterByOccurredAt(
  detailTransactions ?? [],
  activeHistoryRange?.from ?? "",
  activeHistoryRange?.to ?? "",
);
```

3. Replace the whole detail `<DialogContent className="max-w-lg"> … </DialogContent>` block (`:1608-1819`) with:

```tsx
<DialogContent className="min-[769px]:w-[min(56rem,calc(100%-2rem))]">
  {detailHolding && (
    <>
      <DialogHeader>
        <DialogTitle>{detailHolding.name}</DialogTitle>
        <DialogDescription>
          {formatInstrumentSubline(detailHolding, t, locale)}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div className="rounded-[10px] border bg-muted/30 p-3">
            <SparklinePreview />
            <div className="mt-2 text-[12px] text-muted-foreground">
              Harga penutupan 12 bulan terakhir
            </div>
          </div>
          <div className="grid gap-2 text-[12.5px] sm:grid-cols-2">
            <DetailMetric
              label={t.investasi.detailLatestPriceLabel}
              value={formatDecimalRupiah(detailHolding.currentPrice)}
            />
            <DetailMetric
              label={t.investasi.tableValue}
              value={formatDecimalRupiah(detailHolding.currentValue)}
            />
            <DetailMetric
              label={t.investasi.detailSourceLabel}
              value={String(
                detailHolding.latestPriceSource === "manual"
                  ? t.investasi.detailManualLabelPrefix.replace(/:?\s*$/, "")
                  : PRICE_SOURCE_LABEL_KEYS[
                        detailHolding.latestPriceSource as keyof typeof PRICE_SOURCE_LABEL_KEYS
                      ]
                    ? t.investasi.sourceLabels[
                        PRICE_SOURCE_LABEL_KEYS[
                          detailHolding.latestPriceSource as keyof typeof PRICE_SOURCE_LABEL_KEYS
                        ]
                      ]
                    : detailHolding.latestPriceSource,
              )}
            />
            <DetailMetric
              label={t.investasi.totalReturnSuffix}
              value={`${formatDecimalRupiah(detailHolding.returnRp)} (${formatReturnPct(
                detailHolding.returnPct,
              )})`}
              tone={
                parseFloat(detailHolding.returnRp ?? "0") >= 0
                  ? "text-success"
                  : "text-destructive"
              }
            />
            <DetailMetric
              label={t.investasi.detailRealizedPnlLabel}
              value={formatDecimalRupiah(detailHolding.realizedPnlRp)}
              tone={
                detailHolding.realizedPnlRp &&
                parseFloat(detailHolding.realizedPnlRp) >= 0
                  ? "text-success"
                  : detailHolding.realizedPnlRp
                    ? "text-destructive"
                    : undefined
              }
            />
          </div>
          <div className="rounded-[10px] bg-accent p-3 text-[12px] text-accent-foreground">
            {detailHolding.currentPrice === null
              ? detailHolding.automatedPriceUnmapped
                ? t.investasi.automatedUnmappedNote
                : isManualPriceType(detailHolding.type as InvestmentType)
                  ? t.investasi.detailNoManualPrice
                  : t.investasi.detailPriceUnavailable
              : detailHolding.latestPriceSource === "manual"
                ? `${t.investasi.detailManualLabelPrefix}${formatManualDate(
                    detailHolding.latestPriceAsOf ??
                      detailHolding.latestPriceRecordedAt ??
                      new Date().toISOString(),
                    locale,
                  )}`
                : `${t.investasi.detailRecordedAtLabel}: ${
                    (detailHolding.latestPriceAsOf ??
                    detailHolding.latestPriceRecordedAt)
                      ? formatLocaleDateTime(
                          detailHolding.latestPriceAsOf ??
                            detailHolding.latestPriceRecordedAt ??
                            "",
                          locale,
                        )
                      : "—"
                  }`}
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-semibold text-muted-foreground">
              {t.investasi.priceHistoryTitle}
            </div>
            {(detailPrices ?? []).length === 0 ? (
              <div className="text-[12px] text-muted-foreground">
                {t.investasi.priceHistoryEmpty}
              </div>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {(detailPrices ?? []).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-[8px] border p-2 text-[11.5px]"
                  >
                    <span className="text-muted-foreground">
                      {new Date(p.asOf).toLocaleDateString(
                        locale === "id" ? "id-ID" : "en-US",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                      {" · "}
                      {p.source === "manual"
                        ? t.investasi.priceSourceManual
                        : p.source}
                    </span>
                    <span className="mono font-semibold">
                      {formatDecimalRupiah(p.price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <DateRangeFilterField
              from={activeHistoryRange?.from ?? ""}
              to={activeHistoryRange?.to ?? ""}
              locale={locale}
              label={t.investasi.historyFilterLabel}
              cancelLabel={t.common.cancel}
              applyLabel={t.investasi.historyFilterApply}
              onApply={(from, to) =>
                setHistoryRange({
                  holdingId: detailHolding.id,
                  from,
                  to,
                })
              }
            />
            {activeHistoryRange && (
              <button
                type="button"
                className="text-[11.5px] font-semibold text-primary"
                onClick={() => setHistoryRange(null)}
              >
                {t.investasi.historyFilterClear}
              </button>
            )}
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-semibold text-muted-foreground">
              {t.investasi.historySectionTitle}
            </div>
            {(detailTransactions ?? []).length === 0 ? (
              <div className="text-[12px] text-muted-foreground">
                {t.investasi.historyEmptyLabel}
              </div>
            ) : visibleTransactions.length === 0 ? (
              <div className="text-[12px] text-muted-foreground">
                {t.investasi.historyFilterEmpty}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {visibleTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-2 rounded-[8px] border p-2 text-[11.5px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <StatusBadge
                        variant={tx.type === "buy" ? "info" : "warning"}
                      >
                        {tx.type === "buy"
                          ? t.investasi.historyBuyLabel
                          : t.investasi.historySellLabel}
                      </StatusBadge>
                      <span className="mono">
                        {formatQuantity(tx.quantity, detailHolding.type)}{" "}
                        {quantityUnitLabel(
                          detailHolding.type,
                          "lembar",
                          unitLabels(t),
                        ).toLowerCase()}{" "}
                        @ {formatDecimalRupiah(tx.pricePerUnit)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {tx.realizedPnl && (
                        <span
                          className={cn(
                            "mono",
                            parseFloat(tx.realizedPnl) >= 0
                              ? "text-success"
                              : "text-destructive",
                          )}
                        >
                          {t.investasi.historyRealizedPnlTemplate.replace(
                            "{pnl}",
                            formatDecimalRupiah(tx.realizedPnl),
                          )}
                        </span>
                      )}
                      <span>{formatManualDate(tx.occurredAt, locale)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {canManage && detailHolding.type !== "deposito" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setBuySellHolding(detailHolding);
                setDetailHolding(null);
              }}
            >
              {t.investasi.buySellButtonLabel}
            </Button>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" onClick={() => setDetailHolding(null)}>
          Tutup
        </Button>
      </DialogFooter>
    </>
  )}
</DialogContent>
```

- [ ] **Step 7: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/investasi"`
Expected: PASS — 5 new `history-filter` tests, 3 new dialog tests, and every earlier investasi test.

- [ ] **Step 8: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/investasi/page.tsx" "src/app/(app)/investasi/history-filter.ts" "src/app/(app)/investasi/history-filter.test.ts" "src/app/(app)/investasi/investasi.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/src/app/(app)/investasi" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(investasi): wide two-column holding detail with a dated history filter

Metrics and price history on the left, buy/sell history on the right (one
column on mobile); the shared date-range picker filters the history by WIB
day, per holding.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**

- Item 8 (Lot/Lembar in Beli **and** Jual, API receives lembar) → Task 4.
- Item 8b (wider dialog, two columns on md+, one on mobile, date filter on buy/sell history, client-side on `occurredAt`) → Task 6.
- Item 9 (one `UNIT_BY_TYPE` driving form label/placeholder, list, detail, BuySellModal; per-type i18n label; saham lot⇄lembar, reksa_dana 4 dp, obligasi unit, emas 3 dp gram, kripto 8 dp coin, deposito exempt, lainnya unit) → Task 3 (form, list, detail) + Task 4 (BuySellModal label/step).
- Item 10 (additive `AssetType.emas` migration, contracts, web select, i18n; `weightGram` out of scope) → Task 2.
- Item 11 (API values emas from `goldPricePerGram`, fallback last manual price, spec tests; web hides manual price for emas and shows the "Harga dari Pengaturan › Harga Emas (Rp X/gram, diperbarui …)" hint with a `/akun` link via `useGoldPrice`) → Task 1 (API) + Task 5 (web).
- The catalog's optional "auto-write a price-history row when the family gold price changes" is not implemented (valuation reads the live family value; `findPrices` still lists only stored rows).

**Placeholder scan:** no TBD/TODO; every code step carries code; the two conditional notes (import order in Task 1 Step 4, dialog locator fallback in Task 6 Step 2) give the exact alternative.

**Type consistency:** `familyGoldUnitPrice` / `FAMILY_GOLD_PRICE_SOURCE` / `"family-gold-price"` match between Task 1 and Task 5; `maxQuantityDecimals`, `quantityStep`, `hasAtMostDecimals`, `quantityUnitLabel`, `formatQuantity`, `UnitLabels`, `unitLabels`, `quantityDecimalsError` are defined in Task 3 and consumed with the same signatures in Tasks 4 and 6; `filterByOccurredAt(rows, from, to)` matches between Task 6's module and page; test helpers `routeApi`, `postBodyTo`, `holdingOf`, `openAddModal`, `ApiInit` are defined once in Task 3.

**Review Focus:** each of the five lines has its pinning test in its owning task (Task 1: unset/zero gold + parity; Task 4: odd lot; Task 6: WIB boundaries + no leak).
