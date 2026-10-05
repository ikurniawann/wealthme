# WealthMe Arc UI Component Migration

## Status

Design approved conversationally by the user on 2026-10-05. Implementation is
not authorized by this document alone; the implementation plan and execution
method require a separate review.

## Goal

Migrate WealthMe's reusable UI components toward the free components in the
Arc UI (`uiarc.dev`) catalog while preserving WealthMe's product behavior,
financial calculations, authorization boundaries, Indonesian/English copy,
responsive behavior, and accessibility contracts.

The migration intentionally treats Arc UI as an implementation and interaction
reference, not as permission to replace the product wholesale with unrelated
catalog items.

## Scope

### In scope

- Shared primitives under `apps/web/src/components/ui/`.
- Reusable WealthMe components under `apps/web/src/components/wm/`.
- Shell components under `apps/web/src/components/shell/`.
- Page-local components only after their shared primitive dependencies are
  migrated and verified.
- Arc UI free registry components that have a direct semantic and behavioral
  match for an existing WealthMe component.
- Compatibility adapters that preserve current WealthMe component APIs while
  Arc implementations are introduced internally.
- Token, motion, reduced-motion, keyboard, touch-target, and responsive
  adjustments required by adopted Arc components.
- Tests, documentation, and per-batch visual verification.

### Out of scope

- Rewriting API, database, auth, tenant, authorization, money, FX, or i18n
  behavior.
- Replacing every page with a new Arc block merely because it exists in the
  catalog.
- Reconstructing or copying Arc Pro source without a valid Pro entitlement.
- Removing WealthMe components that have no safe Arc equivalent.
- A wholesale rewrite of `globals.css`, API contracts, or page data flows.
- Treating `apps/web/DESIGN.md` as a blocker for this initiative, while still
  keeping the remaining repo and platform safety contracts active.

## Proven context

- The repo contains approximately 165 component files, including shared UI,
  WM, shell, chart, auth, money, and feature components.
- WealthMe uses Next.js 16, React 19, Tailwind v4, shadcn-compatible Base UI,
  Lucide icons, TanStack Query, and existing design-system CSS tokens.
- Shared component files are imported broadly, so changing a primitive can
  affect many pages and tests.
- The current install state has a pre-existing missing `motion/react` module
  affecting TypeScript and many Jest suites. This must be repaired or formally
  isolated before claiming full migration gates.
- Arc UI exposes 234 catalog items, 127 free items, and Pro-only items. Arc
  installation uses a shadcn-compatible registry and its own foundation CSS;
  component documentation must be read before adoption.

## Design principles

1. Preserve public WealthMe APIs first. Consumers should not need to know
   whether a component is backed by Arc or WealthMe code.
2. Prefer semantic equivalence over visual novelty. A finance dashboard needs
   predictable forms, tables, dialogs, charts, and navigation more than catalog
   breadth.
3. Keep business state outside visual primitives. Arc components receive data,
   callbacks, and state from existing WealthMe hooks and feature components.
4. Adopt Arc motion only where it explains cause and effect. Every animated
   path needs a reduced-motion branch and must remain interruptible.
5. Keep one token authority per surface. Arc foundation tokens may be mapped
   to existing WealthMe semantic tokens; two competing global theme systems
   must not be active for the same component.
6. Migrate in reversible batches. Each batch must compile, test, and pass
   focused desktop/mobile checks before the next batch starts.

## Proposed architecture

### Compatibility boundary

Existing WealthMe exports remain the stable boundary:

```text
page / feature component
        ↓ existing WealthMe props and events
WealthMe adapter or wrapper
        ↓ Arc props and documented behavior
Arc component implementation
```

Adapters own translation for:

- WealthMe class names and semantic tokens to Arc styling hooks.
- Existing `variant`, `size`, `open`, `onOpenChange`, and form error props.
- Existing i18n labels and accessibility names.
- Base UI `render` composition and valid table/list markup.
- Existing controlled/uncontrolled state semantics.

An adapter must not contain API fetching, financial calculations, or page
navigation policy.

### Token strategy

Arc foundation CSS will not be imported globally until a compatibility spike
proves that its tokens can be scoped or mapped without changing unrelated
pages. The preferred order is:

1. Map Arc semantic roles to WealthMe semantic variables.
2. Scope Arc component CSS where global import would create collisions.
3. Import Arc foundation globally only after a light/dark visual diff and
   contrast check show no unintended drift.

Raw catalog colors, duplicate font stacks, and duplicate global reset rules
are prohibited in migrated WealthMe components.

## Migration order

### Batch 0 — inventory and compatibility spike

- Build a mapping table for every shared `ui`, `wm`, and `shell` component.
- Mark each item as `adopt`, `adapt`, `retain`, `replace-with-free`, or
  `prohibited`.
- Install or inspect only one low-risk free Arc primitive in an isolated
  adapter test.
- Verify how Arc registry files, CSS modules, motion dependencies, and
  accessibility behavior fit the current Base UI setup.

Done signal: mapping table and spike evidence exist, with no global behavior
change.

### Batch 1 — low-risk primitives

Candidate components:

- button/action button
- badge
- avatar
- progress
- skeleton
- alert and toast wrappers
- input/textarea error semantics

