# Group: tools

Pages built: `splitbill.html`, `split.html`, `rekonsiliasi.html`, `ai.html`, `kalkulator.html`, `quickinput.html`.

All pages verified with `node _shot.cjs <page>.html` (1440px + 390px): `overflow: false`, `errors: none` for every page. Every file's extracted inline `<script>` also passes `node --check`. Interactive flows (dialogs, forms, cross-page share links) were exercised with throwaway Playwright scripts and produced zero console/page errors.

---

## 1. splitbill.html (data-page="splitbill")

Source: `app/(app)/splitbill/page.tsx`, `split-math.ts`.

Feature -> where in HTML:

- Stats (ditalangin / terkumpul / belum dibayar / split aktif) -> `.cover` headline + `.stats-row` (computed live in `draw()`)
- Active vs history tabs -> `.tabs2` + `#listActive`/`#listHistory`
- Create bill dialog (title, total, payout account select, payout instructions (opsional), method segmented Rata/Custom, participants add/remove/rename) -> `openCreate()`
- Exact equal split (`splitEqually`, leftover Rupiah to first N participants) and custom-split live remainder + validation -> ported 1:1 from `split-math.ts`
- Detail/share dialog: participant list with avatar-gradient initial, status pill, "Tandai lunas" (real confirm dialog, irreversible, posts income via `WM.addTx`), per-participant "salin tautan" (`split.html?t=<shareToken>`), payout-account-missing warning + inline edit -> `openDetail()`, `openEditPayout()`
- Revoke all links (destructive, `WM.confirm` first) -> `.btn.danger` in detail footer
- Persistence: `if(WM.store.get("splitBills")==null) WM.store.set(...)` (seed persists to localStorage immediately, required for the public share page to read it)
- Honest UI: "(simulasi)" toast on payment confirmation since it fabricates a real income transaction client-side

## 2. split.html (public share page, no shell/login)

Source: `app/split/[shareToken]/page.tsx`.

- Reads `?t=<token>` from URL, looks up the participant across `WM.store.get("splitBills")`
- States: not-found/invalid token, valid open bill (amount owed, payout account + instructions, "Saya sudah bayar" claim button), claimed (awaiting confirmation pill), paid (confirmation state), revoked link (friendly message, no actions)
- No `WM.shell`/`WM.allowed` — only fonts + `wm.css` + its own script, centered single card
- Verified end-to-end cross-page: created a bill in splitbill.html, opened split.html with the real generated token in a second tab, claimed, saw status update reflected back in splitbill.html's detail dialog

## 3. rekonsiliasi.html (data-page="rekonsiliasi")

Source: `app/(app)/rekonsiliasi/page.tsx` + 3 test files (import-entries, entry-dialogs, password-upload).

- Empty state before any import -> `#empty`
- Upload dropzone + bank picker (BCA/Mandiri/lain) -> `openUploadDialog()`, `.drop`
- Password-protected file flow (wrong-password retry without re-upload, correct password unlocks) -> ported from `password-upload.test.tsx`'s contract
- Simulated CSV parsing (10 fixed sample rows, always labelled "(simulasi)") -> `sampleRows()`
- Matching: auto-suggest (amount+date heuristic), confirm/unmatch, bulk-confirm suggested, create-WM-tx-from-unmatched-entry (`WM.openTx` preset, links back on save) -> `#entriesTbl` + `confirmEntry()`/`unmatchEntry()`/`createTxFromEntry()`
- Entry detail dialog -> `openEntryDetail()`
- Differences summary (`.cover` headline selisih + matched/unmatched/total stats + composition bar) -> top section
- Unmatched WM tx list, upload history (switchable), filter segmented control (Semua/Perlu ditinjau/Belum cocok)
- Persistence via `WM.store.set("bankImports",...)` (not `.ensure`)
- Deliberately trimmed vs. the real app's much larger 4-step AI-extraction wizard (PDF scanning, column-mapping templates, fee-split dialog, skipped-rows banner) — these are backend-dependent flows with no honest client-side equivalent; noted so it isn't mistaken for an oversight.

## 4. ai.html (data-page="ai")

