# Revisi A+B — Calculators/Pajak Fix + Quick Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every server-backed calculator (and the Pajak page) return real numbers again, auto-fill the tax deduction from recorded donations, stop the Asuransi "Bayar Premi" 409 dead-end, make Rekening's "Mutasi" button open an account-filtered Transaksi, and explain what "Rekening Privat" means.

**Architecture:** API fixes live in NestJS (`apps/api`): restore runtime DTO classes on the calculators controller (guarded by a metadata spec), add one read endpoint for the deductible donation total, and align the insurance list's `paidThisPeriod` with `pay()`'s own "paid ahead" rule. Web fixes (`apps/web`) are small page-level edits plus i18n strings in `id.ts`, `en.ts`, `types.ts`.

**Tech Stack:** NestJS 10 + class-validator + Jest + supertest (API); Next.js 16 App Router + React 19 + TanStack Query + Jest + Testing Library (web); pnpm workspace.

**Spec:** `docs/superpowers/plans/2026-09-25-revisi-besar-catalog.md` — items 6, 7, 13, 14, 15.

## Global Constraints

- Work only inside the worktree `/home/stealth/Projects/wealthme-web-revisi-ab` on branch `feat/revisi-ab-calculators-quickfixes`.
- Never edit protected files: `apps/web/src/app/globals.css`, `apps/web/src/app/design-system.css`, `apps/web/src/lib/*`, `apps/web/src/components/ui/*`, `apps/web/src/components/wm/*`, `apps/web/src/components/charts/*`, `apps/web/src/components/shell/*`, `apps/web/src/app/layout.tsx`, `packages/config/*`.
- Every new user-visible string goes into **all three** of `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts` (dictionaries use `satisfies I18nDictionary`).
- Controllers keep the repo convention for DTO classes consumed by `@Body()`: a value import preceded by `// eslint-disable-next-line @typescript-eslint/consistent-type-imports` (see `apps/api/src/donations/donations.controller.ts:26-32`).
- Tax deduction rule stays as implemented in `apps/api/src/donations/donations.service.ts:58-62` (only `zakat_maal`, `zakat_fitrah`, `persepuluhan` with `isTaxDeductible`). Do not change it.
- Run tests locally only as the focused commands each task names. No `next build`, no full `turbo` runs on this laptop.
- Lint every file you touch: `pnpm exec eslint <files>` from the owning app dir must exit 0.
- Commit messages: Conventional Commits (`fix(scope): …` / `feat(scope): …`), ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code comments: none unless the WHY is non-obvious; one line max.

## Review Focus

1. **Re-regression of type-only imports** — `eslint --fix` must not be able to silently turn a `@Body()` DTO back into `import type`; the metadata spec must fail if it does.
2. **Route shadowing** — `GET …/donations/deductible-total` must not be captured by `GET …/donations/:id`.
3. **User override of the auto-filled deduction** — once the user edits the Perpuluhan/Zakat field, a later refetch must not overwrite their value; the form reset must re-enable auto-fill.
4. **Insurance with no renewal date** — `renewalDate: null` must still be payable when no transaction exists this period (no false "paid").
5. **Mutasi link with special chars in id** — the account id must be URL-encoded in the pushed URL.

---

### Task 1: Calculators controller — restore runtime DTO classes (fixes every "hasil 0")

**Files:**

- Modify: `apps/api/src/calculators/calculators.controller.ts:1-24`
- Create: `apps/api/src/calculators/calculators-controller-dto-metadata.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `POST /calculators/{zakat,perpuluhan,pph21,investment,kpr,retirement}` receive validated bodies again. Task 3 relies on `POST /calculators/pph21` returning a non-zero `totalTax` for taxable input.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/calculators/calculators-controller-dto-metadata.spec.ts`:

