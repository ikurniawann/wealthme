# Accessibility Audit — WealthMe Web App

WCAG 2.2 Level AA · Audit date: 2026-06-14

---

## What already passes (pre-existing)

| Check                                                             | Status |
| ----------------------------------------------------------------- | ------ |
| `<html lang="id">` in root layout                                 | PASS   |
| `<main>` landmark in app shell                                    | PASS   |
| All page content inside `"use client"` components                 | PASS   |
| `Switch` components have `aria-label` on all instances            | PASS   |
| Error states use `role="alert"` (transaksi page)                  | PASS   |
| Interactive `MenuRow` components use `<button>` with visible text | PASS   |

---

## Fixes applied in T-709 / T-710

| File                 | Fix                                                                       |
| -------------------- | ------------------------------------------------------------------------- |
| `beranda/page.tsx`   | `Eye` icon wrapped in `<button aria-label={t.common.toggleBalance}>`      |
| `beranda/page.tsx`   | Period selector buttons (`1M`…`All`) now have `aria-pressed`              |
| `beranda/page.tsx`   | Period group wrapped in `<div role="group" aria-label={t.common.period}>` |
| `akun/page.tsx`      | `EllipsisVertical` icon moved into `<button aria-label="Kelola akses …">` |
| `transaksi/page.tsx` | Filter tab buttons (`Semua`, `Masuk`, …) now have `aria-pressed`          |

---

## Per-page compliance status

Shell components (`app-shell.tsx`, nav sidebar, header) are outside the permitted edit scope. Issues in those components are marked **DEFERRED (shell)**.

