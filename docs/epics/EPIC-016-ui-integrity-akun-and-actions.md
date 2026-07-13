# EPIC-016: UI Integrity — Non-Functional Actions & Fake Data

status: backlog
environment: dev
retries: 0
phase: 4
priority: P0
area: Frontend
source: `/agentic-start` full-app audit 2026-07-13 (follow-up to EPIC-015)

## Goal

Every button, toggle, and form field a user can see must either do what it
implies or honestly say it doesn't yet. No screen may show a success
confirmation for an action that silently discarded the user's input, and no
screen may present hardcoded fake data as if it were the user's real
financial data. This epic catalogs every remaining instance found by a
full-app sweep after EPIC-015 closed; EPIC-015 covered only Tax, Donation,
Reconciliation, and session/onboarding integrity.

## Evidence

Full findings: `/agentic-start` audit, 2026-07-13, `apps/web/src/app/(app)/**/page.tsx`
(24 pages checked). Condensed by page below; see the epic Automation Log for
the full line-by-line detail preserved from the audit.

## Tasks

- [ ] ### A — `/akun` Profile save silently drops fields (highest priority)
  - `ProfilBody`: "Simpan Perubahan" sends only the name field to `PATCH
/auth/profile`. Phone, birth date, gender, job, and monthly income are
    uncontrolled `defaultValue` inputs never read on save, yet a success toast
    fires unconditionally.
  - Fix: either wire every field into the save payload (extending the
    profile API if needed) or remove/disable the fields that aren't
    persisted yet, and don't show success unless the save actually covered
    what changed.

- [ ] ### B — `/akun` Settings, Notifications, Privacy tabs are fully inert
  - `PengaturanBody`: currency/language/theme pickers write to an orphaned
    `localStorage["wealthme_settings"]` key never read by the real theme
    system (`components/providers/theme-provider.tsx`) or real i18n
    (`hooks/use-locale.ts`). "Simpan Pengaturan" shows success but changes
    nothing app-wide.
  - `NotifSettingBody`: 11 toggles are `defaultChecked` only, no state, no
    persistence; "Simpan" toasts success regardless.
  - `PrivasiBody`: privacy toggles (e.g. "Sembunyikan dari Anggota Family")
    have no state or effect anywhere — a privacy control that doesn't
    privacy.
  - Fix: wire each control to the real system it should control, or clearly
    relabel as "coming soon" (matching the honest pattern already used on
    `/tax` upload and `/warisan` document upload).

- [ ] ### C — `/akun` Koneksi tab shows fake linked accounts
  - Hardcoded bank/e-wallet list (`BCA Tahapan ···9010`, `Mandiri ···5586`,
    etc.) is not sourced from the real accounts API, unlike `/rekening` and
    `/dana` which are properly wired.
  - Fix: either remove this section or replace it with real data from the
    same accounts endpoint `/rekening` already uses.

- [ ] ### D — `/akun` misc toast-only actions
  - PIN setup, session "Akhiri" (end session — sessions list itself is
    fake), "Ekspor Data Saya", contact rows (chat/email/phone/whatsapp),
    Privacy Policy/Terms/Licenses links, admin "Kelola akses" menu, and
    `AddAdminDialog`'s Peran/Nama fields (unbound; server role hardcoded to
    `admin_staff` regardless of selection).
  - Fix per-item: wire to a real action, or replace with an honest
    "coming soon" state — do not leave a working-looking button that
    silently no-ops.

- [ ] ### E — `/akun` Kirim Feedback textarea captures nothing
  - The feedback `textarea` has no `value`/`onChange`/ref; the button always
    shows "terkirim" regardless of what (if anything) was typed.
  - Fix: bind the textarea and actually send the feedback somewhere
    (support email, a backend endpoint, or at minimum a stored record) or
    remove the false confirmation.

