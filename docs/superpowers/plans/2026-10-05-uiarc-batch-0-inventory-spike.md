# WealthMe Arc UI Batch 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a complete shared-component mapping and validate one isolated Arc UI primitive integration without changing production behavior.

**Architecture:** Batch 0 creates a tracked inventory and a disposable-but-committed compatibility probe. The probe uses the Arc registry and existing WealthMe runtime only behind a dedicated demo/test boundary; no existing `ui`, `wm`, or `shell` export is replaced until the probe proves dependency, token, accessibility, and motion compatibility.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, shadcn registry, Base UI, Arc UI free registry, Motion, Jest, ESLint, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-uiarc-component-migration-design.md`

## Global Constraints

- Preserve public WealthMe APIs first; consumers must not know whether a component is backed by Arc or WealthMe code.
- Do not rewrite API, database, auth, tenant, authorization, money, FX, or i18n behavior.
- Do not reconstruct or copy Arc Pro source without a valid Pro entitlement.
- Do not import Arc foundation CSS globally until a scoped compatibility spike and light/dark visual check pass.
- Keep existing user-owned dirty changes untouched and stage explicit paths only.
- Do not treat `apps/web/DESIGN.md` as a blocker, but keep repo safety and platform contracts active.
- Do not claim full gates while the pre-existing `motion/react` install failure remains unresolved.

## Review Focus

- Registry install must not silently overwrite `apps/web/src/components/ui/*` — test the output path and git diff in Task 2.
- Arc foundation tokens must not leak into unrelated pages — test CSS import scope and an unchanged login render in Task 2.
- Existing Base UI and Arc/Radix primitives must not create duplicate portals or broken focus restoration — test dialog/menu keyboard behavior in Task 3.
- Arc motion must have a reduced-motion branch and must not require unavailable runtime packages — test computed reduced-motion behavior and module resolution in Task 3.
- The mapping must protect financial and shell components from premature migration — review every `money`, `transaction`, `auth`, `navigation`, and `chart` row in Task 1.

### Task 1: Build the shared component mapping

**Files:**

- Create: `docs/architecture/uiarc-component-map.md`
- Read-only inputs: `apps/web/src/components/ui/`, `apps/web/src/components/wm/`, `apps/web/src/components/shell/`, `apps/web/src/components/charts/`, `apps/web/components.json`, `apps/web/package.json`
- Test/evidence: `results.md`

**Interfaces:**

- Consumes: current component file list, import fan-out, Arc catalog metadata, and the approved migration spec.
- Produces: one row per shared component with `current path`, `public export`, `Arc candidate`, `catalog tier`, `decision`, `risk`, `key consumers`, and `verification owner`.

- [x] **Step 1: Inventory current shared exports and consumers**

Run:

```bash
rg --files apps/web/src/components/ui apps/web/src/components/wm apps/web/src/components/shell apps/web/src/components/charts
rg -n "from [\"']@/components/(ui|wm|shell|charts)" apps/web/src --glob '*.tsx' --glob '*.ts'
```

Record shared components and high-fan-out consumers. Do not edit source files.

- [x] **Step 2: Read Arc metadata for candidate equivalents**

Use the machine-readable Arc catalog and each candidate's markdown reference.
At minimum inspect the free candidates for button, input, textarea, dialog,
dropdown-menu, context-menu, card, badge, avatar, progress, skeleton, tabs,
accordion, select/combobox, search-field, money-input, date-picker, and charts.
Mark Pro-only items as `prohibited` unless an entitlement is explicitly
available; never infer or copy their source.

- [x] **Step 3: Write the mapping table**

For every shared export, choose exactly one decision: `adopt`, `adapt`,
`retain`, `replace-with-free`, or `prohibited`. Add a one-sentence reason and
name the focused test or browser check that owns the decision.

- [x] **Step 4: Verify mapping completeness**

Run a small check that every file in the three shared directories appears in
the mapping document and that no row has an empty decision, candidate, or risk.
Record the command and result in `results.md`.

- [x] **Step 5: Commit the inventory**

```bash
git add docs/architecture/uiarc-component-map.md results.md
git commit -m "docs: map WealthMe components to Arc UI"
```

### Task 2: Add the isolated Arc registry compatibility probe

**Files:**

- Modify: `apps/web/components.json` — add the `@uiarc` registry only.
- Create: `apps/web/src/components/arc-probe/arc-button-probe.tsx`
- Create: `apps/web/src/components/arc-probe/arc-button-probe.test.tsx`
- Create or modify: `apps/web/src/components/arc-probe/arc-probe.css` only if the registry component requires scoped styles.
- Test/evidence: `results.md`

**Interfaces:**

- Consumes: Arc's documented free Button API and existing WealthMe semantic labels/tokens.
- Produces: an isolated probe export with no imports from production pages and a test proving keyboard, disabled, loading, and reduced-motion behavior.

- [x] **Step 1: Confirm dependency state before installing**

Run:

```bash
test -d apps/web/node_modules/motion && echo "motion package present" || echo "motion package missing"
pnpm --filter web exec tsc --noEmit
```

If `motion/react` is missing, record the blocker and repair only the dependency
state required for this probe in a separate explicit commit; do not workaround
TypeScript by adding declarations or mock production modules.

- [x] **Step 2: Register Arc without overwriting WealthMe components**

Add:

```json
"@uiarc": "https://uiarc.dev/r/{name}.json"
```

to `apps/web/components.json`. Use the registry's documented install command
with an explicit output path or copy the free Button source into the isolated
`arc-probe` boundary. Confirm `git diff --name-only` before and after; the
command must not modify `components/ui`, `components/wm`, or page files.

- [x] **Step 3: Implement the probe wrapper**

Export `ArcButtonProbe(props: { label: string; disabled?: boolean; loading?: boolean; onClick?: () => void })` from `arc-button-probe.tsx`. Keep it isolated and use the documented Arc Button props only. The wrapper must expose a semantic button, preserve disabled behavior, announce loading without replacing the label silently, and use existing WealthMe tokens rather than raw catalog colors.

- [x] **Step 4: Add the focused test**

In `arc-button-probe.test.tsx`, assert:

```text
renders the supplied label;
does not invoke onClick when disabled;
exposes an honest busy/loading state and remains non-activatable while loading;
is keyboard activatable with Enter or Space;
does not import or render any production page component.
```

- [x] **Step 5: Run focused verification**

```bash
pnpm --filter web exec jest src/components/arc-probe/arc-button-probe.test.tsx --runInBand
pnpm --filter web exec eslint src/components/arc-probe apps/web/components.json
pnpm --filter web exec tsc --noEmit
git diff --check
```

Expected: the probe test and lint pass; TypeScript either passes or reports the
known dependency blocker with no new errors; no production component is changed.

- [x] **Step 6: Commit the isolated probe**

```bash
git add apps/web/components.json apps/web/src/components/arc-probe results.md
git commit -m "chore(web): add isolated Arc UI compatibility probe"
```

### Task 3: Verify visual, token, motion, and portal compatibility

**Files:**

- Modify: `apps/web/src/components/arc-probe/arc-button-probe.tsx` only if Task 2 evidence requires a narrow correction.
- Create: `apps/web/tests/e2e/arc-probe.spec.ts`
- Evidence: `results.md`

**Interfaces:**

- Consumes: the isolated `ArcButtonProbe` from Task 2.
- Produces: desktop/mobile/reduced-motion evidence and a Batch 0 recommendation for the first production primitive family.

- [x] **Step 1: Run the dev server and desktop probe check**

Verify the probe route or test harness at a desktop viewport. Check label,
disabled/loading state, keyboard activation, focus behavior, and that no Arc
foundation CSS changes appear on `/login` or another unchanged page.

- [x] **Step 2: Run the mobile probe check**

Use a narrow touch viewport. Measure the target height, check no horizontal
overflow, and verify the disabled/loading state remains clear without hover.

- [x] **Step 3: Run reduced-motion verification**

Emulate `prefers-reduced-motion: reduce` and confirm the probe has no travel or
long transition that blocks input.

- [x] **Step 4: Record the decision**

Add a Batch 0 evidence entry to `results.md` with the exact files, commands,
screens/measurements, failures, and whether Button is recommended for Batch 1.

- [x] **Step 5: Commit evidence**

```bash
git add apps/web/tests/e2e/arc-probe.spec.ts results.md
git commit -m "test(web): verify Arc UI compatibility probe"
```

## Final Batch 0 Gate

- [x] Mapping document covers all shared `ui`, `wm`, and `shell` files.
- [x] Arc free/Pro boundaries are explicit.
- [x] The Arc registry does not overwrite production WealthMe components.
- [x] The isolated probe has focused Jest, ESLint, and TypeScript evidence.
- [x] Desktop, mobile, keyboard, and reduced-motion checks are recorded.
- [x] A recommendation is made for Batch 1; no production primitive is
      migrated until the next approved plan/task begins.
