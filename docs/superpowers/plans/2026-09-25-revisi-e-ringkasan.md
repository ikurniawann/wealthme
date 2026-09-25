# Revisi E — Ringkasan: All FX Currencies + Net-Worth Trend Bucketing & Live Point Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `/ringkasan` show its headline figures in any of the 7 supported currencies (plus gram emas), and make the "Tren Kekayaan Bersih" chart show a real line for every range, including brand-new families and the `1m` range.

**Architecture:** The API's `getNetWorthHistory` appends a synthetic "today" point, computed by the same `computeNetWorthBreakdown` rollup that backs `GET /dashboard/net-worth`, when the newest persisted snapshot is older than today (UTC day, same boundary as `captureSnapshot`). On the web, a new pure module `ringkasan/_components/history-buckets.ts` buckets the history by range (daily / ISO-weekly / monthly) and replaces `groupHistoryPointsByMonth`. The 7-code currency list moves out of `akun/page.tsx` into a new non-protected `apps/web/src/hooks/currencies.ts`. A new pure module `ringkasan/_components/display-currency.ts` owns `DisplayCurrency` and its formatting. The page lead renders `IDR | Emas | <native select of the 6 foreign codes>`.

**Tech Stack:** NestJS 10 + Prisma + Jest/ts-jest (API); Next.js 16 App Router + React 19 + TanStack Query + Jest (jsdom, `TZ=Asia/Jakarta`) + Testing Library (web); pnpm workspace.

**Spec:** `docs/superpowers/plans/2026-09-25-revisi-besar-catalog.md`, items 1 and 2 (sub-plan E, "Ringkasan"). One intentional deviation: the catalog puts the shared currency list in `apps/web/src/lib/currencies.ts`, but `lib/*` is protected, so it goes in `apps/web/src/hooks/currencies.ts`.

## Global Constraints

