# Revisi H — Master Data Wiring + IAM Add-Member Access Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Master Data do what its dialog promises: drop the four reference groups that only duplicate Prisma enums, feed `bank` / `ewallet` / `lembaga` into the real Rekening, E-Wallet and Donasi selects (with a "+ Tambah ke Master Data" shortcut), and let the IAM add-member dialog assign a custom access role ("Sopir") at creation, with the three member concepts named apart and explained.

**Architecture:** One web hook, `useReferenceItems(group?)`, owns the reference-items query under a single key (`["reference-items", familyGroupId]`) that Master Data invalidates, so every consumer refreshes. `CrudModal` gains a `referenceGroup` field option in `crud-config.ts`; the modal merges Master Data labels with the field's static options (static list = fallback + "Lainnya" catch-all), so the Rekening/E-Wallet forms on `/rekening`, `/dana`, `/akun` and `/quickinput` all pick it up at once. Donasi uses the same hook. The seed is pruned in `packages/contracts` (`buildReferenceItemSeed`), which both the API seed/registration and the web Better-Auth hook already call. IAM needs no API change: `POST …/members/dependant` already returns the Member row `id`, so the dialog follows it with the existing `PUT …/members/:memberId/access`.

**Tech Stack:** Next.js 16 App Router + React 19 + TanStack Query v5 + Jest + Testing Library (web); NestJS 10 + Jest (API); `@wealthme/contracts` built with tsup (its `dist/` is committed); pnpm workspace.

**Spec:** `docs/superpowers/plans/2026-09-25-revisi-besar-catalog.md` — items 16 and 17.

## Global Constraints

- Work only inside the worktree `/home/stealth/Projects/wealthme-web-revisi-ab` on branch `feat/revisi-ab-calculators-quickfixes`.
- Never edit protected files: `apps/web/src/app/globals.css`, `apps/web/src/app/design-system.css`, `apps/web/src/lib/*`, `apps/web/src/components/ui/*`, `apps/web/src/components/wm/*`, `apps/web/src/components/charts/*`, `apps/web/src/components/shell/*`, `apps/web/src/app/layout.tsx`, `packages/config/*`.
- Every new user-visible string goes into **all three** of `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts` (dictionaries use `satisfies I18nDictionary`).
- Controllers keep the repo convention for DTO classes consumed by `@Body()`: a value import preceded by `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`.
- Run tests locally only as the focused jest commands each task names (from `apps/api` or `apps/web`). No `next build`, no full `turbo` runs.
- Lint every file you touch: `pnpm exec eslint <files>` from the owning app dir must exit 0.
- Commit messages: Conventional Commits, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Code comments: none unless the WHY is non-obvious; one line max.
- The husky post-commit hook prints "post-commit script failed (code 1)" (graphify); the commit still lands. Never use `--no-verify`.
- Plan-specific: no Prisma migration. The `ReferenceItemGroup` Prisma enum and the Zod `ReferenceItemGroupSchema` keep all seven values; existing `txntype`/`invtype`/`asettype`/`instype` rows stay in the database and are simply no longer shown or seeded.
- Plan-specific: `packages/contracts/dist/` is tracked in git and is what both apps' jest resolve. After editing `packages/contracts/src`, run `pnpm --filter @wealthme/contracts build` from the repo root and commit `packages/contracts/dist` in the same commit. Contracts has no eslint setup; lint is not required for its files.

## Review Focus

1. **Stored value no longer in Master Data** — editing an account whose `institution` is not in the family's bank list (e.g. "Bank Tes MD", or a legacy "Jenius") must keep that value selected and send it back unchanged, not silently rewrite it to "Bank Lainnya". Pinned in Task 1 (`mergeReferenceOptions` keeps `current`) and Task 4 (rekening edit test).
2. **Reference-items request fails, is slow, or returns a non-array** — the Rekening/E-Wallet/Donasi selects must still offer today's built-in options instead of an empty select or a crash. Pinned in Task 1 (hook non-array test) and Task 4 (crud-modal failed-request test).
3. **Member without `manage` on Master Data** — must not see "+ Tambah ke Master Data" (it would open a page with no add button). Pinned in Task 3 (link test) and Task 4 (crud-modal dependant test).
4. **Access-role assignment fails after the member was created** — the member exists; the dialog must close (so a retry does not create a duplicate) and say the role still needs to be set via "Atur Akses". Pinned in Task 6.
5. **Istri (Co-Master) with a custom access role** — Co-Master means full access; the "Hak akses" select must be disabled and no `PUT …/access` sent. Pinned in Task 6.

---

### Task 1: `useReferenceItems` hook + option merge helper; Master Data page on the shared key

**Files:**

- Create: `apps/web/src/hooks/use-reference-items.ts`
- Create: `apps/web/src/hooks/use-reference-items.test.tsx`
- Create: `apps/web/src/hooks/reference-options.ts`
- Create: `apps/web/src/hooks/reference-options.test.ts`
- Modify: `apps/web/src/app/(app)/masterdata/page.tsx` (imports `:3-25`; query `:107-122`; invalidations `:264-266`, `:287-289`; `referenceItemList` `:338`)
- Test: `apps/web/src/app/(app)/masterdata/masterdata.test.tsx`

**Interfaces:**

- Consumes: `apiFetch<T>(path: string, options?: RequestInit & { token?: string }): Promise<T>` (`@/lib/api-client`); `useSession()` from `@/lib/auth-compat` (returns `{ data: { accessToken, familyGroupId } | null }`); `ReferenceItemDto`, `ReferenceItemGroup` from `@wealthme/contracts`.
- Produces (later tasks rely on these exact names):
  - `referenceItemsQueryKey(familyGroupId: string): readonly ["reference-items", string]`
  - `useReferenceItems(group?: ReferenceItemGroup, opts?: { enabled?: boolean }): { items: ReferenceItemDto[]; isLoading: boolean }` — one fetch of `GET /family-groups/:id/reference-items` per family, filtered client-side by `group`; non-array responses yield `[]`.
  - `mergeReferenceOptions(labels: readonly string[], fallback: readonly string[], current?: string): string[]` — Master Data labels, then `current` if missing, then the fallback's leftovers, de-duplicated in that order.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/hooks/reference-options.test.ts`:

```ts
import { mergeReferenceOptions } from "./reference-options";

describe("mergeReferenceOptions", () => {
  it("lists Master Data labels first, then the static leftovers, without duplicates", () => {
    expect(
      mergeReferenceOptions(
        ["BCA", "Mandiri", "Bank Tes MD"],
        ["BCA", "Mandiri", "BRI", "Bank Lainnya"],
      ),
    ).toEqual(["BCA", "Mandiri", "Bank Tes MD", "BRI", "Bank Lainnya"]);
  });

  it("keeps a stored value that is in neither list selectable", () => {
    expect(mergeReferenceOptions(["BCA"], ["Bank Lainnya"], "Jenius")).toEqual([
      "BCA",
      "Jenius",
      "Bank Lainnya",
    ]);
  });

  it("falls back to the static list when Master Data returned nothing", () => {
    expect(mergeReferenceOptions([], ["GoPay", "OVO"], "GoPay")).toEqual([
      "GoPay",
      "OVO",
    ]);
  });

  it("ignores an empty current value", () => {
    expect(mergeReferenceOptions(["BCA"], [], "")).toEqual(["BCA"]);
  });
});
```

Create `apps/web/src/hooks/use-reference-items.test.tsx`:

```tsx
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReferenceItemDto } from "@wealthme/contracts";

const mockUseSessionAuth = jest.fn();
jest.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import {
  referenceItemsQueryKey,
  useReferenceItems,
} from "./use-reference-items";

const FG = "fg-1";

function item(
  id: string,
  group: ReferenceItemDto["group"],
  label: string,
): ReferenceItemDto {
  return {
    id,
    familyGroupId: FG,
    group,
    label,
    sortOrder: 0,
    isSystem: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: "test-token", familyGroupId: FG },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
});

describe("useReferenceItems", () => {
  it("fetches the family's items once and narrows to the requested group", async () => {
    mockApiFetch.mockResolvedValue([
      item("b1", "bank", "BCA"),
      item("e1", "ewallet", "GoPay"),
      item("b2", "bank", "Bank Tes MD"),
    ]);

    const { result } = renderHook(() => useReferenceItems("bank"), {
      wrapper,
    });

    await waitFor(() =>
      expect(result.current.items.map((i) => i.label)).toEqual([
        "BCA",
        "Bank Tes MD",
      ]),
    );
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      `/family-groups/${FG}/reference-items`,
      expect.objectContaining({ token: "test-token" }),
    );
  });

  it("returns every group when no group is given", async () => {
    mockApiFetch.mockResolvedValue([
      item("b1", "bank", "BCA"),
      item("l1", "lembaga", "BAZNAS"),
    ]);

    const { result } = renderHook(() => useReferenceItems(), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(
      () => useReferenceItems("bank", { enabled: false }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("treats a non-array response as no items instead of crashing", async () => {
    mockApiFetch.mockResolvedValue({});

    const { result } = renderHook(() => useReferenceItems("bank"), {
      wrapper,
    });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it("refetches when the shared key is invalidated (Master Data add reaches every form)", async () => {
    mockApiFetch
      .mockResolvedValueOnce([item("b1", "bank", "BCA")])
      .mockResolvedValueOnce([
        item("b1", "bank", "BCA"),
        item("b2", "bank", "Bank Tes MD"),
      ]);

    const { result } = renderHook(() => useReferenceItems("bank"), {
      wrapper,
    });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: referenceItemsQueryKey(FG),
      });
    });

    await waitFor(() =>
      expect(result.current.items.map((i) => i.label)).toEqual([
        "BCA",
        "Bank Tes MD",
      ]),
    );
  });

  it("keys the cache per family group", () => {
    expect(referenceItemsQueryKey(FG)).toEqual(["reference-items", FG]);
  });
});
```