Done signal: existing consumers keep compiling and focused tests pass.

### Batch 2 — overlays and menus

Candidate components:

- dialog
- popover
- dropdown menu
- context menu
- tooltip
- drawer/bottom-sheet equivalents where they match existing shell behavior

Special checks: focus restoration, Escape routes, portal z-index, touch
long-press, mobile bottom-sheet geometry, and valid `render` composition.

### Batch 3 — selection and form controls

Candidate components:

- select/combobox
- radio group/radio cards
- checkbox
- switch
- segmented control
- date picker/date range picker
- money input only if WealthMe's FX and canonical-value contract remains
  lossless.

Special checks: keyboard navigation, visible labels, inline errors, native
mobile input modes, required fields, and no loss of currency precision.

### Batch 4 — cards, shell, and navigation

Candidate components:

- card/metric card/empty state
- tabs and accordion
- search field/command menu
- user menu
- mobile navigation and shell overlays

Special checks: route history, active state, deep links, browser back behavior,
mobile viewport overflow, and shell safe-area offsets.

### Batch 5 — data visualization and feature composition

Only migrate chart/data components when the Arc API can preserve accessible
labels, real-value formatting, legends, tooltips, and existing Apex behavior.
Do not replace charts solely for animation style. Then migrate page-local
components by feature area, starting with low-risk pages and ending with
transaction, account, and settings flows.

## Data and state flow

- Existing TanStack Query hooks remain the source of server state.
- Existing mutation pending/error/success states remain the source of feedback.
- Adapters translate state into Arc visual states such as `loading`, `error`,
  `disabled`, `open`, or `selected`.
- Components receive locale strings from `useLocale`; no catalog English copy
  may bypass the dictionary.
- Money components preserve `raw`, `canonical`, `currency`, `decimals`, FX
  pending/error state, and IDR preview semantics.
- Navigation components continue to call existing router and shell context
  APIs; Arc components do not invent routes or alter history behavior.

## Error handling and fallback

- If an Arc component's documented API cannot preserve an existing consumer,
  stop that component's migration and mark it `retain` or `adapt`.
- If Arc source introduces a dependency unavailable in the repo, prefer a
  scoped adapter or a free alternative before adding a new dependency.
- If visual parity conflicts with accessibility or financial correctness,
  correctness wins and the difference is documented.
- Pro-only items without entitlement are not copied; use a free catalog item,
  the existing WealthMe component, or defer the migration.
- Failed verification produces a batch evidence capsule in `results.md` and
  does not get folded into the next batch.

## Verification plan

Every batch requires:

### Static and unit gates

- `pnpm --filter web exec tsc --noEmit`
- Focused Jest suites for the changed primitives and their highest-risk
  consumers.
- `pnpm exec eslint` on all changed files.
- `git diff --check`.

### UI and accessibility gates

- `impeccable detect` on changed files when the executable is available;
  pre-existing advisory findings remain explicitly out of scope.
- Playwright desktop verification for opened overlays, forms, navigation, and
  changed page surfaces.
- Playwright mobile viewport verification at a real narrow viewport with touch
  enabled, including 44px targets and bottom-sheet/overflow checks.
- Keyboard-only pass for focus order, Escape, arrows, Enter/Space, and focus
  restoration.
- Reduced-motion check for every adopted animated component.

### Delivery gates

- Update `results.md` with changed files, commands, results, and blockers.
- Commit one coherent batch.
- Push to `development` only after that batch's verification is complete or
  its environment blockers are explicitly recorded and accepted.
- Never stage or overwrite unrelated user-owned changes.

## Risks and mitigations

| Risk                                              | Mitigation                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Arc foundation CSS conflicts with WealthMe tokens | Scope first; map semantic tokens; run light/dark visual diff before global import         |
| Motion dependency or version mismatch             | Repair dependency state in a dedicated prerequisite step; do not hide TypeScript failures |
| Base UI and Arc Radix primitives diverge          | Keep adapters per primitive and test focus/portal behavior before consumer migration      |
| Financial input loses precision or FX state       | Preserve `MoneyField` contract and require round-trip tests before adoption               |
| Catalog breadth causes unnecessary rewrites       | Require semantic mapping and batch acceptance criteria for every component                |
| Pro licensing boundary is crossed                 | Read catalog metadata; never reconstruct Pro source without entitlement                   |
| Large shared blast radius                         | One primitive family per batch, focused consumer tests, reversible commits                |
| Existing dirty worktree gets mixed into migration | Stage explicit paths only and report unrelated changes unchanged                          |

## Acceptance criteria for the overall initiative

- Every shared WealthMe component has a documented Arc mapping decision.
- All adopted free Arc components are behind stable WealthMe-compatible APIs.
- No Pro source is copied without entitlement.
- Existing product behavior and financial data contracts remain intact.
- All completed batches have tracked verification evidence and are pushed
  independently.
- The final migration report lists retained components and explicit reasons.

## References

- Arc catalog and agent rules: https://uiarc.dev/llms.txt
- Arc registry metadata: https://uiarc.dev/r/catalog.json
- Arc component documentation: https://uiarc.dev/components/
- WealthMe component conventions: `apps/web/WM_CONVENTIONS.md`
