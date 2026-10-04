# Task: Add thousand-separator live formatting to "Penghasilan Bulanan" field

Source: user-flagged live, 2026-10-05, screenshot of "Profil Saya" modal. The monthly
income input shows raw digits (`1000000`) while every other Rupiah input in the app
(donation, rekonsiliasi, transaction dialog, etc.) live-formats with `formatAmountInput`
(`@/lib/format`, per `WM_CONVENTIONS.md`'s documented formatter contract).

Root cause (confirmed in code): `apps/web/src/app/(app)/akun/page.tsx` — the
`monthlyIncome` field's initial form value (~line 433), its `onChange` handler
(~line 599), and its submit payload (~line 506-507) all pass the raw string through
unformatted/unparsed, instead of the established format-on-display /
parse-on-submit round trip (see `donation/page.tsx` for the reference pattern).

Scope: `apps/web/src/app/(app)/akun/page.tsx` only (page-local). No API changes — the
value sent to the backend stays a plain digit string, same shape as before, just
derived via `parseRupiah` instead of a raw trim.

## Acceptance checks

### Check 1 — typing formats live with thousand separators

- **Setup:** `playwright-cli` session, authenticated, open "Profil Saya".
- **Action:** type `1000000` into the "Penghasilan Bulanan" field.
- **Expected:** the field displays `1.000.000` (id-ID grouping), not raw digits.
- **Command:**
  ```
  playwright-cli -s=audit fill <income-field-ref> "1000000"
  playwright-cli -s=audit eval "() => document.querySelector('[name=monthlyIncome], input').value" # or by ref/label
  ```

### Check 2 — existing value loads pre-formatted

- **Action:** reload the profile modal after a value is saved.
- **Expected:** the field shows the formatted value on open, not raw digits.

### Check 3 — submitted payload is still a plain digit string (no API shape change)

- **Command:** code review of the `handleSave` payload construction — confirm
  `payload.monthlyIncome` is built via `String(parseRupiah(form.monthlyIncome))`,
  equivalent in shape to the original `form.monthlyIncome.trim()` when the user typed
  plain digits.

### Check 4 — no new design-token-drift findings

- **Command:**
  `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/app/(app)/akun/page.tsx"`
- **Expected:** no new findings at the edited lines.

## Out of scope

- Any other field in the profile form.
- API/backend changes.
