# Revisi F: Tujuan Payments + Anggaran Auto-debit Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead budget auto-debit field, and let a family pay into a goal: a "Setor" contribution that can debit a real account, a contribution history, and a daily auto-debit that moves real money from a chosen source account on the goal's chosen day.

**Architecture:** Budgets lose `autoDebitDay` from DTOs, the response, contracts and the web page. The Prisma column stays and no migration drops it. Goals gain a `GoalContribution` model and `Goal.sourceAccountId` in one additive migration. `GoalsService.contributeInTx()` is the single write path. It runs inside `runSerializableWithRetry`, copies `InsurancesService.runPay()` (tenant-scoped account lookup, `assertBankNotOverdrawn`, balance decrement, a `transfer` Transaction on the goal's own savings category) and adds the contribution row, the `currentAmount` increment and a recomputed status. Both the manual `POST …/goals/:id/contributions` and the now-daily `runAutoDebit()` call it. The web `/tujuan` page adds a Setor dialog, a history expander and a source-account select in the goal form.

**Tech Stack:** NestJS 10, Prisma 6.19, BullMQ 5.78, class-validator, Jest and supertest (API). Next.js 16 App Router, React 19, TanStack Query, Jest and Testing Library (web). zod and tsup (`@wealthme/contracts`). pnpm workspace.

**Spec:** `docs/superpowers/plans/2026-09-25-revisi-besar-catalog.md`, items 4 (Anggaran auto-debet) and 5 (Tujuan payments). The binding decisions: item 4 is option (a), remove. Item 5 is the proposed fix, which includes a `GoalContribution` model, `Goal.sourceAccountId`, the contributions endpoints, a daily cron, "Setor" UI and history.

## Global Constraints

- Work only inside the worktree `/home/stealth/Projects/wealthme-web-revisi-ab` on branch `feat/revisi-ab-calculators-quickfixes`.
- Never edit protected files: `apps/web/src/app/globals.css`, `apps/web/src/app/design-system.css`, `apps/web/src/lib/*`, `apps/web/src/components/ui/*`, `apps/web/src/components/wm/*`, `apps/web/src/components/charts/*`, `apps/web/src/components/shell/*`, `apps/web/src/app/layout.tsx`, `packages/config/*`.
- Every new user-visible string goes into **all three** of `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts` (dictionaries use `satisfies I18nDictionary`).
- Controllers keep the repo convention for DTO classes consumed by `@Body()`: value import preceded by `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`. (`goals.controller.ts:24-28` uses the equivalent `/* eslint-disable … */ … /* eslint-enable … */` block. Add new DTO imports **inside** that block.)
- Money is BigInt on the API and digit-strings over the wire; never use floats for amounts. Tenant scoping: every query filters by familyGroupId.
- Migrations are additive only (no drops, no data rewrites). After a schema change run `pnpm exec prisma generate` from apps/api; rebuild contracts with `pnpm --filter @wealthme/contracts build` when web/api import new contract types.
- Run tests locally only as the focused jest commands each task names. No `next build`, no full `turbo` runs.
- Lint every file you touch: `pnpm exec eslint <files>` from the owning app dir must exit 0.
- Commit messages: Conventional Commits, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code comments: none unless the WHY is non-obvious; one line max.
- The husky post-commit hook prints "post-commit script failed (code 1)" (graphify); the commit still lands. Never use --no-verify.
- `apps/web/src/lib/goals-utils.ts` is protected (under `lib/*`). Add `sourceAccountId` in the page, around `parseGoalFormValues()`, not inside it.
- Never run `eslint --fix` on an API controller. It rewrites `@Body()` DTO imports to `import type`, and `ValidationPipe` then strips every field. `--fix` is fine for web files.

## Review Focus

1. **Same-day re-run of the auto-debit job** (BullMQ retry, two API replicas, a restart at 03:00). The second run must move no money: at most one `source: auto` contribution per goal per local calendar day. Pinned in Task 5, "is idempotent per goal per calendar day".
2. **Source account without enough balance on auto-debit day.** That goal is skipped and nothing is written for it (no half-debit), and the other due goals still run. Pinned in Task 5, "one goal's insufficient balance does not stop the next goal".
3. **Account id from another family** in `POST …/contributions` or in a goal's `sourceAccountId`. Expect 404 and no write. Pinned in Task 3, "rejects an account from another family group", and Task 5, "rejects a sourceAccountId from another family group".
4. **"Today" picked in the Setor dialog before 07:00 WIB.** It must not be rejected as a future date. The web sends local midnight as ISO, and the API rejects only instants after `now`. Pinned in Task 6 (asserts `occurredAt === new Date("2026-09-20T00:00:00").toISOString()`) and Task 3, "accepts an occurredAt equal to now".
5. **Legacy goal with `autoDebitAmount` but no `sourceAccountId`.** Editing only its name must still save, and the daily job must skip it quietly. Pinned in Task 5, "a name-only edit of a legacy auto-debit goal without a source account still saves", and "queries only goals due today that have a source account".

---

### Task 1: Remove auto-debit from budgets (API DTOs + response + contracts + web + tests)

**Files:**

- Modify: `apps/api/src/budgets/dto/create-budget.dto.ts:1-10,44-52`
- Modify: `apps/api/src/budgets/dto/update-budget.dto.ts:1-9,40-48`
- Modify: `apps/api/src/budgets/dto/budget-response.dto.ts:32-37`
- Modify: `apps/api/src/budgets/budgets.service.ts:26,256,319-321,366`
- Test: `apps/api/src/budgets/budgets.service.spec.ts` (append a describe at the end)
- Modify: `packages/contracts/src/budgets/index.ts:13,28,33`
- Modify: `apps/web/src/app/(app)/anggaran/page.tsx:138-140,814-815,821,914,974,1009,1015,1041-1043,1053-1060,1114-1120,1579-1594,1677-1692`
- Modify: `apps/web/src/i18n/types.ts:2723-2724`, `apps/web/src/i18n/id.ts:2933-2934`, `apps/web/src/i18n/en.ts:2880-2881`
- Test: `apps/web/src/app/(app)/anggaran/anggaran.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces: `BudgetDto`, `CreateBudgetDto` and `UpdateBudgetDto` (contracts) have no `autoDebitDay`. The API never writes `Budget.autoDebitDay`. The column stays in `schema.prisma:865`, untouched. Stale clients that still send `autoDebitDay` get it silently stripped by the global `ValidationPipe({ whitelist: true })`, not a 400.

- [ ] **Step 1: Write the failing API test**

Append to `apps/api/src/budgets/budgets.service.spec.ts`:

```ts
describe("BudgetsService — budgets carry no auto-debit (Revisi F item 4)", () => {
  let service: BudgetsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BudgetsService);
  });

  it("does not expose autoDebitDay on the budget DTO", async () => {
    const [result] = await service.findAll(FAMILY_GROUP_ID, true);
    expect(result).not.toHaveProperty("autoDebitDay");
  });

  it("never writes autoDebitDay on create, even if a caller smuggles one in", async () => {
    await service.create(
      FAMILY_GROUP_ID,
      {
        categoryId: PUBLIC_CATEGORY_ID,
        period: "monthly",
        limitAmount: 100,
        autoDebitDay: 25,
      } as never,
      true,
    );
    const [[args]] = prisma.budget.create.mock.calls as unknown as [
      [{ data: Record<string, unknown> }],
    ];
    expect(args.data).not.toHaveProperty("autoDebitDay");
  });

  it("never writes autoDebitDay on update, even if a caller smuggles one in", async () => {
    await service.update(
      FAMILY_GROUP_ID,
      PUBLIC_BUDGET_ID,
      { limitAmount: 200, autoDebitDay: 25 } as never,
      true,
    );
    const [[args]] = prisma.budget.update.mock.calls as unknown as [
      [{ data: Record<string, unknown> }],
    ];
    expect(args.data).not.toHaveProperty("autoDebitDay");
  });
});
```

- [ ] **Step 2: Run the API test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/budgets/budgets.service.spec.ts -t "Revisi F item 4"`
Expected: FAIL. All 3 tests fail with `expect(received).not.toHaveProperty(path)`: the DTO has `autoDebitDay: null`, and the create and update data contain `autoDebitDay: 25`.

- [ ] **Step 3: Write the failing web test**

In `apps/web/src/app/(app)/anggaran/anggaran.test.tsx`, add `autoDebitDay: 25,` to `EXISTING_BUDGET` (after `budgetType: null,` at `:80`). This mimics a legacy row the server used to return. Then append:

```tsx
describe("AnggaranPage — budgets carry no auto-debit (Revisi F item 4)", () => {
  it("shows no auto-debit day on the list, none in the edit dialog, and PATCH never sends one", async () => {
    mockSession("owner", { withExistingBudget: true });
    const user = userEvent.setup();
    render(<AnggaranPage />);

    const editButton = await screen.findByRole("button", {
      name: `Edit anggaran ${EXISTING_CATEGORY.name}`,
    });
    expect(screen.queryByText(/autodebet tgl/i)).not.toBeInTheDocument();

    await user.click(editButton);
    const dialog = await screen.findByRole("dialog", { name: "Edit Anggaran" });
    expect(
      within(dialog).queryByLabelText(/Auto-debet/i),
    ).not.toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan Perubahan" }),
    );

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const patch = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith(`/budgets/${EXISTING_BUDGET.id}`) &&
        (options as RequestInit | undefined)?.method === "PATCH",
    );
    const body = JSON.parse((patch?.[1] as RequestInit).body as string);
    expect(body).not.toHaveProperty("autoDebitDay");
  }, 10000);

  it("the add dialog offers no auto-debit day field", async () => {
    mockSession("member");
    const user = userEvent.setup();
    render(<AnggaranPage />);

    await user.click(
      await screen.findByRole("button", { name: "Tambah Kategori" }),
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByLabelText("Kategori");
    expect(
      within(dialog).queryByLabelText(/Auto-debet/i),
    ).not.toBeInTheDocument();
  }, 10000);
});
```

- [ ] **Step 4: Run the web test to verify it fails**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/anggaran/anggaran.test.tsx" -t "Revisi F item 4"`
Expected: FAIL. The first test finds the text "autodebet tgl 25". The second finds the "Tanggal Auto-debet (1-28)" field.

- [ ] **Step 5: Implement the API side**

`create-budget.dto.ts`: delete the whole `autoDebitDay` property (lines 44-52: the `@ApiPropertyOptional({ description: "EPIC-033 group 5 …" })` block, its decorators and `autoDebitDay?: number;`). Then remove the now-unused `IsOptional` and `Min` from the `class-validator` import, so it reads:

```ts
import { IsEnum, IsInt, IsPositive, IsUUID, Max } from "class-validator";
```

`update-budget.dto.ts`: delete the `autoDebitDay` property (lines 40-48) and remove `Min` from the import:

```ts
import { IsEnum, IsInt, IsOptional, IsPositive, Max } from "class-validator";
```

`budget-response.dto.ts`: delete the `@ApiProperty({ type: Number, nullable: true, description: "Day of month (1-28) the auto-debit runs" }) autoDebitDay!: number | null;` block (lines 32-37).

`budgets.service.ts` makes four deletions:

- `:26`: `autoDebitDay?: number | null;` in `BudgetWithCategory`
- `:256`: `autoDebitDay: dto.autoDebitDay ?? null,` in `create()`'s `tx.budget.create` data
- `:319-321`: the `...(dto.autoDebitDay !== undefined && { autoDebitDay: dto.autoDebitDay }),` spread in `update()`
- `:366`: `autoDebitDay: budget.autoDebitDay ?? null,` in `toDto()`

`packages/contracts/src/budgets/index.ts`: delete `autoDebitDay: number | null;` from `BudgetDto` (`:13`), and `autoDebitDay?: number;` from both `CreateBudgetDto` (`:28`) and `UpdateBudgetDto` (`:33`).

Rebuild contracts (from repo root): `pnpm --filter @wealthme/contracts build`
Expected: exit 0.

- [ ] **Step 6: Implement the web side**

In `apps/web/src/app/(app)/anggaran/page.tsx`:

1. `:136-141`: the usage line becomes

```tsx
<div className="mt-0.5 text-[11.5px] text-muted-foreground">
  {usagePct}% dari {formatRupiah(budget.limitAmount)}
</div>
```

`t` is still used in `BudgetUsageList`? Check with `grep -n "t\." ` inside `BudgetUsageList` (`:112-162`). If no other `t.` use remains in that function, also delete `const { t } = useLocale();` at `:113`. 2. Delete `:814-815` (the comment and `const [autoDebitDay, setAutoDebitDay] = useState("");`) and `:821` (`const [editAutoDebitDay, setEditAutoDebitDay] = useState("");`). 3. `createMutation` payload type: delete `autoDebitDay?: number;` (`:914`). In the `dto` literal, delete the line `...(payload.autoDebitDay ? { autoDebitDay: payload.autoDebitDay } : {}),` (`:974`). 4. `updateMutation` payload type: delete `autoDebitDay?: number;` (`:1009`). In the `dto` literal, delete `autoDebitDay: payload.autoDebitDay,` (`:1015`). 5. `openEdit`: delete the `setEditAutoDebitDay(…)` call (`:1041-1043`). 6. `handleSaveEdit`: replace `:1053-1060` with

```tsx
updateMutation.mutate({
  id: editing.id,
  limitAmount,
  period: editPeriod,
});
```

