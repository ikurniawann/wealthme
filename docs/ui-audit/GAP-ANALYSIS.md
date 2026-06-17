# WealthMe — UI/UX Gap Analysis (Live App vs Demo Mockup)

**Goal:** Enumerate concrete visual/UX divergences between the live Next.js app
(`localhost:3000`) and the static design mockup `docs/WealthMe_Demo(1).html`, so
EPIC-010 can drive the live app to match the mockup's design intent.

**Method:** Screenshots captured with Playwright at two viewports — desktop
(1440×900) and mobile (390×844) — for 14 representative pages, on both targets.
Spec: `apps/web/tests/e2e/audit/ui-audit.spec.ts`. Artifacts:
`docs/ui-audit/live/<id>-<vp>.png`, `docs/ui-audit/demo/<id>-<vp>.png`,
`docs/ui-audit/manifest.json`.

**Environment:** Live app authenticated as the seeded demo user
(`demo@wealthme.id`); web :3000 + API :4000 + seeded Postgres. Demo mockup opened
via `file://` with its login overlay bypassed.

## Legend

| Severity | Meaning                                                                                 |
| -------- | --------------------------------------------------------------------------------------- |
| **P1**   | Functional / structural / missing-data gap — page doesn't deliver the demo's capability |
| **P2**   | Layout / component-style / spacing divergence — noticeably off-design                   |
| **P3**   | Copy / color / cosmetic nuance                                                          |

**Type:** Functional · Layout · Component · Spacing · Color · Copy · Data

## Reading note — what is NOT a gap

The live app shows **real seeded data**; the demo shows **static sample data**.
The following are expected and are **excluded** from the tables below:

- Identity: live `Demo User` / `Christian Rizaldi's Family` vs demo
  `Irfan Arsandi` / `Arsandi Family`.
- Numbers/dates: live computed figures vs demo's fixed numbers; time-of-day
  greeting ("Selamat siang" vs "Selamat pagi").
- Empty sections that are empty only because the demo user has no rows of that
  type (called out explicitly where they hide a real feature).

---

## Cross-cutting (apply to all pages)

| #   | Area                  | Demo                                          | Live                                                                                                                           | Type       | Severity     | Recommended fix                                                                                     |
| --- | --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------ | --------------------------------------------------------------------------------------------------- |
| G1  | Sidebar nav set       | Compact set (Beranda…Kalkulator)              | Adds Warisan/Donasi & Zakat/Tax Center/Split Bill/Rekonsiliasi Bank (EPIC-009) with `New` badges + collapsible Laporan submenu | Content    | — (intended) | Keep; ensure `New` badge + section styling matches demo nav typography (10px upper, letter-spacing) |
| G2  | Topbar actions        | Search · notif · eye · logout                 | Adds **dark-mode toggle** + **"+" quick-add** + (mobile) **ID\|EN** toggle                                                     | Component  | — (intended) | Keep; theme toggle is the anchor for EPIC-010's preset picker                                       |
| G3  | Row/list icons        | Soft **circular pastel** icons                | Mostly **square/rounded** icon chips; Rekening uses generic letter-initial circles                                             | Component  | P2           | Standardize on demo's circular pastel icon treatment for list rows                                  |
| G4  | Section title casing  | Table headers UPPERCASE, letter-spaced        | Some headers Title Case (e.g. Investasi table)                                                                                 | Color/Copy | P3           | Apply `text-[10px]/uppercase/tracking` to table + card sub-headers                                  |
| G5  | Headline number color | Account/total headlines in **primary indigo** | Some headlines green (e.g. Investasi total)                                                                                    | Color      | P3           | Use primary for neutral totals; reserve green/red for gain/loss only                                |

---

## Per-page findings

### 1. Beranda (`/beranda`) — P1

