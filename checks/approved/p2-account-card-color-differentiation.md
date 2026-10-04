# Task: Differentiate default account card colors (audit P2-1)

Source: `docs/audits/ui-ux-audit.md` P2-1. Multiple bank account cards (BCA,
Mandiri, BNI) read as visually similar in the Rekening horizontal scroller.

Root cause (confirmed in code): `components/wm/account-card.tsx`'s
`defaultLook(type)` returns the **same** skin for every account of a given
type (`"bank"` always defaults to `"lime"`, `"ewallet"` to `"forest"`,
`"cash"` to `"sand"`), so two un-customized bank accounts are visually
identical until the user manually opens "Ubah tampilan kartu" per account.
The per-account customization feature already exists (stored in
localStorage via `useCardLooks`/`setLook`) — only the _default_, before any
manual customization, lacks differentiation.

Foundation-path justification (`components/wm/account-card.tsx` is a
protected foundation file per `WM_CONVENTIONS.md`): this is the single
shared source of `defaultLook` used by every account-card call site
(Rekening, Dana, Beranda bento + mobile home) — the fix must land here to
reach all of them, matching the narrow, audited (P2-1) change the backlog
calls for. No other foundation file is touched.

Scope: `components/wm/account-card.tsx` only — change `defaultLook` to pick
a skin from a small per-type pool, deterministically keyed by the account's
own `id` (stable across reloads, no new state), instead of always picking
the pool's first entry. A user's manually-saved `look` (localStorage) still
always wins — `lookFor` only falls back to `defaultLook` when nothing is
saved. Pattern selection logic (`hatch`/`plain` by type) is unchanged —
out of scope, this task is about color only.

## Acceptance checks

### Check 1 — two un-customized bank accounts get different default skins

- **Setup:** unit test or code review — call `defaultLook("bank", idA)` and
  `defaultLook("bank", idB)` for two different ids.
- **Expected:** different `skin` values for most id pairs (a hash-based
  pool pick, not a global constant).

### Check 2 — same account always gets the same default skin (stable)

- **Expected:** `defaultLook("bank", "same-id")` returns the same skin on
  repeated calls (pure function of `id`+`type`, no randomness/state).

### Check 3 — manual customization still overrides the default

- **Setup:** code review of `lookFor` in `useCardLooks`.
- **Expected:** `looks[id] ?? defaultLook(type, id)` — a saved look is
  still checked first; `defaultLook` is only the fallback.

### Check 4 — existing call sites and tests unaffected

- **Command:** `pnpm --filter web exec jest rekening dana beranda account-card`
- **Expected:** no new failures (call sites pass `id`/`type` already; no
  signature break for any caller outside this file).

### Check 5 — no new design-token-drift findings

- **Command:**
  `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/components/wm/account-card.tsx"`
- **Expected:** no new findings at the edited lines.

## Out of scope

- Pattern (`hatch`/`dots`/`waves`/`plain`) default selection.
- Any change to the manual customization UI/flow.
- API/backend changes.