7. `handleSave`: delete `const parsedDay = Number.parseInt(autoDebitDay, 10);` (`:1114`) and the `autoDebitDay: …` property (`:1120`) from the `createMutation.mutate({…})` argument.
8. Add dialog: delete the third `<div className="field mt-0">…</div>` inside the `field field-row` (`:1579-1594`, the `budget-autodebit-day` label and input). The row keeps amount and period.
9. Edit dialog: delete the `<div className="field mt-0">…</div>` holding `budget-edit-autodebit-day` (`:1677-1692`).

i18n: remove both keys from the `anggaran` block only, and leave `tujuan.autoDebitDayPrefix` alone:

- `types.ts:2723-2724`: `fieldAutoDebitDayLabel: string;` and `autoDebitDayPrefix: string;`
- `id.ts:2933-2934`: `fieldAutoDebitDayLabel: "Tanggal Auto-debet (1-28)",` and `autoDebitDayPrefix: "autodebet tgl ",`
- `en.ts:2880-2881`: `fieldAutoDebitDayLabel: "Auto-debit Day (1-28)",` and `autoDebitDayPrefix: "auto-debit day ",`

Then verify nothing still references them: `grep -rn "fieldAutoDebitDayLabel\|anggaran.autoDebitDayPrefix\|autoDebitDay" apps/web/src/app/\(app\)/anggaran apps/api/src/budgets packages/contracts/src/budgets`
Expected: no output. The line `autoDebitDay: 25` in `anggaran.test.tsx` is expected and is the only hit if you include the test file.

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/budgets`
Expected: PASS. All budgets suites are green.

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/anggaran"`
Expected: PASS. New and pre-existing anggaran tests are green.

- [ ] **Step 8: Lint**

Run (from `apps/api`): `pnpm exec eslint src/budgets/dto/create-budget.dto.ts src/budgets/dto/update-budget.dto.ts src/budgets/dto/budget-response.dto.ts src/budgets/budgets.service.ts src/budgets/budgets.service.spec.ts`
Expected: exit 0.

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/anggaran/page.tsx" "src/app/(app)/anggaran/anggaran.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/budgets packages/contracts/src/budgets/index.ts "apps/web/src/app/(app)/anggaran" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
refactor(budgets): drop the dead auto-debit day from budgets

Nothing ever consumed Budget.autoDebitDay, and "day of month" is meaningless
for weekly budgets. Removed from DTOs, response, contracts and /anggaran; the
column stays (no migration). Goal auto-debit is unaffected.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Schema — `GoalContribution`, `Goal.sourceAccountId`, migration, contracts

**Files:**

- Modify: `apps/api/prisma/schema.prisma` (enums after `enum GoalStatus` `:68-73`; `FamilyGroup` `:422-493`; `Account` `:594-632`; `Transaction` `:697-759`; `Goal` `:902-921`)
- Create: `apps/api/prisma/migrations/20260925200000_revisi_f_goal_contributions/migration.sql`
- Modify: `packages/contracts/src/goals/index.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - Prisma: `GoalContributionSource` enum (`manual | auto`) and the `GoalContribution` model. `tx.goalContribution.*` has the fields `id, familyGroupId, goalId, amount: bigint, accountId: string | null, transactionId: string | null (unique), occurredAt, source, createdAt` and the relations `goal`, `account`, `transaction`, `familyGroup`. `Goal.sourceAccountId: string | null` has a `sourceAccount` relation.
  - Contracts (`@wealthme/contracts`):
    - `GoalDto.sourceAccountId: string | null`
    - `CreateGoalDto.sourceAccountId?: string` and `UpdateGoalDto.sourceAccountId?: string`
    - `GoalContributionSourceSchema` / `GoalContributionSource` (`"manual" | "auto"`)
    - `CreateGoalContributionInputSchema` / `CreateGoalContributionInput` (`{ amount: string; accountId?: string; occurredAt?: string }`)
    - `GoalContributionDtoSchema` / `GoalContributionDto` (`{ id; goalId; amount: string; accountId: string | null; accountName: string | null; transactionId: string | null; occurredAt: string; source; createdAt: string }`)
    - `GoalContributionResult` (`{ contribution: GoalContributionDto; goal: GoalDto }`)

- [ ] **Step 1: Edit `schema.prisma`**

After the `enum GoalStatus { … }` block (`:68-73`), add:

```prisma
enum GoalContributionSource {
  manual
  auto
}
```

In `model FamilyGroup`, after `transactionAttachments  TransactionAttachment[]` (last relation before `@@map`), add:

```prisma
  goalContributions       GoalContribution[]
```

In `model Account`, after `allowanceRequestsAsSource AllowanceRequest[] @relation("AllowanceRequestSource")`, add:

```prisma
  goalsAsSource             Goal[]
  goalContributions         GoalContribution[]
```

In `model Transaction`, after `attachments     TransactionAttachment[]`, add:

```prisma
  goalContribution GoalContribution?
```

Replace `model Goal { … }` (`:902-921`) with:

```prisma
model Goal {
  id              String             @id @default(uuid())
  familyGroupId   String
  name            String
  icon            String?
  targetAmount    BigInt
  currentAmount   BigInt             @default(0)
  targetDate      DateTime?
  autoDebitAmount BigInt?
  // EPIC-033 group 5 — day of month (1-28) the auto-debit runs.
  autoDebitDay    Int?
  // Revisi F — account the daily auto-debit draws from.
  sourceAccountId String?
  lastAutoDebitAt DateTime?
  status          GoalStatus         @default(on_track)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  familyGroup     FamilyGroup        @relation(fields: [familyGroupId], references: [id], onDelete: Cascade)
  sourceAccount   Account?           @relation(fields: [sourceAccountId], references: [id], onDelete: SetNull)
  contributions   GoalContribution[]

  @@index([familyGroupId])
  @@index([sourceAccountId])
  @@map("goals")
}

// Revisi F — a payment into a goal; transactionId is set only when money left an account.
model GoalContribution {
  id            String                 @id @default(uuid())
  familyGroupId String
  goalId        String
  amount        BigInt
  accountId     String?
  transactionId String?                @unique
  occurredAt    DateTime
  source        GoalContributionSource @default(manual)
  createdAt     DateTime               @default(now())
  familyGroup   FamilyGroup            @relation(fields: [familyGroupId], references: [id], onDelete: Cascade)
  goal          Goal                   @relation(fields: [goalId], references: [id], onDelete: Cascade)
  account       Account?               @relation(fields: [accountId], references: [id], onDelete: SetNull)
  transaction   Transaction?           @relation(fields: [transactionId], references: [id], onDelete: SetNull)

  @@index([familyGroupId, goalId, occurredAt])
  @@index([accountId])
  @@map("goal_contributions")
}
```

- [ ] **Step 2: Write the migration**

Create `apps/api/prisma/migrations/20260925200000_revisi_f_goal_contributions/migration.sql`:

```sql
-- Revisi F (catalog item 5): real payments into a goal + the goal's auto-debit source account.
CREATE TYPE "GoalContributionSource" AS ENUM ('manual', 'auto');