Source: `app/(app)/ai/page.tsx`, `components/ui/ai-chat-card.tsx` + utils.

- Chat: user/AI bubbles, input + send, Enter-to-send, typing indicator (~600-900ms) -> `bubble()`, `.typing`
- 6 suggested-prompt chips matching real categories -> `#chipsTop`
- Canned replies derived from real `WM.store` data (budget/goal/spending/generic keyword routing) -> `craftReply()` + `budgetReply()`/`goalReply()`/`spendingReply()`/`genericReply()`, all pulling from `WM.totals()`/`WM.income()`/`WM.spent()`/`budgets`/`goals`
- Mandatory prototype disclaimer under input: "Jawaban AI di prototipe ini disimulasikan dari data contoh, bukan model sungguhan."
- Conversation persists via `WM.store.set("aiChat",...)`; "Percakapan baru" clear action with confirm; empty state repeats the chips
- Sidebar ported from real source: "Data yang Dibaca Advisor" (Ya/Tidak list, matches production's read/not-read fields), "Ringkasan Konteks" (real numbers), "Penyedia & Kunci" (labelled as a prototype example, never implies a live key/model call)
- Simulated: no real AI key/provider gating (prototype has no auth), always shows "connected" state, explicitly labelled as a prototype example

## 5. kalkulator.html (data-page="kalkulator")

Source: `app/(app)/kalkulator/page.tsx`, `kalkulator.test.tsx`, BE `calculators.service.ts` + `pph21.util.ts`.

All 7 calculators ported with exact formulas (spot-checked against the test file's golden values):

1. **Zakat Maal** — nisab 85g gold, zakatable = cash+investments+gold−liabilities, 2.5% if ≥nisab and haul confirmed. Verified Rp2.500.000 against golden test.
2. **PPh 21** — biaya jabatan cap, PTKP TK/0, PKP floored to Rp1.000, 5 progressive brackets with detail modal. Verified Rp30.000.000 against golden test.
3. **Investasi** — monthly-compounding FV with area chart, live recompute.
4. **Kredit/KPR** — annuity formula, min-income warning, live recompute.
5. **Pensiun** — sinking-fund PMT (not naive loan amortisation, matches source's explicit anti-bug guard). Verified Rp1.808.818/month against golden test.
6. **Tabungan** — compounding loop, exact real "target tidak akan tercapai" copy for the unreachable case.
7. **Split Group** — per-orang breakdown, 0/negative people blocked with real error copy, routes to splitbill.html.

- Bug found+fixed during verify: grid-span classes were one level too deep inside a non-grid wrapper; fixed with `.calc-panel{display:contents}`.

## 6. quickinput.html (data-page="quickinput")

Source: `app/(app)/quickinput/page.tsx`, `quickinput.test.tsx`.

**Correction to the original task brief:** the real quickinput page is not a multi-row paste/parse transaction grid — it has no such flow anywhere in source. It is a grid of 12 shortcut cards routing to the real transaction dialog, other real pages, or lightweight CRUD create-forms, plus a read-only "Entri Terakhir" list. Built to match the actual app instead of fabricating a feature the source doesn't have:

- 12 shortcut cards -> `#qiCards` (Transaksi opens `WM.openTx()`; Investasi/Anggaran/Warisan/Donasi/Split Bill navigate to their real pages; Rekening/E-Wallet/Aset/Liabilitas/Asuransi/Tujuan Keuangan open inline CRUD modals with field sets matching the real `crud-config.ts`, saving via `WM.store.add`)
- "Entri Terakhir" (last 5 tx, live via `WM.onChange`, empty state, "Lihat semua" -> transaksi.html)
- Only the standard `if(!WM.allowed)return;` guard used (shell already restricts child/staff roles), per task instruction not to build custom role-gating
- Verified: Rekening CRUD creates a real account; `WM.addTx` via the shortcut correctly moved account a1's balance by the exact transacted amount

## Anything missing overall

Nothing required by the task brief was dropped except the noted, deliberately-scoped-out backend-dependent flows in rekonsiliasi.html (4-step AI extraction wizard) and the quickinput.html brief correction (built the real feature, not the briefed-but-nonexistent multi-row grid) — both explained above.