| Area                       | Demo                                         | Live                                | Type      | Sev | Fix                                                        |
| -------------------------- | -------------------------------------------- | ----------------------------------- | --------- | --- | ---------------------------------------------------------- |
| Net-worth composition card | Titled **"Alokasi Kekayaan"**                | Titled **"Komposisi Kekayaan"**     | Copy      | P3  | Rename to match demo                                       |
| Summary tiles under hero   | **5 cards** (grid-5: Dana, Investasi, Aset…) | **2 inline dark stats** inside hero | Layout    | P2  | Restore the 5-up summary-card row below the hero (desktop) |
| Recent-activity title      | **"Aktivitas Terbaru"**                      | **"Transaksi Terbaru"**             | Copy      | P3  | Align copy                                                 |
| Hero range tabs            | Static sparkline                             | Adds 1M/3M/6M/1Y/All tabs           | Component | —   | Keep (enhancement); match pill styling                     |

### 2. Ringkasan (`/ringkasan`) — P2

| Area                 | Demo                                                           | Live                      | Type      | Sev | Fix                                                           |
| -------------------- | -------------------------------------------------------------- | ------------------------- | --------- | --- | ------------------------------------------------------------- |
| KPI card #3          | **Total Liabilitas**                                           | **Surplus Bulan Ini**     | Content   | P2  | Confirm intended metric; demo leads with Liabilitas           |
| "Komposisi Aset" viz | **Horizontal labelled bars** (Investasi/Rekening/Aset/Lainnya) | **Donut + 2-item legend** | Component | P2  | Match demo's bar-list treatment (or align with chosen design) |
| Health Score label   | **"Financial Health Score"**                                   | **"Savings Rate Score"**  | Copy      | P3  | Align label                                                   |
| Top Pengeluaran row  | **% pill badge**                                               | small progress bar + %    | Component | P3  | Match demo's %-badge style                                    |

### 3. Transaksi (`/transaksi`) — P2