ALTER TABLE "goals" ADD COLUMN "sourceAccountId" TEXT;
CREATE INDEX "goals_sourceAccountId_idx" ON "goals"("sourceAccountId");
ALTER TABLE "goals" ADD CONSTRAINT "goals_sourceAccountId_fkey"
  FOREIGN KEY ("sourceAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "goal_contributions" (
    "id" TEXT NOT NULL,
    "familyGroupId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "accountId" TEXT,
    "transactionId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" "GoalContributionSource" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "goal_contributions_transactionId_key" ON "goal_contributions"("transactionId");
CREATE INDEX "goal_contributions_familyGroupId_goalId_occurredAt_idx" ON "goal_contributions"("familyGroupId", "goalId", "occurredAt");
CREATE INDEX "goal_contributions_accountId_idx" ON "goal_contributions"("accountId");
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_familyGroupId_fkey"
  FOREIGN KEY ("familyGroupId") REFERENCES "family_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goalId_fkey"
  FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Validate, format and generate**

Run (from `apps/api`): `pnpm exec prisma format && pnpm exec prisma validate && pnpm exec prisma generate`
Expected: "The schema at prisma/schema.prisma is valid" and "Generated Prisma Client". Then `git diff --stat apps/api/prisma/schema.prisma` should show only this file changed. If `prisma format` re-aligned unrelated lines, that is fine, because it is whitespace only.

- [ ] **Step 4: Contracts**

Replace `packages/contracts/src/goals/index.ts` with:

```ts
import { z } from "zod";

export type GoalStatus = "on_track" | "needs_boost" | "achieved" | "at_risk";

export interface GoalDto {
  id: string;
  name: string;
  icon: string | null;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  autoDebitAmount: number | null;
  /** EPIC-033 group 5 — day of month (1-28) the auto-debit runs. */
  autoDebitDay: number | null;
  /** Revisi F — account the daily auto-debit draws from. */
  sourceAccountId: string | null;
  status: GoalStatus;
  progressPercent: number;
  remainingAmount: number;
}

export interface CreateGoalDto {
  name: string;
  icon?: string;
  targetAmount: number;
  // EPIC-022 C8 — the "Sudah Terkumpul" (already collected) amount at
  // creation; was silently discarded server-side before this.
  currentAmount?: number;
  targetDate?: string;
  autoDebitAmount?: number;
  autoDebitDay?: number;
  sourceAccountId?: string;
}

export interface UpdateGoalDto {
  name?: string;
  icon?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string;
  autoDebitAmount?: number;
  autoDebitDay?: number;
  sourceAccountId?: string;
}

export const GoalContributionSourceSchema = z.enum(["manual", "auto"]);
export type GoalContributionSource = z.infer<
  typeof GoalContributionSourceSchema
>;

export const CreateGoalContributionInputSchema = z.object({
  amount: z.string().regex(/^[1-9]\d{0,11}$/),
  accountId: z.string().uuid().optional(),
  occurredAt: z.string().datetime().optional(),
});
export type CreateGoalContributionInput = z.infer<
  typeof CreateGoalContributionInputSchema
>;

export const GoalContributionDtoSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  amount: z.string(),
  accountId: z.string().nullable(),
  accountName: z.string().nullable(),
  transactionId: z.string().nullable(),
  occurredAt: z.string(),
  source: GoalContributionSourceSchema,
  createdAt: z.string(),
});
export type GoalContributionDto = z.infer<typeof GoalContributionDtoSchema>;

export interface GoalContributionResult {
  contribution: GoalContributionDto;
  goal: GoalDto;
}
```

Run (from repo root): `pnpm --filter @wealthme/contracts build`
Expected: exit 0. tsup emits `dist/index.{js,cjs,d.ts,d.cts}`.

- [ ] **Step 5: Regression check**

Run (from `apps/api`): `pnpm exec jest src/goals`
Expected: PASS. The existing goals suites are still green, because the schema change is additive.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260925200000_revisi_f_goal_contributions packages/contracts/src/goals/index.ts
git commit -m "$(cat <<'EOF'
feat(goals): add GoalContribution model and Goal.sourceAccountId

Additive migration only. Contracts gain the contribution input/DTO schemas
and sourceAccountId on goal DTOs.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `GoalsService.contribute()` / `listContributions()` — one serializable write path

**Files:**

- Create: `apps/api/src/goals/dto/create-goal-contribution.dto.ts`
- Modify: `apps/api/src/goals/goals.service.ts` (imports `:1-13`; `GoalDto` `:17-29`; `toDto` `:73-129`; new methods after `remove()` `:257-265`)
- Create: `apps/api/src/goals/goal-contributions.service.spec.ts`

**Interfaces:**

- Consumes: Task 2's Prisma `GoalContribution` and `Goal.sourceAccountId`, and the contracts types `GoalContributionDto` and `GoalContributionResult`. Existing utils:
  - `runSerializableWithRetry(prisma, fn)` and `type TxClient` (`common/utils/serializable-retry.util.ts`)
  - `assertBankNotOverdrawn(tx, familyGroupId, accountId, amount)` (`common/utils/bank-overdraft.util.ts`)
  - `ownCategoryName(label, obligationName, id)` (`common/utils/own-category-name.util.ts`)
- Produces:
  - `class CreateGoalContributionDto { amount!: string; accountId?: string; occurredAt?: string }`
  - `GoalsService.contribute(familyGroupId: string, goalId: string, dto: CreateGoalContributionDto, now?: Date): Promise<GoalContributionResult>`
  - `GoalsService.listContributions(familyGroupId: string, goalId: string): Promise<GoalContributionDto[]>`
  - `private GoalsService.contributeInTx(tx: TxClient, goal: Goal, input: ContributionInput): Promise<GoalContributionResult>`, where `ContributionInput = { amount: bigint; accountId: string | null; occurredAt: Date; source: PrismaGoalContributionSource; now: Date }`. Task 5 calls this with `source: auto`.
  - `GoalDto.sourceAccountId: string | null` on every goal response.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/goals/goal-contributions.service.spec.ts`:

```ts
import { Test, type TestingModule } from "@nestjs/testing";
import { GoalStatus as PrismaGoalStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

import { GoalsService } from "./goals.service";

const FAMILY_GROUP_ID = "fg-1";
const GOAL_ID = "goal-1";
const ACCOUNT_ID = "acc-1";
const NOW = new Date(2026, 8, 25, 10, 0, 0);

function makeGoal(overrides: Record<string, unknown> = {}) {
  return {
    id: GOAL_ID,
    familyGroupId: FAMILY_GROUP_ID,
    name: "Dana Liburan",
    icon: "✈️",
    targetAmount: 10_000_000n,
    currentAmount: 1_000_000n,
    targetDate: null,
    autoDebitAmount: null,
    autoDebitDay: null,
    sourceAccountId: null,
    lastAutoDebitAt: null,
    status: PrismaGoalStatus.on_track,
    createdAt: new Date("2020-01-01T00:00:00Z"),
    updatedAt: new Date("2020-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makePrisma() {
  const prisma = {
    goal: {
      findUnique: jest.fn().mockResolvedValue(makeGoal()),
      update: jest
        .fn()
        .mockResolvedValue(makeGoal({ currentAmount: 1_250_000n })),
    },
    account: {
      // Serves both our {id,name} lookup and assertBankNotOverdrawn's {type,balance,name}.
      findUnique: jest.fn().mockResolvedValue({
        id: ACCOUNT_ID,
        name: "BCA Tahapan",
        type: "bank",
        balance: 5_000_000n,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    coaAccount: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: "coa-30001", name: "Tabungan" }),
    },
    category: { upsert: jest.fn().mockResolvedValue({ id: "cat-goal" }) },
    transaction: { create: jest.fn().mockResolvedValue({ id: "txn-1" }) },
    goalContribution: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "contrib-1", createdAt: NOW, ...data }),
      ),
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}

describe("GoalsService.contribute (Revisi F item 5)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
  });

  it("with an account: debits it, posts a transfer on the goal's own savings category, records a linked manual contribution, bumps currentAmount", async () => {
    const result = await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "250000", accountId: ACCOUNT_ID },
      NOW,
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { balance: { decrement: 250_000n } },
    });
    expect(prisma.coaAccount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyGroupId: FAMILY_GROUP_ID, code: "30001" },
      }),
    );
    expect(prisma.category.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyGroupId_name_kind: {
            familyGroupId: FAMILY_GROUP_ID,
            name: "Tabungan: Dana Liburan",
            kind: "expense",
          },
        },
      }),
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyGroupId: FAMILY_GROUP_ID,
          accountId: ACCOUNT_ID,
          categoryId: "cat-goal",
          amount: 250_000n,
          type: "transfer",
          description: "Setor tujuan Dana Liburan",
          occurredAt: NOW,
        }),
      }),
    );
    expect(prisma.goalContribution.create).toHaveBeenCalledWith({
      data: {
        familyGroupId: FAMILY_GROUP_ID,
        goalId: GOAL_ID,
        amount: 250_000n,
        accountId: ACCOUNT_ID,
        transactionId: "txn-1",
        occurredAt: NOW,
        source: "manual",
      },
    });
    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id: GOAL_ID, familyGroupId: FAMILY_GROUP_ID },
      data: {
        currentAmount: { increment: 250_000n },
        status: PrismaGoalStatus.on_track,
      },
    });
    expect(result.contribution).toEqual({
      id: "contrib-1",
      goalId: GOAL_ID,
      amount: "250000",
      accountId: ACCOUNT_ID,
      accountName: "BCA Tahapan",
      transactionId: "txn-1",
      occurredAt: NOW.toISOString(),
      source: "manual",
      createdAt: NOW.toISOString(),
    });
    expect(result.goal.currentAmount).toBe(1_250_000);
  });

  it("falls back to COA 30099 when the family has no 30001", async () => {
    prisma.coaAccount.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "coa-30099", name: "Alokasi Lainnya" });

    await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "250000", accountId: ACCOUNT_ID },
      NOW,
    );

    expect(prisma.category.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          name: "Alokasi Lainnya: Dana Liburan",
          coaAccountId: "coa-30099",
        }),
      }),
    );
  });

  it("without an account: records progress only — no account, category or ledger writes", async () => {
    const result = await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "250000" },
      NOW,
    );

    expect(prisma.account.findUnique).not.toHaveBeenCalled();
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.category.upsert).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(result.contribution.accountId).toBeNull();
    expect(result.contribution.transactionId).toBeNull();
  });

  it("rejects when the bank account would go below zero, and writes nothing", async () => {
    prisma.account.findUnique.mockResolvedValue({
      id: ACCOUNT_ID,
      name: "BCA Tahapan",
      type: "bank",
      balance: 100_000n,
    });

    await expect(
      service.contribute(
        FAMILY_GROUP_ID,
        GOAL_ID,
        { amount: "250000", accountId: ACCOUNT_ID },
        NOW,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.goalContribution.create).not.toHaveBeenCalled();
    expect(prisma.goal.update).not.toHaveBeenCalled();
  });

  it("rejects an account from another family group (404) and writes nothing", async () => {
    prisma.account.findUnique.mockResolvedValue(null);

    await expect(
      service.contribute(
        FAMILY_GROUP_ID,
        GOAL_ID,
        { amount: "250000", accountId: "acc-other-family" },
        NOW,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.account.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acc-other-family", familyGroupId: FAMILY_GROUP_ID },
      }),
    );
    expect(prisma.goalContribution.create).not.toHaveBeenCalled();
    expect(prisma.goal.update).not.toHaveBeenCalled();
  });

  it("rejects a contribution larger than what is left to reach the target", async () => {
    await expect(
      service.contribute(FAMILY_GROUP_ID, GOAL_ID, { amount: "9000001" }, NOW),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.goalContribution.create).not.toHaveBeenCalled();
  });

  it("accepts a contribution that exactly completes the target", async () => {
    prisma.goal.update.mockResolvedValue(
      makeGoal({ currentAmount: 10_000_000n }),
    );
    const result = await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "9000000" },
      NOW,
    );
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PrismaGoalStatus.achieved }),
      }),
    );
    expect(result.goal.status).toBe("achieved");
  });

  it("rejects an occurredAt in the future", async () => {
    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    await expect(
      service.contribute(
        FAMILY_GROUP_ID,
        GOAL_ID,
        { amount: "250000", occurredAt: tomorrow.toISOString() },
        NOW,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("accepts an occurredAt equal to now (the web sends local midnight of today)", async () => {
    await service.contribute(
      FAMILY_GROUP_ID,
      GOAL_ID,
      { amount: "250000", occurredAt: NOW.toISOString() },
      NOW,
    );
    expect(prisma.goalContribution.create).toHaveBeenCalled();
  });

  it("404s an unknown goal (tenant-scoped lookup)", async () => {
    prisma.goal.findUnique.mockResolvedValue(null);
    await expect(
      service.contribute(FAMILY_GROUP_ID, "nope", { amount: "1" }, NOW),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.goal.findUnique).toHaveBeenCalledWith({
      where: { id: "nope", familyGroupId: FAMILY_GROUP_ID },
    });
  });
});

describe("GoalsService.listContributions (Revisi F item 5)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
  });

  it("lists newest first, tenant-scoped, with the account name", async () => {
    prisma.goalContribution.findMany.mockResolvedValue([
      {
        id: "c-2",
        goalId: GOAL_ID,
        amount: 500_000n,
        accountId: null,
        transactionId: null,
        occurredAt: new Date("2026-09-24T00:00:00Z"),
        source: "auto",
        createdAt: new Date("2026-09-24T00:00:00Z"),
        account: null,
      },
      {
        id: "c-1",
        goalId: GOAL_ID,
        amount: 250_000n,
        accountId: ACCOUNT_ID,
        transactionId: "txn-1",
        occurredAt: new Date("2026-09-20T00:00:00Z"),
        source: "manual",
        createdAt: new Date("2026-09-20T00:00:00Z"),
        account: { name: "BCA Tahapan" },
      },
    ]);

    const rows = await service.listContributions(FAMILY_GROUP_ID, GOAL_ID);

    expect(prisma.goalContribution.findMany).toHaveBeenCalledWith({
      where: { familyGroupId: FAMILY_GROUP_ID, goalId: GOAL_ID },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: { account: { select: { name: true } } },
    });
    expect(rows.map((r) => r.id)).toEqual(["c-2", "c-1"]);
    expect(rows[0]).toMatchObject({
      amount: "500000",
      source: "auto",
      accountName: null,
    });
    expect(rows[1]).toMatchObject({
      amount: "250000",
      accountName: "BCA Tahapan",
    });
  });

  it("404s a goal outside the caller's family group", async () => {
    prisma.goal.findUnique.mockResolvedValue(null);
    await expect(
      service.listContributions(FAMILY_GROUP_ID, "nope"),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.goalContribution.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/goals/goal-contributions.service.spec.ts`
Expected: FAIL. `TypeError: service.contribute is not a function` (and `listContributions`).

- [ ] **Step 3: Create the DTO**

Create `apps/api/src/goals/dto/create-goal-contribution.dto.ts`:

```ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";

export class CreateGoalContributionDto {
  @ApiProperty({
    description: "Whole rupiah as a digit string, 1..999999999999",
    example: "250000",
  })
  @IsString()
  @Matches(/^[1-9]\d{0,11}$/, {
    message: "amount must be a positive whole-rupiah digit string",
  })
  amount!: string;

  @ApiPropertyOptional({
    description:
      "Account to debit; omit to record progress without moving money",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: "When the contribution happened (ISO 8601); defaults to now",
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
```

- [ ] **Step 4: Implement in `goals.service.ts`**

Replace the import block (`:1-13`) with:

```ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  GoalContributionSource as PrismaGoalContributionSource,
  GoalStatus as PrismaGoalStatus,
  type Goal,
} from "@prisma/client";

import { assertBankNotOverdrawn } from "../common/utils/bank-overdraft.util";
import { ownCategoryName } from "../common/utils/own-category-name.util";
import {
  runSerializableWithRetry,
  type TxClient,
} from "../common/utils/serializable-retry.util";
import { ownerNotifPrefs } from "../notifications/notification-prefs";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from "../prisma/prisma.service";

import type { CreateGoalContributionDto } from "./dto/create-goal-contribution.dto";
import type { CreateGoalDto } from "./dto/create-goal.dto";
import type { UpdateGoalDto } from "./dto/update-goal.dto";
import type {
  GoalContributionDto,
  GoalContributionResult,
} from "@wealthme/contracts";

// Order is preference: the dedicated "Tabungan" savings line first, the generic allocation bucket second.
const GOAL_SAVINGS_COA_PRIORITY = ["30001", "30099"];

interface ContributionInput {
  amount: bigint;
  accountId: string | null;
  occurredAt: Date;
  source: PrismaGoalContributionSource;
  now: Date;
}
```

In `export interface GoalDto`, add `sourceAccountId: string | null;` after `autoDebitDay: number | null;`.

In `toDto`'s parameter type, add `sourceAccountId?: string | null;` after `autoDebitDay?: number | null;`. In its returned object, add `sourceAccountId: goal.sourceAccountId ?? null,` after `autoDebitDay: goal.autoDebitDay ?? null,`.

After `toDto` (before `@Injectable()`), add:

```ts
function toContributionDto(
  row: {
    id: string;
    goalId: string;
    amount: bigint;
    accountId: string | null;
    transactionId: string | null;
    occurredAt: Date;
    source: PrismaGoalContributionSource;
    createdAt: Date;
  },
  accountName: string | null,
): GoalContributionDto {
  return {
    id: row.id,
    goalId: row.goalId,
    amount: row.amount.toString(),
    accountId: row.accountId,
    accountName,
    transactionId: row.transactionId,
    occurredAt: row.occurredAt.toISOString(),
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}
```

Inside `class GoalsService`, add `private readonly logger = new Logger(GoalsService.name);` as the first member (Task 5 uses it). Add these methods after `remove()`:

```ts
  async contribute(
    familyGroupId: string,
    goalId: string,
    dto: CreateGoalContributionDto,
    now: Date = new Date(),
  ): Promise<GoalContributionResult> {
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : now;
    if (occurredAt.getTime() > now.getTime()) {
      throw new BadRequestException(
        "Tanggal setoran tidak boleh di masa depan",
      );
    }
    return runSerializableWithRetry(this.prisma, async (tx) => {
      const goal = await tx.goal.findUnique({
        where: { id: goalId, familyGroupId },
      });
      if (!goal) {
        throw new NotFoundException("Goal not found");
      }
      return this.contributeInTx(tx, goal, {
        amount: BigInt(dto.amount),
        accountId: dto.accountId ?? null,
        occurredAt,
        source: PrismaGoalContributionSource.manual,
        now,
      });
    });
  }

  async listContributions(
    familyGroupId: string,
    goalId: string,
  ): Promise<GoalContributionDto[]> {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId, familyGroupId },
      select: { id: true },
    });
    if (!goal) {
      throw new NotFoundException("Goal not found");
    }
    const rows = await this.prisma.goalContribution.findMany({
      where: { familyGroupId, goalId },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      include: { account: { select: { name: true } } },
    });
    return rows.map((row) => toContributionDto(row, row.account?.name ?? null));
  }

  private async contributeInTx(
    tx: TxClient,
    goal: Goal,
    input: ContributionInput,
  ): Promise<GoalContributionResult> {
    const { familyGroupId } = goal;
    if (input.amount <= 0n) {
      throw new BadRequestException("Jumlah setoran harus lebih dari 0");
    }
    const newCurrent = goal.currentAmount + input.amount;
    if (newCurrent > goal.targetAmount) {
      throw new BadRequestException("Setoran melebihi sisa target tujuan");
    }

    let transactionId: string | null = null;
    let accountName: string | null = null;
    if (input.accountId) {
      const account = await tx.account.findUnique({
        where: { id: input.accountId, familyGroupId },
        select: { id: true, name: true },
      });
      if (!account) {
        throw new NotFoundException(`Account ${input.accountId} not found`);
      }
      await assertBankNotOverdrawn(tx, familyGroupId, account.id, input.amount);
      await tx.account.update({
        where: { id: account.id, familyGroupId },
        data: { balance: { decrement: input.amount } },
      });
      const categoryId = await this.resolveGoalCategoryId(tx, goal);
      const ledgerRow = await tx.transaction.create({
        data: {
          familyGroupId,
          accountId: account.id,
          categoryId,
          amount: input.amount,
          type: "transfer",
          description: `Setor tujuan ${goal.name}`,
          occurredAt: input.occurredAt,
        },
        select: { id: true },
      });
      transactionId = ledgerRow.id;
      accountName = account.name;
    }

    const contribution = await tx.goalContribution.create({
      data: {
        familyGroupId,
        goalId: goal.id,
        amount: input.amount,
        accountId: input.accountId,
        transactionId,
        occurredAt: input.occurredAt,
        source: input.source,
      },
    });

    const updated = await tx.goal.update({
      where: { id: goal.id, familyGroupId },
      data: {
        currentAmount: { increment: input.amount },
        status: computeStatus(
          newCurrent,
          goal.targetAmount,
          goal.targetDate,
          goal.createdAt,
          input.now,
        ),
        ...(input.source === PrismaGoalContributionSource.auto
          ? { lastAutoDebitAt: input.now }
          : {}),
      },
    });

    return {
      contribution: toContributionDto(contribution, accountName),
      goal: toDto(updated, input.now),
    };
  }

  // Keyed by the category's unique (familyGroupId, name, kind), so no Goal column is needed to remember it.
  private async resolveGoalCategoryId(tx: TxClient, goal: Goal): Promise<string> {
    let coaAccount: { id: string; name: string } | null = null;
    for (const code of GOAL_SAVINGS_COA_PRIORITY) {
      coaAccount = await tx.coaAccount.findFirst({
        where: { familyGroupId: goal.familyGroupId, code },
        select: { id: true, name: true },
      });
      if (coaAccount) break;
    }
    if (!coaAccount) {
      throw new BadRequestException(
        "This family group has no savings (Tabungan) COA account provisioned",
      );
    }
    const name = ownCategoryName(coaAccount.name, goal.name, goal.id);
    const category = await tx.category.upsert({
      where: {
        familyGroupId_name_kind: {
          familyGroupId: goal.familyGroupId,
          name,
          kind: "expense",
        },
      },
      create: {
        familyGroupId: goal.familyGroupId,
        name,
        kind: "expense",
        coaAccountId: coaAccount.id,
      },
      update: {},
      select: { id: true },
    });
    return category.id;
  }
```

`ownerNotifPrefs` stays imported, because `runAutoDebit` still uses it. If `ownCategoryName` is flagged unused, you mis-pasted `resolveGoalCategoryId`.

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/goals`
Expected: PASS. The new spec has 12 tests, and the existing `goals.service.spec.ts` and DTO specs are still green.

- [ ] **Step 6: Lint**

Run (from `apps/api`): `pnpm exec eslint src/goals/goals.service.ts src/goals/dto/create-goal-contribution.dto.ts src/goals/goal-contributions.service.spec.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/goals/goals.service.ts apps/api/src/goals/dto/create-goal-contribution.dto.ts apps/api/src/goals/goal-contributions.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(goals): record goal contributions that can debit a real account

One Serializable write path (contributeInTx) mirrors InsurancesService.pay():
tenant-scoped account, bank overdraft floor, balance decrement, a transfer on
the goal's own savings category, then the contribution row and currentAmount.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Controller routes `GET|POST …/goals/:id/contributions` + HTTP spec

**Files:**

- Modify: `apps/api/src/goals/goals.controller.ts:1-28` (imports), and add two handlers after `update()` (`:58-68`)
- Create: `apps/api/src/goals/goals.controller.spec.ts`

**Interfaces:**

- Consumes: `GoalsService.contribute(familyGroupId, goalId, dto)` and `GoalsService.listContributions(familyGroupId, goalId)` from Task 3, plus `CreateGoalContributionDto`.
- Produces:
  - `GET /family-groups/:familyGroupId/goals/:id/contributions` → `200 GoalContributionDto[]` (needs `read Goal`)
  - `POST /family-groups/:familyGroupId/goals/:id/contributions` with body `{ amount: string; accountId?: uuid; occurredAt?: ISO }` → `201 GoalContributionResult` (needs `update Goal`: owner/spouse/member yes, admin_staff no)
  - Task 6 consumes both exact paths.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/goals/goals.controller.spec.ts`:

```ts
import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Role } from "@prisma/client";
import request from "supertest";

import { CaslAbilityFactory } from "../casl/casl-ability.factory";
import { AbilitiesGuard } from "../common/guards/abilities.guard";

import { GoalsController } from "./goals.controller";
import { GoalsService } from "./goals.service";

import type { INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const FAMILY_GROUP_ID = "fg-1";
const GOAL_ID = "goal-1";
const ACCOUNT_ID = "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e";
const BASE = `/family-groups/${FAMILY_GROUP_ID}/goals/${GOAL_ID}/contributions`;

type TenantMember = {
  id: string;
  userId: string;
  familyGroupId: string;
  role: Role;
};

const goalsServiceMock = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  contribute: jest.fn(),
  listContributions: jest.fn(),
};

describe("GoalsController contributions (real ValidationPipe + AbilitiesGuard)", () => {
  let app: INestApplication;
  let member: TenantMember | null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [
        CaslAbilityFactory,
        { provide: GoalsService, useValue: goalsServiceMock },
        { provide: APP_GUARD, useClass: AbilitiesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Stand-in for TenantGuard.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.tenantContext = member
        ? {
            userId: member.userId,
            familyGroupId: FAMILY_GROUP_ID,
            role: member.role,
            member,
          }
        : undefined;
      next();
    });
    // Must match apps/api/src/main.ts exactly.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function actAs(role: Role) {
    member = {
      id: `m-${role}`,
      userId: `u-${role}`,
      familyGroupId: FAMILY_GROUP_ID,
      role,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    goalsServiceMock.contribute.mockResolvedValue({
      contribution: { id: "contrib-1" },
      goal: { id: GOAL_ID },
    });
    goalsServiceMock.listContributions.mockResolvedValue([{ id: "contrib-1" }]);
    actAs(Role.owner);
  });

  it("owner POST with a valid body reaches the service with every field intact (201)", async () => {
    const occurredAt = "2026-09-20T00:00:00.000Z";
    const res = await request(app.getHttpServer())
      .post(BASE)
      .send({ amount: "250000", accountId: ACCOUNT_ID, occurredAt });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      contribution: { id: "contrib-1" },
      goal: { id: GOAL_ID },
    });
    expect(goalsServiceMock.contribute).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      GOAL_ID,
      expect.objectContaining({
        amount: "250000",
        accountId: ACCOUNT_ID,
        occurredAt,
      }),
    );
  });

  it("owner POST without accountId (progress only) is accepted", async () => {
    const res = await request(app.getHttpServer())
      .post(BASE)
      .send({ amount: "1" });
    expect(res.status).toBe(201);
  });

  it.each([
    ["amount as a number", { amount: 250000 }],
    ["amount zero", { amount: "0" }],
    ["negative amount", { amount: "-5" }],
    ["decimal amount", { amount: "12.5" }],
    ["13-digit amount", { amount: "1000000000000" }],
    ["missing amount", {}],
    ["non-uuid accountId", { amount: "250000", accountId: "acc-1" }],
    ["non-date occurredAt", { amount: "250000", occurredAt: "kemarin" }],
  ])("400s on %s and never calls the service", async (_label, body) => {
    const res = await request(app.getHttpServer()).post(BASE).send(body);
    expect(res.status).toBe(400);
    expect(goalsServiceMock.contribute).not.toHaveBeenCalled();
  });

  it("admin_staff (read-only Goal) cannot contribute (403)", async () => {
    actAs(Role.admin_staff);
    const res = await request(app.getHttpServer())
      .post(BASE)
      .send({ amount: "250000" });
    expect(res.status).toBe(403);
    expect(goalsServiceMock.contribute).not.toHaveBeenCalled();
  });

  it("admin_staff can read the contribution history (200)", async () => {
    actAs(Role.admin_staff);
    const res = await request(app.getHttpServer()).get(BASE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "contrib-1" }]);
    expect(goalsServiceMock.listContributions).toHaveBeenCalledWith(
      FAMILY_GROUP_ID,
      GOAL_ID,
    );
  });

  it("dependant (no Goal grant) cannot read the history (403)", async () => {
    actAs(Role.dependant);
    const res = await request(app.getHttpServer()).get(BASE);
    expect(res.status).toBe(403);
    expect(goalsServiceMock.listContributions).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/goals/goals.controller.spec.ts`
Expected: FAIL. POST and GET return `404` (route not found). The `it.each` rows fail with `expected 400, received 404`.

- [ ] **Step 3: Implement**

In `goals.controller.ts`, replace the DTO import block (`:24-28`) with:

```ts
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { CreateGoalContributionDto } from "./dto/create-goal-contribution.dto";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";
import { GoalsService, GoalDto } from "./goals.service";
/* eslint-enable @typescript-eslint/consistent-type-imports */

import type {
  GoalContributionDto,
  GoalContributionResult,
} from "@wealthme/contracts";
```

After `update()` (before `@Delete(":id")`), add:

```ts
  @Get(":id/contributions")
  @CheckAbility((ab) => ab.can("read", "Goal"))
  @ApiOperation({ summary: "List a goal's contributions, newest first" })
  @ApiResponse({ status: 200, description: "Array of contributions" })
  listContributions(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
  ): Promise<GoalContributionDto[]> {
    return this.goalsService.listContributions(req.params.familyGroupId, id);
  }

  @Post(":id/contributions")
  @CheckAbility((ab) => ab.can("update", "Goal"))
  @ApiOperation({
    summary: "Pay into a goal, optionally debiting a source account",
  })
  @ApiResponse({ status: 201, description: "The contribution and the updated goal" })
  contribute(
    @Request() req: ExpressRequest & { params: { familyGroupId: string } },
    @Param("id") id: string,
    @Body() dto: CreateGoalContributionDto,
  ): Promise<GoalContributionResult> {
    return this.goalsService.contribute(req.params.familyGroupId, id, dto);
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `apps/api`): `pnpm exec jest src/goals`
Expected: PASS. The controller spec has 13 tests, and every other goals suite is still green.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/goals/goals.controller.ts src/goals/goals.controller.spec.ts`
Expected: exit 0. Do **not** use `--fix` here (see Global Constraints).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/goals/goals.controller.ts apps/api/src/goals/goals.controller.spec.ts
git commit -m "$(cat <<'EOF'
feat(goals): expose GET/POST /goals/:id/contributions

Read needs read Goal; contributing needs update Goal (admin_staff is
read-only). Covered over HTTP with the production ValidationPipe and the real
AbilitiesGuard.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Daily auto-debit through the contribution path + `sourceAccountId` validation + scheduler job reset

**Files:**

- Modify: `apps/api/src/goals/dto/create-goal.dto.ts` (imports `:2-11`, and a new property after `autoDebitDay`)
- Modify: `apps/api/src/goals/dto/update-goal.dto.ts` (imports `:2-11`, and a new property after `autoDebitDay`)
- Test: `apps/api/src/goals/dto/create-goal.dto.spec.ts` (append)
- Modify: `apps/api/src/goals/goals.service.ts` (`create()` `:227-264`, `update()` `:266-336`, and replace `runAutoDebit()` `:348-440`)
- Test: `apps/api/src/goals/goals.service.spec.ts` (`FakeGoal`/`makeGoal`/`makePrisma` `:11-80`; replace the `runAutoDebit` describe `:82-178`; append create/update describes)
- Modify: `apps/api/src/goals/goal-auto-debit.scheduler.ts`
- Create: `apps/api/src/goals/goal-auto-debit.scheduler.spec.ts`

**Interfaces:**

- Consumes: Task 3's `contributeInTx(tx, goal, input)`, `runSerializableWithRetry` and `this.logger`. BullMQ `Queue.getRepeatableJobs(): Promise<{ key: string; name: string; pattern?: string | null }[]>`, `Queue.removeRepeatableByKey(key)` and `Queue.add(name, data, opts)`. These are deprecated in v5, but present in the installed 5.78.0.
- Produces:
  - `runAutoDebit(now = new Date()): Promise<number>`. It debits goals with `autoDebitAmount`, a non-null `sourceAccountId`, and `autoDebitDay === now.getDate()`. On day 1 it also takes `autoDebitDay === null` (the legacy monthly behaviour). Each debit is a `source: auto` contribution through `contributeInTx`. It is idempotent per goal per local calendar day, and it caps at the remaining target.
  - `create`/`update` return 400 when `autoDebitAmount` is set without a source account, and 404 for a source account outside the family. `GoalDto.sourceAccountId` round-trips.
  - `export const AUTO_DEBIT_CRON = "0 3 * * *"` and the stable `jobId: "goal-auto-debit-cron"`. Stale repeatables for `run-auto-debit` with any other pattern are removed first.

- [ ] **Step 1: Write the failing DTO test**

Append to `apps/api/src/goals/dto/create-goal.dto.spec.ts`:

```ts
describe("CreateGoalDto.sourceAccountId — Revisi F item 5", () => {
  const SOURCE = "5f0c1f7e-7c1a-4b8e-9d7a-2f1c3b4a5d6e";

  it("is required when autoDebitAmount is set", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      autoDebitAmount: 500_000,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "sourceAccountId")).toBe(true);
  });

  it("accepts autoDebitAmount together with a UUID sourceAccountId", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      autoDebitAmount: 500_000,
      sourceAccountId: SOURCE,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("rejects a non-UUID sourceAccountId", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      sourceAccountId: "acc-1",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "sourceAccountId")).toBe(true);
  });

  it("a goal without auto-debit needs no source account", async () => {
    const dto = plainToInstance(CreateGoalDto, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Write the failing service tests**

In `apps/api/src/goals/goals.service.spec.ts`:

(a) Replace `interface FakeGoal` and `makeGoal` (`:11-44`) with:

```ts
interface FakeGoal {
  id: string;
  familyGroupId: string;
  name: string;
  icon: string | null;
  targetAmount: bigint;
  currentAmount: bigint;
  targetDate: Date | null;
  autoDebitAmount: bigint | null;
  autoDebitDay: number | null;
  sourceAccountId: string | null;
  status: PrismaGoalStatus;
  lastAutoDebitAt: Date | null;
  createdAt: Date;
}

const ACCOUNT_ID = "acc-1";

// Far enough in the past that a goal with no explicit `createdAt` override
// never gets mistaken for "brand new" by the C7 elapsed-pace heuristic.
const OLD_CREATED_AT = new Date("2020-01-01T00:00:00Z");

function makeGoal(overrides: Partial<FakeGoal> = {}): FakeGoal {
  return {
    id: GOAL_ID,
    familyGroupId: FAMILY_GROUP_ID,
    name: "Dana Liburan",
    icon: "✈️",
    targetAmount: 10_000_000n,
    currentAmount: 0n,
    targetDate: null,
    autoDebitAmount: 500_000n,
    autoDebitDay: 15,
    sourceAccountId: ACCOUNT_ID,
    status: PrismaGoalStatus.on_track,
    lastAutoDebitAt: null,
    createdAt: OLD_CREATED_AT,
    ...overrides,
  };
}
```

(b) Replace `makePrisma()` (`:46-80`) with:

```ts
function makePrisma() {
  const prisma = {
    goal: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    member: {
      // Default: no stored prefs → `resolveNotifPrefs(null)` defaults, which
      // has `goalMilestone: true`.
      findFirst: jest
        .fn()
        .mockResolvedValue({ user: { notificationPrefs: null } }),
    },
    account: {
      findUnique: jest.fn().mockResolvedValue({
        id: ACCOUNT_ID,
        name: "BCA Tahapan",
        type: "bank",
        balance: 50_000_000n,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    coaAccount: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: "coa-30001", name: "Tabungan" }),
    },
    category: { upsert: jest.fn().mockResolvedValue({ id: "cat-goal" }) },
    transaction: { create: jest.fn().mockResolvedValue({ id: "txn-1" }) },
    goalContribution: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "contrib-1", createdAt: new Date(), ...data }),
      ),
    },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
  );
  return prisma;
}
```

(c) Replace the whole `describe("GoalsService.runAutoDebit — goals are a manual tracker (EPIC-022 A3)", …)` block (`:82-178`) with:

```ts
describe("GoalsService.runAutoDebit — daily, real money, via the contribution path (Revisi F)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;
  // Local-time constructor: the suite runs under TZ=Asia/Jakarta (jest.global-setup.js).
  const NOW = new Date(2026, 2, 15, 3, 0, 0);

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
  });

  function dueGoal(overrides: Partial<FakeGoal> = {}) {
    const goal = makeGoal(overrides);
    prisma.goal.findMany.mockResolvedValue([goal]);
    prisma.goal.findUnique.mockResolvedValue(goal);
    prisma.goal.update.mockImplementation(
      ({ data }: { data: { currentAmount?: { increment: bigint } } }) =>
        Promise.resolve({
          ...goal,
          currentAmount:
            goal.currentAmount + (data.currentAmount?.increment ?? 0n),
        }),
    );
    return goal;
  }

  it("queries only goals due today that have a source account", async () => {
    prisma.goal.findMany.mockResolvedValue([]);
    await service.runAutoDebit(NOW);
    expect(prisma.goal.findMany).toHaveBeenCalledWith({
      where: {
        autoDebitAmount: { not: null },
        sourceAccountId: { not: null },
        OR: [{ autoDebitDay: 15 }],
      },
    });
  });

  it("on the 1st, a legacy goal with no autoDebitDay is due too", async () => {
    prisma.goal.findMany.mockResolvedValue([]);
    await service.runAutoDebit(new Date(2026, 3, 1, 3, 0, 0));
    expect(prisma.goal.findMany).toHaveBeenCalledWith({
      where: {
        autoDebitAmount: { not: null },
        sourceAccountId: { not: null },
        OR: [{ autoDebitDay: 1 }, { autoDebitDay: null }],
      },
    });
  });

  it("debits the source account and records a source=auto contribution, then notifies", async () => {
    dueGoal();

    const debited = await service.runAutoDebit(NOW);

    expect(debited).toBe(1);
    expect(prisma.account.update).toHaveBeenCalledWith({
      where: { id: ACCOUNT_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { balance: { decrement: 500_000n } },
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "transfer", amount: 500_000n }),
      }),
    );
    expect(prisma.goalContribution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        goalId: GOAL_ID,
        amount: 500_000n,
        accountId: ACCOUNT_ID,
        source: "auto",
        occurredAt: NOW,
      }),
    });
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastAutoDebitAt: NOW }),
      }),
    );
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyGroupId: FAMILY_GROUP_ID,
          title: "Auto-debit tujuan",
        }),
      }),
    );
  });

  it("is idempotent per goal per calendar day", async () => {
    dueGoal();
    prisma.goalContribution.findFirst.mockResolvedValue({ id: "c-earlier" });

    const debited = await service.runAutoDebit(NOW);

    expect(debited).toBe(0);
    expect(prisma.goalContribution.findFirst).toHaveBeenCalledWith({
      where: {
        familyGroupId: FAMILY_GROUP_ID,
        goalId: GOAL_ID,
        source: "auto",
        occurredAt: {
          gte: new Date(2026, 2, 15),
          lt: new Date(2026, 2, 16),
        },
      },
      select: { id: true },
    });
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.goalContribution.create).not.toHaveBeenCalled();
  });

  it("caps the debit at what is left to reach the target", async () => {
    dueGoal({ currentAmount: 9_800_000n, targetAmount: 10_000_000n });

    await service.runAutoDebit(NOW);

    expect(prisma.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { decrement: 200_000n } },
      }),
    );
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PrismaGoalStatus.achieved }),
      }),
    );
  });

  it("a goal already at target moves no money but stamps the run", async () => {
    dueGoal({ currentAmount: 10_000_000n, targetAmount: 10_000_000n });

    const debited = await service.runAutoDebit(NOW);

    expect(debited).toBe(0);
    expect(prisma.account.update).not.toHaveBeenCalled();
    expect(prisma.goal.update).toHaveBeenCalledWith({
      where: { id: GOAL_ID, familyGroupId: FAMILY_GROUP_ID },
      data: { lastAutoDebitAt: NOW },
    });
  });

  it("one goal's insufficient balance does not stop the next goal", async () => {
    const broke = makeGoal({ id: "goal-broke", sourceAccountId: "acc-empty" });
    const fine = makeGoal({ id: "goal-fine" });
    prisma.goal.findMany.mockResolvedValue([broke, fine]);
    prisma.goal.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === broke.id ? broke : fine),
    );
    prisma.goal.update.mockResolvedValue(fine);
    prisma.account.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === "acc-empty"
            ? { id: "acc-empty", name: "Kosong", type: "bank", balance: 0n }
            : {
                id: ACCOUNT_ID,
                name: "BCA Tahapan",
                type: "bank",
                balance: 50_000_000n,
              },
        ),
    );

    const debited = await service.runAutoDebit(NOW);

    expect(debited).toBe(1);
    expect(prisma.goalContribution.create).toHaveBeenCalledTimes(1);
    expect(prisma.goalContribution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ goalId: "goal-fine" }),
    });
    expect(prisma.account.update).toHaveBeenCalledTimes(1);
  });
});
```

(d) Append the following at the end of the file:

```ts
describe("GoalsService create/update — sourceAccountId (Revisi F)", () => {
  let service: GoalsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(GoalsService);
    prisma.goal.create.mockImplementation(
      ({ data }: { data: Partial<FakeGoal> }) =>
        Promise.resolve(makeGoal({ ...data })),
    );
    prisma.goal.update.mockImplementation(
      ({ data }: { data: Partial<FakeGoal> }) =>
        Promise.resolve(makeGoal({ ...data })),
    );
  });

  it("create rejects autoDebitAmount without a source account (400)", async () => {
    await expect(
      service.create(FAMILY_GROUP_ID, {
        name: "Dana Liburan",
        targetAmount: 10_000_000,
        autoDebitAmount: 500_000,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });

  it("create rejects a sourceAccountId from another family group (404)", async () => {
    prisma.account.findUnique.mockResolvedValue(null);
    await expect(
      service.create(FAMILY_GROUP_ID, {
        name: "Dana Liburan",
        targetAmount: 10_000_000,
        autoDebitAmount: 500_000,
        sourceAccountId: "acc-other",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.account.findUnique).toHaveBeenCalledWith({
      where: { id: "acc-other", familyGroupId: FAMILY_GROUP_ID },
      select: { id: true },
    });
    expect(prisma.goal.create).not.toHaveBeenCalled();
  });

  it("create stores and returns the source account", async () => {
    const result = await service.create(FAMILY_GROUP_ID, {
      name: "Dana Liburan",
      targetAmount: 10_000_000,
      autoDebitAmount: 500_000,
      sourceAccountId: ACCOUNT_ID,
    });
    expect(prisma.goal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceAccountId: ACCOUNT_ID }),
      }),
    );
    expect(result.sourceAccountId).toBe(ACCOUNT_ID);
  });

  it("update rejects setting autoDebitAmount on a goal with no source account (400)", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ autoDebitAmount: null, sourceAccountId: null }),
    );
    await expect(
      service.update(FAMILY_GROUP_ID, GOAL_ID, { autoDebitAmount: 500_000 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.goal.update).not.toHaveBeenCalled();
  });

  it("a name-only edit of a legacy auto-debit goal without a source account still saves", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ autoDebitAmount: 500_000n, sourceAccountId: null }),
    );
    const result = await service.update(FAMILY_GROUP_ID, GOAL_ID, {
      name: "Renamed",
    });
    expect(result.name).toBe("Renamed");
    expect(prisma.account.findUnique).not.toHaveBeenCalled();
  });

  it("update can attach a source account to a legacy goal", async () => {
    prisma.goal.findUnique.mockResolvedValue(
      makeGoal({ autoDebitAmount: 500_000n, sourceAccountId: null }),
    );
    await service.update(FAMILY_GROUP_ID, GOAL_ID, {
      autoDebitAmount: 500_000,
      sourceAccountId: ACCOUNT_ID,
    });
    expect(prisma.goal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceAccountId: ACCOUNT_ID }),
      }),
    );
  });
});
```

- [ ] **Step 3: Write the failing scheduler test**

Create `apps/api/src/goals/goal-auto-debit.scheduler.spec.ts`:

```ts
import {
  AUTO_DEBIT_CRON,
  GoalAutoDebitScheduler,
} from "./goal-auto-debit.scheduler";