In `apps/web/src/app/(app)/masterdata/masterdata.test.tsx`, add below the existing `import MasterDataPage from "./page";` line:

```tsx
import { useReferenceItems } from "../../../hooks/use-reference-items";
```

and append this `describe` at the end of the file:

```tsx
describe("MasterDataPage, a new item reaches every form reading the same group (Revisi H)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();

    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
  });

  function BankProbe() {
    const { items } = useReferenceItems("bank");
    return (
      <ul aria-label="bank-probe">
        {items.map((i) => (
          <li key={i.id}>{i.label}</li>
        ))}
      </ul>
    );
  }

  it("adding a bank in Master Data refreshes a form-side useReferenceItems('bank') consumer", async () => {
    let list: ReferenceItemDto[] = [
      buildReferenceItem({ id: "ref-bca", label: "BCA" }),
    ];
    mockApiFetch.mockImplementation((path: string, options?: RequestInit) => {
      if (path.includes("/coa-accounts")) return Promise.resolve([]);
      if (path.endsWith("/access/me")) {
        return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
      }
      if (path.endsWith("/family-groups/mine")) {
        return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
      }
      if (path.includes("/reference-items")) {
        if (options?.method === "POST") {
          const body = JSON.parse(String(options.body)) as {
            group: ReferenceItemDto["group"];
            label: string;
          };
          const created = buildReferenceItem({
            id: "ref-new",
            group: body.group,
            label: body.label,
            isSystem: false,
          });
          list = [...list, created];
          return Promise.resolve(created);
        }
        return Promise.resolve(list);
      }
      return Promise.resolve([]);
    });
    const user = userEvent.setup();
    render(
      <>
        <MasterDataPage />
        <BankProbe />
      </>,
    );

    const probe = await screen.findByRole("list", { name: "bank-probe" });
    await within(probe).findByText("BCA");

    const addButtons = await screen.findAllByRole("button", {
      name: "+ Tambah",
    });
    await user.click(addButtons[1]);
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByPlaceholderText("cth: Bank Jago"),
      "Bank Tes MD",
    );
    await user.click(within(dialog).getByRole("button", { name: /Simpan/i }));

    expect(await within(probe).findByText("Bank Tes MD")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/hooks/reference-options src/hooks/use-reference-items "src/app/\(app\)/masterdata"`
Expected: FAIL — all three suites report `Cannot find module './reference-options'` / `'./use-reference-items'` / `'../../../hooks/use-reference-items'`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/hooks/reference-options.ts`:

```ts
/** Master Data labels first, then a stored value no longer listed, then the static list's leftovers (keeps "Lainnya"). */
export function mergeReferenceOptions(
  labels: readonly string[],
  fallback: readonly string[],
  current?: string,
): string[] {
  return Array.from(
    new Set([...labels, ...(current ? [current] : []), ...fallback]),
  );
}
```

Create `apps/web/src/hooks/use-reference-items.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReferenceItemDto, ReferenceItemGroup } from "@wealthme/contracts";

import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/lib/auth-compat";

// Not in lib/query-keys.ts (protected); Master Data invalidates this same key so every form refreshes.
export const referenceItemsQueryKey = (familyGroupId: string) =>
  ["reference-items", familyGroupId] as const;

export function useReferenceItems(
  group?: ReferenceItemGroup,
  { enabled = true }: { enabled?: boolean } = {},
): { items: ReferenceItemDto[]; isLoading: boolean } {
  const { data: session } = useSession();
  const token = session?.accessToken;
  const familyGroupId = session?.familyGroupId ?? "";

  const { data, isLoading } = useQuery<ReferenceItemDto[]>({
    queryKey: referenceItemsQueryKey(familyGroupId),
    queryFn: ({ signal }) =>
      apiFetch<ReferenceItemDto[]>(
        `/family-groups/${familyGroupId}/reference-items`,
        { token, signal },
      ),
    enabled: enabled && Boolean(token) && Boolean(familyGroupId),
    staleTime: 60_000,
    // "+ Tambah ke Master Data" opens a new tab; refresh the list when the user comes back.
    refetchOnWindowFocus: "always",
  });

  const all = Array.isArray(data) ? data : [];
  return {
    items: group ? all.filter((i) => i.group === group) : all,
    isLoading,
  };
}
```

In `apps/web/src/app/(app)/masterdata/page.tsx`:

1. Add after the `import { useCanManage } from "@/hooks/use-role-permissions";` line:

```tsx
import {
  referenceItemsQueryKey,
  useReferenceItems,
} from "@/hooks/use-reference-items";
```

2. Replace the whole block at `:107-122` (the comment "EPIC-024 Task J — the seven reference lists…", `const referenceItemsQueryKey = …`, and the `useQuery<ReferenceItemDto[]>` call) with:

```tsx
const { items: referenceItemList, isLoading: isReferenceItemsLoading } =
  useReferenceItems();
```

3. In `handleReferenceItemCreate` (`:264-266`) and `handleReferenceItemDelete` (`:287-289`), change `queryKey: referenceItemsQueryKey,` to:

```tsx
        queryKey: referenceItemsQueryKey(familyGroupId),
