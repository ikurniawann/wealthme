# Task: Label the IAM page-access-matrix bulk-set buttons (audit P2-2)

Source: `docs/audits/ui-ux-audit.md` P2-2. The access matrix renders without
clear row/column ARIA labeling, so a screen-reader user cannot resolve
"which permission, for which resource."

Root cause (confirmed live via playwright-cli accessibility snapshot on
`/iam` → "Buat role" → the `PageAccessMatrix` inside `RoleEditorDialog`):
each page-group's **per-row** controls are already well-labeled (a
`radiogroup` with `aria-label="Akses {page label}"` per row, e.g. "Akses
Beranda", each radio individually named "Tidak"/"Lihat"/"Kelola"). The real
gap is the **per-group bulk-set row** ("Semua: Tidak / Lihat / Kelola") —
`apps/web/src/app/(app)/iam/_components/page-access-matrix.tsx` ~line
58-68 — which renders 3 buttons per group (6 groups × 3 = 18 buttons) with
only the bare level label as their accessible name. A screen-reader user
tabbing through hears "Tidak", "Lihat", "Kelola" repeated 6 times with no
indication which group ("Beranda", "Keuangan", etc.) each set applies to.

Scope: `apps/web/src/app/(app)/iam/_components/page-access-matrix.tsx`
only (page-local, not a protected foundation path).

## Acceptance checks

### Check 1 — each bulk-set button has a group-scoped accessible name

- **Setup:** code review / unit test of the rendered buttons.
- **Expected:** each "Semua" button gets an `aria-label` that includes both
  the group title and the target level (e.g. `"Set semua {title} ke
{o.label}"`), while the visible text stays the short level label
  (`o.label`) — no visual change.

### Check 2 — live accessibility snapshot shows distinct names

- **Command:** `playwright-cli` on `/iam` → open the role editor → snapshot.
- **Expected:** the 18 bulk-set buttons no longer collapse to 3 repeated
  bare names; each accessible name is unique per group+level.

### Check 3 — existing IAM tests still pass

- **Command:** `pnpm --filter web exec jest iam`
- **Expected:** no new failures.

### Check 4 — no new design-token-drift findings

- **Command:**
  `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/iam/_components/page-access-matrix.tsx"`
- **Expected:** no new findings at the edited lines.

## Out of scope

- The per-row radiogroups (`"Akses {label}"`) — already correctly labeled.
- Any other page.
- API/backend changes.