function makeQueue(existing: { key: string; name: string; pattern: string }[]) {
  return {
    getRepeatableJobs: jest.fn().mockResolvedValue(existing),
    removeRepeatableByKey: jest.fn().mockResolvedValue(true),
    add: jest.fn().mockResolvedValue({}),
  };
}

describe("GoalAutoDebitScheduler (Revisi F — daily)", () => {
  it("runs daily at 03:00", () => {
    expect(AUTO_DEBIT_CRON).toBe("0 3 * * *");
  });

  it("removes the old monthly repeatable before registering the daily one under the same jobId", async () => {
    const queue = makeQueue([
      { key: "legacy-monthly", name: "run-auto-debit", pattern: "0 3 1 * *" },
      { key: "someone-else", name: "other-job", pattern: "0 3 1 * *" },
    ]);

    await new GoalAutoDebitScheduler(queue as never).onModuleInit();

    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith("legacy-monthly");
    expect(queue.add).toHaveBeenCalledWith(
      "run-auto-debit",
      {},
      { repeat: { pattern: "0 3 * * *" }, jobId: "goal-auto-debit-cron" },
    );
    expect(
      queue.removeRepeatableByKey.mock.invocationCallOrder[0],
    ).toBeLessThan(queue.add.mock.invocationCallOrder[0]!);
  });

  it("leaves an already-daily repeatable alone on restart", async () => {
    const queue = makeQueue([
      { key: "daily", name: "run-auto-debit", pattern: "0 3 * * *" },
    ]);

    await new GoalAutoDebitScheduler(queue as never).onModuleInit();

    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/goals`
Expected: FAIL.

- `create-goal.dto.spec.ts`: "is required when autoDebitAmount is set" and "rejects a non-UUID" fail (`sourceAccountId` is unknown to the DTO).
- `goals.service.spec.ts`: the new `runAutoDebit` tests fail because the `findMany` `where` is `{ autoDebitAmount: { not: null } }` and no account or contribution writes happen, and the create/update source tests fail (no 400/404).
- `goal-auto-debit.scheduler.spec.ts` fails with `AUTO_DEBIT_CRON` undefined (not exported).

- [ ] **Step 5: Implement the DTOs**

`create-goal.dto.ts`: add `IsUUID` and `ValidateIf` to the `class-validator` import (alphabetical: `IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUUID, Max, MaxLength, Min, ValidateIf`). After the `autoDebitDay` property, add:

```ts
  @ApiPropertyOptional({
    description:
      "Account the auto-debit draws from; required when autoDebitAmount is set",
  })
  @ValidateIf(
    (o: CreateGoalDto) =>
      o.autoDebitAmount != null || o.sourceAccountId !== undefined,
  )
  @IsUUID()
  sourceAccountId?: string;
```

`update-goal.dto.ts`: add `IsUUID` to the import. After `autoDebitDay`, add:

```ts
  @ApiPropertyOptional({ description: "Account the auto-debit draws from" })
  @IsOptional()
  @IsUUID()
  sourceAccountId?: string;
```

- [ ] **Step 6: Implement the service**

In `create()`, after the `currentAmount > targetAmount` guard, add:

```ts
const sourceAccountId = dto.sourceAccountId ?? null;
await this.assertSourceAccount(familyGroupId, autoDebitAmount, sourceAccountId);
```

Add `sourceAccountId,` to the `goal.create` data, after `autoDebitDay: dto.autoDebitDay ?? null,`.

In `update()`, after the `currentAmount > targetAmount` guard, add:

```ts
const sourceAccountId =
  dto.sourceAccountId !== undefined
    ? dto.sourceAccountId
    : existing.sourceAccountId;
if (dto.autoDebitAmount != null || dto.sourceAccountId !== undefined) {
  await this.assertSourceAccount(
    familyGroupId,
    autoDebitAmount,
    sourceAccountId,
  );
}
```

Add `sourceAccountId,` to the `goal.update` data, after the `autoDebitDay:` entry.

Replace the entire `runAutoDebit` docblock and method (`:348-440`) with:

```ts
  /** Daily: debits each goal whose autoDebitDay is today from its source account. Returns goals debited. */
  async runAutoDebit(now: Date = new Date()): Promise<number> {
    const dayOfMonth = now.getDate();
    const goals = await this.prisma.goal.findMany({
      where: {
        autoDebitAmount: { not: null },
        sourceAccountId: { not: null },
        // Pre-Revisi-F goals have no day; they keep running on the 1st.
        OR:
          dayOfMonth === 1
            ? [{ autoDebitDay: 1 }, { autoDebitDay: null }]
            : [{ autoDebitDay: dayOfMonth }],
      },
    });
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    let debited = 0;
    for (const due of goals) {
      try {
        const result = await runSerializableWithRetry(this.prisma, (tx) =>
          this.autoDebitOne(tx, due.id, due.familyGroupId, now, dayStart, dayEnd),
        );
        if (!result) continue;
        debited += 1;

        const notifPrefs = await ownerNotifPrefs(this.prisma, due.familyGroupId);
        if (notifPrefs.goalMilestone) {
          await this.prisma.notification.create({
            data: {
              familyGroupId: due.familyGroupId,
              title: "Auto-debit tujuan",
              body: `${result.goal.name} bertambah Rp${result.contribution.amount} dari auto-debit.`,
              icon: result.goal.icon ?? "🎯",
            },
          });
        }
      } catch (err) {
        this.logger.warn(
          `Goal auto-debit failed for ${due.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return debited;
  }

  private async autoDebitOne(
    tx: TxClient,
    goalId: string,
    familyGroupId: string,
    now: Date,
    dayStart: Date,
    dayEnd: Date,
  ): Promise<GoalContributionResult | null> {
    const goal = await tx.goal.findUnique({
      where: { id: goalId, familyGroupId },
    });
    if (
      !goal ||
      goal.autoDebitAmount === null ||
      goal.autoDebitAmount <= 0n ||
      !goal.sourceAccountId
    ) {
      return null;
    }

    const already = await tx.goalContribution.findFirst({
      where: {
        familyGroupId,
        goalId,
        source: PrismaGoalContributionSource.auto,
        occurredAt: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
    });
    if (already) return null;

    const remaining = goal.targetAmount - goal.currentAmount;
    const amount =
      goal.autoDebitAmount < remaining ? goal.autoDebitAmount : remaining;
    if (amount <= 0n) {
      await tx.goal.update({
        where: { id: goal.id, familyGroupId },
        data: { lastAutoDebitAt: now },
      });
      return null;
    }

    return this.contributeInTx(tx, goal, {
      amount,
      accountId: goal.sourceAccountId,
      occurredAt: now,
      source: PrismaGoalContributionSource.auto,
      now,
    });
  }

  private async assertSourceAccount(
    familyGroupId: string,
    autoDebitAmount: bigint | null,
    sourceAccountId: string | null,
  ): Promise<void> {
    if (autoDebitAmount != null && !sourceAccountId) {
      throw new BadRequestException(
        "Rekening sumber wajib dipilih untuk auto-debit",
      );
    }
    if (!sourceAccountId) return;
    const account = await this.prisma.account.findUnique({
      where: { id: sourceAccountId, familyGroupId },
      select: { id: true },
    });
    if (!account) {
      throw new NotFoundException(`Account ${sourceAccountId} not found`);
    }
  }
```

Also delete the now-stale EPIC-022 A3 comment about goals being "a manual tracker, not real money" if any copy remains elsewhere in the file (`grep -n "manual tracker" apps/api/src/goals/goals.service.ts` must print nothing).

- [ ] **Step 7: Implement the scheduler**

Replace `apps/api/src/goals/goal-auto-debit.scheduler.ts` with:

```ts
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";

import type { Queue } from "bullmq";

const JOB_NAME = "run-auto-debit";
const JOB_ID = "goal-auto-debit-cron";
// Daily at 03:00, after the 02:00 net-worth snapshot; the service picks goals due today.
export const AUTO_DEBIT_CRON = "0 3 * * *";

@Injectable()
export class GoalAutoDebitScheduler {
  private readonly logger = new Logger(GoalAutoDebitScheduler.name);

  constructor(@InjectQueue("goal-auto-debit") private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // A repeatable's key includes its pattern, so the old monthly cron would keep firing unless removed.
    const repeatables = await this.queue.getRepeatableJobs();
    for (const job of repeatables) {
      if (job.name === JOB_NAME && job.pattern !== AUTO_DEBIT_CRON) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }
    await this.queue.add(
      JOB_NAME,
      {},
      { repeat: { pattern: AUTO_DEBIT_CRON }, jobId: JOB_ID },
    );
    this.logger.log(`Scheduled daily goal auto-debit (${AUTO_DEBIT_CRON})`);
  }
}
```

`goal-auto-debit.processor.ts` is unchanged, because it already calls `this.goals.runAutoDebit()`.

- [ ] **Step 8: Run the tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/goals`
Expected: PASS. Every goals suite is green: the DTO specs, `goals.service.spec.ts` (including the C7/A4 describes, unchanged), `goal-contributions.service.spec.ts`, `goals.controller.spec.ts` and `goal-auto-debit.scheduler.spec.ts`.

- [ ] **Step 9: Typecheck the API**

API spec files are excluded from `tsconfig.json`, and ts-jest is transpile-only, so type errors in `goals.service.ts` would not fail jest.
Run (from `apps/api`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0. If the laptop runs hot, run it on wit-hq (project memory: heavy builds run there).

- [ ] **Step 10: Lint**

Run (from `apps/api`): `pnpm exec eslint src/goals/goals.service.ts src/goals/goals.service.spec.ts src/goals/dto/create-goal.dto.ts src/goals/dto/update-goal.dto.ts src/goals/dto/create-goal.dto.spec.ts src/goals/goal-auto-debit.scheduler.ts src/goals/goal-auto-debit.scheduler.spec.ts`
Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/goals
git commit -m "$(cat <<'EOF'
feat(goals): daily auto-debit moves real money from the goal's source account

Cron is now daily and honours autoDebitDay (legacy null = the 1st); each run
is a source=auto contribution through the same Serializable path as Setor,
idempotent per goal per day, capped at the remaining target. A goal with an
auto-debit now requires a same-family source account. The stale monthly
repeatable is removed on boot so the jobId stays single.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Web `/tujuan` — "Setor" dialog + contribution history

**Files:**

- Create: `apps/web/src/app/(app)/tujuan/_components/contribute-dialog.tsx`
- Create: `apps/web/src/app/(app)/tujuan/_components/contribution-history.tsx`
- Modify: `apps/web/src/app/(app)/tujuan/page.tsx` (imports `:3-38`; `GoalCardProps` `:159-164`; `GoalCard` `:171-307`; `TujuanPage` `:309-633`)
- Modify: `apps/web/src/i18n/types.ts` (`tujuan` block `:2231-2273`), `id.ts` (`:2425-2479`), `en.ts` (`:2379-2432`)
- Test: `apps/web/src/app/(app)/tujuan/tujuan.test.tsx`

**Interfaces:**

- Consumes: Task 4's `POST|GET /family-groups/:fg/goals/:id/contributions`, and Task 2's contract types `CreateGoalContributionInput`, `GoalContributionResult`, `GoalContributionDto`, `GoalDto.sourceAccountId`. `GET /family-groups/:fg/accounts` (existing).
- Produces:
  - `ContributeDialog({ goal, accounts, familyGroupId, token, onClose })`
  - `type SourceAccountOption = { id: string; name: string; institution: string | null }`
  - `ContributionHistory({ goalId, familyGroupId, token })`
  - In `TujuanPage`, an `accounts: SourceAccountOption[]` query on `queryKeys.accounts.all(familyGroupId)`, enabled for managers. Task 7 reuses it.
  - The query key for history is `[...queryKeys.goals.all(fg), goalId, "contributions"]`, so invalidating `goals.all` refreshes it.

- [ ] **Step 1: Write the failing tests**

In `tujuan.test.tsx`:

(a) Add `fireEvent` and `waitFor` to the `@testing-library/react` import:

```ts
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
```

(b) In `buildGoal`, add `sourceAccountId: null,` after `autoDebitDay: null,`.

(c) Replace `mockSession` (`:82-111`) with:

```ts
const ACCOUNT = { id: "acc-1", name: "BCA Tahapan", institution: "BCA" };
const CONTRIBUTION = {
  id: "contrib-1",
  goalId: "goal-1",
  amount: "250000",
  accountId: ACCOUNT.id,
  accountName: ACCOUNT.name,
  transactionId: "txn-1",
  occurredAt: "2026-09-20T00:00:00.000Z",
  source: "manual",
  createdAt: "2026-09-20T01:00:00.000Z",
};

type MockOptions = { contributionError?: string };

function mockSession(role: string, opts: MockOptions = {}) {
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
  mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
    // EPIC-030 — menu/permission gating reads the resolved IAM access.
    if (path.endsWith("/access/me")) {
      return Promise.resolve(
        resolveEffectiveAccess({ role: role as MemberRoleKey }),
      );
    }
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: role }]);
    }
    if (path.endsWith("/accounts")) {
      return Promise.resolve([ACCOUNT]);
    }
    if (path.endsWith("/goals/goal-1/contributions")) {
      if (options?.method === "POST") {
        return opts.contributionError
          ? Promise.reject({ status: 400, message: opts.contributionError })
          : Promise.resolve({
              contribution: CONTRIBUTION,
              goal: buildGoal({ currentAmount: 1_250_000 }),
            });
      }
      return Promise.resolve([CONTRIBUTION]);
    }
    if (path.endsWith("/goals")) {
      if (options?.method === "POST") {
        return Promise.reject({
          status: 400,
          message: "Target tanggal tidak boleh di masa lalu",
        });
      }
      return Promise.resolve([buildGoal()]);
    }
    return Promise.resolve([]);
  });
}
```

(d) Append:

```tsx
describe("TujuanPage — Setor into a goal (Revisi F item 5)", () => {
  it("posts the amount as a digit string with the source account and a local-midnight date, then closes", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Setor ke Dana Liburan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Setor ke Dana Liburan",
    });
    const amount = within(dialog).getByLabelText("Jumlah Setoran (Rp)");
    await user.type(amount, "250000");
    expect(amount).toHaveValue("250.000");
    await user.selectOptions(
      await within(dialog).findByLabelText("Rekening Sumber"),
      ACCOUNT.id,
    );
    fireEvent.change(within(dialog).getByLabelText("Tanggal Setoran"), {
      target: { value: "2026-09-20" },
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan Setoran" }),
    );

    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Setoran tercatat!"),
    );
    const post = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path ===
          `/family-groups/${FAMILY_GROUP_ID}/goals/goal-1/contributions` &&
        (options as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({
      amount: "250000",
      accountId: ACCOUNT.id,
      occurredAt: new Date("2026-09-20T00:00:00").toISOString(),
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  }, 10000);

  it("omits accountId when 'no account' is kept, and disables save for an empty or zero amount", async () => {
    mockSession("owner");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Setor ke Dana Liburan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Setor ke Dana Liburan",
    });
    const save = within(dialog).getByRole("button", { name: "Simpan Setoran" });
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Jumlah Setoran (Rp)"), "0");
    expect(save).toBeDisabled();
    await user.clear(within(dialog).getByLabelText("Jumlah Setoran (Rp)"));
    await user.type(
      within(dialog).getByLabelText("Jumlah Setoran (Rp)"),
      "5000",
    );
    await user.click(save);

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const post = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith("/contributions") &&
        (options as RequestInit | undefined)?.method === "POST",
    );
    const body = JSON.parse((post?.[1] as RequestInit).body as string);
    expect(body.amount).toBe("5000");
    expect(body).not.toHaveProperty("accountId");
  }, 10000);

  it("a rejected contribution shows the server's message and keeps the dialog open", async () => {
    mockSession("owner", {
      contributionError: 'Saldo rekening bank "BCA Tahapan" tidak mencukupi',
    });
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Setor ke Dana Liburan" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Setor ke Dana Liburan",
    });
    await user.type(
      within(dialog).getByLabelText("Jumlah Setoran (Rp)"),
      "250000",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Simpan Setoran" }),
    );

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Saldo rekening bank "BCA Tahapan" tidak mencukupi',
      ),
    );
    expect(
      screen.getByRole("dialog", { name: "Setor ke Dana Liburan" }),
    ).toBeInTheDocument();
  }, 10000);

  it("admin_staff gets no Setor button but can open the contribution history", async () => {
    mockSession("admin_staff");
    const user = userEvent.setup();
    render(<TujuanPage />);

    await screen.findByText("Dana Liburan");
    expect(
      screen.queryByRole("button", { name: /Setor ke/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Riwayat Setoran" }));
    expect(await screen.findByText("Rp 250.000")).toBeInTheDocument();
    expect(screen.getByText(/Manual · BCA Tahapan/)).toBeInTheDocument();
  }, 10000);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/tujuan"`
Expected: FAIL. The 4 new tests fail with `Unable to find role="button" and name "Setor ke Dana Liburan"` or `"Riwayat Setoran"`. The 3 pre-existing tests still pass.

- [ ] **Step 3: i18n**

`types.ts`: in the `tujuan` block, after `noticeSavingsNoAutoDebitSuffix: string;`, add:

```ts
contributeButton: string;
contributeButtonAriaPrefix: string;
contributeDialogTitlePrefix: string;
contributeDialogDesc: string;
contributeAmountLabel: string;
contributeAccountLabel: string;
contributeNoAccountOption: string;
contributeDateLabel: string;
contributeSubmit: string;
contributeSubmitting: string;
contributeToastSuccess: string;
historyToggleShow: string;
historyToggleHide: string;
historyLoading: string;
historyError: string;
historyEmpty: string;
historySourceManual: string;
historySourceAuto: string;
```

`id.ts`: in `tujuan`, change `trackerDisclaimer` and add the keys after `noticeSavingsNoAutoDebitSuffix`:

```ts
    trackerDisclaimer:
      "Setoran dari rekening mengurangi saldo rekening itu; tanpa rekening, progres hanya dicatat.",
```

```ts
    contributeButton: "Setor",
    contributeButtonAriaPrefix: "Setor ke ",
    contributeDialogTitlePrefix: "Setor ke ",
    contributeDialogDesc:
      "Jika memilih rekening, saldonya berkurang dan setoran tercatat sebagai transaksi.",
    contributeAmountLabel: "Jumlah Setoran (Rp)",
    contributeAccountLabel: "Rekening Sumber",
    contributeNoAccountOption: "Tanpa rekening (hanya catat progres)",
    contributeDateLabel: "Tanggal Setoran",
    contributeSubmit: "Simpan Setoran",
    contributeSubmitting: "Menyimpan…",
    contributeToastSuccess: "Setoran tercatat!",
    historyToggleShow: "Riwayat Setoran",
    historyToggleHide: "Tutup Riwayat",
    historyLoading: "Memuat riwayat…",
    historyError: "Gagal memuat riwayat setoran.",
    historyEmpty: "Belum ada setoran.",
    historySourceManual: "Manual",
    historySourceAuto: "Auto-debit",
```

`en.ts`: in `tujuan`, change `trackerDisclaimer` and add the keys after `noticeSavingsNoAutoDebitSuffix`:

```ts
    trackerDisclaimer:
      "Contributions from an account reduce that account's balance; without one, progress is only tracked.",
```

```ts
    contributeButton: "Contribute",
    contributeButtonAriaPrefix: "Contribute to ",
    contributeDialogTitlePrefix: "Contribute to ",
    contributeDialogDesc:
      "If you pick an account, its balance goes down and the contribution is recorded as a transaction.",
    contributeAmountLabel: "Amount (Rp)",
    contributeAccountLabel: "Source account",
    contributeNoAccountOption: "No account (track progress only)",
    contributeDateLabel: "Date",
    contributeSubmit: "Save contribution",
    contributeSubmitting: "Saving…",
    contributeToastSuccess: "Contribution recorded!",
    historyToggleShow: "Contribution history",
    historyToggleHide: "Hide history",
    historyLoading: "Loading history…",
    historyError: "Failed to load contribution history.",
    historyEmpty: "No contributions yet.",
    historySourceManual: "Manual",
    historySourceAuto: "Auto-debit",
```

- [ ] **Step 4: Create the dialog**

Create `apps/web/src/app/(app)/tujuan/_components/contribute-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApiError } from "@/hooks/use-api-error";
import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatAmountInput } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type {
  CreateGoalContributionInput,
  GoalContributionResult,
  GoalDto,
} from "@wealthme/contracts";

export type SourceAccountOption = {
  id: string;
  name: string;
  institution: string | null;
};

function todayLocalIsoDate(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

interface ContributeDialogProps {
  goal: GoalDto;
  accounts: SourceAccountOption[];
  familyGroupId: string;
  token: string;
  onClose: () => void;
}

export function ContributeDialog({
  goal,
  accounts,
  familyGroupId,
  token,
  onClose,
}: ContributeDialogProps) {
  const { t } = useLocale();
  const { handleError } = useApiError();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(goal.sourceAccountId ?? "");
  const [date, setDate] = useState(todayLocalIsoDate);

  const digits = amount.replace(/\D/g, "");
  const canSubmit = /^[1-9]\d*$/.test(digits) && date !== "";

  const mutation = useMutation({
    mutationFn: (input: CreateGoalContributionInput) =>
      apiFetch<GoalContributionResult>(
        `/family-groups/${familyGroupId}/goals/${goal.id}/contributions`,
        { token, method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      toast.success(t.tujuan.contributeToastSuccess);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.goals.all(familyGroupId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.accounts.all(familyGroupId),
      });
      onClose();
    },
    onError: handleError,
  });

  function handleSubmit() {
    if (!canSubmit || mutation.isPending) return;
    mutation.mutate({
      amount: digits,
      ...(accountId ? { accountId } : {}),
      // Local midnight, so picking "today" is never later than the server's now.
      occurredAt: new Date(`${date}T00:00:00`).toISOString(),
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{`${t.tujuan.contributeDialogTitlePrefix}${goal.name}`}</DialogTitle>
        <DialogDescription>{t.tujuan.contributeDialogDesc}</DialogDescription>
        <DialogBody>
          <div className="field">
            <label className="label" htmlFor="goal-contribute-amount">
              {t.tujuan.contributeAmountLabel}
            </label>
            <input
              id="goal-contribute-amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(formatAmountInput(e.target.value))}
              className="input mono"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="goal-contribute-account">
              {t.tujuan.contributeAccountLabel}
            </label>
            <select
              id="goal-contribute-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="select"
            >
              <option value="">{t.tujuan.contributeNoAccountOption}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.institution ? ` (${a.institution})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="goal-contribute-date">
              {t.tujuan.contributeDateLabel}
            </label>
            <input
              id="goal-contribute-date"
              type="date"
              max={todayLocalIsoDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={handleSubmit}
          >
            {mutation.isPending
              ? t.tujuan.contributeSubmitting
              : t.tujuan.contributeSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Create the history list**

Create `apps/web/src/app/(app)/tujuan/_components/contribution-history.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";

import { useLocale } from "@/hooks/use-locale";
import { apiFetch } from "@/lib/api-client";
import { formatRupiah } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

import type { GoalContributionDto } from "@wealthme/contracts";

interface ContributionHistoryProps {
  goalId: string;
  familyGroupId: string;
  token: string | undefined;
}

export function ContributionHistory({
  goalId,
  familyGroupId,
  token,
}: ContributionHistoryProps) {
  const { t, locale } = useLocale();
  const { data, isLoading, isError } = useQuery<GoalContributionDto[]>({
    queryKey: [...queryKeys.goals.all(familyGroupId), goalId, "contributions"],
    enabled: Boolean(token) && Boolean(familyGroupId),
    queryFn: ({ signal }) =>
      apiFetch<GoalContributionDto[]>(
        `/family-groups/${familyGroupId}/goals/${goalId}/contributions`,
        { token, signal },
      ),
  });

  if (isLoading) {
    return (
      <div className="text-[11.5px] text-muted-foreground">
        {t.tujuan.historyLoading}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="text-[11.5px] text-destructive">
        {t.tujuan.historyError}
      </div>
    );
  }
  if (!data?.length) {
    return (
      <div className="text-[11.5px] text-muted-foreground">
        {t.tujuan.historyEmpty}
      </div>
    );
  }

  return (
    <ul className="space-y-1.5" aria-label={t.tujuan.historyToggleShow}>
      {data.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between gap-2 text-[11.5px]"
        >
          <span className="min-w-0 truncate text-muted-foreground">
            {new Date(c.occurredAt).toLocaleDateString(
              locale === "en" ? "en-US" : "id-ID",
              { day: "numeric", month: "short", year: "numeric" },
            )}
            {" · "}
            {c.source === "auto"
              ? t.tujuan.historySourceAuto
              : t.tujuan.historySourceManual}
            {c.accountName ? ` · ${c.accountName}` : ""}
          </span>
          <span className="mono shrink-0 font-semibold">
            {formatRupiah(Number(c.amount))}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Wire it into `page.tsx`**

1. Add `Wallet` to the `lucide-react` import list. Directly above `import type { GoalDto, GoalStatus } from "@wealthme/contracts";`, add:

```ts
import {
  ContributeDialog,
  type SourceAccountOption,
} from "./_components/contribute-dialog";
import { ContributionHistory } from "./_components/contribution-history";
```

2. Replace `interface GoalCardProps` (`:159-164`) with:

```ts
interface GoalCardProps {
  goal: GoalDto;
  onEdit: (goal: GoalDto) => void;
  onDelete: (goal: GoalDto) => void;
  onContribute: (goal: GoalDto) => void;
  canManage: boolean;
  familyGroupId: string;
  token: string | undefined;
}
```

3. Change the `GoalCard` signature to `function GoalCard({ goal, onEdit, onDelete, onContribute, canManage, familyGroupId, token }: GoalCardProps) {`, and add `const [showHistory, setShowHistory] = useState(false);` as its first line after `useLocale()`.

4. Replace the `{canManage && ( <div className="mt-2.5 grid grid-cols-2 gap-1.5"> … </div> )}` block (`:288-303`) with:

```tsx
{
  canManage && (
    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
      <button
        type="button"
        onClick={() => onContribute(goal)}
        aria-label={`${t.tujuan.contributeButtonAriaPrefix}${goal.name}`}
        className="flex items-center justify-center gap-1.5 rounded-[7px] border border-primary/30 bg-accent px-3 py-[7px] text-[11px] font-semibold text-primary transition-colors hover:bg-accent/70"
      >
        <Wallet className="size-[13px]" aria-hidden="true" />{" "}
        {t.tujuan.contributeButton}
      </button>
      <button
        onClick={() => onEdit(goal)}
        className="flex items-center justify-center gap-1.5 rounded-[7px] border px-3 py-[7px] text-[11px] font-semibold transition-colors hover:bg-accent"
      >
        <Pencil className="size-[13px]" /> {t.tujuan.editButton}
      </button>
      <button
        onClick={() => onDelete(goal)}
        className="flex items-center justify-center gap-1.5 rounded-[7px] border px-3 py-[7px] text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/5"
      >
        <Trash2 className="size-[13px]" /> {t.tujuan.deleteButton}
      </button>
    </div>
  );
}
<button
  type="button"
  onClick={() => setShowHistory((open) => !open)}
  aria-expanded={showHistory}
  className="mt-2 w-full text-left text-[11px] font-semibold text-primary hover:underline"
>
  {showHistory ? t.tujuan.historyToggleHide : t.tujuan.historyToggleShow}
</button>;
{
  showHistory && (
    <div className="mt-1.5 border-t pt-2">
      <ContributionHistory
        goalId={goal.id}
        familyGroupId={familyGroupId}
        token={token}
      />
    </div>
  );
}
```

5. In `TujuanPage`, after `const [deletingGoal, setDeletingGoal] = …` (`:325`), add:

```ts
const [contributingGoal, setContributingGoal] = useState<GoalDto | null>(null);
```

After the goals `useQuery` (`:327-341`), add:

```ts
const { data: accounts = [] } = useQuery<SourceAccountOption[]>({
  queryKey: queryKeys.accounts.all(familyGroupId ?? ""),
  enabled: Boolean(familyGroupId) && Boolean(token) && canManage === true,
  queryFn: ({ signal }) =>
    apiFetch<SourceAccountOption[]>(
      `/family-groups/${familyGroupId}/accounts`,
      { token, signal },
    ),
});
```

6. In the `goals?.map` render, pass the new props:

```tsx
<GoalCard
  goal={g}
  onEdit={handleEdit}
  onDelete={setDeletingGoal}
  onContribute={setContributingGoal}
  canManage={!!canManage}
  familyGroupId={familyGroupId ?? ""}
  token={token}
/>
```

7. Before `<ConfirmDeleteDialog` (`:626`), add:

```tsx
{
  contributingGoal && familyGroupId && token && (
    <ContributeDialog
      key={contributingGoal.id}
      goal={contributingGoal}
      accounts={accounts}
      familyGroupId={familyGroupId}
      token={token}
      onClose={() => setContributingGoal(null)}
    />
  );
}
```

8. The header comment at `:461-463` ("EPIC-022 A3 — goals are a manual tracker, not real money …") no longer holds. Replace it with `{/* Revisi F — contributions can now move real money; the line says when. */}`.

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/tujuan"`
Expected: PASS. All 7 tests are green (3 pre-existing, 4 new).

- [ ] **Step 8: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/tujuan/page.tsx" "src/app/(app)/tujuan/tujuan.test.tsx" "src/app/(app)/tujuan/_components/contribute-dialog.tsx" "src/app/(app)/tujuan/_components/contribution-history.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0. If only `import/order` reports, `pnpm exec eslint --fix` on those web files is safe.

- [ ] **Step 9: Commit**

```bash
git add "apps/web/src/app/(app)/tujuan" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(web): Setor into a goal and see its contribution history on /tujuan

Setor dialog (amount, optional source account, date) posts a digit-string
amount and a local-midnight date; each goal card gains a history expander.
The tracker disclaimer now says when money actually moves.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Web goal form — "Rekening Sumber Auto-debit" select

**Files:**

- Modify: `apps/web/src/components/crud/crud-config.ts` (`CrudField` `:31-61`; the `tujuan` fields `:330-338`)
- Modify: `apps/web/src/components/crud/crud-modal.tsx` (`CrudModalProps` `:28-50`; `CrudModal` `:116-133`; `CrudForm` `:139-312`)
- Modify: `apps/web/src/app/(app)/tujuan/page.tsx` (imports `:26`; `handleEdit` `:360-378`; `handleSubmit` `:386-427`; `<CrudModal>` `:621-625`)
- Modify: `apps/web/src/i18n/types.ts`, `id.ts`, `en.ts` (`tujuan` block)
- Test: `apps/web/src/app/(app)/tujuan/tujuan.test.tsx`

**Interfaces:**

- Consumes: Task 5's API rule (`sourceAccountId` required with `autoDebitAmount`, a UUID from the same family), Task 6's `accounts` query in `TujuanPage`, and `parseGoalFormValues(values, originalCurrentAmount?)` (existing, `lib/goals-utils.ts:25`, protected: call only).
- Produces:
  - `CrudField.visibleWhen?: (values: Record<string, string>) => boolean`
  - `CrudModalProps.labelOverrides?: Record<string, string>`
  - A `tujuan` form field `sourceAccountId` (select) that is shown only while "Auto-debit / Bulan" is above 0.
  - Goal POST/PATCH bodies carry `sourceAccountId` whenever `autoDebitAmount` is present.

- [ ] **Step 1: Write the failing tests**

In `tujuan.test.tsx`, extend `MockOptions` and the `/goals` branch of `mockSession`:

```ts
type MockOptions = { contributionError?: string; goalPostOk?: boolean };
```

```ts
if (path.endsWith("/goals")) {
  if (options?.method === "POST") {
    return opts.goalPostOk
      ? Promise.resolve(buildGoal({ id: "goal-new", name: "Rumah Baru" }))
      : Promise.reject({
          status: 400,
          message: "Target tanggal tidak boleh di masa lalu",
        });
  }
  return Promise.resolve([buildGoal()]);
}
```

Then append:

```tsx
describe("TujuanPage — goal form source account for auto-debit (Revisi F item 5)", () => {
  it("shows the source-account select only once an auto-debit amount is typed, and sends it", async () => {
    mockSession("owner", { goalPostOk: true });
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Tambah Tujuan" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("cth: Dana Liburan"),
      "Rumah Baru",
    );
    await user.type(
      within(dialog).getByLabelText("Target Jumlah"),
      "100000000",
    );
    expect(
      within(dialog).queryByLabelText("Rekening Sumber Auto-debit"),
    ).not.toBeInTheDocument();

    await user.type(
      within(dialog).getByLabelText("Auto-debit / Bulan"),
      "500000",
    );
    await user.selectOptions(
      await within(dialog).findByLabelText("Rekening Sumber Auto-debit"),
      ACCOUNT.id,
    );
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const post = mockApiFetch.mock.calls.find(
      ([path, options]) =>
        typeof path === "string" &&
        path.endsWith("/goals") &&
        (options as RequestInit | undefined)?.method === "POST",
    );
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toMatchObject(
      {
        name: "Rumah Baru",
        targetAmount: 100_000_000,
        autoDebitAmount: 500_000,
        sourceAccountId: ACCOUNT.id,
      },
    );
  }, 30000);

  it("blocks saving an auto-debit without a source account, keeps the dialog open, and never POSTs", async () => {
    mockSession("owner", { goalPostOk: true });
    const user = userEvent.setup();
    render(<TujuanPage />);

    await user.click(
      await screen.findByRole("button", { name: "Tambah Tujuan" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("cth: Dana Liburan"),
      "Rumah Baru",
    );
    await user.type(
      within(dialog).getByLabelText("Target Jumlah"),
      "100000000",
    );
    await user.type(
      within(dialog).getByLabelText("Auto-debit / Bulan"),
      "500000",
    );
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Pilih rekening sumber untuk auto-debit.",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      mockApiFetch.mock.calls.some(
        ([path, options]) =>
          typeof path === "string" &&
          path.endsWith("/goals") &&
          (options as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  }, 30000);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/tujuan" -t "source account for auto-debit"`
Expected: FAIL. The first test finds no "Rekening Sumber Auto-debit" label. The second never sees the toast, and the POST happens.

- [ ] **Step 3: i18n**

`types.ts`: in `tujuan`, after `historySourceAuto: string;`, add:

```ts
sourceAccountFieldLabel: string;
sourceAccountPlaceholder: string;
sourceAccountRequired: string;
```

`id.ts`: after `historySourceAuto: "Auto-debit",`, add:

```ts
    sourceAccountFieldLabel: "Rekening Sumber Auto-debit",
    sourceAccountPlaceholder: "Pilih rekening…",
    sourceAccountRequired: "Pilih rekening sumber untuk auto-debit.",
```

`en.ts`: after `historySourceAuto: "Auto-debit",`, add:

```ts
    sourceAccountFieldLabel: "Auto-debit source account",
    sourceAccountPlaceholder: "Choose an account…",
    sourceAccountRequired: "Choose a source account for the auto-debit.",
```

- [ ] **Step 4: CrudField `visibleWhen` + CrudModal `labelOverrides`**

`crud-config.ts`: in `interface CrudField`, after `hideOnEdit?: boolean;`, add:

```ts
  /** Render the field only while this returns true for the current values. */
  visibleWhen?: (values: Record<string, string>) => boolean;
```

In the `tujuan` entity, after the `autodebitDay` field object (ends `:337`), add:

```ts
      {
        // Revisi F — label comes from i18n via CrudModal `labelOverrides`; options via `dynamicOptions`.
        key: "sourceAccountId",
        label: "Rekening Sumber",
        type: "select",
        options: [],
        visibleWhen: (v) => parseRupiah(v.autodebit ?? "") > 0,
      },
```

`crud-modal.tsx`:

- In `interface CrudModalProps`, after `dynamicOptions?: …;`, add `labelOverrides?: Record<string, string>;`.
- In `CrudModal`, add `labelOverrides,` to the destructure, and pass `labelOverrides={labelOverrides}` to `<CrudForm …>`.
- In `CrudForm`, change the signature to `function CrudForm({ state, onClose, onSubmit, dynamicOptions, labelOverrides }: CrudFormProps) {`.
- Replace the `visibleFields` computation (`:180-183`) with:

```ts
const visibleFields = (
  state.mode === "edit"
    ? config.fields.filter((f) => !f.hideOnEdit)
    : config.fields
).filter((f) => !f.visibleWhen || f.visibleWhen(values));
```

- In `renderField`, add `const label = labelOverrides?.[f.key] ?? f.label;` as the first line, and replace each of the four `f.label` uses inside `renderField` with `label`: `aria-label={f.label}`, `<span className="t-sm t-bold">{f.label}</span>`, `label={f.label}` on `EmojiPicker`, and `<span className="label">{f.label}</span>`.

- [ ] **Step 5: Page wiring**

In `page.tsx`:

- Change `import { buildGoalBody } from "@/lib/goals-utils";` to `import { parseGoalFormValues } from "@/lib/goals-utils";`.
- In `handleEdit`'s `initialValues`, add `sourceAccountId: goal.sourceAccountId ?? "",` after `autodebitDay`.
- In `handleSubmit`, replace from `try {` through the `const body = buildGoalBody(…);` statement (`:395-401`) with:

```ts
    const payload = parseGoalFormValues(
      values,
      mode === "edit" ? (editingOriginalCurrentAmount ?? undefined) : undefined,
    );
    if (payload.autoDebitAmount && !values.sourceAccountId) {
      toast.error(t.tujuan.sourceAccountRequired);
      // Rejecting keeps CrudModal open with the user's input.
      throw new Error(t.tujuan.sourceAccountRequired);
    }
    const body = JSON.stringify(
      payload.autoDebitAmount
        ? { ...payload, sourceAccountId: values.sourceAccountId }
        : payload,
    );
    try {
```

The rest of the `try` block (the PATCH/POST calls, the toasts, the invalidation and the `catch`) is unchanged.

- Before `return (`, add:

```ts
const sourceAccountOptions = [
  { value: "", label: t.tujuan.sourceAccountPlaceholder },
  ...accounts.map((a) => ({
    value: a.id,
    label: a.institution ? `${a.name} (${a.institution})` : a.name,
  })),
];
```

- Replace the `<CrudModal … />` element with:

```tsx
<CrudModal
  state={crud}
  onClose={handleCloseCrud}
  onSubmit={handleSubmit}
  dynamicOptions={{ sourceAccountId: sourceAccountOptions }}
  labelOverrides={{ sourceAccountId: t.tujuan.sourceAccountFieldLabel }}
/>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/tujuan" src/lib/goals-utils.test.ts "src/app/\(app\)/rekening"`
Expected: PASS. All tujuan tests are green (9). `goals-utils` is unchanged and green. The rekening tests (the other `CrudModal` + `dynamicOptions` user) are still green.

- [ ] **Step 7: Typecheck the web app**

Run (from `apps/web`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0. This is not `next build`. If the laptop runs hot, run it on wit-hq.

- [ ] **Step 8: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/crud/crud-config.ts src/components/crud/crud-modal.tsx "src/app/(app)/tujuan/page.tsx" "src/app/(app)/tujuan/tujuan.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/crud/crud-config.ts apps/web/src/components/crud/crud-modal.tsx "apps/web/src/app/(app)/tujuan" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(web): pick the auto-debit source account in the goal form

The select appears once an auto-debit amount is typed; saving an auto-debit
without one is blocked client-side (the API 400s too). CrudModal gains
visibleWhen and i18n labelOverrides.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

1. **Spec coverage.**
   - Item 4 option (a), remove from UI and DTOs and keep the column: Task 1.
   - Item 5, the `GoalContribution` model and `sourceAccountId`: Task 2.
   - The contribution endpoint that optionally debits an account atomically and increments `currentAmount`: Tasks 3 and 4.
   - The history GET: Tasks 3 and 4.
   - The Setor dialog (amount, account, date) and the history list: Task 6.
   - Auto-debit honouring `autoDebitDay`, a daily cron, a required `sourceAccountId`, and each run recorded as a contribution: Task 5. The goal form select: Task 7.
   - The scheduler jobId stays stable and the stale repeatable is removed: Task 5.
   - No gaps.
2. **Placeholder scan.** Every code step has full code. No "TBD", "add validation" or "similar to Task N" remains.
3. **Type consistency.**
   - `contributeInTx(tx, goal, ContributionInput)` is defined in Task 3 and used with the same shape in Task 5.
   - `GoalContributionResult`, `GoalContributionDto` and `CreateGoalContributionInput` are defined in Task 2 and used in Tasks 3, 4 and 6.
   - `SourceAccountOption` is defined in Task 6 and reused in Task 7.
   - `AUTO_DEBIT_CRON` is exported in Task 5 and imported by its spec.
   - `GoalDto.sourceAccountId` is in contracts (Task 2), the API (Task 3) and the web fixtures (Task 6).
4. **Review Focus.** Each of the 5 lines is pinned by a named test in its owning task (Tasks 3, 5 and 6).

## Judgment Calls (for the reviewer)

- **Goal category.** No `Goal.categoryId` column is added. `resolveGoalCategoryId` upserts on the existing unique `(familyGroupId, name, kind)` with `ownCategoryName(coa.name, goal.name, …)` under COA `30001` (Tabungan), falling back to `30099`. Renaming a goal starts a new category, and two goals with the same name share one.
- **Ledger shape.** A contribution with an account posts `type: "transfer"` with no `toAccountId`. This is exactly how `LiabilitiesService` posts a principal payment, and the account balance is decremented.
- **Over-target.** A manual contribution above the remaining target returns 400. This matches `update()`'s existing "Sudah Terkumpul tidak boleh melebihi Target Jumlah" rule. An auto-debit is capped instead.
- **Legacy goals.** Goals with `autoDebitAmount` but no `sourceAccountId` stop getting the old counter-only monthly bump. The daily job skips them until someone picks an account. Goals with a null `autoDebitDay` run on the 1st.
- **BullMQ API.** The job keeps the repo's `queue.add({ repeat, jobId })` style. It uses `getRepeatableJobs` and `removeRepeatableByKey`, which are deprecated in BullMQ v5 but present in 5.78, rather than migrating to `upsertJobScheduler`. That migration would change the job identity the task asks to keep stable.
- **Missed days.** If the worker is down on day N, that month's auto-debit is skipped. The idempotency is per day, as the spec requires, not per month with catch-up.