```ts
import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { CalculatorsController } from "./calculators.controller";
import { CalculatorsService } from "./calculators.service";
import {
  InvestmentCalcRequestDto,
  KprCalcRequestDto,
  RetirementCalcRequestDto,
} from "./dto/investment.dto";
import { PerpuluhanRequestDto } from "./dto/perpuluhan.dto";
import { Pph21RequestDto } from "./dto/pph21.dto";
import { ZakatRequestDto } from "./dto/zakat.dto";

import type { INestApplication } from "@nestjs/common";

// A type-only DTO import degrades design:paramtypes to Object, and the global
// ValidationPipe({ whitelist: true }) then strips every field from the body.
function paramTypesOf(method: string): unknown[] {
  const types = Reflect.getMetadata(
    "design:paramtypes",
    CalculatorsController.prototype,
    method,
  ) as unknown[] | undefined;
  if (!types) throw new Error(`no design:paramtypes for ${method}()`);
  return types;
}

describe("CalculatorsController — request DTOs survive to runtime", () => {
  it.each([
    ["calculateZakat", ZakatRequestDto],
    ["calculatePerpuluhan", PerpuluhanRequestDto],
    ["calculatePph21", Pph21RequestDto],
    ["calculateInvestment", InvestmentCalcRequestDto],
    ["calculateKpr", KprCalcRequestDto],
    ["calculateRetirement", RetirementCalcRequestDto],
  ])("%s() still receives its DTO class", (method, dto) => {
    const types = paramTypesOf(method as string);
    expect(types).toContain(dto);
    expect(types).not.toContain(Object);
  });
});

describe("CalculatorsController over HTTP with the production ValidationPipe", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CalculatorsController],
      providers: [CalculatorsService],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("zakat: 100 jt cash above nisab yields zakatable 100 jt and zakat 2.5 jt", async () => {
    const res = await request(app.getHttpServer())
      .post("/calculators/zakat")
      .send({
        cash: 100_000_000,
        investments: 0,
        gold: 0,
        liabilities: 0,
        haulConfirmed: true,
      })
      .expect(200);

    expect(res.body.zakatable).toBe(100_000_000);
    expect(res.body.zakat).toBe(2_500_000);
    expect(res.body.isObligated).toBe(true);
  });

  it("pph21: 100 jt/year gross with TK/0 PTKP yields a positive tax", async () => {
    const res = await request(app.getHttpServer())
      .post("/calculators/pph21")
      .send({ grossIncome: 100_000_000, zakatPaid: 0, ptkp: 54_000_000 })
      .expect(200);

    expect(res.body.grossIncome).toBe(100_000_000);
    expect(res.body.totalTax).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/calculators/calculators-controller-dto-metadata.spec.ts`
Expected: FAIL — the `it.each` rows report `expect(received).toContain(expected)` (types contain `Object`), and the zakat HTTP test reports `zakatable` received `null`.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/calculators/calculators.controller.ts`, replace the DTO import block (currently lines 8-24: the `./dto/investment.dto` value import, the `perpuluhan`/`pph21`/`zakat` imports with inline `type`, and the trailing `import type { … } from "./dto/investment.dto"`) with:

```ts
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  InvestmentCalcRequestDto,
  InvestmentCalcResultDto,
  KprCalcRequestDto,
  KprCalcResultDto,
  RetirementCalcRequestDto,
  RetirementCalcResultDto,
} from "./dto/investment.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  PerpuluhanRequestDto,
  PerpuluhanResultDto,
} from "./dto/perpuluhan.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Pph21RequestDto, Pph21ResultDto } from "./dto/pph21.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ZakatRequestDto, ZakatResultDto } from "./dto/zakat.dto";
```

Keep the existing `CalculatorsService` import and its disable comment unchanged. Remove the now-duplicate `import type { InvestmentCalcRequestDto, KprCalcRequestDto, RetirementCalcRequestDto } from "./dto/investment.dto";`.

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `pnpm exec jest src/calculators`
Expected: PASS — all suites in `src/calculators` green (the new spec: 8 tests).

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/calculators/calculators.controller.ts src/calculators/calculators-controller-dto-metadata.spec.ts`
Expected: exit 0, no output. If `consistent-type-imports` still reports on a multi-line import, the disable comment must sit directly above the `import {` line that ESLint reports.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/calculators/calculators.controller.ts apps/api/src/calculators/calculators-controller-dto-metadata.spec.ts
git commit -m "$(cat <<'EOF'
fix(calculators): restore runtime DTO classes so ValidationPipe stops stripping every body

