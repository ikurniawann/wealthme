# Task: Fix hardcoded SFMono-Regular font stack in masterdata.css

Source: `docs/audits/ui-ux-audit.md` finding P1-1.
Root cause (confirmed in code): `apps/web/src/app/(app)/masterdata/masterdata.css:112`
— `.md-cat-code` hardcodes `font-family: ui-monospace, SFMono-Regular, Menlo, monospace`
instead of the project's `--font-mono` token (`var(--font-dm-mono), ui-monospace, monospace`,
`globals.css:21`, exposed as the `.mono` utility at `globals.css:379`). The element itself is a
legitimate mono use (a category **code**, matching DESIGN.md's "mono is reserved for codes and
IDs") — the bug is the hardcoded stack bypassing the DM Mono token, not misuse of mono.

Scope: `apps/web/src/app/(app)/masterdata/masterdata.css` only (page-local, not a foundation
path). No API changes.

## Acceptance checks

### Check 1 — rule uses the project mono token

- **Action:** inspect the compiled rule for `.md-cat-code`.
- **Expected:** `font-family` resolves to `var(--font-mono)` (or references `--font-dm-mono`
  directly), not a hardcoded `SFMono-Regular`/`Menlo` stack.
- **Command:** `grep -n "font-family" apps/web/src/app/\(app\)/masterdata/masterdata.css`
  Expected result: no literal `SFMono-Regular` remains.

### Check 2 — no new design-token-drift findings

- **Command:**
  `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/masterdata/masterdata.css"`
- **Expected:** no new findings introduced at the edited line (the pre-existing finding, if
  any, at line 112 should disappear or change to reference the token correctly).

## Out of scope

- Any other masterdata.css rules.
- Other backlog tasks (`beranda.css` transition, TanStack Query error, Dana formatting, Tujuan
  status, etc.) — tracked separately in `docs/agentic/checkpoints/ui-restyle-backlog.md`.
