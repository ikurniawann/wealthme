# Task: Resolve contradictory goal status signal on Tujuan (audit P1-5)

Source: `docs/audits/ui-ux-audit.md` P1-5 / AC-5. A goal card observed live
showed "Perlu perhatian" (needs attention) styling together with an
on-track progress reading in the same panel — two conflicting status
signals for the same goal.

Root cause (confirmed in code): `apps/web/src/app/(app)/tujuan/page.tsx`'s
`attentionGoals` (EPIC-033 revision, ~line 242-252) always pads the "Perlu
perhatian" panel with every other goal (`restGoals`, sorted by progress)
even when none of them need attention, instead of only the goals whose
`status` is `needs_boost`/`at_risk`. A goal with `status: "on_track"` then
renders inside a card titled "Perlu perhatian" with a status label reading
"Sesuai rencana" ("on plan") — the contradiction the audit flagged. The
i18n copy already matches the single-signal design
(`attCaption: "Tujuan yang tertinggal dari rencana"`,
`attAllGood: "Semua tujuan berjalan sesuai rencana."`) — only the EPIC-033
padding logic diverged from it.

Scope: `apps/web/src/app/(app)/tujuan/page.tsx` only (page-local), plus the
one existing test (`tujuan.test.tsx`) that currently asserts the padded
(contradictory) behavior and must be updated to assert the corrected,
single-signal behavior.

## Acceptance checks

### Check 1 — "Perlu perhatian" panel lists only goals that actually need attention

- **Setup:** code review + unit test.
- **Expected:** `attentionGoals` is derived solely from `needsAttentionGoals`
  (status `needs_boost`/`at_risk`), capped at `MAX_ATTENTION_ROWS` — no
  `on_track`/`achieved` goal is padded in.

### Check 2 — empty state shown when no goal needs attention

- **Setup:** unit test with all goals `on_track`.
- **Expected:** the panel shows `t.tujuan.v2.attAllGood` ("Semua tujuan
  berjalan sesuai rencana.") instead of listing an on-track goal.

### Check 3 — a goal that does need attention still appears correctly

- **Setup:** unit test with one `needs_boost` goal among on-track goals.
- **Expected:** only the `needs_boost` goal appears under "Perlu perhatian".

### Check 4 — existing test suite updated and green

- **Command:** `pnpm --filter web exec jest tujuan.test.tsx`
- **Expected:** all tests pass (the EPIC-033 test asserting the old padded
  behavior is rewritten to assert the corrected single-signal behavior).

### Check 5 — no new design-token-drift findings

- **Command:**
  `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/tujuan/page.tsx"`
- **Expected:** no new findings at the edited lines.

## Out of scope

- Any other page.
- API/backend changes (goal `status` values are unchanged).