- Work only inside the worktree /home/stealth/Projects/wealthme-web-revisi-ab on branch feat/revisi-ab-calculators-quickfixes.
- Never edit protected files: apps/web/src/app/globals.css, apps/web/src/app/design-system.css, apps/web/src/lib/_, apps/web/src/components/ui/_, apps/web/src/components/wm/_, apps/web/src/components/charts/_, apps/web/src/components/shell/_, apps/web/src/app/layout.tsx, packages/config/_.
- Every new user-visible string goes into all three of apps/web/src/i18n/types.ts, id.ts, en.ts (dictionaries use `satisfies I18nDictionary`).
- Non-IDR amounts are always labeled indicative (mock FX table, Open Design Decision #6); never present them as live rates.
- Run tests locally only as the focused jest commands each task names (from apps/api or apps/web). No `next build`, no full `turbo` runs.
- Lint every file you touch: `pnpm exec eslint <files>` from the owning app dir must exit 0.
- Commit messages: Conventional Commits, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code comments: none unless the WHY is non-obvious; one line max.
- The husky post-commit hook prints "post-commit script failed (code 1)" (graphify); the commit still lands. Never use --no-verify.

## Review Focus

1. **Today's snapshot already exists.** When the 02:00 cron has already written today's row, the API must not append a second "today" point and must skip the rollup queries. Pinned in Task 1.
2. **ISO week across a year boundary.** On the `6m` range, Mon 2026-12-28 through Sun 2027-01-03 is one week and must stay one bucket, not split at 1 Jan. Pinned in Task 2.
3. **Re-picking the foreign currency the select last showed.** From IDR or Emas, choosing USD must still switch to USD. A select that already shows "USD" would fire no `change` event, so the idle select shows a hidden placeholder instead. Pinned in Task 5.
4. **FX rate missing for the chosen code** (FX request still loading, failed, or the code is absent from `/fx/rates`). Show `"..."`, never a 1:1 number under a foreign symbol. Pinned in Task 4.
5. **Indicative note when the page currency and the profile currency differ.** With the profile on IDR and the page picker on SGD, the "≈ Nilai dalam SGD … kurs indikatif" note must appear. Pinned in Task 4.

---

### Task 1: API — `getNetWorthHistory` appends a live "today" point

**Files:**

- Modify: `apps/api/src/dashboard/dashboard.service.ts:459-489` (`getNetWorthHistory`)
- Modify: `apps/api/src/dashboard/dashboard.service.spec.ts:62-67` (add `FakeSnapshot`), `:158-162` (fake `netWorthSnapshot.findMany`), and append a new `describe` at end of file (after `:596`)

**Interfaces:**

- Consumes: `DashboardService.computeNetWorthBreakdown(familyGroupId, canSeePrivate)` (private, `dashboard.service.ts:311`), which is the same rollup `getNetWorth` uses.
- Produces: `getNetWorthHistory(familyGroupId: string, range = "30d", now: Date = new Date()): Promise<NetWorthHistoryDto>`. If there is no persisted snapshot, or the newest snapshot's `date` is before the UTC start of `now`'s day, `points` ends with `{ capturedAt: now.toISOString(), totalCash, totalInvestments, totalAssets, totalLiabilities, netWorth }` computed family-wide (`canSeePrivate = true`, same as `captureSnapshot`). The controller (`dashboard.controller.ts:89`) is unchanged. The web tasks rely on the endpoint returning ascending points with the live point last.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/dashboard/dashboard.service.spec.ts`, add this interface directly after `interface FakeInvestment { … }` (ends at `:67`):

```ts
interface FakeSnapshot {
  capturedAt: Date;
  date: Date;
  totalCash: bigint;
  totalInvestments: bigint;
  totalAssets: bigint;
  totalLiabilities: bigint;
  netWorth: bigint;
}
```

In `makeFakePrisma`, replace the `netWorthSnapshot` block (`:158-162`) with:

```ts
    netWorthSnapshot: {
      upsert: jest.fn(({ create }: { create: Record<string, unknown> }) =>
        Promise.resolve(create),
      ),
      findMany: jest.fn((): Promise<FakeSnapshot[]> => Promise.resolve([])),
    },
```

Append at the end of the file:

```ts
function snapshotRow(day: string, netWorth: bigint): FakeSnapshot {
  return {
    capturedAt: new Date(`${day}T02:00:00.000Z`),
    date: new Date(`${day}T00:00:00.000Z`),
    totalCash: netWorth,
    totalInvestments: 0n,
    totalAssets: 0n,
    totalLiabilities: 0n,
    netWorth,
  };
}

describe("DashboardService net-worth history — live today point", () => {
  const NOW = new Date("2026-09-25T08:00:00.000Z");
  let service: DashboardService;
  let prisma: ReturnType<typeof makeFakePrisma>;

  beforeEach(async () => {
    const { accounts } = buildFixtures();
    prisma = makeFakePrisma(accounts, [], []);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  it("a family with no snapshot yet gets one live point from the family-wide rollup", async () => {
    const history = await service.getNetWorthHistory(
      FAMILY_GROUP_ID,
      "1m",
      NOW,
    );

    // 100 visible + 500 private: snapshots are family-wide, so private is included.
    expect(history.points).toEqual([
      {
        capturedAt: NOW.toISOString(),
        totalCash: "600",
        totalInvestments: "0",
        totalAssets: "0",
        totalLiabilities: "0",
        netWorth: "600",
      },
    ]);
  });

  it("appends the live point after persisted snapshots when the newest is older than today", async () => {
    prisma.netWorthSnapshot.findMany.mockResolvedValueOnce([
      snapshotRow("2026-09-23", 400n),
      snapshotRow("2026-09-24", 500n),
    ]);

    const history = await service.getNetWorthHistory(
      FAMILY_GROUP_ID,
      "1m",
      NOW,
    );

    expect(history.points.map((p) => [p.capturedAt, p.netWorth])).toEqual([
      ["2026-09-23T02:00:00.000Z", "400"],
      ["2026-09-24T02:00:00.000Z", "500"],
      [NOW.toISOString(), "600"],
    ]);
  });

  it("does not duplicate today when today's snapshot already exists", async () => {
    prisma.netWorthSnapshot.findMany.mockResolvedValueOnce([
      snapshotRow("2026-09-24", 500n),
      snapshotRow("2026-09-25", 550n),
    ]);

    const history = await service.getNetWorthHistory(
      FAMILY_GROUP_ID,
      "1m",
      NOW,
    );

    expect(history.points.map((p) => p.netWorth)).toEqual(["500", "550"]);
    expect(prisma.account.findMany).not.toHaveBeenCalled();
  });

  it("filters persisted snapshots by the range measured from `now`", async () => {
    await service.getNetWorthHistory(FAMILY_GROUP_ID, "1m", NOW);

    const since = new Date(NOW);
    since.setMonth(since.getMonth() - 1);
    expect(prisma.netWorthSnapshot.findMany).toHaveBeenCalledWith({
      where: { familyGroupId: FAMILY_GROUP_ID, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/api`): `pnpm exec jest src/dashboard/dashboard.service.spec.ts`
Expected: FAIL. ts-jest reports `TS2554: Expected 1-2 arguments, but got 3` for the `getNetWorthHistory(…, NOW)` calls. If type-check diagnostics are off, the "no snapshot yet" and "appends the live point" tests fail instead: `points` received `[]` or has only 2 entries, and the range test's `gte` differs.

- [ ] **Step 3: Write minimal implementation**

In `apps/api/src/dashboard/dashboard.service.ts`, replace `getNetWorthHistory` (`:459-489`) with:

```ts
  async getNetWorthHistory(
    familyGroupId: string,
    range = "30d",
    now: Date = new Date(),
  ): Promise<NetWorthHistoryDto> {
    const since = new Date(now);
    const monthMatch = /^(\d+)m$/.exec(range);
    const dayMatch = /^(\d+)d$/.exec(range);
    if (monthMatch) {
      since.setMonth(since.getMonth() - parseInt(monthMatch[1] ?? "12", 10));
    } else if (dayMatch) {
      since.setDate(since.getDate() - parseInt(dayMatch[1] ?? "30", 10));
    } else {
      since.setDate(since.getDate() - 30);
    }

    const rows = await this.prisma.netWorthSnapshot.findMany({
      where: { familyGroupId, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
    });

    const points: NetWorthHistoryPointDto[] = rows.map((r) => ({
      capturedAt: r.capturedAt.toISOString(),
      totalCash: r.totalCash.toString(),
      totalInvestments: r.totalInvestments.toString(),
      totalAssets: r.totalAssets.toString(),
      totalLiabilities: r.totalLiabilities.toString(),
      netWorth: r.netWorth.toString(),
    }));

    // Same UTC day boundary as captureSnapshot, so "today" means the same row key.
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const newest = rows[rows.length - 1];
    if (!newest || newest.date.getTime() < startOfToday.getTime()) {
      const b = await this.computeNetWorthBreakdown(familyGroupId, true);
      points.push({
        capturedAt: now.toISOString(),
        totalCash: b.totalCash.toString(),
        totalInvestments: b.totalInvestments.toString(),
        totalAssets: b.totalAssets.toString(),
        totalLiabilities: b.totalLiabilities.toString(),
        netWorth: b.netWorth.toString(),
      });
    }

    return { range, currency: "IDR", points };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/api`): `pnpm exec jest src/dashboard`
Expected: PASS. Every suite in `src/dashboard` is green, including the 4 new tests.

- [ ] **Step 5: Lint**

Run (from `apps/api`): `pnpm exec eslint src/dashboard/dashboard.service.ts src/dashboard/dashboard.service.spec.ts`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/dashboard/dashboard.service.ts apps/api/src/dashboard/dashboard.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): append a live today point to net-worth history

Snapshots only exist after the 02:00 cron, so new families saw an empty trend
and everyone's chart lagged a day. When the newest snapshot is older than
today, the history now ends with the same family-wide rollup the cron writes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Web — range-aware trend bucketing + honest empty-state copy

**Files:**

- Create: `apps/web/src/app/(app)/ringkasan/_components/history-buckets.ts`
- Create: `apps/web/src/app/(app)/ringkasan/_components/history-buckets.test.ts`
- Modify: `apps/web/src/app/(app)/ringkasan/_components/use-ringkasan-data.ts:20-27` (imports), `:41-51` (move `TrendRangeKey`), `:66-87` (delete `groupHistoryPointsByMonth`), `:281-293` (use the new bucketer + labels)
- Modify: `apps/web/src/i18n/id.ts:2347`, `apps/web/src/i18n/en.ts:2301` (`ringkasan.emptyNetWorthTrend` value only; the key and `types.ts` stay as they are)

**Interfaces:**

- Consumes: Task 1's endpoint behavior. Points are ascending and may end with a live point on the same local day as the last snapshot.
- Produces (from `history-buckets.ts`):
  - `export type TrendRangeKey = "1m" | "3m" | "6m" | "12m" | "ytd" | "all" | "custom";` (moved here; `use-ringkasan-data.ts` re-exports it, so `page-lead.tsx`, `trend-composition-section.tsx` and `page.tsx` keep importing it from `./use-ringkasan-data`)
  - `export type HistoryGranularity = "day" | "week" | "month";`
  - `export function granularityForRange(range: TrendRangeKey): HistoryGranularity`
  - `export function bucketHistoryPoints(points: NetWorthHistoryPointDto[], range: TrendRangeKey): NetWorthHistoryPointDto[]`
  - `export function trendCategoryLabel(capturedAt: string, granularity: HistoryGranularity, dateLocale: string): string`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/(app)/ringkasan/_components/history-buckets.test.ts`:

```ts
/**
 * Revisi E — the trend used to bucket every range by calendar month, so `1m`
 * collapsed to one point and hit the "< 2 points" empty state. Jest runs in
 * Asia/Jakarta (jest.config.ts); points sit at 05:00Z = 12:00 WIB, the same day.
 */

import type { NetWorthHistoryPointDto } from "@wealthme/contracts";

import {
  bucketHistoryPoints,
  granularityForRange,
  trendCategoryLabel,
} from "./history-buckets";

function point(isoDate: string, netWorth: string): NetWorthHistoryPointDto {
  return {
    capturedAt: `${isoDate}T05:00:00.000Z`,
    totalCash: netWorth,
    totalInvestments: "0",
    totalAssets: "0",
    totalLiabilities: "0",
    netWorth,
  };
}

function dailyPoints(
  startIso: string,
  count: number,
): NetWorthHistoryPointDto[] {
  const start = Date.parse(`${startIso}T05:00:00.000Z`);
  return Array.from({ length: count }, (_, i) =>
    point(
      new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      String(1000 + i),
    ),
  );
}

const dayOf = (p: NetWorthHistoryPointDto) => p.capturedAt.slice(0, 10);

describe("granularityForRange", () => {
  it.each([
    ["1m", "day"],
    ["3m", "day"],
    ["6m", "week"],
    ["12m", "month"],
    ["ytd", "month"],
    ["all", "month"],
    ["custom", "month"],
  ] as const)("%s → %s", (range, expected) => {
    expect(granularityForRange(range)).toBe(expected);
  });
});

describe("bucketHistoryPoints", () => {
  it("returns [] for no points", () => {
    expect(bucketHistoryPoints([], "1m")).toEqual([]);
  });

  it("1m keeps one point per day, even across a month boundary", () => {
    const points = dailyPoints("2026-08-27", 30); // 27 Aug → 25 Sep
    const out = bucketHistoryPoints(points, "1m");
    expect(out).toHaveLength(30);
    expect(dayOf(out[0]!)).toBe("2026-08-27");
    expect(dayOf(out[29]!)).toBe("2026-09-25");
  });

  it("daily buckets keep the later point when a day has two (snapshot + live point)", () => {
    const snapshot = point("2026-09-25", "500");
    const live = {
      ...point("2026-09-25", "600"),
      capturedAt: "2026-09-25T09:00:00.000Z", // 16:00 WIB, same day
    };
    expect(bucketHistoryPoints([snapshot, live], "3m")).toEqual([live]);
  });

  it("6m keeps the last point of each ISO (Monday-start) week", () => {
    const points = dailyPoints("2026-09-07", 14); // Mon 7 Sep → Sun 20 Sep
    const out = bucketHistoryPoints(points, "6m");
    expect(out.map(dayOf)).toEqual(["2026-09-13", "2026-09-20"]);
  });

  it("6m keeps an ISO week that spans New Year as one bucket", () => {
    const points = dailyPoints("2026-12-28", 8); // Mon 28 Dec → Mon 4 Jan
    const out = bucketHistoryPoints(points, "6m");
    expect(out.map(dayOf)).toEqual(["2027-01-03", "2027-01-04"]);
  });

  it.each(["12m", "ytd", "all", "custom"] as const)(
    "%s keeps the closing point of each calendar month",
    (range) => {
      const points = dailyPoints("2026-07-21", 54); // 21 Jul → 12 Sep (live evidence)
      const out = bucketHistoryPoints(points, range);
      expect(out.map(dayOf)).toEqual([
        "2026-07-31",
        "2026-08-31",
        "2026-09-12",
      ]);
    },
  );
});

describe("trendCategoryLabel", () => {
  const capturedAt = "2026-07-21T05:00:00.000Z";

  it("day and week labels carry the day of month so daily ticks are distinct", () => {
    expect(trendCategoryLabel(capturedAt, "day", "id-ID")).toMatch(/21/);
    expect(trendCategoryLabel(capturedAt, "week", "id-ID")).toMatch(/21/);
  });

  it("month labels stay month + 2-digit year", () => {
    const label = trendCategoryLabel(capturedAt, "month", "id-ID");
    expect(label).toMatch(/Jul/);
    expect(label).toMatch(/26/);
    expect(label).not.toMatch(/21/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/ringkasan/_components/history-buckets"`
Expected: FAIL with `Cannot find module './history-buckets' from 'src/app/(app)/ringkasan/_components/history-buckets.test.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/app/(app)/ringkasan/_components/history-buckets.ts`:

```ts
import type { NetWorthHistoryPointDto } from "@wealthme/contracts";

export type TrendRangeKey =
  | "1m"
  | "3m"
  | "6m"
  | "12m"
  | "ytd"
  | "all"
  | "custom";

export type HistoryGranularity = "day" | "week" | "month";

export function granularityForRange(range: TrendRangeKey): HistoryGranularity {
  if (range === "1m" || range === "3m") return "day";
  if (range === "6m") return "week";
  return "month";
}

function bucketKey(date: Date, granularity: HistoryGranularity): string {
  if (granularity === "month") {
    return `${date.getFullYear()}-${date.getMonth()}`;
  }
  if (granularity === "day") {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
  // An ISO week is identified by its Monday's calendar date.
  const monday = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - ((date.getDay() + 6) % 7),
  );
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
}

/** Keeps the last (closing) point per bucket; `points` must be ascending. */
export function bucketHistoryPoints(
  points: NetWorthHistoryPointDto[],
  range: TrendRangeKey,
): NetWorthHistoryPointDto[] {
  const granularity = granularityForRange(range);
  const lastByKey = new Map<string, NetWorthHistoryPointDto>();
  for (const point of points) {
    lastByKey.set(bucketKey(new Date(point.capturedAt), granularity), point);
  }
  return [...lastByKey.values()];
}

export function trendCategoryLabel(
  capturedAt: string,
  granularity: HistoryGranularity,
  dateLocale: string,
): string {
  return new Date(capturedAt).toLocaleDateString(
    dateLocale,
    granularity === "month"
      ? { month: "short", year: "2-digit" }
      : { day: "numeric", month: "short" },
  );
}
```

In `apps/web/src/app/(app)/ringkasan/_components/use-ringkasan-data.ts`:

(a) In the `@wealthme/contracts` type import (`:20-27`), remove `NetWorthHistoryPointDto,` (it is no longer used here). Below that import block, add:

```ts
import {
  bucketHistoryPoints,
  granularityForRange,
  trendCategoryLabel,
  type TrendRangeKey,
} from "./history-buckets";

export type { TrendRangeKey } from "./history-buckets";
```

(b) Delete the local `export type TrendRangeKey = … | "custom";` declaration (`:44-51`). Keep the `// ── Trend range segmented control …` comment lines `:41-43` and the `TrendCustomRange` type (`:52-53`).

(c) Delete the whole `// ── Root cause of the x-axis label bug ──…` comment and the `groupHistoryPointsByMonth` function (`:66-87`). Nothing else imports it.

(d) Replace `:281-293` (the "Bucketed to one (closing) point per calendar month" comment through the end of the `netWorthTrendCategories` map) with:

```ts
const trendGranularity = granularityForRange(trendRange);
const groupedHistoryPoints = bucketHistoryPoints(
  netWorthHistoryPoints,
  trendRange,
);
const netWorthTrendValues = groupedHistoryPoints.map((p) => Number(p.netWorth));
const netWorthTrendCategories = groupedHistoryPoints.map((p) =>
  trendCategoryLabel(p.capturedAt, trendGranularity, t.beranda.dateLocale),
);
```

The YoY block below (`groupedHistoryPoints[0]` / last) is unchanged.

(e) Empty-state copy. In `apps/web/src/i18n/id.ts:2347`:

```ts
    emptyNetWorthTrend:
      "Tren mulai terisi setelah snapshot harian pertama (02:00).",
```

In `apps/web/src/i18n/en.ts:2301`:

```ts
    emptyNetWorthTrend:
      "The trend fills in after the first daily snapshot (02:00).",
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/ringkasan" src/i18n/dictionary.test.ts`
Expected: PASS. The new `history-buckets` suite (18 tests) and the i18n parity suite are green.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/ringkasan/_components/history-buckets.ts" "src/app/(app)/ringkasan/_components/history-buckets.test.ts" "src/app/(app)/ringkasan/_components/use-ringkasan-data.ts" src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/ringkasan/_components/history-buckets.ts" "apps/web/src/app/(app)/ringkasan/_components/history-buckets.test.ts" "apps/web/src/app/(app)/ringkasan/_components/use-ringkasan-data.ts" apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
fix(ringkasan): bucket the net-worth trend by range instead of always by month

1m/3m now plot daily points, 6m one point per ISO week, longer ranges one per
month, so 1 Bulan no longer collapses to a single point and the empty state.
The empty state now says when the trend starts filling in.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Web — shared currency list in `hooks/currencies.ts`

**Files:**

- Create: `apps/web/src/hooks/currencies.ts`
- Create: `apps/web/src/hooks/currencies.test.ts`
- Modify: `apps/web/src/app/(app)/akun/page.tsx:17` (add import), `:1096-1109` (delete local `CurrencyCode` + `CURRENCIES`)

**Interfaces:**

- Consumes: nothing.
- Produces (from `@/hooks/currencies`):
  - `export type CurrencyCode = "IDR" | "USD" | "SGD" | "EUR" | "JPY" | "AUD" | "CNY";`
  - `export type ForeignCurrencyCode = Exclude<CurrencyCode, "IDR">;`
  - `export const CURRENCIES: readonly { code: CurrencyCode; flag: string }[]` (7 entries, IDR first)
  - `export const FOREIGN_CURRENCIES: readonly { code: ForeignCurrencyCode; flag: string }[]` (the other 6, same order)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/hooks/currencies.test.ts`:

```ts
/**
 * Revisi E — one currency list shared by /akun (profile preference) and
 * /ringkasan (display picker). Must match apps/api/src/fx/fx-mock.service.ts.
 */

import { en } from "@/i18n/en";
import { id } from "@/i18n/id";

import { CURRENCIES, FOREIGN_CURRENCIES } from "./currencies";

describe("CURRENCIES", () => {
  it("lists the 7 codes the FX table serves, IDR first", () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual([
      "IDR",
      "USD",
      "SGD",
      "EUR",
      "JPY",
      "AUD",
      "CNY",
    ]);
  });

  it("gives every code a distinct, non-empty flag", () => {
    const flags = CURRENCIES.map((c) => c.flag);
    expect(flags.every((f) => f.length > 0)).toBe(true);
    expect(new Set(flags).size).toBe(flags.length);
  });

  it("has a display name for every code in both locales", () => {
    const codes = CURRENCIES.map((c) => c.code).sort();
    expect(Object.keys(id.akun.pengaturan.currencies).sort()).toEqual(codes);
    expect(Object.keys(en.akun.pengaturan.currencies).sort()).toEqual(codes);
  });
});

describe("FOREIGN_CURRENCIES", () => {
  it("is every code except IDR, in the same order", () => {
    expect(FOREIGN_CURRENCIES.map((c) => c.code)).toEqual([
      "USD",
      "SGD",
      "EUR",
      "JPY",
      "AUD",
      "CNY",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/web`): `pnpm exec jest src/hooks/currencies.test.ts`
Expected: FAIL with `Cannot find module './currencies' from 'src/hooks/currencies.test.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/hooks/currencies.ts`:

```ts
// Structural only (code/flag); names resolve from `t.akun.pengaturan.currencies[code]`.
export type CurrencyCode =
  | "IDR"
  | "USD"
  | "SGD"
  | "EUR"
  | "JPY"
  | "AUD"
  | "CNY";

export type ForeignCurrencyCode = Exclude<CurrencyCode, "IDR">;

export const CURRENCIES: readonly { code: CurrencyCode; flag: string }[] = [
  { code: "IDR", flag: "🇮🇩" },
  { code: "USD", flag: "🇺🇸" },
  { code: "SGD", flag: "🇸🇬" },
  { code: "EUR", flag: "🇪🇺" },
  { code: "JPY", flag: "🇯🇵" },
  { code: "AUD", flag: "🇦🇺" },
  { code: "CNY", flag: "🇨🇳" },
];

export const FOREIGN_CURRENCIES: readonly {
  code: ForeignCurrencyCode;
  flag: string;
}[] = CURRENCIES.filter(
  (c): c is { code: ForeignCurrencyCode; flag: string } => c.code !== "IDR",
);
```

In `apps/web/src/app/(app)/akun/page.tsx`:

(a) After `import { FAMILY_RELIGION_OPTIONS } from "@/hooks/family-religion-options";` (`:17`), add:

```ts
import { CURRENCIES } from "@/hooks/currencies";
```

(b) Delete `:1096-1109`, i.e. the three comment lines starting `// Structural only (code/flag) — title/name resolve from`, the `type CurrencyCode = …;` line, and the whole `const CURRENCIES: { code: CurrencyCode; flag: string }[] = [ … ];` array. The render loop at `:1350` (`CURRENCIES.map((c) => …)`) is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/web`): `pnpm exec jest src/hooks/currencies.test.ts pengaturan-body`
Expected: PASS. The new suite (4 tests) passes, and `pengaturan-body.test.tsx` (including "should list all 5 supported currencies") still passes unchanged.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint src/hooks/currencies.ts src/hooks/currencies.test.ts "src/app/(app)/akun/page.tsx"`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/currencies.ts apps/web/src/hooks/currencies.test.ts "apps/web/src/app/(app)/akun/page.tsx"
git commit -m "$(cat <<'EOF'
refactor(web): share the supported currency list from hooks/currencies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Web — `DisplayCurrency` for every FX code in the hero stats + indicative note

**Files:**

- Create: `apps/web/src/app/(app)/ringkasan/_components/display-currency.ts`
- Create: `apps/web/src/app/(app)/ringkasan/_components/display-currency.test.ts`
- Modify: `apps/web/src/app/(app)/ringkasan/_components/hero-stats-section.tsx:7-35` (imports + FX query), `:48-60` (`money`)
- Modify: `apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx:16` (type moves out)
- Modify: `apps/web/src/app/(app)/ringkasan/page.tsx:44` (type import), `:62` (note currency), `:97-103` (note)

**Interfaces:**

- Consumes: `CurrencyCode`, `ForeignCurrencyCode` from `@/hooks/currencies` (Task 3); `formatRupiah(value, { code, rate })` from `@/lib/format` (read-only use).
- Produces (from `./display-currency`):
  - `export type DisplayCurrency = CurrencyCode | "GOLD";`
  - `export function isForeignCurrency(c: DisplayCurrency): c is ForeignCurrencyCode`
  - `export function formatInDisplayCurrency(value: number, displayCurrency: DisplayCurrency, ctx: { formatIdr: (v: number) => string; rates: Record<string, number> | undefined; gramPrice: number | null }): string`
  - `export function indicativeNoteCurrency(displayCurrency: DisplayCurrency, profileCurrency: string, profileIsIndicative: boolean): string | null`
  - Task 5 imports `DisplayCurrency` and `isForeignCurrency` from here.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/(app)/ringkasan/_components/display-currency.test.ts`:

```ts
/**
 * Revisi E — the Ringkasan picker used to convert only USD. Every FX code now
 * converts via /fx/rates, always prefixed "≈" (mock table, never live).
 * Rates below are the real values in apps/api/src/fx/fx-mock.service.ts.
 */

import {
  formatInDisplayCurrency,
  indicativeNoteCurrency,
  isForeignCurrency,
} from "./display-currency";

const RATES = {
  IDR: 1,
  USD: 0.000063,
  SGD: 0.000085,
  EUR: 0.000058,
  JPY: 0.0095,
  AUD: 0.000097,
  CNY: 0.000448,
};
const formatIdr = (v: number) => `IDR:${v}`;

describe("isForeignCurrency", () => {
  it("is true for the 6 FX codes and false for IDR and GOLD", () => {
    expect(isForeignCurrency("SGD")).toBe(true);
    expect(isForeignCurrency("CNY")).toBe(true);
    expect(isForeignCurrency("IDR")).toBe(false);
    expect(isForeignCurrency("GOLD")).toBe(false);
  });
});

describe("formatInDisplayCurrency", () => {
  it("IDR delegates to the page's own IDR formatter", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "IDR", {
        formatIdr,
        rates: RATES,
        gramPrice: null,
      }),
    ).toBe("IDR:1000000");
  });

  it("converts JPY with its 0-decimal format and the indicative ≈ prefix", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "JPY", {
        formatIdr,
        rates: RATES,
        gramPrice: null,
      }),
    ).toBe("≈ ¥ 9,500");
  });

  it("converts EUR with 2 decimals", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "EUR", {
        formatIdr,
        rates: RATES,
        gramPrice: null,
      }),
    ).toBe("≈ € 58.00");
  });

  it("shows the loading placeholder while rates are unavailable", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "SGD", {
        formatIdr,
        rates: undefined,
        gramPrice: null,
      }),
    ).toBe("...");
  });

  it("shows the loading placeholder when the chosen code is missing from the rate table", () => {
    expect(
      formatInDisplayCurrency(1_000_000, "AUD", {
        formatIdr,
        rates: { IDR: 1, USD: 0.000063 },
        gramPrice: null,
      }),
    ).toBe("...");
  });

  it("GOLD divides by the family's price per gram", () => {
    expect(
      formatInDisplayCurrency(2_500_000, "GOLD", {
        formatIdr,
        rates: undefined,
        gramPrice: 1_000_000,
      }),
    ).toBe("2,5 gr");
  });

  it("GOLD without a price shows the loading placeholder", () => {
    expect(
      formatInDisplayCurrency(2_500_000, "GOLD", {
        formatIdr,
        rates: undefined,
        gramPrice: null,
      }),
    ).toBe("...");
  });
});

describe("indicativeNoteCurrency", () => {
  it("names the picked foreign currency even when the profile is on IDR", () => {
    expect(indicativeNoteCurrency("SGD", "IDR", false)).toBe("SGD");
  });

  it("falls back to the profile currency when the picker is on IDR", () => {
    expect(indicativeNoteCurrency("IDR", "USD", true)).toBe("USD");
  });

  it("is null for IDR on an IDR profile", () => {
    expect(indicativeNoteCurrency("IDR", "IDR", false)).toBeNull();
  });

  it("is null for GOLD on an IDR profile (gold is not an FX conversion)", () => {
    expect(indicativeNoteCurrency("GOLD", "IDR", false)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/ringkasan/_components/display-currency"`
Expected: FAIL with `Cannot find module './display-currency' from 'src/app/(app)/ringkasan/_components/display-currency.test.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/app/(app)/ringkasan/_components/display-currency.ts`:

```ts
import { formatRupiah } from "@/lib/format";
import type { CurrencyCode, ForeignCurrencyCode } from "@/hooks/currencies";

export type DisplayCurrency = CurrencyCode | "GOLD";

export function isForeignCurrency(
  c: DisplayCurrency,
): c is ForeignCurrencyCode {
  return c !== "IDR" && c !== "GOLD";
}

export function formatInDisplayCurrency(
  value: number,
  displayCurrency: DisplayCurrency,
  ctx: {
    formatIdr: (v: number) => string;
    rates: Record<string, number> | undefined;
    gramPrice: number | null;
  },
): string {
  if (displayCurrency === "IDR") return ctx.formatIdr(value);
  if (displayCurrency === "GOLD") {
    return ctx.gramPrice
      ? `${(value / ctx.gramPrice).toLocaleString("id-ID", { maximumFractionDigits: 2 })} gr`
      : "...";
  }
  const rate = ctx.rates?.[displayCurrency];
  return rate
    ? `≈ ${formatRupiah(value, { code: displayCurrency, rate })}`
    : "...";
}

export function indicativeNoteCurrency(
  displayCurrency: DisplayCurrency,
  profileCurrency: string,
  profileIsIndicative: boolean,
): string | null {
  if (isForeignCurrency(displayCurrency)) return displayCurrency;
  return profileIsIndicative ? profileCurrency : null;
}
```

In `apps/web/src/app/(app)/ringkasan/_components/hero-stats-section.tsx`:

(a) Replace `import type { DisplayCurrency } from "./page-lead";` (`:12`) with:

```ts
import {
  formatInDisplayCurrency,
  isForeignCurrency,
  type DisplayCurrency,
} from "./display-currency";
```

(b) Replace `:24-35` (the EPIC-033 comment through `const gramPrice = …;`) with:

```ts
// Same FX cache key as ConsolidatedTotalCard; gold uses the family's own price per gram.
const { data: fx } = useQuery<FxRatesResponse>({
  queryKey: ["fx", "rates", "IDR"],
  queryFn: () => apiFetch<FxRatesResponse>("/fx/rates?base=IDR"),
  staleTime: 5 * 60_000,
  enabled: isForeignCurrency(displayCurrency),
});
const { pricePerGram } = useGoldPrice();
const gramPrice = pricePerGram ? Number(pricePerGram) : null;
```

(c) Replace the `money` function (`:48-60`) with:

```ts
const money = (v: number) =>
  formatInDisplayCurrency(v, displayCurrency, {
    formatIdr: moneyIdr,
    rates: fx?.rates,
    gramPrice,
  });
```

In `apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx`, replace `:16` (`export type DisplayCurrency = "IDR" | "USD" | "GOLD";`) with:

```ts
import type { DisplayCurrency } from "./display-currency";
```

(Move this line up so it sits with the other imports, directly after `import type { TrendCustomRange, TrendRangeKey } from "./use-ringkasan-data";`. The `currencies` array at `:53-57` still compiles, because `"USD"` is a `CurrencyCode`. Task 5 replaces it.)

In `apps/web/src/app/(app)/ringkasan/page.tsx`:

(a) Replace `import type { DisplayCurrency } from "./_components/page-lead";` (`:44`) with:

```ts
import {
  indicativeNoteCurrency,
  type DisplayCurrency,
} from "./_components/display-currency";
```

(b) After `const data = useRingkasanData(trendRange, customRange);` (`:62`), add:

```ts
const noteCurrency = indicativeNoteCurrency(
  displayCurrency,
  data.currency,
  data.isIndicative,
);
```

(c) Replace the note block (`:97-103`) with:

```tsx
{
  noteCurrency && (
    <div className="t-xs t-muted">
      {t.ringkasan.indicativeFxNotePrefix}
      {noteCurrency}
      {t.ringkasan.indicativeFxNoteSuffix}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/ringkasan"`
Expected: PASS. The `display-currency` suite (12 tests) and the Task 2 `history-buckets` suite are green.

- [ ] **Step 5: Type-check the touched files**

Run (from `apps/web`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0. There is no `next build`; this is the only whole-app check, and it catches a stale `DisplayCurrency` import.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/ringkasan/_components/display-currency.ts" "src/app/(app)/ringkasan/_components/display-currency.test.ts" "src/app/(app)/ringkasan/_components/hero-stats-section.tsx" "src/app/(app)/ringkasan/_components/page-lead.tsx" "src/app/(app)/ringkasan/page.tsx"`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/ringkasan/_components/display-currency.ts" "apps/web/src/app/(app)/ringkasan/_components/display-currency.test.ts" "apps/web/src/app/(app)/ringkasan/_components/hero-stats-section.tsx" "apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx" "apps/web/src/app/(app)/ringkasan/page.tsx"
git commit -m "$(cat <<'EOF'
feat(ringkasan): convert headline figures into any supported FX currency

Hero stats convert with fx.rates[code] for every non-IDR code (not just USD),
prefix "≈", and the indicative-rate note names the picked currency.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Web — `IDR | Emas | <currency ▾>` picker in the page lead

**Files:**

- Modify: `apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx:11-14` (imports), `:53-57` (`currencies`), `:70-87` (currency control)
- Create: `apps/web/src/app/(app)/ringkasan/_components/page-lead.test.tsx`
- Modify: `apps/web/src/i18n/types.ts:2193`, `apps/web/src/i18n/id.ts:2387`, `apps/web/src/i18n/en.ts:2341` (replace `currencyUsd` with two new keys)

**Interfaces:**

- Consumes: `FOREIGN_CURRENCIES` from `@/hooks/currencies` (Task 3); `DisplayCurrency` and `isForeignCurrency` from `./display-currency` (Task 4).
- Produces: `RingkasanPageLead`'s props are unchanged. It calls `onDisplayCurrencyChange` with `"IDR"`, `"GOLD"`, or any `ForeignCurrencyCode`. New i18n keys: `ringkasan.currencyForeignAriaLabel`, `ringkasan.currencyForeignPlaceholder`. Removed key: `ringkasan.currencyUsd` (its only reader was `page-lead.tsx:55`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/(app)/ringkasan/_components/page-lead.test.tsx`:

```tsx
/**
 * Revisi E — the display-currency picker offers IDR, Emas and a select of
 * every foreign FX code (with flags). Default locale is "id".
 */

import { fireEvent, render, screen, within } from "@testing-library/react";

import { RingkasanPageLead } from "./page-lead";
import type { DisplayCurrency } from "./display-currency";

function renderLead(displayCurrency: DisplayCurrency) {
  const onDisplayCurrencyChange = jest.fn();
  render(
    <RingkasanPageLead
      familyName="Keluarga Demo"
      todayLabel="25 September 2026"
      trendRange="12m"
      onTrendRangeChange={jest.fn()}
      customRange={{ from: "2026-06-25", to: "2026-09-25" }}
      onCustomRangeChange={jest.fn()}
      displayCurrency={displayCurrency}
      onDisplayCurrencyChange={onDisplayCurrencyChange}
      privacyOn={false}
      onTogglePrivacy={jest.fn()}
    />,
  );
  const select = screen.getByRole("combobox", {
    name: "Mata uang asing",
  }) as HTMLSelectElement;
  return { onDisplayCurrencyChange, select };
}

describe("RingkasanPageLead — display currency picker", () => {
  it("offers IDR, Emas and every foreign FX currency with its flag", () => {
    const { select } = renderLead("IDR");

    expect(screen.getByRole("tab", { name: "IDR" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Emas" })).toBeInTheDocument();
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["🇺🇸 USD", "🇸🇬 SGD", "🇪🇺 EUR", "🇯🇵 JPY", "🇦🇺 AUD", "🇨🇳 CNY"]);
  });

  it("picking a foreign currency switches the display currency", () => {
    const { onDisplayCurrencyChange, select } = renderLead("IDR");

    fireEvent.change(select, { target: { value: "JPY" } });

    expect(onDisplayCurrencyChange).toHaveBeenCalledWith("JPY");
  });

  it("an idle select shows the placeholder, so re-picking USD from Emas still fires", () => {
    const { onDisplayCurrencyChange, select } = renderLead("GOLD");
    expect(select.value).toBe("");

    fireEvent.change(select, { target: { value: "USD" } });

    expect(onDisplayCurrencyChange).toHaveBeenCalledWith("USD");
  });

  it("a foreign selection shows in the select and deselects IDR/Emas", () => {
    const { select } = renderLead("EUR");

    expect(select.value).toBe("EUR");
    expect(screen.getByRole("tab", { name: "IDR" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByRole("tab", { name: "Emas" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("clicking Emas selects GOLD", () => {
    const { onDisplayCurrencyChange } = renderLead("IDR");

    fireEvent.click(screen.getByRole("tab", { name: "Emas" }));

    expect(onDisplayCurrencyChange).toHaveBeenCalledWith("GOLD");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/ringkasan/_components/page-lead"`
Expected: FAIL. Every test reports `Unable to find an accessible element with the role "combobox" and name "Mata uang asing"`.

- [ ] **Step 3: Write minimal implementation**

i18n: in `apps/web/src/i18n/types.ts`, replace `currencyUsd: string;` (`:2193`) with:

```ts
currencyForeignAriaLabel: string;
currencyForeignPlaceholder: string;
```

In `apps/web/src/i18n/id.ts`, replace `currencyUsd: "USD",` (`:2387`) with:

```ts
    currencyForeignAriaLabel: "Mata uang asing",
    currencyForeignPlaceholder: "Valas",
```

In `apps/web/src/i18n/en.ts`, replace `currencyUsd: "USD",` (`:2341`) with:

```ts
    currencyForeignAriaLabel: "Foreign currency",
    currencyForeignPlaceholder: "FX",
```

In `apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx`:

(a) Change the imports (`:11-14`, plus the `DisplayCurrency` import Task 4 added) to:

```ts
import { Eye, EyeOff } from "lucide-react";

import { FOREIGN_CURRENCIES } from "@/hooks/currencies";
import { useLocale } from "@/hooks/use-locale";
import { isForeignCurrency, type DisplayCurrency } from "./display-currency";
import type { TrendCustomRange, TrendRangeKey } from "./use-ringkasan-data";

// design-system.css styles the active segment via [aria-selected], which a <select> cannot carry.
const ACTIVE_SEGMENT_STYLE = {
  background: "var(--card)",
  color: "var(--foreground)",
  boxShadow: "var(--shadow-card)",
} as const;
```

(b) Replace the `currencies` array (`:53-57`) with:

```ts
const fixedCurrencies: { key: "IDR" | "GOLD"; label: string }[] = [
  { key: "IDR", label: t.ringkasan.currencyIdr },
  { key: "GOLD", label: t.ringkasan.currencyGold },
];
const foreignSelected = isForeignCurrency(displayCurrency);
```

(c) Replace the currency `tablist` div (`:70-87`) with:

```tsx
<div
  role="group"
  aria-label={t.ringkasan.currencyGroupAriaLabel}
  className="segmented"
>
  <div
    role="tablist"
    aria-label={t.ringkasan.currencyGroupAriaLabel}
    className="contents"
  >
    {fixedCurrencies.map((c) => (
      <button
        key={c.key}
        type="button"
        role="tab"
        aria-selected={displayCurrency === c.key}
        onClick={() => onDisplayCurrencyChange(c.key)}
        className="segmented__item"
      >
        {c.label}
      </button>
    ))}
  </div>
  <select
    aria-label={t.ringkasan.currencyForeignAriaLabel}
    className="segmented__item"
    style={foreignSelected ? ACTIVE_SEGMENT_STYLE : undefined}
    value={foreignSelected ? displayCurrency : ""}
    onChange={(e) => {
      const next = FOREIGN_CURRENCIES.find((c) => c.code === e.target.value);
      if (next) onDisplayCurrencyChange(next.code);
    }}
  >
    <option value="" disabled hidden>
      {t.ringkasan.currencyForeignPlaceholder}
    </option>
    {FOREIGN_CURRENCIES.map((c) => (
      <option key={c.code} value={c.code}>
        {`${c.flag} ${c.code}`}
      </option>
    ))}
  </select>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/ringkasan" src/i18n/dictionary.test.ts`
Expected: PASS. The `page-lead` suite (5 tests), the `display-currency` and `history-buckets` suites, and the i18n parity suite are all green.

- [ ] **Step 5: Type-check**

Run (from `apps/web`): `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: exit 0. Any leftover `t.ringkasan.currencyUsd` reader would fail here.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/ringkasan/_components/page-lead.tsx" "src/app/(app)/ringkasan/_components/page-lead.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/ringkasan/_components/page-lead.tsx" "apps/web/src/app/(app)/ringkasan/_components/page-lead.test.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(ringkasan): pick any supported currency from an IDR | Emas | currency picker

The third segment is a native select of the 6 foreign FX codes with flags;
an idle placeholder makes re-picking the same code still fire.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```
