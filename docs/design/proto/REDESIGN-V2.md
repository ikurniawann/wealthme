# Redesign v2: remaining pages (read before touching any page)

User verdict on v1: layouts and behaviour still copied the old site. Only `index.html` (the approved concept)
and `anggaran.html` (the v2 exemplar) are done. Every other page must be re-laid-out and re-behaved to match them.
Keep each page's data logic, calculations and store keys; replace markup, layout and interaction.

## Layout (study anggaran.html + index.html)

- No page title block with subtitle. The dark gradient hero card (`.card.hero.dark`) IS the page head:
  big number (`.big` with `.cur`), one-line caption, controls top-right (`.ghost-btn`, `.ghost-btn.lit` for the
  primary add), hatched chart in `.chart-wrap`, KPI column (`.kpis .kpi` with `data-short` for phones).
- Bento grid `.bento` with explicit desktop placement per page (`@media (min-width:1181px)` grid-column/row),
  one screen at 1440x900 where possible. Side column = compact `.mini-list` + `.see-all`. Grid of `.btile` for
  collections. `.tips` card with `.mosaic` for the one alert/insight. Max ~5 rows per list, rest behind see-all.
- Few words: no helper paragraphs, captions only for numbers. Tabular numbers.

## Behaviour (the part v1 got wrong)

- Tap an item = edit in place (`.inl` editor inside the tile/row: money input + range, Enter saves, Esc cancels).
- Detail/long forms open as the right side panel (WM.modal now renders `.sheet.side` on desktop, bottom sheet on phone).
  Only the add-transaction popup and confirms stay centred.
- Delete never asks first: remove immediately, toast with Urungkan (undo). Confirm only for irreversible things.
- Two-step inline actions instead of dialogs (Bayar -> choose account chip -> Bayar Rp x), with undo toast.
- No per-row edit/delete icon rows, no data tables as primary UI (tables only inside reports/detail panels),
  no tabs where a `.seg` filter works.

## Pages still to convert

ringkasan, transaksi, notifikasi, laporan (keep concept look, dark cover already), tujuan, dana, rekening,
investasi, aset, aset-detail, liabilitas, asuransi, warisan, donation, tax, persetujuan, splitbill, rekonsiliasi,
ai, kalkulator, quickinput, mastercoa, masterdata, iam, panduan, akun, akses-saya. Public pages (login etc.) are fine.
Verify each with `node _shot.cjs page.html` (1440 + 390, no errors, no overflow).
