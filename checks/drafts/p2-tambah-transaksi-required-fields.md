# Task: Required-field indicators + inline validation on Tambah Transaksi (audit P2-4/AC-7)

Source: `docs/audits/ui-ux-audit.md` AC-7. "Given Tambah Transaksi form,
required field marked consistently (not just optional fields), attempting
submit required field empty shows inline, field-level error message.
Verified by: live form interaction — clear amount field, attempt submit,
confirm inline error appears without full-page reload or silent no-op."

Root cause (confirmed via code review of
`apps/web/src/components/shell/transaction-dialog.tsx`): the only existing
field-level marker is the description field's "(opsional)" suffix
(`t.shell.transactionDialog.optionalSuffix`) — every required field (Jumlah,
Akun, Tanggal, and tab-specific Transfer ke / Kartu Kredit) has no marker at
all, so a user cannot tell which fields are required from the label alone.
Validation failures only ever surface as a transient `toast.error(...)` —
there is no inline, field-level error text, unlike the established pattern
already used in `apps/web/src/components/crud/crud-modal.tsx`
(`requiredErrors` state + inline error rendered under the control).

Scope: `apps/web/src/components/shell/transaction-dialog.tsx` only — a
protected `components/shell/*` foundation path, narrowly justified because
this is the single global "Tambah Transaksi" modal the audit explicitly
flagged (same precedent as task #7's `AccountCard` touch). No other shell
component, no API change.

Required fields in scope (per existing `saveTxn` validation branches):
amount (all tabs), account (expense/income/transfer tabs, not card), date
(all tabs — `DateField` already receives `required`, just unmarked/silent),
destination account (transfer tab only), card/liability (card tab only).
Category stays as-is (already optional, no change).

## Acceptance checks

### Check 1 — required fields carry a visible marker

- **Setup:** code review of the `Field` labels for amount, account, date,
  destAccount, card.
- **Expected:** each required label shows a consistent marker (e.g. a `*`
  via a shared `t.shell.transactionDialog.requiredSuffix`/similar), parallel
  to the existing `optionalSuffix` pattern on the description field. No
  visual change to the description field itself.

### Check 2 — clearing the amount field and submitting shows an inline error

- **Command:** `playwright-cli` — open `/beranda` (or any page with the
  global "+" trigger), open "Tambah Transaksi", clear the Jumlah field,
  attempt to submit.
- **Expected:** an inline, field-level error message appears under the
  Jumlah field (not just a toast), without a full-page reload or silent
  no-op. The existing `toast.error(t.shell.transactionDialog.invalidAmount)`
  may stay alongside it.

### Check 3 — submitting with no account selected on the Expense tab shows an inline error

- **Command:** `playwright-cli`, same dialog, Expense tab, fill a valid
  amount, leave Akun unselected, submit.
- **Expected:** inline error appears under the Akun tiles.

### Check 4 — existing transaction-dialog tests still pass

- **Command:** `pnpm --filter web exec jest transaction-dialog`
- **Expected:** no new failures.

### Check 5 — no new design-token-drift findings

- **Command:**
  `.agents/skills/impeccable/scripts/impeccable detect --json --target "apps/web/src/components/shell/transaction-dialog.tsx"`
- **Expected:** no new findings at the edited lines.

### Check 6 — typecheck clean

- **Command:** `pnpm --filter web exec tsc --noEmit`
- **Expected:** no new errors.

## Out of scope

- Category field (stays optional, unmarked beyond its current state).
- Any other dialog/page.
- Swapping in a third-party component (e.g. uiarc.dev's `money-input` /
  `context-menu`) — flagged separately in
  `docs/agentic/checkpoints/ui-restyle-backlog.md`'s "uiarc.dev decision"
  note; WealthMe's `AmountHero`/`formatAmountInput`/`parseRupiah` already
  cover IDR-only amount entry, so this does not qualify as a "missing
  primitive" under that standing decision.
- API/backend changes.
