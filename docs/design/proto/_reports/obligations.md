# Kewajiban group — build report

Pages built: `warisan.html`, `donation.html`, `tax.html`, `persetujuan.html`. All four verified with
`node _shot.cjs` (1440px + 390px, no console errors, no horizontal overflow) and a Playwright pass that
opens every dialog/modal on each page (add/edit forms, approve/reject, save-to-record) with no runtime
errors.

## Feature checklist (source → prototype)

### warisan.html (source: `app/(app)/warisan/page.tsx`)

- Asset list with type icon, category badge, linked-asset note, estimated value → `.wr-card` list, `card()`.
- Heir allocation chips + progress bar (allocated/unallocated %) → `.wr-chips`, `.wr-alloc`/`.track`.
- Visibility toggle per asset (`visibility: heirs_only|private`) → `data-vis` switch in each card.
- Add/edit modal: pick from existing Aset vs manual entry (segmented control), name, value, category,
  notes, visibility switch, heir editor table (name/relationship/%, add/remove row, allocation notice,
  blocks >100%) → `openForm()`/`heirEditorHtml()`.
- Delete with confirm + undo toast → `del()`.
- Beneficiary-allocation donut + per-heir avatar rows, "Belum dialokasikan" slice → `WM.chart.donut` in `draw()`.
- Hero: total value, asset count, heir count.
- Honest-UI note: no faraid/legal engine exists in source either — the real page is manual free-text
  heirs/percentages only, so the prototype states plainly this is personal record-keeping, not a legal
  division, and points to a notary for faraid.

### donation.html (source: `app/(app)/donation/page.tsx`)

- Zakat Maal calculator: cash+investments+gold−liabilities, nisab = 85g × gold price (indicative
  Rp1,100,000/g, same fallback constant as `calculators.service.ts`), haul checkbox, `meetsNisab`/
  `isObligated`/`zakat = zakatable×2.5%` ported exactly → `calcZakat()`.
- Persepuluhan (tithe) calculator: (income+other income) × adjustable rate%, default 10%, independent
  arithmetic (no nisab/haul) → tithe calc block.
- Family-religion gate: Islam shows zakat calculator, Kristen/Katolik shows tithe, Hindu/Buddha/none show
  an honest "general only"/"not set" note, with an inline picker to set it (mirrors the real page's
  inline prompt) → `drawReligionBox()`/`drawCalc()`.
- Donation types filtered by religion; tax-deductible switch restricted to zakat_maal/zakat_fitrah/
  persepuluhan only → `typesFor()`, `syncDed()`.
- Add/edit/delete donation, optional source account (deducts via `WM.addTx`), history list with type
  icon, recipient, date, account, deductible badge → `openForm()`, `drawHist()`.
- Hero + totals: total this year, transaction count, deductible-this-year total.
- Simulated/cut: receipt upload (no file storage exists in this static prototype) — dropped rather than
  faked; "Kuitansi Tersimpan" stat card was not built for the same reason (Honest UI).

### tax.html (source: `app/(app)/tax/page.tsx` + `_components/*` + `tax-engine/*`)

- PPh 21 OP calculator: PTKP (base 54jt + married 4.5jt + K/I wife 54jt + dependents×4.5jt), biaya
  jabatan (5%, cap Rp6jt/yr), pension deduction capped to gross−biayaJabatan, freelance NPPN% net,
  other net income, zakat/persepuluhan deduction (auto-filled from this year's deductible donations,
  editable), PKP floored to nearest Rp1,000, Pasal 17 progressive brackets (5/15/25/30/35%) — all ported
  from `tax-engine/pph-op.engine.ts`, `ptkp.ts` verbatim (JS numbers instead of bigint, safe at these
  magnitudes) → `computePphOp()`, `pasal17()`.
- Bracket breakdown table, PTKP/PKP/effective-rate summary, marital status + dependents segmented
  controls, tax-year selector.
- TER bulanan & koreksi Desember: full verified TER_A/B/C band tables ported from
  `tax-rules/data/pph21.rules.ts` (PP 58/2023 Lampiran), category resolved via the real TK/K map,
  monthly withholding Jan–Nov + December true-up = annual tax − withheld → `terRateBps()`, `recalcTer()`.
- PPh final UMKM 0,5%: 12-month omzet input, cumulative tracking, Rp500jt exemption, Rp4,8M ceiling
  warning, 7-year individual time limit pre-2026-04-22 (PP 20/2026 removes it after) → `umkmYear()`.
- Pajak final investasi & penghasilan lain: deposito/tabungan (20%, exempt ≤Rp7,5jt principal), dividen
  (10% / 0% reinvested), saham IDX (0,1%), kupon SBN (10%), reksa dana (0%), kripto domestik (0,21%)/luar
  (1%), sewa (10%), p2p/emas (user-entered rate, honest "no rate on file" state) → `FINAL` table,
  `recalcFinal()`.
- SPT status trio (prev/current year, mark-as-reported), tax documents list (upload/delete, explicitly
  labeled "Simulasi — berkas tidak benar-benar diunggah"), Riwayat pajak, save-to-record review dialog,
  CSV summary download, "Lapor SPT di DJP Online" external link. All IDR figures, estimates labeled
  "Perkiraan".

### persetujuan.html (source: `app/(app)/persetujuan/page.tsx`)

- Reads/writes the shared `requests` store (fund requests) already seeded by the foundation.
- Pending tab: one card per request (avatar, requester → target account, amount, keperluan box,
  Setujui/Tolak).
- Approve: opens a dialog to pick a source account, blocks on insufficient balance with the same inline
  danger-notice pattern as the source (`ApproveRequestForm`), then calls `WM.addTx({type:"tf",...})` to
  move real money and marks the request `approved` with `decidedAt`/`decidedBy`.
- Reject: modal with an optional reason field, marks `rejected` with `decidedAt`/`decidedBy`/`rejectReason`.
- Riwayat tab: decision table (Pemohon/Keperluan/Rekening/Status/Diputuskan oleh/Tanggal/Jumlah).
- Stat tiles: pending count+total, approved this month, rejected this month. Owner-only gate (mirrors
  `canAccessPage` check) shown as a lock-style notice for non-owner roles.
- Notifications for pending requests are handled by the shared shell/bell (unchanged foundation feature).

## Simulated / honestly labeled

- Tax document uploads (donation receipts likewise) — filename/size only, no real file storage, labeled.
- Gold price for zakat nisab uses the same indicative constant as the backend fallback (no live price
  feed in this static prototype).
- "Lapor SPT di DJP Online" opens the real external DJP site in a new tab (no fake in-app filing flow).

## Nothing missing beyond the above; no wm.css/wm.js edits made — all four pages are self-contained with page-local CSS only.
