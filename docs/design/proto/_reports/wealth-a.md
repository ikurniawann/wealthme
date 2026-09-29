# wealth-a report

Pages built: `dana.html`, `rekening.html`, `investasi.html` (all verified with `_shot.cjs` at 1440/390, no console errors, no h-overflow; every dialog opened via a Playwright smoke pass).

## dana.html — real source: `app/(app)/dana/page.tsx`

- Hero total (cash+ewallet) + accounts-connected count → `.cover`, matches header/hero.
- Kas Tunai / E-Wallet sections: add, edit, delete (`WM.confirm` + accounts store), each with owner badge ("Bersama"/member) — feature -> `#cashList`/`#ewalletList`, `openForm()`.
- Add/edit forms match real `crud-config.ts` fields: cash = nama + saldo (negative allowed, `data-allow-zero`) + pemilik; e-wallet = provider select (GoPay/OVO/DANA/LinkAja/ShopeePay) + nomor + saldo + pemilik. Owner select collapses to self for non-master, matches `ownerOptions` logic.
- Komposisi donut (per e-wallet + aggregate Tunai bucket) → `WM.chart.donut`, mirrors `DonutChart` composition logic (only positive balances).
- Mutasi Tunai & E-Wallet Terakhir table, derived from shared `tx` store filtered to dana account ids → `#mutBody`.
- Info note routing bank/credit-card management to `rekening.html`, matches real page's callout.
- "Minta Dana" (fund-request) wired to `WM.store` `requests` collection for shared accounts a non-owner doesn't own, mirrors `MintaDanaDialog`. Note: wm.js's role gating (`WM.allowedPage`) only lets master/spouse reach this page in the prototype's 4-role model, so the request button can't actually be demoed by switching to a child/staff role — foundation limitation, not fixable page-locally.

## rekening.html — real source: `app/(app)/rekening/page.tsx`

- Physical `.pcard` visuals (page-local CSS ported from `../dashboard-concept.html`), stat cards (Saldo bank / Rekening bersama / Milik anggota), Semua/Milik saya/Bersama filter tabs — all structural matches.
- Add/edit form fields match `crud-config.ts` exactly: bank select, nama, no. rekening, saldo, jenis (create-only), **Rekening Privat** toggle, pemilik select.
- Detail dialog: kv summary, last mutations (`WM.txRow`), link to `rekonsiliasi.html` ("Rekonsiliasi saldo bank"), edit/delete from the same sheet.
- Delete confirm mirrors real copy ("riwayat tetap tersimpan").
- Deviation (flagged per GUIDE's explicit "incl. credit cards"): the real `/rekening` page scopes to `type: "bank"` only — credit cards are modeled as **Liabilitas**, not bank accounts, in the real app. I added a separate, clearly-labelled "Kartu Kredit" section (pcard.dark, view-only, no fake CRUD) with a note + link to `liabilitas.html`, so the page shows the full picture honestly without fabricating an account-CRUD flow that doesn't exist server-side.
- Skipped: the indicative USD total line (real page uses a live `/fx/rates` endpoint) — no real FX source exists client-side, so it's omitted rather than faked, per Honest UI.

## investasi.html — real source: `app/(app)/investasi/page.tsx` + `crud-config.ts`

- 3 stat cards (Nilai portofolio, Untung/rugi, Dividen & bunga tercatat — the last one real-derived from `tx` rows tagged `c-invest`/income, not fabricated), filter chips (Semua + 7 jenis), Kepemilikan donut, holdings table with Nama/Jenis/Jumlah/Harga-Sumber/Modal/Nilai/Untung-Rugi/Aksi.
- Price-source honesty matches the real page's per-type labelling exactly: saham/kripto show "Live belum tersedia di prototipe · pakai harga beli" (never a fake Live badge); emas follows a family gold price (editable via "Atur harga emas", referencing emasantam.id per kg → stored per gram); deposito shows computed simple-interest value ("Nilai dihitung"); reksa dana/obligasi/lainnya show "Harga manual · tanggal" once set, else "Belum ada harga manual". No price is ever simulated.
- Add/Catat investasi modal re-renders its fields per jenis (interest rate for obligasi/deposito, jatuh tempo for deposito, manual price for manual types), matching `crud-config.ts`'s field set.
- Beli/Jual dialog adjusts qty + weighted cost and can post a real linked transaction (Rp out/in against a chosen account), mirroring the real `BuySellModal`'s settlement account.
- "Modal vs Nilai per posisi" bar chart replaces the real app's **removed** 6-month portfolio trend line — that fabricated chart was explicitly deleted upstream per its own Honest-UI fix (`G1 P0`); I did not reintroduce it. The bar chart shown is today's real modal-vs-nilai snapshot only.
- Simplification (noted, not silently dropped): omitted the saham lot/lembar and emas kg/gram unit-toggle inputs from the add form (single quantity field with a static unit label instead) to keep the prototype form tractable; buy/sell and the table still show correct converted units.

Nothing else in `wm.css`/`wm.js` was touched; all page-local CSS/JS lives inside the three files above.