```

4. Delete the line `const referenceItemList = referenceItems ?? [];` (`:338`).

`useQuery` stays imported (categories and COA still use it); `ReferenceItemDto` stays imported (`pendingDelete`).

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/hooks/reference-options src/hooks/use-reference-items "src/app/\(app\)/masterdata"`
Expected: PASS — 4 + 6 new hook/helper tests, the new masterdata probe test, and every pre-existing `masterdata.test.tsx` test green.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint src/hooks/reference-options.ts src/hooks/reference-options.test.ts src/hooks/use-reference-items.ts src/hooks/use-reference-items.test.tsx "src/app/(app)/masterdata/page.tsx" "src/app/(app)/masterdata/masterdata.test.tsx"`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/reference-options.ts apps/web/src/hooks/reference-options.test.ts apps/web/src/hooks/use-reference-items.ts apps/web/src/hooks/use-reference-items.test.tsx "apps/web/src/app/(app)/masterdata/page.tsx" "apps/web/src/app/(app)/masterdata/masterdata.test.tsx"
git commit -m "$(cat <<'EOF'
feat(masterdata): share one reference-items query via useReferenceItems

Master Data now reads and invalidates the same key any form will use, so a
new bank/e-wallet/lembaga reaches every consumer without a reload.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Drop the four enum-duplicate groups (seed, Master Data UI, i18n, CRUD config)

**Files:**

- Modify: `packages/contracts/src/reference-items/index.ts` (after `:24`; `REFERENCE_ITEM_DEFAULTS` `:50-60`; `buildReferenceItemSeed` `:75-82`)
- Modify (generated): `packages/contracts/dist/*`
- Test: `apps/api/src/auth/auth.service.spec.ts` (inside `describe("register()", …)`, `:107-181`)
- Modify: `apps/web/src/app/(app)/masterdata/page.tsx` (`:8-12` imports, `:27-47` group list, `:466` comment)
- Modify: `apps/web/src/components/crud/crud-config.ts` (union `:68-84`; comment `:347-351`; `mdtxntype` `:363-372`, `mdinvtype` `:411-420`, `mdasettype` `:422-431`, `mdinstype` `:444-453`)
- Modify: `apps/web/src/i18n/types.ts:213-220`, `apps/web/src/i18n/id.ts:2013-2021,2035-2036`, `apps/web/src/i18n/en.ts:1976-1984,1998-1999`
- Test: `apps/web/src/app/(app)/masterdata/masterdata.test.tsx`

**Interfaces:**

- Consumes: Task 1's page state (`referenceItemList`).
- Produces: `ACTIVE_REFERENCE_ITEM_GROUPS: readonly ["bank", "ewallet", "lembaga"]` and `type ActiveReferenceItemGroup = "bank" | "ewallet" | "lembaga"` exported from `@wealthme/contracts`; `buildReferenceItemSeed()` emits only those groups. `CrudEntity` no longer contains `mdtxntype | mdinvtype | mdasettype | mdinstype`. Task 3 relies on the page's `REFERENCE_GROUP_ENTITIES` containing exactly bank, ewallet, lembaga.

- [ ] **Step 1: Write the failing tests**

(a) `apps/api/src/auth/auth.service.spec.ts` — add inside `describe("register()", () => { … })`, after the "never creates an 'Akun Utama' account" test:

```ts
it("seeds only the bank, e-wallet and lembaga reference lists (Revisi H)", async () => {
  mockPrisma.user.findUnique.mockResolvedValue(null);
  mockPrisma.user.create.mockResolvedValue({
    id: "user-1",
    email: "user@example.com",
    name: "Jane Doe",
  });
  mockJwt.sign
    .mockReturnValueOnce("access-token")
    .mockReturnValueOnce("refresh-token");
  mockRedis.set.mockResolvedValue(undefined);

  await service.register({
    email: "user@example.com",
    password: "strongPass123",
    name: "Jane Doe",
  });

  const [[arg]] = mockPrisma.referenceItem.createMany.mock.calls as [
    [{ data: { group: string; isSystem: boolean }[] }],
  ];
  expect(new Set(arg.data.map((d) => d.group))).toEqual(
    new Set(["bank", "ewallet", "lembaga"]),
  );
  expect(arg.data.every((d) => d.isSystem)).toBe(true);
});
```

(b) `apps/web/src/app/(app)/masterdata/masterdata.test.tsx` — add inside the existing `describe("MasterDataPage, reference items are real API-backed data (EPIC-024 Task J)", …)` (it reuses that block's `stubApiFetch`):

```tsx
it("shows only Bank, E-Wallet and Lembaga Donasi; enum-duplicate groups and their old rows are gone (Revisi H)", async () => {
  stubApiFetch([
    buildReferenceItem({ id: "r-bank", group: "bank", label: "BCA" }),
    buildReferenceItem({
      id: "r-txn",
      group: "txntype",
      label: "Kartu Kredit",
    }),
    buildReferenceItem({ id: "r-inv", group: "invtype", label: "Crypto" }),
    buildReferenceItem({
      id: "r-lem",
      group: "lembaga",
      label: "BAZNAS",
    }),
  ]);
  render(<MasterDataPage />);

  await screen.findByText("BAZNAS");
  expect(screen.getByText("Lembaga Donasi")).toBeInTheDocument();
  expect(screen.getByText("E-Wallet")).toBeInTheDocument();
  expect(screen.queryByText("Kartu Kredit")).not.toBeInTheDocument();
  expect(screen.queryByText("Crypto")).not.toBeInTheDocument();
  for (const title of [
    /Jenis Transaksi/,
    /Jenis Investasi/,
    /Kategori Aset/,
    /Jenis Asuransi/,
  ]) {
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/api`): `pnpm exec jest src/auth/auth.service.spec.ts -t "reference lists"`
Expected: FAIL — the received Set also contains `txntype`, `invtype`, `asettype`, `instype`.

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/masterdata" -t "enum-duplicate"`
Expected: FAIL — "Kartu Kredit" and the "↕ Jenis Transaksi" card are rendered.

- [ ] **Step 3: Prune the seed in contracts and rebuild**

In `packages/contracts/src/reference-items/index.ts`, directly after `export type ReferenceItemGroup = z.infer<typeof ReferenceItemGroupSchema>;` add:

```ts
// txntype/invtype/asettype/instype duplicate Prisma enums; they stay in the schema only so existing rows parse.
export const ACTIVE_REFERENCE_ITEM_GROUPS = [
  "bank",
  "ewallet",
  "lembaga",
] as const satisfies readonly ReferenceItemGroup[];
export type ActiveReferenceItemGroup =
  (typeof ACTIVE_REFERENCE_ITEM_GROUPS)[number];
```

Replace the `REFERENCE_ITEM_DEFAULTS` declaration (`:50-60`) with:

```ts
export const REFERENCE_ITEM_DEFAULTS: Record<
  ActiveReferenceItemGroup,
  readonly string[]
> = {
  bank: ["BCA", "Mandiri", "BRI", "BNI", "CIMB", "OCBC"],
  ewallet: ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"],
  lembaga: ["BAZNAS", "Dompet Dhuafa", "Gereja / Paroki", "Pura / Vihara"],
};
```

Replace the body of `buildReferenceItemSeed` (`:75-82`) with:

```ts
export function buildReferenceItemSeed(): ReferenceItemSeedEntry[] {
  return ACTIVE_REFERENCE_ITEM_GROUPS.flatMap((group) =>
    REFERENCE_ITEM_DEFAULTS[group].map((label, index) => ({
      group,
      label,
      sortOrder: index,
    })),
  );
}
```

Run (from the repo root): `pnpm --filter @wealthme/contracts build`
Expected: tsup prints `Build success` for ESM, CJS and DTS; `git status --short packages/contracts/dist` lists the four dist files as modified.

- [ ] **Step 4: Prune the web UI, CRUD config and i18n**

`apps/web/src/app/(app)/masterdata/page.tsx`:

1. Change the contracts type import (`:8-12`) to:

```tsx
import type {
  ActiveReferenceItemGroup,
  CategoryDto,
  ReferenceItemDto,
  ReferenceItemGroup,
} from "@wealthme/contracts";
```

2. Replace `:27-47` (the two comment blocks and `REFERENCE_GROUP_ENTITIES`) with:

```tsx
// Only the lists that feed real form selects (Rekening, E-Wallet, Donasi); order = card grid.
const REFERENCE_GROUP_ENTITIES: {
  entity: CrudEntity;
  group: ActiveReferenceItemGroup;
}[] = [
  { entity: "mdbank", group: "bank" },
  { entity: "mdewallet", group: "ewallet" },
  { entity: "mdlembaga", group: "lembaga" },
];
```

3. Change the JSX comment at `:466` from `the seven reference lists, real API-backed data` to `the three reference lists, real API-backed data`.

`apps/web/src/components/crud/crud-config.ts`:

1. In the `CrudEntity` union (`:68-84`) delete the four lines `| "mdtxntype"`, `| "mdinvtype"`, `| "mdasettype"`, `| "mdinstype"`. The union's tail becomes:

```ts
  | "tujuan"
  | "mdbank"
  | "mdkategori"
  | "mdewallet"
  | "mdlembaga";
```

2. Replace the comment at `:347-351` with:

```ts
// EPIC-024 Task J (D14) — the `ReferenceItem` model backing mdbank/mdewallet/
// mdlembaga only stores a `label`; the demo's extra fields had nothing real to
// persist to, so they are dropped rather than shown and silently discarded.
```

3. Delete the four entries `mdtxntype: { … },` (`:363-372`), `mdinvtype: { … },` (`:411-420`), `mdasettype: { … },` (`:422-431`), `mdinstype: { … },` (`:444-453`) entirely.

`apps/web/src/i18n/types.ts:213-220` — replace the `MasterDataGroupId` union with:

```ts
type MasterDataGroupId = "mdbank" | "mdewallet" | "mdlembaga";
```

`apps/web/src/i18n/id.ts` — in `masterdata.groups` (`:2013-2021`) delete the `mdtxntype`, `mdinvtype`, `mdasettype`, `mdinstype` lines, leaving:

```ts
    groups: {
      mdbank: { title: "Bank", label: "Bank" },
      mdewallet: { title: "E-Wallet", label: "E-Wallet" },
      mdlembaga: { title: "Lembaga Donasi", label: "Lembaga" },
    },
```

and replace `footerRest` (`:2035-2036`) with:

```ts
    footerRest:
      " tersimpan ke server dan dipakai di transaksi & laporan. Bank, e-wallet, dan lembaga donasi juga tersimpan per keluarga dan langsung muncul sebagai pilihan di formulir Rekening, E-Wallet, dan Donasi. Menghapus item yang masih dipakai transaksi akan ditolak dengan pesan yang menyebutkan datanya.",
```

`apps/web/src/i18n/en.ts` — same edits (`:1976-1984`, `:1998-1999`):

```ts
    groups: {
      mdbank: { title: "Bank", label: "Bank" },
      mdewallet: { title: "E-Wallet", label: "E-Wallet" },
      mdlembaga: { title: "Donation Institution", label: "Institution" },
    },
```

```ts
    footerRest:
      " is saved to the server and used in transactions & reports. Banks, e-wallets and donation institutions are also saved per family and show up right away as choices in the Bank Account, E-Wallet and Donation forms. Deleting an item still in use by a transaction is rejected with a message naming that data.",
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/api`): `pnpm exec jest src/auth/auth.service.spec.ts src/reference-items`
Expected: PASS — the new seed test and every existing auth/reference-items spec green.

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/masterdata"`
Expected: PASS — the new test plus all existing masterdata tests (the "+ Tambah" at index 1 is still Bank).

- [ ] **Step 6: Lint**

Run (from `apps/api`): `pnpm exec eslint src/auth/auth.service.spec.ts`
Expected: exit 0.

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/masterdata/page.tsx" "src/app/(app)/masterdata/masterdata.test.tsx" src/components/crud/crud-config.ts src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/reference-items/index.ts packages/contracts/dist apps/api/src/auth/auth.service.spec.ts "apps/web/src/app/(app)/masterdata/page.tsx" "apps/web/src/app/(app)/masterdata/masterdata.test.tsx" apps/web/src/components/crud/crud-config.ts apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
refactor(masterdata): drop reference groups that only mirrored Prisma enums

Jenis Transaksi/Investasi/Aset/Asuransi were never read by any form and could
not extend the enums anyway. Stop seeding and showing them; existing rows stay.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: "+ Tambah ke Master Data" link + `/masterdata#<group>` opens that group's add dialog

**Files:**

- Create: `apps/web/src/components/crud/add-to-master-data-link.tsx`
- Create: `apps/web/src/components/crud/add-to-master-data-link.test.tsx`
- Modify: `apps/web/src/components/crud/index.ts`
- Modify: `apps/web/src/app/(app)/masterdata/page.tsx` (`:3` react import; new effect after the `useState` block at `:124-133`)
- Modify: `apps/web/src/i18n/types.ts:3940-3943`, `apps/web/src/i18n/id.ts:4125-4128`, `apps/web/src/i18n/en.ts:4057-4060` (top-level `crud` block)
- Test: `apps/web/src/app/(app)/masterdata/masterdata.test.tsx`

**Interfaces:**

- Consumes: `useCanManage("ReferenceItem"): { canManage: boolean | undefined }` (`@/hooks/use-role-permissions`); Task 2's `REFERENCE_GROUP_ENTITIES` (bank, ewallet, lembaga).
- Produces: `AddToMasterDataLink({ group }: { group: ReferenceItemGroup }): JSX.Element | null`, exported from `@/components/crud` — an `<a href="/masterdata#<group>" target="_blank">` shown only when `canManage === true`. `t.crud.addToMasterData: string`. Visiting `/masterdata#bank|#ewallet|#lembaga` as a manager opens that group's add dialog once and strips the hash. Tasks 4 and 5 render the link.

- [ ] **Step 1: Add the i18n key (all three files)**

`types.ts` — top-level `crud` block, after `editDescription: string;`:

```ts
addToMasterData: string;
```

`id.ts` — top-level `crud` block, after `editDescription: …,`:

```ts
    addToMasterData: "+ Tambah ke Master Data",
```

`en.ts` — same position:

```ts
    addToMasterData: "+ Add to Master Data",
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/src/components/crud/add-to-master-data-link.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";

import { id as mockDictionary } from "../../i18n/id";

const mockUseCanManage = jest.fn();
jest.mock("../../hooks/use-role-permissions", () => ({
  useCanManage: (...args: unknown[]) => mockUseCanManage(...args),
}));

import { AddToMasterDataLink } from "./add-to-master-data-link";

describe("AddToMasterDataLink", () => {
  beforeEach(() => jest.resetAllMocks());

  it("links a Master Data manager to that group's add dialog in a new tab", () => {
    mockUseCanManage.mockReturnValue({ canManage: true });
    render(<AddToMasterDataLink group="lembaga" />);

    const link = screen.getByRole("link", {
      name: mockDictionary.crud.addToMasterData,
    });
    expect(link).toHaveAttribute("href", "/masterdata#lembaga");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(mockUseCanManage).toHaveBeenCalledWith("ReferenceItem");
  });

  it.each([false, undefined])(
    "renders nothing when canManage is %s",
    (canManage) => {
      mockUseCanManage.mockReturnValue({ canManage });
      const { container } = render(<AddToMasterDataLink group="bank" />);
      expect(container).toBeEmptyDOMElement();
    },
  );
});
```

In `masterdata.test.tsx`, append:

```tsx
describe("MasterDataPage, /masterdata#<group> deep link (Revisi H)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    queryClient.clear();
    mockUseSessionAuth.mockReturnValue({
      data: {
        session: { token: TOKEN, familyGroupId: FAMILY_GROUP_ID },
        user: { id: "user-1", name: "Test User", email: "user@example.com" },
      },
      isPending: false,
    });
    mockApiFetch.mockImplementation((path: string) => {
      if (path.endsWith("/access/me")) {
        return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
      }
      if (path.endsWith("/family-groups/mine")) {
        return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
      }
      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("opens the Lembaga add dialog when arriving via #lembaga, then clears the hash", async () => {
    window.history.replaceState(null, "", "/masterdata#lembaga");
    render(<MasterDataPage />);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByPlaceholderText("cth: ACT, Kitabisa"),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });

  it("ignores a hash naming a removed group", async () => {
    window.history.replaceState(null, "", "/masterdata#txntype");
    render(<MasterDataPage />);

    await screen.findAllByRole("button", { name: "+ Tambah" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/components/crud/add-to-master-data-link "src/app/\(app\)/masterdata" -t "AddToMasterDataLink|deep link"`
Expected: FAIL — `Cannot find module './add-to-master-data-link'`; the `#lembaga` test times out in `findByRole("dialog")`.

- [ ] **Step 4: Implement**

Create `apps/web/src/components/crud/add-to-master-data-link.tsx`:

```tsx
"use client";

import type { ReferenceItemGroup } from "@wealthme/contracts";

import { useLocale } from "@/hooks/use-locale";
import { useCanManage } from "@/hooks/use-role-permissions";

export function AddToMasterDataLink({ group }: { group: ReferenceItemGroup }) {
  const { t } = useLocale();
  const { canManage } = useCanManage("ReferenceItem");
  if (!canManage) return null;
  return (
    <a
      href={`/masterdata#${group}`}
      target="_blank"
      rel="noopener noreferrer"
      className="hint block font-semibold text-primary hover:underline"
    >
      {t.crud.addToMasterData}
    </a>
  );
}
```

`apps/web/src/components/crud/index.ts` — append:

```ts
export { AddToMasterDataLink } from "./add-to-master-data-link";
```

`apps/web/src/app/(app)/masterdata/page.tsx`:

1. `:3` → `import { useEffect, useState } from "react";`

2. Directly after the `pendingCatDelete` `useState` (end of the block at `:124-133`), add:

```tsx
useEffect(() => {
  if (!canManageReferenceItem) return;
  const target = REFERENCE_GROUP_ENTITIES.find(
    (g) => `#${g.group}` === window.location.hash,
  );
  if (!target) return;
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
  // Deep link from a form's "+ Tambah ke Master Data": open that group's add dialog once.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setCrud({ entity: target.entity, mode: "add" });
}, [canManageReferenceItem]);
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/components/crud/add-to-master-data-link "src/app/\(app\)/masterdata"`
Expected: PASS — 3 link tests, 2 deep-link tests, and all earlier masterdata tests green.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/crud/add-to-master-data-link.tsx src/components/crud/add-to-master-data-link.test.tsx src/components/crud/index.ts "src/app/(app)/masterdata/page.tsx" "src/app/(app)/masterdata/masterdata.test.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/crud/add-to-master-data-link.tsx apps/web/src/components/crud/add-to-master-data-link.test.tsx apps/web/src/components/crud/index.ts "apps/web/src/app/(app)/masterdata/page.tsx" "apps/web/src/app/(app)/masterdata/masterdata.test.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(masterdata): deep-link a group's add dialog and add a Tambah ke Master Data link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Bank and E-Wallet selects read Master Data (every `CrudModal` consumer)

**Files:**

- Modify: `apps/web/src/components/crud/crud-config.ts` (imports `:4`; `CrudField` `:31-62`; rekening `bank` `:88-101`; ewallet `nama` `:144-149`)
- Modify: `apps/web/src/components/crud/crud-modal.tsx` (imports `:16-18`; `CrudForm` `:139-145`; select `:187-203`; default field `:305-311`)
- Modify: `apps/web/src/app/(app)/rekening/page.tsx` (import `:30-35`; `openEdit` `:559-572`)
- Create: `apps/web/src/components/crud/crud-modal.test.tsx`
- Test: `apps/web/src/app/(app)/rekening/rekening.test.tsx` (`mockApiRoutes` `:115-142`)

No change is needed in `dana/page.tsx`, `akun/page.tsx` or `quickinput/page.tsx`: they open the same `rekening`/`ewallet` entities through `CrudModal` and inherit the behaviour.

**Interfaces:**

- Consumes: Task 1 `useReferenceItems(undefined, { enabled })`, `mergeReferenceOptions(labels, fallback, current)`; Task 3 `AddToMasterDataLink`.
- Produces: `CrudField.referenceGroup?: ReferenceItemGroup`. For a select with `referenceGroup`, options = `dynamicOptions[f.key]` if given, else `mergeReferenceOptions(<that group's labels>, f.options, currentValue)`; the field renders `AddToMasterDataLink` under the control. Only entities with such a field fetch reference items.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/crud/crud-modal.test.tsx`:

```tsx
import type { ReactNode } from "react";
import { resolveEffectiveAccess } from "@wealthme/contracts";
import type { ReferenceItemDto } from "@wealthme/contracts";
import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseSessionAuth = jest.fn();
jest.mock("../../lib/auth-client", () => ({
  authClient: {
    useSession: (...args: unknown[]) => mockUseSessionAuth(...args),
    signOut: jest.fn(),
  },
}));

const mockApiFetch = jest.fn();
jest.mock("../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// jsdom has no PointerEvent — Base UI's Dialog reads pointer-event fields.
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

import { CrudModal } from "./crud-modal";

const FG = "fg-1";
const STATIC_EWALLETS = ["GoPay", "OVO", "DANA", "LinkAja", "ShopeePay"];

function item(
  id: string,
  group: ReferenceItemDto["group"],
  label: string,
  isSystem = false,
): ReferenceItemDto {
  return {
    id,
    familyGroupId: FG,
    group,
    label,
    sortOrder: 0,
    isSystem,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

let queryClient: QueryClient;

function renderModal(entity: "ewallet" | "cash") {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return rtlRender(
    <CrudModal
      state={{ entity, mode: "add" }}
      onClose={jest.fn()}
      onSubmit={jest.fn()}
    />,
    { wrapper: Providers },
  );
}

function routeApi({
  role = "owner",
  referenceItems,
}: {
  role?: "owner" | "dependant";
  referenceItems: ReferenceItemDto[] | Error;
}) {
  mockApiFetch.mockImplementation((path: string) => {
    if (path.endsWith("/access/me")) {
      return Promise.resolve(resolveEffectiveAccess({ role }));
    }
    if (path.endsWith("/family-groups/mine")) {
      return Promise.resolve([{ id: FG, myRole: role }]);
    }
    if (path.endsWith("/reference-items")) {
      return referenceItems instanceof Error
        ? Promise.reject(referenceItems)
        : Promise.resolve(referenceItems);
    }
    return Promise.resolve([]);
  });
}

function optionLabels(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((o) => o.textContent ?? "");
}

beforeEach(() => {
  jest.resetAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mockUseSessionAuth.mockReturnValue({
    data: {
      session: { token: "test-token", familyGroupId: FG },
      user: { id: "user-1", name: "Test User", email: "user@example.com" },
    },
    isPending: false,
  });
});

describe("CrudModal — selects backed by Master Data (Revisi H)", () => {
  it("lists the family's Master Data e-wallets (not other groups), then the built-in leftovers", async () => {
    routeApi({
      referenceItems: [
        item("e1", "ewallet", "GoPay", true),
        item("e2", "ewallet", "OVO", true),
        item("e3", "ewallet", "Jenius"),
        item("b1", "bank", "Bank Tes MD"),
      ],
    });
    renderModal("ewallet");

    const select = await screen.findByRole("combobox", { name: /^E-Wallet/ });
    await waitFor(() =>
      expect(optionLabels(select)).toEqual([
        "GoPay",
        "OVO",
        "Jenius",
        "DANA",
        "LinkAja",
        "ShopeePay",
      ]),
    );
  });

  it("keeps the built-in list when the reference-items request fails", async () => {
    routeApi({ referenceItems: new Error("offline") });
    renderModal("ewallet");

    const select = await screen.findByRole("combobox", { name: /^E-Wallet/ });
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FG}/reference-items`,
        expect.anything(),
      ),
    );
    expect(optionLabels(select)).toEqual(STATIC_EWALLETS);
  });

  it("offers '+ Tambah ke Master Data' for the e-wallet group to a manager", async () => {
    routeApi({ referenceItems: [] });
    renderModal("ewallet");

    const link = await screen.findByRole("link", {
      name: "+ Tambah ke Master Data",
    });
    expect(link).toHaveAttribute("href", "/masterdata#ewallet");
  });

  it("hides the link from a member who cannot manage Master Data", async () => {
    routeApi({ role: "dependant", referenceItems: [] });
    renderModal("ewallet");

    await screen.findByRole("combobox", { name: /^E-Wallet/ });
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/family-groups/${FG}/access/me`,
        expect.anything(),
      ),
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not fetch reference items for a form without a Master Data field", async () => {
    routeApi({ referenceItems: [] });
    renderModal("cash");

    await screen.findByRole("dialog");
    expect(mockApiFetch).not.toHaveBeenCalledWith(
      `/family-groups/${FG}/reference-items`,
      expect.anything(),
    );
  });
});
```

`apps/web/src/app/(app)/rekening/rekening.test.tsx`:

1. Change the RTL import to `import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";` and the contracts type import to `import type { AccountDto, ReferenceItemDto } from "@wealthme/contracts";`.

2. Replace `mockApiRoutes` (`:115-142`) with (only the signature and the `/reference-items` branch are new):

```tsx
function mockApiRoutes(
  accounts: AccountDto[],
  referenceItems: ReferenceItemDto[] = [],
) {
  mockApiFetch.mockImplementation(
    (path: string, options?: { method?: string }) => {
      if (options?.method === "PATCH") {
        return Promise.resolve({ id: "acc-1" });
      }
      if (path.endsWith("/members")) {
        return Promise.resolve([]);
      }
      if (path.startsWith("/fx/rates")) {
        return Promise.resolve({ base: "IDR", rates: {} });
      }
      // EPIC-030 — menu/permission gating reads the resolved IAM access.
      if (path.endsWith("/access/me")) {
        return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
      }
      if (path.endsWith("/family-groups/mine")) {
        return Promise.resolve([{ id: FAMILY_GROUP_ID, myRole: "owner" }]);
      }
      if (path.endsWith("/reference-items")) {
        return Promise.resolve(referenceItems);
      }
      return Promise.resolve(accounts);
    },
  );
}

function buildBankItem(
  id: string,
  label: string,
  isSystem: boolean,
): ReferenceItemDto {
  return {
    id,
    familyGroupId: FAMILY_GROUP_ID,
    group: "bank",
    label,
    sortOrder: 0,
    isSystem,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
```

3. Add inside `describe("RekeningPage, ownership labels and bank edit (EPIC-022 A2)", …)`:

```tsx
it("edits an account whose bank was added in Master Data without resetting it to 'Bank Lainnya' (Revisi H)", async () => {
  mockApiRoutes(
    [
      buildAccount({
        id: "acc-md",
        name: "Rekening MD",
        institution: "Bank Tes MD",
      }),
    ],
    [
      buildBankItem("ref-bca", "BCA", true),
      buildBankItem("ref-md", "Bank Tes MD", false),
    ],
  );
  const user = userEvent.setup();
  render(<RekeningPage />);
  await screen.findByText("Rekening MD");

  await user.click(screen.getByRole("button", { name: "Opsi rekening" }));
  await user.click(await screen.findByText("Edit"));
  const dialog = within(await screen.findByRole("dialog"));

  const bankSelect = dialog.getByRole("combobox", { name: /^Nama Bank/ });
  await waitFor(() => expect(bankSelect).toHaveValue("Bank Tes MD"));
  expect(
    within(bankSelect).getByRole("option", { name: "Bank Lainnya" }),
  ).toBeInTheDocument();
  expect(
    await dialog.findByRole("link", { name: "+ Tambah ke Master Data" }),
  ).toHaveAttribute("href", "/masterdata#bank");

  await user.click(dialog.getByRole("button", { name: /Simpan/i }));
  const patchCall = mockApiFetch.mock.calls.find(
    (call) => call[1]?.method === "PATCH",
  );
  expect(
    (JSON.parse(patchCall![1].body as string) as { institution: string })
      .institution,
  ).toBe("Bank Tes MD");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest src/components/crud/crud-modal "src/app/\(app\)/rekening"`
Expected: FAIL — the e-wallet options stay the static five (no "Jenius"), no "+ Tambah ke Master Data" link is found, and the rekening test's bank select holds "Bank Lainnya" instead of "Bank Tes MD".

- [ ] **Step 3: Add `referenceGroup` to the CRUD config**

`apps/web/src/components/crud/crud-config.ts`:

1. After `import { formatRupiah, parseRupiah } from "@/lib/format";` add:

```ts
import type { ReferenceItemGroup } from "@wealthme/contracts";
```

2. In `interface CrudField`, directly after `hideOnEdit?: boolean;`, add:

```ts
  /** Select options come from this Master Data group; static `options` stay as the fallback. */
  referenceGroup?: ReferenceItemGroup;