Type-only imports erased the @Body() DTO metadata; whitelist:true then removed
every field and all six calculators returned null/0. Guarded by a metadata spec.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Donations — `GET …/donations/deductible-total?year=YYYY`

**Files:**

- Modify: `apps/api/src/donations/donations.controller.ts` (add a handler declared **before** `@Get(":id")`)
- Create: `apps/api/src/donations/donations.controller.spec.ts`

**Interfaces:**

- Consumes: `DonationsService.getTotalDeductibleAmount(familyGroupId: string, year: number): Promise<bigint>` (exists, `donations.service.ts:282`).
- Produces: `GET /family-groups/:familyGroupId/donations/deductible-total?year=YYYY` → `200 { year: number; total: string }` (total = BigInt as decimal string). Missing `year` → current calendar year. Non-integer / < 2000 / > 2100 `year` → `400`. Task 3 consumes this exact shape.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/donations/donations.controller.spec.ts`:

```ts
import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { DonationsController } from "./donations.controller";
import { DonationsService } from "./donations.service";

import type { INestApplication } from "@nestjs/common";

const FG = "fg-1";

describe("DonationsController — GET deductible-total", () => {
  let app: INestApplication;
  const service = {
    getTotalDeductibleAmount: jest.fn(),
    findOne: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DonationsController],
      providers: [{ provide: DonationsService, useValue: service }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns the deductible total for the requested year as a string", async () => {
    service.getTotalDeductibleAmount.mockResolvedValue(BigInt(2_500_000));

    const res = await request(app.getHttpServer())
      .get(`/family-groups/${FG}/donations/deductible-total?year=2026`)
      .expect(200);

    expect(res.body).toEqual({ year: 2026, total: "2500000" });
    expect(service.getTotalDeductibleAmount).toHaveBeenCalledWith(FG, 2026);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it("defaults to the current calendar year when year is omitted", async () => {
    service.getTotalDeductibleAmount.mockResolvedValue(BigInt(0));
    const year = new Date().getFullYear();

    const res = await request(app.getHttpServer())
      .get(`/family-groups/${FG}/donations/deductible-total`)
      .expect(200);

    expect(res.body).toEqual({ year, total: "0" });
    expect(service.getTotalDeductibleAmount).toHaveBeenCalledWith(FG, year);
  });

  it.each(["abc", "1999", "2101", "2026.5"])(
    "rejects year=%s with 400",
    async (year) => {
      await request(app.getHttpServer())
        .get(`/family-groups/${FG}/donations/deductible-total?year=${year}`)
        .expect(400);
      expect(service.getTotalDeductibleAmount).not.toHaveBeenCalled();
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/donations/donations.controller.spec.ts`
Expected: FAIL — the first test sees `findOne` called (the `:id` route captured `deductible-total`) or a non-200 status.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/donations/donations.controller.ts`: add `BadRequestException` to the `@nestjs/common` import, then insert this handler **between** the existing `@Get()` `findAll` handler and the `@Post()` handler (so it is declared before `@Get(":id")`):

```ts
  @Get("deductible-total")
  @CheckAbility((ab: AppAbility) => ab.can("read", "Donation"))
  @ApiParam({ name: "familyGroupId", type: String })
  @ApiQuery({ name: "year", required: false, type: Number })
  @ApiOperation({
    summary:
      "Total tax-deductible donations (zakat + persepuluhan) for a calendar year",
  })
  async getDeductibleTotal(
    @Param("familyGroupId") familyGroupId: string,
    @Query("year") year?: string,
  ): Promise<{ year: number; total: string }> {
    const resolvedYear =
      year === undefined ? new Date().getFullYear() : Number(year);
    if (
      !Number.isInteger(resolvedYear) ||
      resolvedYear < 2000 ||
      resolvedYear > 2100
    ) {
      throw new BadRequestException("year must be an integer between 2000 and 2100");
    }
    const total = await this.donationsService.getTotalDeductibleAmount(
      familyGroupId,
      resolvedYear,
    );
    return { year: resolvedYear, total: total.toString() };
  }
```

If the existing `findAll` carries a `@PageAccess(...)` decorator, apply the same `@PageAccess(...)` value to this handler too.

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `pnpm exec jest src/donations`
Expected: PASS — new spec 6 tests green; `donations.service.spec.ts` still green.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/donations/donations.controller.ts src/donations/donations.controller.spec.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/donations/donations.controller.ts apps/api/src/donations/donations.controller.spec.ts
git commit -m "$(cat <<'EOF'
feat(donations): expose the tax-deductible donation total per year

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Pajak — auto-fill the deduction field from recorded donations

**Files:**

- Modify: `apps/web/src/app/(app)/tax/page.tsx` (state near `:204-207`, reset near `:348`, the Perpuluhan/Zakat field near `:576-600`)
- Modify: `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts` (the `tax` namespace next to `perpuluhanHint`)
- Test: `apps/web/src/app/(app)/tax/tax.test.tsx`

**Interfaces:**

- Consumes: Task 2's `GET /family-groups/${fgId}/donations/deductible-total?year=${taxYear}` → `{ year: number; total: string }`. Page identifiers that already exist: `token` (`:156`), `fgId` (`:175`), `taxYear` state, `zakat`/`setZakat` state, `formatNumber` from `@/lib/format`.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/app/(app)/tax/tax.test.tsx`, add a new `describe` block at the end of the file. Reuse the file's existing session/`mockApiFetch` setup helpers (copy the `beforeEach` pattern from the nearest existing `describe`); route the new URL in the mock and leave every other URL behaving as the existing default mock does:

```tsx
describe("TaxPage — deduction auto-fill from recorded donations", () => {
  const DEDUCTIBLE_URL = `/family-groups/${FAMILY_GROUP_ID}/donations/deductible-total?year=${new Date().getFullYear()}`;

  function routeDeductible(total: string) {
    const fallback = mockApiFetch.getMockImplementation();
    mockApiFetch.mockImplementation((url: string, init?: unknown) => {
      if (url === DEDUCTIBLE_URL) {
        return Promise.resolve({ year: new Date().getFullYear(), total });
      }
      return fallback ? fallback(url, init) : Promise.reject(new Error(url));
    });
  }

  it("pre-fills the Perpuluhan/Zakat field with the deductible total", async () => {
    routeDeductible("2500000");
    render(<TaxPage />);

    const field = await screen.findByLabelText(/perpuluhan/i);
    await waitFor(() => expect(field).toHaveValue("2.500.000"));
    expect(
      screen.getByText(/infaq, sedekah & wakaf tidak termasuk/i),
    ).toBeInTheDocument();
  });

  it("keeps the user's own value once they edit the field", async () => {
    routeDeductible("2500000");
    const user = userEvent.setup();
    render(<TaxPage />);

    const field = await screen.findByLabelText(/perpuluhan/i);
    await waitFor(() => expect(field).toHaveValue("2.500.000"));
    await user.clear(field);
    await user.type(field, "1000000");
    await queryClient.invalidateQueries();

    await waitFor(() => expect(field).toHaveValue("1.000.000"));
  });
});
```

Use the file's own names for `FAMILY_GROUP_ID`, `render`, `queryClient`, `TaxPage` (check the imports at the top of `tax.test.tsx` and use whatever the file already calls them; add `waitFor` to the `@testing-library/react` import if missing). The label regex `/perpuluhan/i` must match `t.tax.fieldPerpuluhanLabel` in `id.ts`; if that label text does not contain "perpuluhan", use a regex that matches its actual Indonesian text.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/tax"`
Expected: FAIL — `findByLabelText` cannot find the field (the `<label>` has no `htmlFor`), or the value stays `""`.

- [ ] **Step 3: Add the i18n key (all three files)**

`apps/web/src/i18n/types.ts` — in the `tax` block, directly after `perpuluhanHintLinkLabel: string;`:

```ts
perpuluhanAutoFilledHint: string;
```

`apps/web/src/i18n/id.ts` — in the `tax` block, directly after `perpuluhanHintLinkLabel: …,`:

```ts
    perpuluhanAutoFilledHint:
      "Terisi otomatis dari total zakat & persepuluhan tercatat tahun {year}. Infaq, sedekah & wakaf tidak termasuk pengurang pajak (PP 60/2010).",
```

`apps/web/src/i18n/en.ts` — same position:

```ts
    perpuluhanAutoFilledHint:
      "Auto-filled from recorded zakat & tithe for {year}. Infaq, sedekah & waqf are not tax-deductible (PP 60/2010).",
```

- [ ] **Step 4: Implement the auto-fill in `tax/page.tsx`**

1. Next to `const [zakat, setZakat] = useState("");` add:

```tsx
const [zakatTouched, setZakatTouched] = useState(false);
```

2. After the existing `taxRecords` `useQuery`, add:

```tsx
const { data: deductible } = useQuery<{ year: number; total: string }>({
  queryKey: ["donations", fgId ?? "", "deductible-total", taxYear],
  queryFn: () =>
    apiFetch<{ year: number; total: string }>(
      `/family-groups/${fgId}/donations/deductible-total?year=${taxYear}`,
      { token },
    ),
  enabled: !!token && !!fgId,
});

useEffect(() => {
  if (zakatTouched || !deductible) return;
  const total = Number(deductible.total);
  setZakat(total > 0 ? formatNumber(Math.min(total, MAX_TAX_INPUT)) : "");
}, [deductible, zakatTouched]);
```

Add `useEffect` to the existing `react` import if it is not already imported.

3. In the reset handler where `setZakat("");` is called (near `:348`), add `setZakatTouched(false);` on the next line.

4. In the Perpuluhan/Zakat field block: give the `<label>` `htmlFor="tax-perpuluhan"`, give the `<input>` `id="tax-perpuluhan"`, and change its `onChange` to also mark the field touched:

```tsx
              onChange={(e) => {
                setZakatTouched(true);
                setZakat(
                  e.target.value === ""
                    ? ""
                    : formatNumber(
                        Math.min(parseRupiah(e.target.value), MAX_TAX_INPUT),
                      ),
                );
              }}
```

5. Directly under the existing `perpuluhanHint` hint `<div>`, add:

```tsx
<div className="mt-1 text-[11px] text-muted-foreground">
  {t.tax.perpuluhanAutoFilledHint.replace("{year}", String(taxYear))}
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/tax"`
Expected: PASS — the 2 new tests and every pre-existing `tax.test.tsx` test green.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/tax/page.tsx" "src/app/(app)/tax/tax.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/tax/page.tsx" "apps/web/src/app/(app)/tax/tax.test.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(tax): pre-fill the deduction from recorded zakat and tithe donations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Asuransi API — list's `paidThisPeriod` agrees with `pay()`'s "paid ahead" rule

**Files:**

- Modify: `apps/api/src/insurances/insurances.service.ts` (`findAll` near `:268-279`; `assertNotAlreadyPaidThisPeriod` near `:830-842`)
- Test: `apps/api/src/insurances/insurances.service.spec.ts` (the `describe("paidThisPeriod", …)` block near `:258`)

**Interfaces:**

- Consumes: nothing new.
- Produces: `InsuranceResponseDto.paidThisPeriod === true` whenever `pay()` would reject with the "sudah dibayar periode ini" 409 — i.e. a payment transaction exists in the current period **or** `renewalDate` is after now. Task 5 relies on this and on the existing `renewalDate` field.

- [ ] **Step 1: Write the failing tests**

Inside the existing `describe("paidThisPeriod", () => { … })` block in `insurances.service.spec.ts`, add:

```ts
it("is true when renewalDate is already in the future (paid ahead), even with no transaction this period", async () => {
  const future = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  prisma.insurance.findMany.mockResolvedValue([
    { ...BASE_ROW, renewalDate: future },
  ]);
  prisma.transaction.findMany.mockResolvedValue([]);
  const [item] = await service.findAll(FAMILY_GROUP_ID);
  expect(item!.paidThisPeriod).toBe(true);
});

it("is false when renewalDate is in the past and no transaction landed this period", async () => {
  const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  prisma.insurance.findMany.mockResolvedValue([
    { ...BASE_ROW, renewalDate: past },
  ]);
  prisma.transaction.findMany.mockResolvedValue([]);
  const [item] = await service.findAll(FAMILY_GROUP_ID);
  expect(item!.paidThisPeriod).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/insurances/insurances.service.spec.ts -t "paidThisPeriod"`
Expected: FAIL — the "paid ahead" test receives `false`.

- [ ] **Step 3: Write minimal implementation**

In `insurances.service.ts`, add a module-level helper next to the other top-level functions (above `toInsuranceDto`):

```ts
/** `pay()` treats a renewal date after now as "already paid through". */
function isPaidAhead(
  renewalDate: Date | null,
  now: Date = new Date(),
): boolean {
  return renewalDate !== null && renewalDate > now;
}
```

In `findAll`, replace the return line with:

```ts
const now = new Date();
return rows.map((r) =>
  toInsuranceDto(
    r,
    lookup,
    paidSet.has(r.id) || isPaidAhead(r.renewalDate, now),
  ),
);
```

In `assertNotAlreadyPaidThisPeriod`, replace `if (renewalDate && renewalDate > new Date()) {` with `if (isPaidAhead(renewalDate)) {` (same body).

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/insurances`
Expected: PASS — all insurance specs green, including the pre-existing H8 `pay` tests.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/insurances/insurances.service.ts src/insurances/insurances.service.spec.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/insurances/insurances.service.ts apps/api/src/insurances/insurances.service.spec.ts
git commit -m "$(cat <<'EOF'
fix(insurances): mark policies paid ahead as paid so Bayar Premi no longer 409s

The list only looked at this period's transactions while pay() also refuses
when renewalDate is in the future, leaving an enabled button that always failed.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Web quick fixes — Asuransi paid-through tooltip, Mutasi account filter, Rekening Privat copy

**Files:**

- Modify: `apps/web/src/app/(app)/asuransi/page.tsx` (Bayar Premi `<Button>` near `:256-266`)
- Modify: `apps/web/src/app/(app)/rekening/page.tsx` (footer Mutasi button near `:362`; private badge near `:277-279`)
- Modify: `apps/web/src/components/crud/crud-config.ts:125-129` (rekening `isPrivate` helper text only — **not** the category one at `:403-407`)
- Modify: `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts`
- Test: `apps/web/src/app/(app)/rekening/rekening.test.tsx`, `apps/web/src/app/(app)/asuransi/asuransi.test.tsx`

**Interfaces:**

- Consumes: Task 4 — `paidThisPeriod` is `true` when `renewalDate` is in the future. Existing `formatLocaleDate(iso: string | null, locale: Locale): string` in `asuransi/page.tsx:102`. Existing `t.asuransi.payAlreadyPaidTooltip`.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing tests**

(a) `rekening.test.tsx` — make the router mock's `push` observable. Replace the `jest.mock("next/navigation", …)` factory's `push: jest.fn(),` with `push: mockPush,` and declare above the mock:

```tsx
const mockPush = jest.fn();
```

Then add a test in the file's main `describe` (reuse its existing default `mockApiFetch` setup that returns the `acc-1` / "Tabungan Utama" account):

```tsx
it("Mutasi footer button opens Transaksi filtered to that account", async () => {
  const user = userEvent.setup();
  render(<RekeningPage />);

  const card = (await screen.findByText("Tabungan Utama")).closest(
    "[data-account-card], article, li, .card",
  ) as HTMLElement;
  await user.click(within(card).getByRole("button", { name: /lihat mutasi/i }));

  expect(mockPush).toHaveBeenCalledWith("/transaksi?accountId=acc-1");
});

it("explains what Privat means on the badge", async () => {
  mockApiFetch.mockImplementation(/* same default routing, but the account has isPrivate: true */);
  render(<RekeningPage />);

  expect(
    await screen.findByTitle(/hanya terlihat oleh master/i),
  ).toBeInTheDocument();
});
```

For the second test, build the private account with the file's existing `buildAccount({ …, isPrivate: true })` helper and route it through the same URL the default mock uses. If `.closest(...)` does not find the card container, pick the nearest ancestor selector the rendered markup actually has.

(b) `asuransi.test.tsx` — add a `describe` that routes `/family-groups/fg-1/insurances` to one policy with `paidThisPeriod: true` and `renewalDate` 30 days in the future (all other fields copied from whatever minimal `InsuranceDto` shape the page needs; reuse `mockApiFetchDefault("ok")` routing for summary/members):

```tsx
it("tells the user the policy is paid through its renewal date", async () => {
  render(<AsuransiPage />);
  const pay = await screen.findByRole("button", { name: /bayar premi/i });
  expect(pay).toBeDisabled();
  expect(pay).toHaveAttribute(
    "title",
    expect.stringMatching(/sudah dibayar hingga/i),
  );
});
```

If the page renders more than one "Bayar Premi" button (header + card), select the card's button via `getAllByRole(...)` and assert on the one that is disabled.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(rekening|asuransi)"`
Expected: FAIL — `mockPush` called with `"/transaksi"`; no element with the Privat title; the Bayar button's title is `"Sudah dibayar periode ini"`.

- [ ] **Step 3: Add i18n keys (all three files)**

`types.ts` — in the `asuransi` block (the one `t.asuransi.payAlreadyPaidTooltip` resolves to), directly after `payAlreadyPaidTooltip: string;`:

```ts
payPaidThroughTooltipPrefix: string;
```

and in the `rekening` block, directly after `privateBadge: string;`:

```ts
privateBadgeTooltip: string;
```

`id.ts`:

```ts
    payPaidThroughTooltipPrefix: "Sudah dibayar hingga ",
```

```ts
    privateBadgeTooltip:
      "Hanya terlihat oleh Master & Co-Master. Anggota lain tidak melihat rekening ini maupun transaksinya.",
```

`en.ts`:

```ts
    payPaidThroughTooltipPrefix: "Paid through ",
```

```ts
    privateBadgeTooltip:
      "Only visible to the Master & Co-Master. Other members can't see this account or its transactions.",
```

- [ ] **Step 4: Implement**

(a) `rekening/page.tsx` footer button: `onClick={() => router.push("/transaksi")}` →

```tsx
          onClick={() =>
            router.push(`/transaksi?accountId=${encodeURIComponent(account.id)}`)
          }
```

Also change the kebab item at `:296` to use `encodeURIComponent(account.id)` so both entry points build the URL the same way.

(b) `rekening/page.tsx` private badge: wrap the existing `StatusBadge` so it carries the tooltip:

```tsx
{
  account.isPrivate && (
    <span title={t.rekening.privateBadgeTooltip}>
      <StatusBadge variant="purple">{t.rekening.privateBadge}</StatusBadge>
    </span>
  );
}
```

(c) `components/crud/crud-config.ts:128` (rekening `isPrivate` only):

```ts
        helperText:
          "Hanya terlihat oleh Master & Co-Master. Anggota lain tidak melihat rekening ini maupun transaksinya.",
```

(d) `asuransi/page.tsx` Bayar Premi button `title`:

```tsx
            title={
              item.paidThisPeriod
                ? item.renewalDate && new Date(item.renewalDate) > new Date()
                  ? `${t.asuransi.payPaidThroughTooltipPrefix}${formatLocaleDate(item.renewalDate, locale)}`
                  : t.asuransi.payAlreadyPaidTooltip
                : undefined
            }
```

Use the page's existing locale variable name (whatever the surrounding component already passes to `formatLocaleDate`).

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/(rekening|asuransi)"`
Expected: PASS — new and pre-existing tests in both folders green.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/rekening/page.tsx" "src/app/(app)/rekening/rekening.test.tsx" "src/app/(app)/asuransi/page.tsx" "src/app/(app)/asuransi/asuransi.test.tsx" src/components/crud/crud-config.ts src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/rekening" "apps/web/src/app/(app)/asuransi" apps/web/src/components/crud/crud-config.ts apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
fix(web): filter Mutasi by account, explain Privat, show paid-through date on premiums

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```
