# wealth-b — Aset, Liabilitas, Asuransi

Pages built: `aset.html`, `aset-detail.html`, `liabilitas.html`, `asuransi.html`.
All four verified with `node _shot.cjs` at 1440/390px: `overflow: false, errors: none` on every page (liabilitas also spot-checked at 1024). Dialogs exercised interactively (Playwright) with zero console errors on every page.

## aset.html (port of `app/(app)/aset/page.tsx`)

- 5 tabs (semua/dana/rekening/investasi/fisik) -> `.tabs` + `activeTab` filter, matches real `TAB_IDS`.
- Total banner + per-user privacy eye toggle (`wm.aset-privacy.<userId>` localStorage key, same pattern as real app) -> `.cover` banner + `#eye`.
- Breakdown stat cards (Dana/Rekening/Investasi/Aset fisik), shown only when ≥2 non-zero categories, mirroring `nonZeroAssetCategoryCount`.
- 6-month trend + allocation donut, built from real per-asset history (not a fabricated fallback) — Honest UI: shows an empty state until 2+ real months exist.
- Grouped cards: Dana & Rekening, Investasi, Aset Fisik (recorded/projection dual value, rate badge, edit/delete, "Gunakan nilai ini" adopt action).
- Add/Edit dialog: name, type (properti/kendaraan/elektronik/perhiasan/emas/lainnya), value, value-change mode (percent vs Rp/year fixed) with per-type default-rate hint, acquisition date, notes, document upload.
- Live "Proyeksi 5 tahun" notice, exact real formula: percent → value×(1+rate/100×5), fixed → value+amount×5, floored at 0.
- Delete confirm (`WM.confirm`).
- Simulated: document upload/preview (toast "Dokumen terlampir (simulasi)" — no server).

## aset-detail.html (port of `app/(app)/aset/[id]/page.tsx`)

- Reads `?id=` via `URLSearchParams`; "Aset tidak ditemukan" empty state; back link to aset.html.
- Value history list + area chart, revaluation dialog (nilai baru / persentase perubahan modes, date max today, optional note).
- Documents section (simulated upload/open/delete, clearly labeled).
- `canManage` approximated via `WM.isOwner()` (master/spouse) since this prototype has no grant system.

## liabilitas.html (port of `app/(app)/liabilitas/*`)

- KPR: 4 rate schemes (fixed/tiered/floating rate periods) × 2 payment methods (flat/anuitas), all 7 real presets (manual/flpp_tapak/flpp_rusun/konvensional/berjenjang/syariah_murabahah/syariah_mmq) ported verbatim with official/example badges.
- Amortisation math ported near line-for-line from the API's util (BigInt, round-half-up, no floating point) — hand-verified against a manual example to the rupiah.
- Full scrollable amortisation table, due-date/grace-period logic, floating-rate history panel (explicitly labeled as manual notes, not a live feed).
- Prepayment simulator (reduce tenor / reduce installment / full payoff) with penalty, cash-out, and net-saving preview, labeled "simulasi saja" until confirmed.
- "Record installment payment" dialog: principal/interest split preview, balance check, **creates a real tx via `WM.addTx`** and updates outstanding/paid state.
- Credit card, pinjaman, kendaraan, lainnya kinds with correct field visibility per type.
- Add/edit/delete with real validation (tenor 1–600, rate 0–30%, required fields, rate-period pattern checks).
- Cover headline: total sisa liabilitas, KPR/pinjaman vs kartu split, cicilan bulan ini, DTA ratio with the same 4 risk tiers as the real app.
- Store key `liabilities`; one-time migration upgrades the old flat seed shape to the full shape.
- Known simplification: anuitas schedules always re-annuitise fresh at the first displayed row rather than preserving the API's `installmentAnchorPeriod` persistence nuance (documented in code comment) — underlying math is exact.
- Out of scope (matches rest of prototype): FX/multi-currency, no 6-month net-worth chart (that's `/ringkasan`, not `/liabilitas`).

## asuransi.html (port of `app/(app)/asuransi/page.tsx`)

- Policy cards (type, provider, status, pertanggungan/premi, renewal date + badge, no. polis, beneficiary summary, Bayar/Ubah/Hapus).
- Add/Edit dialog: nama, provider (opsional), jenis, status, premi, periode, pertanggungan (opsional), tanggal perpanjangan (opsional), no. polis, auto-renew (shown once a renewal date exists), catatan, beneficiary editor (link to family member, nama, hubungan, persentase, allocation bar, over-100% blocked, under-100% warns).
- Pay dialog: real local debit via `WM.addTx` (category "Lainnya" — no dedicated Asuransi category exists in seed data), balance check, advances renewal date, marks paid.
- Delete policy/beneficiary with confirm + undo toast.
- Aggregated Ahli Waris table across all policies.
- Charts: premi 6-bulan (labeled "≈ Perkiraan", since no real premium history exists) and coverage-by-type donut.
- Nearest-renewal warning computed live (not hardcoded).
- No claims feature — confirmed absent in the real source, so none was invented (Honest UI).

## Simulated across the group (all disclosed in-UI)

- Document upload/preview (aset, aset-detail): no server, toast says "(simulasi)".
- Floating-rate entries (liabilitas): manual notes, not a live bank feed.
- Premium trend chart (asuransi): labeled as an estimate, same approach the real app itself uses.

## Not implemented / out of scope

- FX/multi-currency on liabilitas (prototype is IDR-only everywhere).
- Net-worth 6-month chart lives on `/ringkasan` in the real app, correctly not duplicated on `/liabilitas`.
