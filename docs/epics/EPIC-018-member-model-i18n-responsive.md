# EPIC-018: Per-Member Finances, i18n Coverage & Responsive UI

status: backlog
environment: dev
retries: 0
phase: 4
priority: P2
area: Full-stack
source: `/nerve` QA audit 2026-07-19 (3-agent code audit, follow-up to EPIC-016/017)

## Goal

Close the three biggest gaps between what WealthMe _appears_ to promise and
what it actually does, surfaced by a full-app QA audit:

1. **Per-member finances.** A family member intuitively expects "my money" to
   be distinct from "the family's money," but today the roles
   `owner | member | admin_staff` differ **only** in CASL permissions with
   **zero data separation** — every member sees the same accounts, categories,
   and transactions, and a member's new transaction lands in a shared family
   account. This is the user's #1 confusion. Either build real per-member
   ownership ("pockets") or make the already-possible separate-family-group
   answer explicit (see Open Design Decisions).
2. **i18n coverage.** The language mechanism works and the `/akun` picker is
   real (per EPIC-016 B1), but the dictionary covers only ~52 keys across 3
   sections and only 2 of 25 app pages consume it. Switching to English
   visibly changes almost nothing, so the user perceives "the language
   doesn't change." Extend real bilingual coverage to the whole app.
3. **Responsive / empty space.** On tall desktop viewports, sparse pages
   (`beranda`, `ringkasan`) leave a large empty area below the content because
   the layout is a top-aligned vertical stack that never fills the viewport.
   Cosmetic, but it reads as "unfinished." Make sparse dashboards denser/more
   adaptive or consciously accept the whitespace.

This epic preserves every existing feature shape and stays backward-compatible;
each task group is independently shippable and independently gated.

## Evidence

From a 3-agent read-only code audit, 2026-07-19 (line refs verified against the
current tree):

- **Roles differ only by permissions, not data.**
  `apps/api/src/auth/casl-ability.factory.ts:38-97` defines all three roles
  (`owner | member | admin_staff`) as CASL ability sets over the _same_
  family-scoped data. There is **no** `createdByUserId` / `ownerUserId` on the
  financial models: `apps/api/prisma/schema.prisma` — `Account` (`:301-321`),
  `Category` (`:323-341`), `Transaction` (`:343-361`) are scoped **only** by
  `familyGroupId`. Confirmed: no per-member owner column exists. The
  `isPrivate` flag added in EPIC-016 B4 (`schema.prisma:312, 332`) is a
  per-item **HIDE** toggle, not per-member ownership — a private account is
  still a _family_ account, just hidden from `member` viewers.
- **Separate finances already achievable with no code:** one `FamilyGroup` per
  person (separate logins) fully isolates data today — this is a product
  decision, not a missing feature.
- **i18n is shallow.** Store + hook work (`apps/web/src/hooks/use-locale.ts:40-57`);
  the `/akun` picker is real (`apps/web/src/app/(app)/akun/page.tsx:918`, per
  EPIC-016 B1). But the dictionaries (`apps/web/src/i18n/id.ts`,
  `apps/web/src/i18n/en.ts`) hold only ~52 keys / 3 sections
  (`greeting` + `common` + `beranda`), and only **2 of 25** app pages
  (`beranda`, `akun`) call `useLocale`. The shell is hardcoded Indonesian:
  sidebar/nav (`apps/web/src/lib/nav` → `apps/web/src/components/shell/sidebar.tsx:105,158`),
  topbar, mobile nav, and `apps/web/src/components/shell/app-shell.tsx:29`
  ("Memuat WealthMe…"). ~1551 quoted multi-word literals across ~17k LOC in
  the remaining 23 pages. Net effect: EN mode changes almost nothing on screen.
- **`/panduan` is real content, hardcoded ID.**
  `apps/web/src/app/(app)/panduan/page.tsx` `JOURNEYS` (`:47-268`) is a genuine
  9-journey catalog with 1-2 sentence explanations (not just links) — decent
  content, but 100% hardcoded Indonesian and "Buka →" (`:306`) is a plain
  `router.push`. Not a defect; its strings fold into the i18n task.
- **Empty vertical space is a layout choice, not a bug.**
  `apps/web/src/components/shell/app-shell.tsx:55` — `<main>` is
  `flex-1 px-3.5 pb-20 pt-3.5 md:px-6 md:py-6`, full-width, no `max-width`,
  nothing stretches to viewport height. `apps/web/src/app/(app)/beranda/page.tsx:284`
  is a top-aligned `space-y` stack. On tall desktops, content height < viewport
  → empty area below. Data-heavy pages fill fine; only sparse pages
  (`beranda`, `ringkasan`) show the gap. LOW / cosmetic.