- [ ] ### F — `/laporan` period selector and header actions are decorative
  - Calendar button, period `<select>` (hardcoded month options, no
    `value`/`onChange`), and Download button in the page header do nothing;
    the page already has a fully real "Export Laporan" feature lower down
    (real POST `/exports`, polling, real download) that duplicates this
    intent correctly.
  - Fix: wire the header period selector to actually filter the report data,
    or remove the duplicate fake controls and point users at the real
    Export Laporan feature.

- [ ] ### G — `/tax` e-Filing and download-summary buttons are toast-only
  - "Lapor SPT Tahunan" and "Unduh Ringkasan" imply a real external action
    (opening DJP e-Filing, generating a download) but only show a toast.
  - Fix: wire to a real destination/export, or relabel as "coming soon"
    (the page already does this correctly for document upload).

- [ ] ### H — `/asuransi` premium payment button is a no-op
  - The "Bayar" (pay premium) button on a policy card doesn't record a
    payment or update any renewal/due-date state.
  - Fix: wire to a real payment-recording flow (can reuse the
    `autoRenewDate`/billing-cycle machinery from EPIC-015 Task B), or relabel
    honestly.

- [ ] ### I — `/rekonsiliasi` export buttons are toast-only
  - "Unduh PDF" / "Unduh Excel" on the reconciliation summary do nothing
    (the summary counts above them are real).
  - Fix: wire to a real export, or remove until one exists.

- [ ] ### J — Low-priority polish
  - `/beranda`: cashflow card month `<select>` has exactly one option and no
    `onChange` — either make it multi-month and functional or drop the
    dropdown chrome for a plain label.
  - `/donation`: `NISAB` (zakat gold-price threshold) is a hardcoded static
    Rupiah constant, not sourced from any live gold-price reference — will
    silently drift wrong over time. Low priority (business-logic staleness,
    not fake UI), but worth a follow-up ticket to source it from a rate
    feed or make it configurable.

## Explicitly Not In Scope (already honest, verified during the audit)

`/tax` document-upload empty state and `/warisan` document-upload both
already say "belum tersedia — segera hadir" and are excluded — they disclose
their own limitation instead of faking success. `ai`, `anggaran`, `aset`,
`dana`, `investasi`, `kalkulator`, `liabilitas`, `mastercoa`, `masterdata`,
`notifikasi`, `panduan`, `quickinput`, `rekening`, `ringkasan`, `splitbill`,
`transaksi`, `tujuan` were all checked and found clean — every control is
state-bound and every data source is a real `useQuery`/`apiFetch` call.

## Acceptance Criteria

- No button, toggle, or form shows a success confirmation for an action it
  did not actually perform.
- No screen presents hardcoded/fake data as if it were the user's own
  financial data.
- Any genuinely unbuilt feature is disclosed as "coming soon" rather than
  faked, matching the existing `/tax` and `/warisan` pattern.
- All static gates (lint, build, test, security) remain green.

## Test Plan

- Unit/component tests for each rewired control (profile save payload,
  settings persistence, feedback capture).
- Playwright E2E per fixed page confirming the control's real effect
  persists across a reload.
- Manual QA pass on `/akun` specifically, given its concentration of
  findings.

## Agent Routing

`ecc:react-reviewer` + `ecc:typescript-reviewer` for each task's diff;
`review-qa-agent` for WealthMe-specific acceptance-criteria checks;
`ecc:security-reviewer` for anything touching account/session/admin-role
data (Tasks A, D, and the `AddAdminDialog` role field).

## Done Signal

Each task group above closes independently via `/task-work EPIC-016 <n>`;
the epic closes when all tasks are checked and the acceptance criteria hold
across a fresh QA pass of `/akun`, `/laporan`, `/tax`, `/asuransi`, and
`/rekonsiliasi`.

## Automation Log

- 2026-07-13 — `/agentic-start` created this epic from a full-app
  non-functional-UI audit (24 pages, delegated to a read-only research
  agent) run immediately after closing out EPIC-015. Status left at
  `backlog` rather than `on-progress`: several tasks (B, C, D) involve a
  product decision (build the real feature vs. honestly remove/relabel it)
  that should be made by a human before an automated loop picks this up.