| Area                | Demo                                         | Live                                | Type       | Sev | Fix                                                                                                    |
| ------------------- | -------------------------------------------- | ----------------------------------- | ---------- | --- | ------------------------------------------------------------------------------------------------------ |
| Filter pills        | Semua/Masuk/Keluar/Transfer/**Kartu Kredit** | missing **Kartu Kredit** pill       | Functional | P2  | Add Kartu Kredit filter                                                                                |
| Sort control        | **"Urutkan: Terbaru"** dropdown              | absent                              | Functional | P2  | Add sort dropdown                                                                                      |
| Summary stat #3     | **"Selisih"**                                | **"Initial"**                       | Copy       | P3  | Rename to "Selisih"                                                                                    |
| Row affordance      | chevron `>` (open detail)                    | **edit + delete** icons             | Component  | P2  | Decide model; demo uses chevron→detail. If keeping edit/delete, move into a row menu to reduce clutter |
| Row density / icons | generous padding, circular icons             | tighter rows, square icons          | Spacing    | P2  | Increase row padding; circular icons (see G3)                                                          |
| Add buttons         | none (global add)                            | two ("Tambah Transaksi" + "Tambah") | Component  | P3  | Drop the redundant button                                                                              |

### 4. Anggaran (`/anggaran`) — P2 (high fidelity)

| Area                | Demo                            | Live                      | Type      | Sev | Fix                                               |
| ------------------- | ------------------------------- | ------------------------- | --------- | --- | ------------------------------------------------- |
| Category rows       | **card-per-category** with gaps | single card, tighter rows | Spacing   | P2  | Add inter-row gap / card separation to match demo |
| Progress bar weight | thicker, rounded                | thinner                   | Component | P3  | Match bar height/radius                           |

### 5. Laporan (`/laporan`) — P2

| Area                     | Demo                            | Live                                                                     | Type      | Sev | Fix                                                                                               |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------ | --------- | --- | ------------------------------------------------------------------------------------------------- |
| Tab bar                  | **6 tabs**, fits cleanly        | **17+ tabs overflow** the bar (last clipped) + redundant sidebar submenu | Layout    | P2  | Make tab bar scrollable/grouped, or collapse rarely-used reports; remove duplication with sidebar |
| Export controls          | small download icon             | adds full **Export Laporan** card (PDF/Excel)                            | Component | —   | Keep (enhancement); tighten into header to save vertical space                                    |
| "Performa Investasi" viz | **line chart** (Nilai vs Modal) | horizontal bars                                                          | Component | P3  | Match line-chart treatment                                                                        |
| Wealth Allocation        | multi-segment donut             | single-segment (cash only — see Aset P1)                                 | Data      | P1→ | Fixed once Aset aggregation lands (#9)                                                            |

### 6. Tujuan Keuangan (`/tujuan`) — P3 (high fidelity)

| Area              | Demo                            | Live                            | Type      | Sev | Fix                                                    |
| ----------------- | ------------------------------- | ------------------------------- | --------- | --- | ------------------------------------------------------ |
| KPI card #3       | **"Berjalan / jangka panjang"** | **"Berisiko / tidak tercapai"** | Copy      | P3  | Confirm intended bucket label                          |
| Goal-card actions | none on card                    | adds **Edit / Hapus** links     | Component | P3  | Keep; consider moving into a card menu for cleanliness |

### 7. Rekening (`/rekening`) — P2

| Area               | Demo                                      | Live                                         | Type      | Sev | Fix                                                                    |
| ------------------ | ----------------------------------------- | -------------------------------------------- | --------- | --- | ---------------------------------------------------------------------- |
| Account icon       | **bank-branded badge** (BCA/MDR/BNI)      | generic **letter-initial circle**            | Component | P2  | Use bank-branded/colored badges                                        |
| Status badge       | **Utama / Aktif** (status)                | account **type** (Tabungan/E-Wallet)         | Component | P3  | Show status; surface type elsewhere                                    |
| Action buttons     | full-width **Transfer / Top Up / Mutasi** | compact **Transfer/Mutasi/Edit/Hapus** pills | Component | P2  | Match demo's segmented full-width actions; fold Edit/Hapus into a menu |
| Masked account no. | `•••• •••• 9010`                          | `—`                                          | Data      | P3  | Render masked number when present                                      |

### 8. Investasi (`/investasi`) — P3 (high fidelity)

| Area                 | Demo      | Live       | Type  | Sev | Fix    |
| -------------------- | --------- | ---------- | ----- | --- | ------ |
| Total headline color | indigo    | green      | Color | P3  | See G5 |
| Table header casing  | UPPERCASE | Title Case | Color | P3  | See G4 |

### 9. Aset (`/aset`) — P1 (functional gap)

| Area             | Demo                                                                                                                            | Live                                                                                                                                                     | Type       | Sev    | Fix                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------ |
| Page purpose     | **Consolidated net-worth**: aggregates Dana & Rekening, Investasi, Aset Fisik, Liabilitas with per-group totals + itemized rows | Only **Aset Fisik**; "Dana & Rekening" and "Investasi" show placeholder **"Data akan tersedia setelah modul terkait aktif."** despite that data existing | Functional | **P1** | Aggregate existing Rekening + Investasi data into this page; remove placeholder copy |
| Total card label | **"Total Aset"** (all classes)                                                                                                  | **"Total Aset Fisik" = Rp 0**                                                                                                                            | Content    | P1     | Compute total across all asset classes                                               |

### 10. Liabilitas (`/liabilitas`) — P2

| Area              | Demo                                         | Live                                    | Type    | Sev | Fix                                                                                           |
| ----------------- | -------------------------------------------- | --------------------------------------- | ------- | --- | --------------------------------------------------------------------------------------------- |
| KPI card #2       | **Debt-to-Asset Ratio** (3,2% / Sangat Aman) | **Jumlah Liabilitas** (count)           | Content | P2  | Add DTA-ratio KPI                                                                             |
| Total trend       | **"▼ Turun 1,08% (membaik)"**                | "Sisa tagihan aktif" (no trend)         | Copy    | P3  | Add MoM trend line                                                                            |
| Populated card UI | rich cards (limit usage bar, tenor, bunga)   | **empty state** (no seeded liabilities) | Data    | P2  | Could not verify populated card vs demo — seed a liability or verify card markup against demo |

### 11. Asuransi (`/asuransi`) — not in demo set

Live-only page (no demo counterpart). Out of scope for fidelity; note for design
parity pass later.

### 12. AI Advisor (`/ai`) — P2

| Area                       | Demo                           | Live                                                                          | Type    | Sev | Fix                                                     |
| -------------------------- | ------------------------------ | ----------------------------------------------------------------------------- | ------- | --- | ------------------------------------------------------- |
| Chat container height      | hugs content                   | **fixed tall box** with large empty area                                      | Layout  | P2  | Let the message area grow with content / cap min-height |
| Suggestion chips           | **6 chips**                    | **4 chips** (missing "utang kartu kredit aman?", "Proyeksi kekayaan 5 tahun") | Content | P3  | Add the 2 missing prompt chips                          |
| Greeting                   | personalized w/ net-worth data | generic                                                                       | Data    | P3  | Greet with the user's computed summary                  |
| "Pertanyaan Populer" label | 💡 prefix                      | no emoji                                                                      | Copy    | P3  | Add emoji prefix                                        |

### 13. Kalkulator (`/kalkulator`) — P3 (high fidelity)

| Area          | Demo                                  | Live                                                           | Type      | Sev | Fix                                                            |
| ------------- | ------------------------------------- | -------------------------------------------------------------- | --------- | --- | -------------------------------------------------------------- |
| Tabs          | Investasi/Kredit/Pensiun/Tabungan (4) | adds Zakat Maal/PPh 21/Split Group (7); default **Zakat Maal** | Content   | —   | Keep (enhancement); consider default = Investasi to match demo |
| Result reveal | live-computed result card             | button-triggered ("Hitung Zakat")                              | Component | P3  | Optional: live-compute like demo                               |

### 14. Notifikasi (`/notifikasi`) — P2 + capture note

| Area           | Demo                                                  | Live                                                                                                      | Type      | Sev | Fix                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card header    | **"N Baru"** pill + **"Tandai semua dibaca"**         | verify against re-capture                                                                                 | Component | P2  | Ensure header pill + mark-all-read action present                                                                                                                                                                                  |
| Row badges     | **Baru** (green) / **Alert** (red); read items dimmed | verify                                                                                                    | Component | P2  | Match badge variants + read/unread dimming                                                                                                                                                                                         |
| ⚠ Capture note | —                                                     | both live `notifikasi` shots caught the global **"Memuat WealthMe…"** splash (the page was still loading) | —         | —   | Re-run `ui-audit` on an unloaded machine to capture rendered content (the spec already waits for `load` + settle). Compare against `demo/notifikasi-*` for the target. If the splash persists, the loader itself is a perf finding |

---

## Mobile (responsive) notes

Mobile fidelity is generally **high** (hamburger topbar, hero with range pills,
donut card, 2 summary tiles, floating bottom nav + center FAB, stacked sections).
Deltas:

- Live adds an **ID | EN** language toggle in the mobile topbar (demo has none).
- Bottom-nav 5th item: live shows the **user avatar**; demo shows **"Akun"**
  icon+label. Minor.
- Same Beranda copy/structure deltas as desktop (#1) carry over.

---

## Prioritized backlog (feeds EPIC-010 Group C)

1. **P1 — Aset consolidated net-worth** (#9): aggregate Rekening + Investasi;
   this also fixes Laporan → Wealth Allocation (#5).
2. **P2 — Transaksi** filter (Kartu Kredit) + sort dropdown + row affordance/density (#3).
3. **P2 — Rekening** card icons/badges/actions (#7).
4. **P2 — Ringkasan** Komposisi Aset viz + KPI #3 (#2).
5. **P2 — Laporan** tab overflow (#5); **AI** chat container height (#12).
6. **P2 — Beranda** 5-up summary row (#1); **Anggaran** row spacing (#4); **Liabilitas** DTA KPI (#10).
7. **P3 — copy/color sweep**: G4, G5, and the per-page P3 copy items.

Cross-cutting **G1–G5** should be handled as shared-primitive tweaks where
allowed (e.g. `components/wm` list-row icon shape), not per page.