## Tasks

- [ ] ### A — Full i18n coverage (extract + wire the whole app)
  - Extract the ~1500 hardcoded multi-word Indonesian literals into the
    `id`/`en` dictionaries (`apps/web/src/i18n/*.ts`), organized into **per-page
    dictionary sections** mirroring the existing `beranda` section pattern, so
    each page pulls only its own keys.
  - Wire `useLocale` (`apps/web/src/hooks/use-locale.ts`) through the **23
    currently-untranslated pages** plus the **shell**: sidebar/nav
    (`lib/nav` → `components/shell/sidebar.tsx`), topbar, mobile nav, and
    `components/shell/app-shell.tsx` ("Memuat WealthMe…"). Shell/nav files are
    protected foundation paths — a reviewed foundation change is required here
    (flag for explicit authorization before editing `components/shell/*` and
    `lib/nav`).
  - Fold `/panduan`'s `JOURNEYS` catalog copy (`panduan/page.tsx:47-268`, incl.
    "Buka →") into the dictionary.
  - Translate the strings that live in `apps/web/src/lib/data` (labels, sample
    copy) or route them through the dictionary.
  - **Phase this by page cluster** (e.g. shell+nav first as the highest-visible
    win, then dashboard/reports pages, then long-tail pages) so it ships in
    reviewable increments rather than one ~1500-string mega-PR. Each phase is
    its own `/task-work` pass.
  - Acceptance for this task: switching `/akun` → English visibly re-renders
    the sidebar, topbar, and the covered pages; no untranslated key falls back
    to a raw key string; ID remains byte-faithful to today's copy.

- [ ] ### B — Per-member finances ("pockets")
  - **Gated on Open Design Decision #1** — only build this if the user chooses
    the per-member-pockets model over the separate-family-group answer.
  - Schema: add a **nullable** `ownerUserId` FK to `Account`
    (`schema.prisma:301-321`) — and optionally `Category` — scoped within the
    family group; nullable so existing rows stay "family-shared." Additive
    migration only (no drops, no failing non-null backfill).
  - Scope **reads** by owner where the user asks for "mine": account/category
    lists, reports, dashboard, and budgets gain a "mine vs family" lens.
  - Scope **writes**: a member's new transaction can target their own pocket
    (default) vs an explicitly shared family account.
  - Extend CASL (`casl-ability.factory.ts:38-97`) with an own-vs-shared
    dimension so a member can always manage their own pocket while shared
    family data still honors the existing owner/admin_staff/member rules.
  - UI: assign an owner to an account, and a **"Milik saya / Keluarga"**
    (Mine / Family) filter on the lists/dashboard.
  - Preserve full backward compatibility: null-owner data behaves exactly as
    today (family-shared). Medium-to-large; the biggest task in this epic.