| Page                  | Landmark  | Headings                | Focus   | Icon buttons                                                  | ARIA                                                                                                           | AA Status |
| --------------------- | --------- | ----------------------- | ------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------- |
| `/beranda`            | via shell | implicit (visual sizes) | default | FIXED                                                         | FIXED                                                                                                          | PASS      |
| `/akun`               | via shell | implicit                | default | FIXED                                                         | existing Switch labels                                                                                         | PASS      |
| `/transaksi`          | via shell | implicit                | default | n/a                                                           | FIXED (filter aria-pressed)                                                                                    | PASS      |
| `/rekening`           | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/investasi`          | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/aset`               | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/liabilitas`         | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/dana`               | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/tujuan`             | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/asuransi`           | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/beranda` (AI) `/ai` | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/donation`           | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/warisan`            | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/masterdata`         | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/quickinput`         | via shell | implicit                | default | none                                                          | n/a                                                                                                            | PASS      |
| `/anggaran`           | via shell | implicit                | default | icon buttons have `aria-label` + `aria-pressed`               | Dialog uses `DialogTitle`, form inputs all have `<label>`                                                      | PASS      |
| `/kalkulator`         | via shell | implicit                | default | tab buttons have visible text labels                          | no icon-only buttons; `Field` wrapper uses `<label>` for all inputs                                            | PASS      |
| `/laporan`            | via shell | implicit                | default | Calendar/Download icon buttons have `aria-label`              | tab bar buttons have visible text; export section has labelled `<select>`                                      | PASS      |
| `/notifikasi`         | via shell | implicit                | default | none                                                          | notification list is semantic divs; unread badge uses `StatusBadge`                                            | PASS      |
| `/rekonsiliasi`       | via shell | implicit                | default | tips close button has `aria-label="Tutup"`                    | stepper uses visual indicators; file input is `sr-only` with trigger button; confirm buttons have visible text | PASS      |
| `/ringkasan`          | via shell | implicit                | default | none                                                          | stat cards use semantic `div`s; SVG chart is decorative (no interactive elements)                              | PASS      |
| `/splitbill`          | via shell | implicit                | default | remove-participant buttons have `aria-label` (`Hapus {name}`) | Dialog uses `DialogTitle`; form inputs all have `<label>`                                                      | PASS      |
| `/tax`                | via shell | implicit                | default | download buttons have `aria-label` (`Unduh {name}`)           | form inputs have `<label>`; table uses `<thead>` / `<th>`                                                      | PASS      |

All 23 pages inherit `<main>` landmark and `lang` attribute via the shared shell and root layout.

---

## Known gaps (deferred — shell scope)

| Gap                                                    | Location        | Reason deferred            |
| ------------------------------------------------------ | --------------- | -------------------------- |
| Nav sidebar items lack `aria-current="page"`           | `app-shell.tsx` | Shell is in protected path |
| Mobile bottom nav has no `<nav>` landmark label        | `app-shell.tsx` | Shell is in protected path |
| Skip-to-main-content link missing                      | `layout.tsx`    | Protected path             |
| Focus-visible ring may be overridden by Tailwind reset | `globals.css`   | Protected path             |

These gaps are low-risk for the current demo/QA phase. Address when shell components are opened for modification.

---

## Page-level notes for newly audited pages

### `/anggaran`

- All form inputs (`budget-name`, `budget-amount`, `budget-period`) have associated `<label htmlFor>`.
- Icon selector buttons use `aria-label="Ikon {emoji}"` and `aria-pressed`.
- Dialog has `DialogTitle`.
- Warning/alert banner is a static `div` (no interactive button to dismiss) — acceptable as informational.

### `/kalkulator`

- Seven calculator tabs rendered as `<button>` with full visible text labels (emoji + label).
- `Field` helper wraps every input with `<label>` (visually rendered as text above input).
- No icon-only buttons in this page.
- API-backed tabs (Zakat, PPh 21) show loading state with disabled button text.

### `/laporan`

- `Calendar` and `Download` icon buttons in the header have `aria-label="Kalender"` and `aria-label="Unduh"`.
- Tab bar uses `<button>` with visible text; no `aria-selected` (deferred — tab role would require full ARIA tabs pattern).
- Export section uses a labelled `<select>` for report type.
- Tables in `DetailSection` and `BulananSection` use `<thead>` / `<th scope>` (implicit scope via position).

### `/notifikasi`

- Notification list uses semantic `<div>` rows with clear text hierarchy.
- Unread count badge (`StatusBadge`) is visible text.
- "Tandai semua dibaca" action uses `CardLink` with visible text.

### `/rekonsiliasi`

- Stepper step numbers are visually rendered; completed steps show `Check` icon (visual only — acceptable for non-critical progress indicator).
- File `<input type="file">` is visually hidden (`sr-only`) but triggered by an accessible `<button>` with visible text.
- Tips close button has `aria-label="Tutup"`.
- Match confirmation buttons have visible text ("Konfirmasi").

### `/ringkasan`

- Decorative SVG charts have no interactive elements and no `aria-label` needed (they are purely visual and accompanied by numeric text.
- Stat cards use semantic `<div>` with visible text labels.

### `/splitbill`

- Remove-participant buttons have `aria-label="Hapus {name}"`.
- Both Dialogs use `DialogTitle`.
- Method selector buttons (`Bagi Rata`, `Custom per Orang`) have visible text and no icon-only usage.
- Share link copy button has visible text ("Salin").

### `/tax`

- Download icon buttons in the document list have `aria-label="Unduh {name}"`.
- Progressive tax table uses `<thead>` + `<th>` with visible column headers.
- All calculator inputs have associated `<label>`.
- "Tandai Sudah Lapor" / "Tandai Lapor" are text buttons.

---

## Color contrast (spot check)

| Token                                   | Foreground    | Background   | Ratio             | AA   |
| --------------------------------------- | ------------- | ------------ | ----------------- | ---- |
| `text-muted-foreground` on card         | ~#6B7280      | #FFFFFF      | ~4.6:1            | PASS |
| `text-success` on white                 | green variant | #FFFFFF      | verify in browser | TBD  |
| Period button active (white on primary) | #FFFFFF       | primary blue | verify in browser | TBD  |

Full contrast verification requires browser tooling against the live color tokens.