```

3. In `rekening.fields`, the `bank` field: add `referenceGroup: "bank",` after `type: "select",` (keep its `options` array, including `"Bank Lainnya"`, unchanged).

4. In `ewallet.fields`, the `nama` field: add `referenceGroup: "ewallet",` after `type: "select",` (keep its `options` unchanged).

- [ ] **Step 4: Resolve reference options in `CrudModal`**

`apps/web/src/components/crud/crud-modal.tsx`:

1. After `import { useLocale } from "@/hooks/use-locale";` add:

```tsx
import { mergeReferenceOptions } from "@/hooks/reference-options";
import { useReferenceItems } from "@/hooks/use-reference-items";
```

and after `import { CRUD_CONFIG, type CrudEntity, type CrudField } from "./crud-config";` add:

```tsx
import { AddToMasterDataLink } from "./add-to-master-data-link";
```

2. In `CrudForm`, directly after `const config = CRUD_CONFIG[state.entity];`, add:

```tsx
const { items: referenceItems } = useReferenceItems(undefined, {
  enabled: config.fields.some((f) => f.referenceGroup),
});
```

3. Replace the `if (f.type === "select") { … }` branch of `renderControl` (`:187-203`) with:

```tsx
if (f.type === "select") {
  const options =
    dynamicOptions?.[f.key] ??
    (f.referenceGroup
      ? mergeReferenceOptions(
          referenceItems
            .filter((i) => i.group === f.referenceGroup)
            .map((i) => i.label),
          f.options ?? [],
          values[f.key],
        )
      : (f.options ?? [])
    ).map((o) => ({ value: o, label: o }));
  return (
    <select
      className="select"
      value={values[f.key] ?? ""}
      onChange={(e) => setField(f.key, e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
```

4. In `renderField`'s final `return (<label …>…</label>)` (`:305-311`), add the link as the last child:

```tsx
<label key={f.key} className={fieldClass}>
  <span className="label">{f.label}</span>
  {renderControl(f)}
  {hint && <span className="hint block">{hint}</span>}
  {f.referenceGroup && <AddToMasterDataLink group={f.referenceGroup} />}
</label>
```

- [ ] **Step 5: Stop Rekening's edit from rewriting unlisted banks**

`apps/web/src/app/(app)/rekening/page.tsx`:

1. Remove `CRUD_CONFIG,` from the `@/components/crud` import (`:30-35`); it has no other use in the file.

2. Replace `:559-572` (the F6 comment, `const bankOptions = …` and `const bank = …`) with:

```tsx
// CrudModal keeps a stored bank selectable even when it is not in Master Data.
const bank = account.institution || "Bank Lainnya";
```

- [ ] **Step 6: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest src/components/crud "src/app/\(app\)/(rekening|dana|masterdata|tujuan|liabilitas)"`
Expected: PASS — 5 new crud-modal tests, the new rekening test, and every pre-existing test in those folders green (they either never open a reference-backed form or route `/reference-items`).

- [ ] **Step 7: Lint**

Run (from `apps/web`): `pnpm exec eslint src/components/crud/crud-config.ts src/components/crud/crud-modal.tsx src/components/crud/crud-modal.test.tsx "src/app/(app)/rekening/page.tsx" "src/app/(app)/rekening/rekening.test.tsx"`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/crud/crud-config.ts apps/web/src/components/crud/crud-modal.tsx apps/web/src/components/crud/crud-modal.test.tsx "apps/web/src/app/(app)/rekening/page.tsx" "apps/web/src/app/(app)/rekening/rekening.test.tsx"
git commit -m "$(cat <<'EOF'
feat(crud): feed the bank and e-wallet selects from Master Data

Banks/e-wallets added in Master Data now appear in every Rekening/E-Wallet
form, the built-in list stays as fallback, and editing no longer rewrites an
unlisted bank to "Bank Lainnya".

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Donasi "Lembaga" select reads Master Data

**Files:**

- Modify: `apps/web/src/app/(app)/donation/page.tsx` (imports `:33-44`; state `:301`; select `:871-885`)
- Test: `apps/web/src/app/(app)/donation/donation.test.tsx`

**Interfaces:**

- Consumes: Task 1 `useReferenceItems("lembaga")`, `mergeReferenceOptions`; Task 3 `AddToMasterDataLink` (from `@/components/crud`), `t.crud.addToMasterData`.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing test**

In `apps/web/src/app/(app)/donation/donation.test.tsx`:

1. Change the RTL import to `import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";` and add `import { resolveEffectiveAccess } from "@wealthme/contracts";` below it.

2. Directly after the `jest.mock("../../../lib/api-client", …)` block, add the PointerEvent polyfill (the donation dialog is a Base UI Dialog):

```tsx
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}
```

3. Append at the end of the file:

```tsx
describe("DonationPage — Lembaga options come from Master Data (Revisi H)", () => {
  const lembaga = (id: string, label: string, isSystem: boolean) => ({
    id,
    familyGroupId: "fg-1",
    group: "lembaga",
    label,
    sortOrder: 0,
    isSystem,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFamilyReligion.mockReturnValue({
      religion: "islam",
      isOwner: true,
      isLoading: false,
      isError: false,
      updateReligion: mockUpdateReligion,
      isUpdating: false,
    });
    mockApiFetch.mockImplementation(
      (url: string, init?: { method?: string }) => {
        if (url.endsWith("/reference-items")) {
          return Promise.resolve([
            lembaga("l1", "BAZNAS", true),
            lembaga("l2", "Masjid Al-Ikhlas", false),
            { ...lembaga("b1", "Bank Tes MD", false), group: "bank" },
          ]);
        }
        if (url.endsWith("/access/me")) {
          return Promise.resolve(resolveEffectiveAccess({ role: "owner" }));
        }
        if (url.endsWith("/family-groups/mine")) {
          return Promise.resolve([{ id: "fg-1", myRole: "owner" }]);
        }
        if (url.endsWith("/donations") && init?.method === "POST") {
          return Promise.resolve({ id: "don-1" });
        }
        if (url.includes("/calculators/zakat")) {
          return Promise.resolve({
            zakatable: 0,
            nisab: 100_000_000,
            zakat: 0,
            meetsNisab: false,
            isObligated: false,
            nisabSource: "indicative",
          });
        }
        return Promise.resolve([]);
      },
    );
  });

  it("lists Master Data lembaga (not other groups), keeps 'Lainnya', and saves the chosen one", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.donation.recordDonationButton,
      }),
    );
    const select = await screen.findByLabelText(
      mockDictionary.donation.fieldLembagaLabel,
    );
    await waitFor(() =>
      expect(
        within(select).getByRole("option", { name: "Masjid Al-Ikhlas" }),
      ).toBeInTheDocument(),
    );
    expect(
      within(select).queryByRole("option", { name: "Bank Tes MD" }),
    ).not.toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: "Lainnya" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", {
        name: mockDictionary.crud.addToMasterData,
      }),
    ).toHaveAttribute("href", "/masterdata#lembaga");

    await user.selectOptions(select, "Masjid Al-Ikhlas");
    await user.type(
      screen.getByLabelText(mockDictionary.donation.fieldJumlahLabel),
      "250000",
    );
    await user.click(
      screen.getByRole("button", {
        name: mockDictionary.donation.saveRecordButton,
      }),
    );

    await waitFor(() => {
      const post = mockApiFetch.mock.calls.find(
        ([u, i]) =>
          String(u).endsWith("/donations") &&
          (i as { method?: string } | undefined)?.method === "POST",
      );
      expect(post).toBeDefined();
      expect(
        (JSON.parse(String(post![1].body)) as { recipient: string }).recipient,
      ).toBe("Masjid Al-Ikhlas");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/donation" -t "Master Data"`
Expected: FAIL — `waitFor` times out: no option "Masjid Al-Ikhlas" in the Lembaga select.

- [ ] **Step 3: Implement**

`apps/web/src/app/(app)/donation/page.tsx`:

1. After `import { useLocale } from "@/hooks/use-locale";` add:

```tsx
import { mergeReferenceOptions } from "@/hooks/reference-options";
import { useReferenceItems } from "@/hooks/use-reference-items";
import { AddToMasterDataLink } from "@/components/crud";
```

2. Directly after `const [lembaga, setLembaga] = useState(LEMBAGA_OPTIONS[0]);` (`:301`) add:

```tsx
const { items: lembagaItems } = useReferenceItems("lembaga");
const lembagaOptions = mergeReferenceOptions(
  lembagaItems.map((i) => i.label),
  LEMBAGA_OPTIONS,
  lembaga,
);
```

3. In the Lembaga field (`:871-885`), replace `{LEMBAGA_OPTIONS.map((o) => (` with `{lembagaOptions.map((o) => (`, and directly after the closing `</select>` of `dn-lembaga` add:

```tsx
<AddToMasterDataLink group="lembaga" />
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/donation"`
Expected: PASS — the new test and the four existing religion-prompt tests green.

- [ ] **Step 5: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/donation/page.tsx" "src/app/(app)/donation/donation.test.tsx"`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/donation/page.tsx" "apps/web/src/app/(app)/donation/donation.test.tsx"
git commit -m "$(cat <<'EOF'
feat(donation): list Master Data lembaga in the donation form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: IAM add-member — assign a custom "Hak akses" at creation

No API change: `POST /family-groups/:id/members/dependant` already returns `DependantMemberResponseDto.id` (the Member row id, `apps/api/src/family-groups/dto/dependant-member-response.dto.ts:10-11`, set from `member.id` in `family-groups.service.ts:832`), and `PUT /family-groups/:id/members/:memberId/access` (`apps/api/src/access/access.controller.ts:92-108`) looks the member up by that id and requires `{ accessRoleId: string | null, overrides: AccessPermissions }` (`MemberAccessInputSchema`, `packages/contracts/src/access/index.ts:231-236`).

**Files:**

- Modify: `apps/web/src/app/(app)/iam/_components/add-member-dialog.tsx` (imports `:20-21`; props `:44-54`; state `:84-92`; mutation `:94-134`; `handleCreate` `:136-155`; `handleOpenChange` `:162-169`; role `onChange` `:316-328`; new field after `:349`)
- Modify: `apps/web/src/app/(app)/iam/page.tsx:344-349`
- Modify: `apps/web/src/i18n/types.ts` (`akun.addDependant` `:937-969`), `apps/web/src/i18n/id.ts` (`:772-805`), `apps/web/src/i18n/en.ts` (`:770-803`)
- Create: `apps/web/src/app/(app)/iam/_components/add-member-dialog.test.tsx`

**Interfaces:**

- Consumes: `AccessRoleResponse` from `@wealthme/contracts`; `queryKeys.familyGroups.members(id)`, `queryKeys.familyGroups.accessRoles(id)` from `@/lib/query-keys`.
- Produces: `AddMemberDialog` gains a required prop `roles: AccessRoleResponse[]`. Select `id={`${fieldId}-access-role`}` labelled `t.akun.addDependant.accessRoleLabel`. Task 7 wraps this label with an InfoTip.

- [ ] **Step 1: Add i18n keys (all three files)**

`types.ts` — in `akun.addDependant`, directly after `relationshipNoneOption: string;`:

```ts
accessRoleLabel: string;
accessRoleDefaultOption: string;
accessRoleEmptyHint: string;
toastAccessRoleFailed: string;
```

`id.ts` — same position:

```ts
      accessRoleLabel: "Hak akses",
      accessRoleDefaultOption: "Bawaan (ikuti peran)",
      accessRoleEmptyHint:
        "Belum ada role. Buat di tab Role Akses untuk dipakai di sini.",
      toastAccessRoleFailed:
        "Akun dibuat, tapi hak akses gagal disimpan. Atur lewat tombol Atur Akses.",
```

`en.ts` — same position:

```ts
      accessRoleLabel: "Access role",
      accessRoleDefaultOption: "Default (follow role)",
      accessRoleEmptyHint:
        "No roles yet. Create one in the Access Roles tab to use it here.",
      toastAccessRoleFailed:
        "Account created, but the access role could not be saved. Set it with Atur Akses.",
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/src/app/(app)/iam/_components/add-member-dialog.test.tsx`:

```tsx
import type { ReactNode } from "react";
import type { AccessRoleResponse } from "@wealthme/contracts";
import { render as rtlRender, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { id as mockDictionary } from "../../../../i18n/id";

const mockApiFetch = jest.fn();
jest.mock("../../../../lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// jsdom has no PointerEvent — Base UI's Dialog reads pointer-event fields.
if (typeof window !== "undefined" && !window.PointerEvent) {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error — jsdom has no native PointerEvent to satisfy the type
  window.PointerEvent = PointerEventPolyfill;
}

import { AddMemberDialog } from "./add-member-dialog";

const FG = "fg-1";
const L = mockDictionary.akun.addDependant;
const SOPIR: AccessRoleResponse = {
  id: "r-sopir",
  name: "Sopir",
  description: null,
  dataScope: "own",
  permissions: { transaksi: "manage" },
  memberCount: 0,
  createdAt: "2026-09-24T00:00:00.000Z",
};

function routeApi({ accessFails = false } = {}) {
  mockApiFetch.mockImplementation(
    (path: string, init?: { method?: string }) => {
      if (path.endsWith("/login-handle")) {
        return Promise.resolve({ handle: "arsandi" });
      }
      if (path.endsWith("/members/dependant")) {
        return Promise.resolve({
          id: "m-new",
          userId: "u-new",
          familyGroupId: FG,
          role: "operational",
          relationship: "supir",
          name: "Pak Joko",
          username: "joko",
          createdAt: "2026-09-25T00:00:00.000Z",
        });
      }
      if (path.endsWith("/access") && init?.method === "PUT") {
        return accessFails
          ? Promise.reject({ status: 404, message: "Role not found" })
          : Promise.resolve(undefined);
      }
      return Promise.resolve({});
    },
  );
}

function renderDialog(roles: AccessRoleResponse[] = [SOPIR]) {
  const onOpenChange = jest.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  rtlRender(
    <AddMemberDialog
      open
      onOpenChange={onOpenChange}
      familyGroupId={FG}
      token="test-token"
      roles={roles}
    />,
    { wrapper: Providers },
  );
  return { onOpenChange };
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(L.nameLabel), "Pak Joko");
  await user.type(screen.getByLabelText(L.usernameLabel), "joko");
  await user.type(screen.getByLabelText(L.passwordLabel), "rahasia123");
}

function callsTo(suffix: string, method: string) {
  return mockApiFetch.mock.calls.filter(
    ([p, i]) =>
      String(p).endsWith(suffix) &&
      (i as { method?: string } | undefined)?.method === method,
  );
}

describe("AddMemberDialog — Hak akses at creation (Revisi H)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    routeApi();
  });

  it("assigns the chosen custom role right after the member is created", async () => {
    const user = userEvent.setup();
    renderDialog();

    await fillRequired(user);
    await user.selectOptions(
      screen.getByLabelText(L.accessRoleLabel),
      "r-sopir",
    );
    await user.click(screen.getByRole("button", { name: L.createButton }));

    await waitFor(() =>
      expect(callsTo("/members/m-new/access", "PUT")).toHaveLength(1),
    );
    const [put] = callsTo("/members/m-new/access", "PUT");
    expect(put[0]).toBe(`/family-groups/${FG}/members/m-new/access`);
    expect(JSON.parse(String(put[1].body))).toEqual({
      accessRoleId: "r-sopir",
      overrides: {},
    });
    const [post] = callsTo("/members/dependant", "POST");
    expect(JSON.parse(String(post[1].body))).not.toHaveProperty("accessRoleId");
    expect(mockApiFetch.mock.calls.indexOf(post)).toBeLessThan(
      mockApiFetch.mock.calls.indexOf(put),
    );
  });

  it("sends no access call when 'Bawaan (ikuti peran)' is kept", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    expect(screen.getByLabelText(L.accessRoleLabel)).toHaveValue("");
    expect(
      screen.getByRole("option", { name: L.accessRoleDefaultOption }),
    ).toBeInTheDocument();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: L.createButton }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(callsTo("/access", "PUT")).toHaveLength(0);
  });

  it("closes and tells the Master to use Atur Akses when the role could not be saved", async () => {
    routeApi({ accessFails: true });
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await fillRequired(user);
    await user.selectOptions(
      screen.getByLabelText(L.accessRoleLabel),
      "r-sopir",
    );
    await user.click(screen.getByRole("button", { name: L.createButton }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(L.toastAccessRoleFailed),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(callsTo("/members/dependant", "POST")).toHaveLength(1);
  });

  it("disables Hak akses for Istri (Co-Master) and never sends a role for her", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(
      screen.getByLabelText(L.accessRoleLabel),
      "r-sopir",
    );
    await user.selectOptions(screen.getByLabelText(L.roleLabel), "spouse");
    expect(screen.getByLabelText(L.accessRoleLabel)).toBeDisabled();
    expect(screen.getByLabelText(L.accessRoleLabel)).toHaveValue("");

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: L.createButton }));
    await waitFor(() =>
      expect(callsTo("/members/dependant", "POST")).toHaveLength(1),
    );
    expect(callsTo("/access", "PUT")).toHaveLength(0);
  });

  it("explains how to get roles when the family has none yet", () => {
    renderDialog([]);
    expect(screen.getByText(L.accessRoleEmptyHint)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/iam"`
Expected: FAIL — `add-member-dialog.test.tsx` reports "Unable to find a label with the text of: Hak akses"; `members-tab.test.tsx` still passes.

- [ ] **Step 4: Implement the field**

`apps/web/src/app/(app)/iam/_components/add-member-dialog.tsx`:

1. Change `import type { MemberRelationship } from "@wealthme/contracts";` to:

```tsx
import type {
  AccessRoleResponse,
  MemberRelationship,
} from "@wealthme/contracts";
```

2. Props — add `roles` to both the destructuring and the type:

```tsx
export function AddMemberDialog({
  open,
  onOpenChange,
  familyGroupId,
  token,
  roles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  familyGroupId: string | null;
  token: string | undefined;
  roles: AccessRoleResponse[];
}) {
```

3. After `const [relationship, setRelationship] = useState<MemberRelationship | "">("");` add:

```tsx
const [accessRoleId, setAccessRoleId] = useState("");
```

4. Replace the whole `useMutation` call (`:94-134`) with:

```tsx
const { mutate: createMember, isPending } = useMutation({
  mutationFn: async ({
    accessRoleId: chosenRoleId,
    ...body
  }: {
    name: string;
    username: string;
    email?: string;
    initialPassword: string;
    role: "dependant" | "operational" | "member" | "spouse";
    relationship?: MemberRelationship;
    accessRoleId: string | null;
  }) => {
    const created = await apiFetch<{
      id: string;
      username: string;
      pendingEmail?: string | null;
    }>(`/family-groups/${familyGroupId}/members/dependant`, {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
    if (!chosenRoleId) return { created, accessRoleFailed: false };
    try {
      await apiFetch(
        `/family-groups/${familyGroupId}/members/${created.id}/access`,
        {
          method: "PUT",
          token,
          body: JSON.stringify({ accessRoleId: chosenRoleId, overrides: {} }),
        },
      );
      return { created, accessRoleFailed: false };
    } catch {
      return { created, accessRoleFailed: true };
    }
  },
  onSuccess: ({ created, accessRoleFailed }) => {
    onOpenChange(false);
    // FIX 5 (MEDIUM, react-reviewer) — the dialog stays mounted; reset its state with the close.
    setRole("dependant");
    setRelationship("");
    setAccessRoleId("");
    setShowPassword(false);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.familyGroups.members(familyGroupId ?? ""),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.familyGroups.accessRoles(familyGroupId ?? ""),
    });
    toast.success(t.akun.addDependant.toastCreated, {
      description: `${t.akun.addDependant.toastCreatedDesc} Login: ${created.username}${created.pendingEmail ? ` · Link konfirmasi dikirim ke ${created.pendingEmail}` : ""}`,
      duration: 10000,
    });
    if (accessRoleFailed) {
      toast.error(t.akun.addDependant.toastAccessRoleFailed);
    }
  },
  onError: (err) => {
    toast.error(
      extractApiErrorMessage(err, t.akun.addDependant.toastCreateFailed),
    );
  },
});
```

5. In `handleCreate`, add to the `createMember({ … })` object, after the `relationship` spread:

```tsx
      accessRoleId: isIstriCoMaster ? null : accessRoleId || null,
```

6. In `handleOpenChange`, add `setAccessRoleId("");` after `setRelationship("");`.

7. In the role `<select>`'s `onChange`, after `setRelationship(next === "spouse" ? "istri" : "");` add:

```tsx
if (next === "spouse") setAccessRoleId("");
```

8. Directly after the `{isIstriCoMaster && ( … notice … )}` block (ends `:349`), add:

```tsx
<div className="field">
  <label className="label" htmlFor={`${fieldId}-access-role`}>
    {t.akun.addDependant.accessRoleLabel}
  </label>
  <select
    id={`${fieldId}-access-role`}
    className="select"
    value={accessRoleId}
    disabled={isIstriCoMaster}
    onChange={(e) => setAccessRoleId(e.target.value)}
    aria-describedby={
      roles.length === 0 ? `${fieldId}-access-role-hint` : undefined
    }
  >
    <option value="">{t.akun.addDependant.accessRoleDefaultOption}</option>
    {roles.map((r) => (
      <option key={r.id} value={r.id}>
        {r.name}
      </option>
    ))}
  </select>
  {roles.length === 0 && (
    <p className="hint" id={`${fieldId}-access-role-hint`}>
      {t.akun.addDependant.accessRoleEmptyHint}
    </p>
  )}
</div>
```

`apps/web/src/app/(app)/iam/page.tsx:344-349` — pass the roles the page already fetches from `GET /family-groups/:id/access-roles`:

```tsx
<AddMemberDialog
  open={addOpen}
  onOpenChange={setAddOpen}
  familyGroupId={familyGroupId}
  token={token}
  roles={roles ?? []}
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/iam"`
Expected: PASS — 5 new add-member tests and the 4 existing members-tab tests green.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/iam/_components/add-member-dialog.tsx" "src/app/(app)/iam/_components/add-member-dialog.test.tsx" "src/app/(app)/iam/page.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/iam/_components/add-member-dialog.tsx" "apps/web/src/app/(app)/iam/_components/add-member-dialog.test.tsx" "apps/web/src/app/(app)/iam/page.tsx" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(iam): pick a custom access role when adding a member

The add-member dialog now offers the family's access roles (e.g. Sopir) and
assigns the choice right after creation through the existing access endpoint.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: IAM — name the three concepts apart ("Hubungan" · "Peran sistem" · "Hak akses") with InfoTips

**Files:**

- Modify: `apps/web/src/app/(app)/iam/_components/add-member-dialog.tsx` (imports; the three `<label>`s at `:194-196`, `:309-311`, and Task 6's access-role label)
- Modify: `apps/web/src/app/(app)/iam/_components/members-tab.tsx` (`:10`, `:70-86`, `:91`, `:98`, after `:143`)
- Modify: `apps/web/src/app/(app)/iam/_components/member-access-dialog.tsx:174,195`
- Modify: `apps/web/src/i18n/types.ts`, `apps/web/src/i18n/id.ts`, `apps/web/src/i18n/en.ts` (`akun.addDependant` values + new `akun.memberConcepts` block)
- Test: `apps/web/src/app/(app)/iam/_components/members-tab.test.tsx`, `apps/web/src/app/(app)/iam/_components/add-member-dialog.test.tsx`

**Interfaces:**

- Consumes: `InfoTip({ children, label }: { children: ReactNode; label?: string })` from `@/components/wm`; Task 6's access-role select and `L.accessRoleLabel`.
- Produces: `t.akun.memberConcepts: { relationship; systemRole; accessRole; relationshipInfo; systemRoleInfo; accessRoleInfo; infoLabelPrefix }` (all `string`). InfoTip trigger names are `${infoLabelPrefix}${concept}` → "Tentang Hubungan", "Tentang Peran sistem", "Tentang Hak akses".

- [ ] **Step 1: i18n (all three files)**

`types.ts` — in `akun`, directly after the closing `};` of `addDependant` (before `crud: {`):

```ts
memberConcepts: {
  relationship: string;
  systemRole: string;
  accessRole: string;
  relationshipInfo: string;
  systemRoleInfo: string;
  accessRoleInfo: string;
  infoLabelPrefix: string;
}
```

`id.ts` — same position:

```ts
    memberConcepts: {
      relationship: "Hubungan",
      systemRole: "Peran sistem",
      accessRole: "Hak akses",
      relationshipInfo:
        "Siapa dia di keluarga (anak, supir, sekretaris…). Hanya label, tidak mengubah akses.",
      systemRoleInfo:
        "Tingkat bawaan WealthMe: Co-Master, Anggota, Anak, atau Staff Operasional. Menentukan akses awal bila hak akses dibiarkan Bawaan.",
      accessRoleInfo:
        'Role buatan Master (mis. "Sopir") yang menentukan halaman apa saja yang bisa dibuka. Bila dipilih, menggantikan akses bawaan dari peran sistem.',
      infoLabelPrefix: "Tentang ",
    },
```

and in `id.ts` `akun.addDependant` change these existing values:

```ts
      roleLabel: "Peran sistem",
```

```ts
      istriCoMasterHint:
        'Istri menjadi Co-Master: akses penuh ke semua data keuangan. Kelola anggota dan pengaturan keluarga tetap di Master. Hubungan otomatis terkunci ke "istri". Maksimal 1 istri per keluarga.',
      relationshipLabel: "Hubungan (opsional)",
```

`en.ts` — same position:

```ts
    memberConcepts: {
      relationship: "Relationship",
      systemRole: "System role",
      accessRole: "Access role",
      relationshipInfo:
        "Who they are in the family (child, driver, secretary…). A label only; it does not change access.",
      systemRoleInfo:
        "WealthMe's built-in tier: Co-Master, Member, Child, or Operational Staff. Sets the starting access when the access role is left at Default.",
      accessRoleInfo:
        'A role the Master created (e.g. "Sopir") that decides which pages they can open. When chosen, it replaces the system role\'s default access.',
      infoLabelPrefix: "About ",
    },
```

and in `en.ts` `akun.addDependant`:

```ts
      roleLabel: "System role",
```

```ts
      istriCoMasterHint:
        'The wife becomes Co-Master: full access to every finance surface. Member management and family settings stay with the Master. Relationship locks to "istri". Max 1 wife per family.',
      relationshipLabel: "Relationship (optional)",
```

- [ ] **Step 2: Write the failing tests**

`members-tab.test.tsx` — change the first import to `import { render, screen, within } from "@testing-library/react";` and append inside `describe("IAM MembersTab", …)`:

```tsx
it("names Hubungan, Peran sistem and Hak akses apart, each with its own explainer (Revisi H)", () => {
  render(
    <MembersTab
      members={[{ ...child, relationship: "anak" }]}
      isLoading={false}
      roles={[]}
      currentUserId="u-master"
      onEditAccess={jest.fn()}
      onResetPassword={jest.fn()}
      onEditEmail={jest.fn()}
      onRemove={jest.fn()}
    />,
  );
  const c = mockDictionary.akun.memberConcepts;
  for (const label of [c.relationship, c.systemRole, c.accessRole]) {
    expect(
      screen.getByRole("columnheader", { name: new RegExp(`^${label}`) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${c.infoLabelPrefix}${label}` }),
    ).toBeInTheDocument();
  }
  expect(
    screen.queryByRole("columnheader", { name: "Tipe" }),
  ).not.toBeInTheDocument();
  const row = screen.getByRole("row", { name: /Aisyah/ });
  expect(within(row).getAllByRole("cell")[1]).toHaveTextContent("Anak");
});
```

`add-member-dialog.test.tsx` — append inside the existing `describe`:

```tsx
it("labels the three concepts and explains each one", () => {
  renderDialog();
  const c = mockDictionary.akun.memberConcepts;
  expect(screen.getByLabelText("Hubungan (opsional)")).toBeInTheDocument();
  expect(screen.getByLabelText("Peran sistem")).toBeInTheDocument();
  expect(screen.getByLabelText("Hak akses")).toBeInTheDocument();
  for (const label of [c.relationship, c.systemRole, c.accessRole]) {
    expect(
      screen.getByRole("button", { name: `${c.infoLabelPrefix}${label}` }),
    ).toBeInTheDocument();
  }
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/iam"`
Expected: FAIL — no "Tentang Hubungan" button in either component; the members table has no "Hubungan" column and still shows "Tipe".

- [ ] **Step 4: Implement**

`add-member-dialog.tsx`:

1. Add `import { InfoTip } from "@/components/wm";` after the `@/components/ui/dialog` import, and inside the component after `const { t } = useLocale();` add:

```tsx
const concepts = t.akun.memberConcepts;
```

2. Replace the relationship `<label …>…</label>` (`:194-196`) with:

```tsx
<div className="flex items-center gap-1">
  <label className="label" htmlFor={`${fieldId}-relationship`}>
    {t.akun.addDependant.relationshipLabel}
  </label>
  <InfoTip label={`${concepts.infoLabelPrefix}${concepts.relationship}`}>
    {concepts.relationshipInfo}
  </InfoTip>
</div>
```

3. Replace the role `<label …>…</label>` (`:309-311`) with:

```tsx
<div className="flex items-center gap-1">
  <label className="label" htmlFor={`${fieldId}-role`}>
    {t.akun.addDependant.roleLabel}
  </label>
  <InfoTip label={`${concepts.infoLabelPrefix}${concepts.systemRole}`}>
    {concepts.systemRoleInfo}
  </InfoTip>
</div>
```

4. Replace Task 6's access-role `<label …>…</label>` with:

```tsx
<div className="flex items-center gap-1">
  <label className="label" htmlFor={`${fieldId}-access-role`}>
    {t.akun.addDependant.accessRoleLabel}
  </label>
  <InfoTip label={`${concepts.infoLabelPrefix}${concepts.accessRole}`}>
    {concepts.accessRoleInfo}
  </InfoTip>
</div>
```

`members-tab.tsx`:

1. `:10` → `import { InfoTip, StatusBadge } from "@/components/wm";`

2. After `const roleLabel = …;` (`:71-72`) add:

```tsx
const concepts = t.akun.memberConcepts;
const conceptHeader = (label: string, info: string) => (
  <span className="inline-flex items-center gap-0.5">
    {label}
    <InfoTip label={`${concepts.infoLabelPrefix}${label}`}>{info}</InfoTip>
  </span>
);
```

3. Replace the header row (`:80-86`) with:

```tsx
<tr>
  <th>Anggota</th>
  <th>{conceptHeader(concepts.relationship, concepts.relationshipInfo)}</th>
  <th>{conceptHeader(concepts.systemRole, concepts.systemRoleInfo)}</th>
  <th>{conceptHeader(concepts.accessRole, concepts.accessRoleInfo)}</th>
  <th>Data terlihat</th>
  <th style={{ textAlign: "right" }}>Aksi</th>
</tr>
```

4. Change both `colSpan={5}` (`:91`, `:98`) to `colSpan={6}`.

5. Directly after the name cell's closing `</td>` (`:143`), add:

```tsx
<td>
  {m.relationship ? (
    m.relationship.charAt(0).toUpperCase() + m.relationship.slice(1)
  ) : (
    <span className="t-muted">—</span>
  )}
</td>
```

`member-access-dialog.tsx`:

- `:174` → `<span className="label">1. {t.akun.memberConcepts.systemRole}</span>`
- `:195` → `<span className="label">2. {t.akun.memberConcepts.accessRole}</span>`

- [ ] **Step 5: Run tests to verify they pass**

Run (from `apps/web`): `pnpm exec jest "src/app/\(app\)/iam"`
Expected: PASS — both new tests plus all Task 6 and pre-existing members-tab tests green.

- [ ] **Step 6: Lint**

Run (from `apps/web`): `pnpm exec eslint "src/app/(app)/iam/_components/add-member-dialog.tsx" "src/app/(app)/iam/_components/add-member-dialog.test.tsx" "src/app/(app)/iam/_components/members-tab.tsx" "src/app/(app)/iam/_components/members-tab.test.tsx" "src/app/(app)/iam/_components/member-access-dialog.tsx" src/i18n/types.ts src/i18n/id.ts src/i18n/en.ts`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(app)/iam/_components" apps/web/src/i18n/types.ts apps/web/src/i18n/id.ts apps/web/src/i18n/en.ts
git commit -m "$(cat <<'EOF'
feat(iam): name Hubungan, Peran sistem and Hak akses apart with explainers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- **Spec coverage (item 16):** remove `txntype`/`invtype`/`asettype`/`instype` from UI + seed → Task 2 (contracts seed, API spec, page, crud-config, i18n; no migration, rows kept). `useReferenceItems(group)` hook → Task 1. Bank select in Rekening → Task 4 (all four `CrudModal` consumers). E-Wallet select → Task 4. Donasi Lembaga → Task 5. "+ Tambah ke Master Data" affordance → Task 3 (link + deep-linked add dialog), rendered in Tasks 4 and 5. "Data baru langsung tersedia di seluruh formulir" → Task 1 shared key + probe test, `refetchOnWindowFocus: "always"` for the new-tab path. `institusi` group → out of scope by controller decision.
- **Spec coverage (item 17):** "Hak Akses" select from `GET …/access-roles` with "Bawaan (ikuti peran)" default, assigned via `PUT …/members/:memberId/access` after create → Task 6 (API response already carries `id`, so no API task). Rename Hubungan / Peran sistem / Hak akses + one InfoTip each → Task 7. The spec's optional "auto-set tier when a custom role is chosen" is not implemented; the Co-Master case is handled by disabling Hak akses instead (Task 6).
- **Placeholders:** none; every code step carries full code and every command an `Expected:` line.
- **Name consistency:** `referenceItemsQueryKey`, `useReferenceItems`, `mergeReferenceOptions` (Task 1) are used with the same signatures in Tasks 3–5; `ACTIVE_REFERENCE_ITEM_GROUPS`/`ActiveReferenceItemGroup` (Task 2) are used in the page in Task 2; `AddToMasterDataLink` and `t.crud.addToMasterData` (Task 3) are used in Tasks 4–5; `CrudField.referenceGroup` (Task 4) only in Task 4; `t.akun.addDependant.accessRoleLabel|accessRoleDefaultOption|accessRoleEmptyHint|toastAccessRoleFailed` (Task 6) and `t.akun.memberConcepts.*` (Task 7) match their tests.