- [ ] ### C — Responsive layout for sparse pages (empty-space)
  - Give sparse dashboard pages (`beranda`, `ringkasan`) a **denser, adaptive
    grid** — e.g. a 2-column main+aside layout on wide viewports — so content
    fills the available width/height instead of stacking top-aligned with a
    dead zone below.
  - The gap originates in `components/shell/app-shell.tsx:55` (`<main>` has no
    height/`max-width` strategy). Prefer solving it **inside the page files**
    (`beranda/page.tsx`, `ringkasan/page.tsx`) to avoid touching the protected
    shell. **If** a shell-level change is genuinely required (e.g. a max-width
    container or min-height fill), that is a protected foundation change —
    flag it for explicit reviewed authorization first; do not edit
    `components/shell/*` opportunistically.
  - LOW priority / cosmetic. Acceptable alternative outcome (per Open Design
    Decision #3): consciously accept the whitespace and close the task as
    "won't-fix, documented."

## Open Design Decisions

The implementer must resolve these with the user (AskUserQuestion) before the
dependent task starts — matching EPIC-016's build-vs-relabel sign-off pattern.
They are genuine forks, not defaults.

1. **Member model — PIVOTAL.** Choose the answer to "my money vs family money":
   - **(b) Per-member pockets** — add `ownerUserId` to `Account` (± `Category`),
     scope reads/writes/CASL by it, add owner-assignment UI + a "mine vs
     family" filter. Medium-large build (Task B). Keeps one family group but
     gives real per-member separation inside it.
   - **(c) Accept separate family groups as the answer** — fully separate
     finances already work today via one `FamilyGroup` per person / separate
     logins. ~No code; a product/UX decision to document and possibly surface
     in onboarding copy. Task B is dropped.
     This decision blocks Task B entirely and is the user's #1 reported
     confusion — it must be made first.

2. **i18n scope.** Translate **all 25 pages now**, or a **prioritized subset**
   (shell + high-traffic pages first, long-tail later)? Drives how many phases
   Task A ships in and where "done enough" sits. Recommendation: shell + nav +
   top pages first (highest perceived-value), long-tail as follow-ups.

3. **Responsiveness.** **Redesign** the dashboard density (Task C build) or
   **accept the whitespace** and close Task C as won't-fix? Cosmetic; cheapest
   to accept, but a denser grid measurably improves the "finished" feel.

## Acceptance Criteria

- **i18n:** switching language in `/akun` visibly changes the sidebar, topbar,
  mobile nav, and every covered page; Indonesian copy remains byte-faithful to
  today's; no visible raw dictionary keys; the untranslated-page count drops to
  the agreed target (all 25, or the prioritized subset per Decision #2).
- **Member model (if Task B is chosen):** `Account` (± `Category`) has a real,
  tenant-scoped, **nullable** `ownerUserId`; a member can see/manage their own
  pocket and toggle a "mine vs family" view; null-owner data behaves exactly as
  before (backward compatible); no cross-tenant or cross-member leak; CASL still
  enforces owner/admin_staff/member on shared data. **If Decision #1 picks (c),
  this criterion is replaced by a documented product decision** (separate family
  groups) with no schema change.
- **Responsive:** sparse pages either fill the viewport with an adaptive
  grid, or the whitespace is a consciously-documented accepted state (per
  Decision #3).
- All static gates green: `scripts/qa.sh`, `scripts/test.sh`,
  `scripts/security-check.sh`. Any protected `components/shell/*` / `lib/nav`
  change carries explicit reviewed authorization.

## Test Plan

- **Unit/component:** dictionary lookups fall back safely (missing key never
  renders a raw key); `useLocale`-wired components re-render on locale change;
  (Task B) owner-scoping helper returns "mine" vs "family" sets correctly for
  each role; the "mine vs family" filter toggles the query.
- **Integration:** (Task B) account/transaction create accepts + validates
  `ownerUserId` within the family group (rejects cross-member/cross-tenant ids);
  reports/dashboard/budgets honor the owner lens; additive migration applies on
  a DB with existing null-owner rows.
- **E2E (Playwright):** switch language in `/akun` → sidebar + a sample page
  render in English, reload persists; (Task B) create a member-owned account,
  confirm it shows under "Milik saya" and is excluded from another member's
  "mine" view; (Task C) sparse page fills the viewport at a wide breakpoint (or
  the accepted-whitespace decision is recorded, no test needed).
- **Smoke:** `beranda`, `ringkasan`, `panduan`, `akun` load after DEV deploy in
  both locales.

## Agent Routing

`code-agent` + `shadcn` for the page/i18n wiring, `ecc:react-reviewer` +
`ecc:typescript-reviewer` post-edit on every diff; `review-qa-agent` for
WealthMe-specific acceptance-criteria + honest-UI + foundation-path checks
(Tasks A shell change, C). For Task B: `database-reviewer` +
`/ecc:prisma-patterns` / `/ecc:database-migrations` (schema + additive
migration), `nestjs-best-practices` + `ecc:security-reviewer` + `security-agent`
(owner scoping, tenant + cross-member isolation, CASL). Gates via `test-agent` /
`security-agent`; `deploy-agent` (DEV only). Per task: `/task-work EPIC-018 <n>`.
Each Open Design Decision above must be confirmed with the user
(AskUserQuestion) before the dependent task starts — Decision #1 gates Task B
entirely.

## Done Signal

Each task group closes independently via `/task-work EPIC-018 <n>` (Task A in
phased sub-passes). The epic closes when: the agreed i18n scope renders in both
locales across the covered pages + shell; the member-model decision is
implemented (per-member pockets shipped and gated, **or** the separate-family-
group answer documented); the responsiveness decision is implemented or recorded
as accepted; and the acceptance criteria hold across a fresh QA pass of
`/akun`, `/beranda`, `/ringkasan`, and `/panduan`.

## Automation Log

<!-- Append automation results here. -->
