# EPIC-024: Client Revision Punch-List (docs/revisi.txt, Aug 2026)

status: on-progress
environment: dev
retries: 0
phase: 4
priority: P0
area: Full-stack
source: `docs/revisi.txt` (27 items), received 2026-08-06; `/grilling` session 2026-08-06 resolved all 18 design decisions; 3-agent parallel code audit mapped every bug to file:line

## Goal

The client tested the deployed app and wrote 27 revision items — a mix of bugs
that block daily use (PIN login dead, approvals erroring, crypto showing
−99.99%), features the household model needs (a wife who is a true co-master),
and one full UI/UX revamp. A grilling session with the product owner resolved
**every** design decision, and a 3-agent code audit traced every reported bug
to its root cause with file:line evidence. This epic is the canonical record of
both — implementation can start without re-deciding anything.

Three themes:

1. **A family that matches reality.** The wife stops being an invited guest
   with a crippled account picker: she is created by her husband and holds the
   identical menu and powers. Members are added directly, not emailed a link.
   Approvals get a real page instead of a panel buried in settings.
2. **Money data the user can trust.** Investment percentages come from live
   markets instead of a mock that fabricates −99.99%; stocks accept lot or
   lembar; deposito exists; the tax form stops rejecting its own auto-format;
   liabilities become operable, not just visible.
3. **A UI that tells the truth.** Buttons that do nothing (gembok, master-data
   tambah) either work or disappear; error toasts show the server's real
   message instead of a generic apology; public split-bill links actually open
   publicly. The revamp itself ships prototype-first so nothing is rebuilt
   twice.

## Verbatim Source List

Transcribed exactly from `docs/revisi.txt` (client numbering preserved — note
gaps 19–28 do not exist; the file jumps 18 → 29).

1. rekening master masuk ke akun istri. tapi pas bikin transaksi, pilihanya cuma "akun utama". harusnya bisa pilih banyak rekening kaya master.
2. tambahkan anak/operasional tapi ada hubungan keluarga istri
3. login pakai pin error
4. istri harusnya ditambahkan master user, bukan di undang (seperti tambah akun anak/operasional) tapi dengan menu yang 1:1 dengan master
5. approve permintaan dana error. mending approval dibuatkan menu page baru
6. di menu investasi, buat saham : itu bisa langsung muncul persen valid atau tidak?
7. di menu investasi, buat kripto : gimana cara input kripto? kok form nya sama kaya saham? dan harusnya coin dong bukan lot. lalu saat input kripto kenapa tiba tiba -99.99%? lalu angka yang di input itu angka existing atau angka saat beli? tambahin juga "catat investasi" untuk mencatat inestasi yang sudah ada
8. pajak : input otomatis di parsing titik, saat disimpan error grossIncome must be a numeric string
9. split bill : pop up splitbill masih tidak responsif. masih harus di geser/scroll horizontal
10. setup pin setelah login error : Gagal mengatur buka cepat. Kamu bisa coba lagi nanti di Pengaturan Akun.
11. ketika setelah register, seharusnya tidak muncul rekening akun utama. karena harus ditambahkan sendiri oleh user
12. liablitas tidak bisa di edit/lihat detail
13. donasi & zakat calculator tidak berfungsi
14. di page asset, ada button gembok fungsinya apa
15. update warisan error : Failed to update inheritance asset.
16. url split bill memangnya yang buka harus register dulu? harusnya nggak kan? trus ini setting dapat dari mana? "Split bill ini belum punya rekening tujuan pembayaran — atur dulu sebelum konfirmasi."
17. setup master data selain kategori error "Daftar referensi ini bawaan sistem — penambahan belum didukung."
18. fitur iam roles invite link undang anggota hapus saja. anggota keluarga ditambahkan sama seperti anak/operasional. tapi kalau istri satu banding satu dengan suami
19. tunai -> cash & e-wallet
20. rekening -> bank & account
21. tambahin investasi deposito
22. penurunan aset bisa fixed rupiah
23. di semua deskripsi transaksi ditambhakn fitur upload file/foto
24. item didalam liablitas tidak ada detail - edit - hapus - bayar
25. tambah fitur didalam laporan - ringkasan bedasarkan COA
26. revamp seluruh frontend UI/UX … prototype html terlebih dahulu sebelum implementasi (verbatim panjang — lihat `docs/revisi.txt`)

## Evidence

Every finding below was read in code during the audit, not inferred.

- **Three code paths resolve "the active family group" three different ways**:
  `apps/web/src/lib/auth.ts:158` orders memberships `createdAt: desc` (newest),
  `apps/api/src/auth/auth.service.ts:237` takes `memberships[0]` with **no
  orderBy**, and `apps/api/src/family-groups/family-groups.service.ts:96`
  orders `asc` (oldest). A wife who registered herself and then accepted an
  invite has two memberships; the transaction dialog reads `/auth/me` and lands
  on **her own** auto-created group, whose only account is her own "Akun
  Utama". Item 1 is not a picker bug — it is a group-resolution bug.
- **The nginx allowlist regex predates the devices controller.**
  `deploy/nginx/default.conf:54` enumerates NestJS auth routes by name;
  `@Controller("auth/devices")` was never added, so `POST /api/auth/devices*`
  is swallowed by Better Auth's catch-all on the web container. Separately,
  `/api/device-unlock` (a Next.js BFF route) is prefix-stripped by
  `location /api/` into a path NestJS does not serve → 404. Both PIN flows are
  dead **only in the deployed environment** — local dev has no nginx.
- **"Approve permintaan dana error" is two defects stacked**: the funding
  transfer trips the anti-overdraft guard
  (`apps/api/src/common/utils/bank-overdraft.util.ts`) when the chosen source
  is a zero-balance bank account (which "Akun Utama" always is), and
  `akun/page.tsx:2946-2955` catches every failure with a bare
  `catch { toast.error(generic) }` — the informative 400 message never reaches
  the user. `extractApiErrorMessage` exists and is used 500 lines later in the
  same file.
- **`USE_REAL_MARKET_DATA=false` in every env file.** `MockMarketDataAdapter`
  hashes the ticker into a price between Rp 500 and Rp 100.000
  (`mock-market-data.adapter.ts`), and `findAll()` **persists** that mock price
  as a real `InvestmentPrice` row. Any cost basis above ~100k — all real crypto
  and most IDX stocks — shows as a near-total loss; Rp 1,5 M/BTC → −99,99%.
  The real adapters (`routed-market-data.adapter.ts`: Yahoo `.JK` for saham,
  CoinGecko for kripto with a 15-ticker map) already exist behind
  `MarketDataPort`, wired by EPIC-023 G1, and are simply switched off.
- **The quick-input investment path discards user data**:
  `components/crud/crud-config.ts:173` hardcodes `quantity: "1"` and drops the
  "Nilai Sekarang" field entirely — a per-unit field receives a whole-portfolio
  number.
- **`enum InvestmentType` has no `deposito`** (`schema.prisma:83`), no
  `purchasedAt`, no `maturityDate`; the quantity field is one untyped
  "Jumlah (lot/unit)" with no lot↔lembar conversion anywhere.
- **Tax rejects its own format**: `create-tax-record.dto.ts` requires
  `/^\d+$/` (a plain digit string) while the frontend builds the payload from
  `String(serverEcho)` — extreme values serialize to scientific notation, and
  no upper bound exists on either side (`pph21.dto.ts` is `@IsNumber()
@Min(0)` with no `@Max`).
- **Split-bill dialogs cannot fit a phone**: participant rows are `flex` with
  multiple `shrink-0` children and fixed-width fields
  (`splitbill/page.tsx:543-899`) — at 375px only the name column can compress.
  The public page `/split/[shareToken]` is designed public (its API routes are
  `@Public()`) but `apps/web/src/middleware.ts` never allowlisted `/split/`, so
  every recipient is bounced to `/login`. And `payoutAccountId` is required at
  create with **no PATCH endpoint** — the error message "atur dulu sebelum
  konfirmasi" points at a capability that does not exist.
- **Liabilities API is complete and unused**: `liabilities.controller.ts`
  exposes `PATCH /:id`, `POST /:id/pay`, `POST /:id/purchase`, `DELETE /:id`
  (built by EPIC-023 E) — `LiabilityCard` (`liabilitas/page.tsx:439-560`) is
  pure display with zero interactive elements. Items 12 and 34 are one gap.
- **The zakat calculator works and is hidden**: `donation/page.tsx:432` renders
  it only when `religion === "islam"`; `FamilyGroup.religion` is nullable with
  no default, so a family that never chose sees nothing — four fallback
  branches render notes, none render a calculator. The `/kalkulator` zakat
  tab's prefilled defaults (50 jt + 30 jt) sit below the default nisab
  (Rp 93,5 jt) so it answers Rp 0 out of the box.
- **The gembok button is inert**: `aset/page.tsx:932-939` renders a `<button>`
  with an aria-label and **no onClick, no state, no mutation**. `Asset` has no
  `isPrivate` field.
- **Warisan update fails on an empty string**: heir rows default
  `relationship: ""`, the frontend filters only on `name`
  (`warisan/page.tsx:574-580`), and `CreateHeirDto.relationship` is
  `@IsNotEmpty()` → 400 → another generic toast.
- **Master data is a client-side illusion**: the seven reference lists are
  hardcoded arrays (`masterdata/page.tsx:44-71`); "delete" mutates local
  `useState` and evaporates on refresh; only Kategori has a real API.
- **Attachments have no storage**: `StoragePort` exists
  (`apps/api/src/storage/storage.port.ts`) but only a mock implementation is
  bound and **no module injects it**. The only real multipart upload in the
  repo is reconciliation's, parsed in memory and never persisted. `Transaction`
  has no attachment field or model.
- **No report groups by COA**: every report `select` pulls only
  `coaAccount.direction`; nothing groups or subtotals by COA account, code, or
  `groupNum` (single exception: the reconciliation bridge's group-3 check).
  `Category.coaAccountId` is NOT NULL, so the data for item 35 already exists.

## Design Decisions (RESOLVED — grilling session 2026-08-06)

All decided by the product owner; do not reopen without new information.

1. **Istri = co-master penuh** → `Member(role: owner, relationship: istri)` —
   second owner in the husband's family group, **no own family group**, created
   directly by master (username+password, forced password change), **max 1
   istri per family group**. No CASL change needed (owner already manages
   everything). Role `spouse` no longer used for wives.
   **Supersedes EPIC-023 D2 and D6 for wives**: EPIC-023 made a spouse a
   co-owner _minus_ member management, arriving by email invite; the owner has
   since decided a wife is 1:1 with the master, member management included,
   created directly. The `spouse` role and invite flow remain in code for
   non-wife cases but are no longer the wife's path.
2. **Invite-link**: hidden in UI only; backend invitation endpoints stay.
3. **Co-master can add** anak/operasional to the same group (item 2's meaning).
4. **Transaction account picker**: master + co-master see ALL family accounts;
   dependant/operational only accounts assigned to them (`ownerUserId`) —
   current row-scoping already matches; the istri bug is group-resolution (see
   Evidence).
5. **"Akun Utama" auto-create at registration: stop.** Existing accounts left
   untouched (no migration).
6. **New "Persetujuan" page**: pending + history tabs, owner/co-master only.
7. **Investment input semantics**: harga beli + jumlah + nilai sekarang (manual
   only for non-live types) + **tanggal beli (new date picker)**. "Catat
   investasi" = the same create flow (it records holdings, not buy
   transactions).
8. **Live prices ON** (`USE_REAL_MARKET_DATA=true`): Yahoo for saham IDX,
   CoinGecko for kripto; manual price = fallback (unknown ticker must not
   throw). Purge stored `source: "mock"` price rows.
9. **Stock quantity: both LOT and LEMBAR** input (form toggle; 1 lot = 100
   lembar; store canonical lembar). Kripto = coin decimals. Deposito = nominal.
10. **New investment type `deposito`**: nominal, bunga %/thn (simple interest),
    tanggal mulai + jatuh tempo.
11. **Asset value change**: mode `% per tahun` OR `Rp tetap per tahun` (both
    linear, floored at 0).
12. **Zakat**: inline "pilih agama keluarga" prompt on the donasi page when
    religion is unset; menu renamed to **"Donasi"**.
13. **Aset lock button** → privacy toggle with **eye icon** (blur all amounts
    on the page); the current gembok is an inert element.
14. **Master data** → real per-family-group reference tables (seeded with the
    current hardcoded defaults, full CRUD).
15. **Transaction attachments**: stored on server disk via Docker volume behind
    the existing `StoragePort` (S3 later without feature changes).
16. **Laporan COA** = yearly matrix per COA account: columns Jan–Dec, rows
    tanggal 1–31, each cell lists the individual transaction amounts that day
    (stacked when >1), yearly total on top; picker = COA account + year; cell
    click shows the transactions. (Matches the client's spreadsheet mock.)
17. **Labels exactly as written**: "Tunai" → **"Cash & E-Wallet"**, "Rekening"
    → **"Bank & Account"**.
18. **UI/UX revamp**: shadcn UI + **ApexCharts**; static-HTML prototype of ALL
    pages + modals/popups reviewed and approved BEFORE any app implementation.

## User Stories

| ID         | Story                                                                                                                                                                           | Priority |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-FAM-15  | As a master, I want to create my wife's account directly (username + password) exactly like I create a child's, so that she never depends on an email invite.                   | P0       |
| US-FAM-16  | As a wife (co-master), I want the identical menu and powers as my husband, so that we run the family money as equals.                                                           | P0       |
| US-FAM-17  | As a co-master, I want to add children and operational members myself, so that member management does not bottleneck on one person.                                             | P0       |
| US-FAM-18  | As a master or co-master, I want the transaction form to offer every family account, so that I record money where it actually moved.                                            | P0       |
| US-FAM-19  | As a master or co-master, I want a dedicated Persetujuan page with pending and history tabs, so that fund requests are handled in one place instead of a settings panel.        | P0       |
| US-AUTH-10 | As any member, I want PIN setup and PIN login to work in the deployed app, so that quick unlock is not a feature that only works on localhost.                                  | P0       |
| US-AUTH-11 | As any user, I want failed actions to show the server's actual reason, so that "coba lagi nanti" stops hiding fixable problems.                                                 | P0       |
| US-REK-1   | As a new user, I want to start with zero accounts and add my own, so that my ledger contains only accounts that exist in real life.                                             | P1       |
| US-INV-8   | As a stock investor, I want a valid gain/loss percent immediately from live IDX prices, so that the number on screen means something.                                           | P0       |
| US-INV-9   | As a crypto holder, I want to input coins in decimals with live CoinGecko pricing, so that 0.015 BTC is recordable and correctly valued.                                        | P0       |
| US-INV-10  | As an investor, I want to record existing holdings with buy price, quantity, and purchase date, so that my portfolio history starts from the truth.                             | P0       |
| US-INV-11  | As a saver, I want deposito with nominal, annual rate, and maturity date, so that its accrued value appears without manual updates.                                             | P1       |
| US-INV-12  | As an IDX investor, I want to enter stock quantity in lot or lembar, so that I can type what my broker statement says either way.                                               | P1       |
| US-TAX-1   | As a taxpayer, I want the tax form to save what its own auto-format produced, so that formatting and validation stop fighting each other.                                       | P0       |
| US-SPLIT-7 | As a phone user, I want the split-bill dialog to fit my screen without horizontal scrolling, so that I can split a bill at the restaurant table.                                | P1       |
| US-SPLIT-8 | As a split-bill recipient, I want the shared link to open without registering, so that the link is worth opening.                                                               | P0       |
| US-SPLIT-9 | As a bill owner, I want to set or fix the payout account after creating a bill, so that an old bill is repairable instead of permanently broken.                                | P1       |
| US-LIAB-6  | As a head of family, I want detail, edit, delete, and pay actions on every liability item, so that the page manages debt instead of only displaying it.                         | P0       |
| US-WAR-1   | As a head of family, I want inheritance updates to save (or tell me exactly what is missing), so that "Failed to update" stops being the only answer.                           | P0       |
| US-DON-8   | As a user who has not set a family religion, I want an inline prompt on the Donasi page, so that the zakat calculator is one tap away instead of invisible.                     | P1       |
| US-ASSET-5 | As an asset owner, I want an eye toggle that blurs all amounts, so that I can open the app in public without broadcasting my net worth.                                         | P2       |
| US-ASSET-6 | As an asset owner, I want depreciation in fixed rupiah per year as an alternative to percent, so that straight-line schedules from my accountant fit.                           | P1       |
| US-MD-1    | As a family admin, I want reference lists (bank, e-wallet, lembaga, …) I can actually add to and that survive refresh, so that master data is data, not decoration.             | P1       |
| US-TXN-9   | As any user, I want to attach files or photos to a transaction and see them in its detail, so that receipts live with the record they prove.                                    | P1       |
| US-RPT-14  | As a report reader, I want a yearly per-COA matrix (tanggal × bulan) with each day's amounts and the year total, so that I see spending rhythm the way my spreadsheet shows it. | P1       |
| US-NAV-1   | As the owner, I want the menus renamed to "Cash & E-Wallet" and "Bank & Account", so that the taxonomy matches how I talk about money.                                          | P2       |
| US-UI-1    | As the owner, I want an HTML prototype of every page and modal to review before any rebuild, so that the revamp is approved once and implemented once.                          | P0       |

## Tasks

One task group = one branch = one PR to `development`. Execution order is in
`## Agent Routing` below.

- [ ] ### A — Family & Roles: istri co-master, group resolution, Persetujuan page, stop Akun Utama (items 1, 2, 4, 5, 11, 18)
  - **A1** — Istri as second owner: `DEFAULT_ROLE_BY_RELATIONSHIP.istri` →
    `owner` (`packages/contracts/src/members/index.ts`); extend
    `createDependantMember` (`family-groups.service.ts:436`) to accept
    `role: owner` **only when** `relationship === "istri"`, enforcing max-1
    istri per family group inside the same `$transaction`; loosen
    `create-dependant-member.dto.ts` accordingly; add "Istri (Co-Master)" to
    `AddDependantMemberDialog` (`akun/page.tsx:3092`). The created user gets
    **no family group of her own** (existing better-auth-bypass pattern).
    (D1, D3, US-FAM-15/16/17)
  - **A2** — Hide invite UI: remove `AddAdminModal` rendering and the
    `entity === "member"` crud path (`akun/page.tsx:2995-3090, 3463-3487`,
    `crud-config.ts:342-344`). Backend invitation endpoints untouched. (D2)
  - **A3** — Unify active-family-group resolution to ONE deterministic rule
    (`createdAt asc` = oldest) across `apps/web/src/lib/auth.ts:158`,
    `apps/api/src/auth/auth.service.ts:237`,
    `apps/api/src/family-groups/family-groups.service.ts:96`. Migration/script
    for the existing DEV wife: role → `owner` in the husband's group; her empty
    auto-created group is left. (Evidence #1, US-FAM-18)
  - **A4** — Verify picker behaviour per role (no code expected beyond
    A1+A3): master/co-master see all family accounts, dependant/operational
    only assigned ones. E2E asserts both the allow and the deny. (D4)
  - **A5** — New `/persetujuan` page (owner-only nav item): Pending tab
    (approve/reject with source-account picker) + Riwayat tab; move/reuse
    `AllowanceRequestsPanel`/`ApproveRequestForm` from `akun/page.tsx:2716-2955`.
    Replace every bare `catch { toast.error(generic) }` in the approve path
    with `extractApiErrorMessage`. (D6, US-FAM-19, US-AUTH-11)
  - **A6** — Stop auto-creating "Akun Utama": remove the account-create block
    from `apps/web/src/lib/auth.ts:143-150` AND
    `apps/api/src/auth/auth.service.ts:178-185`; verify empty-state of
    rekening/transaksi pages at 0 accounts. Existing rows untouched. (D5,
    US-REK-1)
  - **A7** — Domain docs: create `CONTEXT-MAP.md` + `CONTEXT.md` (glossary:
    Master/Co-Master, Anggota, Rekening, Akun Utama, Permintaan Dana,
    Lot/Lembar, Catat Investasi) and `docs/adr/0001-istri-as-second-owner.md`.

- [ ] ### B — PIN/buka cepat nginx routes + error surfacing (items 3, 10)
  - **B1** — [x] Add `devices(?:/.*)?` to the nginx auth-route allowlist regex
    (`deploy/nginx/default.conf:54`) and a dedicated location proxying
    `/api/device-unlock` to web:3000 (it is a Next BFF route, not NestJS).
  - **B2** — [x] Error surfacing: `quick-unlock-prompt.tsx:64` and
    `device-unlock-pad.tsx` distinguish 401/403/404/network from "PIN salah".
    Validate `API_URL` in `apps/web/src/lib/env.ts`. (US-AUTH-10/11)
  - **B3** — [ ] Deploy smoke on DEV: register device, set PIN, log out, PIN
    unlock — **must** be verified through nginx, the bug lives there. (pending
    epic-wide DEV deploy after all groups land)

- [ ] ### C — Investasi: live prices, lot/lembar, koin, deposito, tanggal beli, quickinput fix (items 6, 7, 31)
  - **C1** — `USE_REAL_MARKET_DATA=true` across `.env*` + `deploy/.env.example`;
    widen `TICKER_TO_COINGECKO_ID`; unknown ticker → manual-price fallback with
    a "harga manual" badge (must not throw); migration purges
    `InvestmentPrice` rows with `source: "mock"`. (D8, US-INV-8/9)
  - **C2** — Schema: `Investment.purchasedAt DateTime?`,
    `maturityDate DateTime?`; enum + `deposito`. Additive migration. (D7, D10)
  - **C3** — Form per type (`investasi/page.tsx` AddInvestmentModal): saham
    quantity toggle **Lot/Lembar** (store canonical lembar, ×100); kripto
    "Jumlah Koin" decimal; deposito nominal + bunga %/thn
    (`INTEREST_BEARING_TYPES` += deposito) + jatuh tempo, valued by simple
    interest; "Tanggal Beli" date picker for all types; manual "nilai
    sekarang" only for non-live types; CTA "Catat Investasi". (D7, D9, D10,
    US-INV-10/11/12)
  - **C4** — Fix quick-input path (`crud-config.ts:173`,
    `quickinput/page.tsx:222-235`): stop hardcoding `quantity: "1"`, stop
    discarding "Nilai Sekarang" — align with the main form or route to it.
    (Evidence #5)

- [ ] ### D — Aset: privacy eye toggle + penyusutan Rp tetap (items 14, 32)
  - **D1** — Replace the inert gembok (`aset/page.tsx:932-939`) with an
    `Eye`/`EyeOff` toggle (`aria-pressed`, per-user localStorage) that blurs
    all amounts on the page. (D13, US-ASSET-5)
  - **D2** — `Asset.valueChangeMode` (`percent`|`fixed`) +
    `valueChangeAmount BigInt?`; `computeEstimatedValue`
    (`assets.service.ts:58`) handles fixed mode (linear, floor 0); form mode
    toggle % / Rp. Additive migration. Golden test on a hand-computed
    schedule. (D11, US-ASSET-6)

- [x] ### E — Pajak numeric-string robustness (item 8) ✅
  - **E1** — [x] Frontend (`tax/page.tsx:261-274`): build the payload from
    `parseRupiah` digits directly (never `String(float)`), with an upper bound
    guard. API: `@Max`/length caps on `create-tax-record.dto.ts` +
    `pph21.dto.ts`, friendlier message; surface server errors in the toast.
    (US-TAX-1, US-AUTH-11)

- [ ] ### F — Split bill: public URL, dialog responsif, edit rekening tujuan (items 9, 16)
  - **F1** — Add `/split` to the middleware allowlist
    (`apps/web/src/middleware.ts`) — the page and API are already designed
    public. (US-SPLIT-8)
  - **F2** — Rework both dialogs (`splitbill/page.tsx:543-899`) for ≤375px:
    stack/wrap the participant rows, flexible field widths, breakpoint the
    `grid-cols-3` header. No horizontal scrolling anywhere. (US-SPLIT-7)
  - **F3** — `PATCH /split-bills/:id` accepting `payoutAccountId` + edit UI in
    the detail dialog — makes legacy bills with null/deleted payout repairable.
    (US-SPLIT-9)

- [ ] ### G — Liabilitas: detail/edit/hapus/bayar UI wiring (items 12, 34)
  - **G1** — Per-item actions on `LiabilityCard` (reuse the `RowActions`
    pattern from `warisan/page.tsx:178`): **Detail** (dialog with info +
    amortisation summary), **Edit** (`PATCH /:id`), **Hapus** (`DELETE` +
    confirm), **Bayar** (`POST /:id/pay` with principal/interest split and
    source-account picker — endpoint built by EPIC-023 E). (US-LIAB-6)

- [ ] ### H — Warisan: heir relationship validation + error surfacing (item 15)
  - **H1** — Require relationship in the form before submit (or filter heirs
    lacking it); surface the server's message via `extractApiErrorMessage`.
    (US-WAR-1, US-AUTH-11)

- [ ] ### I — Donasi: religion prompt inline + rename menu (item 13)
  - **I1** — When `religion === null`, render an inline "Pilih agama keluarga"
    prompt (dropdown + save) on the donasi page; calculator appears
    immediately after. Rename menu/title to "Donasi" (both locales). Clarify
    the below-nisab Rp 0 answer on `/kalkulator`. (D12, US-DON-8)

- [ ] ### J — Master data: ReferenceItem tables + seed + CRUD (item 17)
  - **J1** — Model `ReferenceItem { id, familyGroupId, group enum(bank|ewallet|txntype|invtype|lembaga|asettype|instype), label, sortOrder, isSystem, createdAt }`,
    `@@unique([familyGroupId, group, label])`; seed defaults from
    `REFERENCE_GROUPS` (`masterdata/page.tsx:44-71`) at registration +
    backfill migration for existing groups; CRUD endpoints
    `GET/POST/DELETE /family-groups/:id/reference-items` (owner manage);
    rewrite `masterdata/page.tsx` against the API — no more fake local
    deletes, no more "bawaan sistem" toast. (D14, US-MD-1)

- [ ] ### K — Labels: "Cash & E-Wallet" / "Bank & Account" (items 29, 30)
  - **K1** — `i18n/id.ts` + `en.ts` (structures must stay identical per
    `i18n/types.ts`): `nav.items.dana`, `pageTitles.dana`, `panduan…dana`,
    `dana.*` → "Cash & E-Wallet"; `nav.items.rekening`, `pageTitles.rekening`,
    `search…rekening`, `aset.tabs.rekening` → "Bank & Account"; also fix the
    existing `bank: "Bank"` vs `bank: "Tabungan"` inconsistency between
    `aset.accountTypeLabels` and `rekening.typeLabels`. Route ids `/dana`,
    `/rekening` are structural — unchanged. (D17, US-NAV-1)

- [ ] ### L — Lampiran transaksi: StoragePort disk + attachment endpoints + UI (item 33)
  - **L1** — `StorageDiskService` implementing the existing `StoragePort`
    (root from `STORAGE_DIR` env, persistent volume in `docker-compose.yml`);
    swap the mock binding in `storage.module.ts`. (D15)
  - **L2** — Model `TransactionAttachment { id, transactionId, familyGroupId, path, mimeType, size, createdAt }`
    - multipart `POST /family-groups/:id/transactions/:txId/attachments`
      (jpg/png/webp/pdf, ≤5MB — reuse the `FileInterceptor` pattern from
      `reconciliation.controller.ts`), streamed `GET`, `DELETE`. Tenant-scope
      every path; no path traversal. (US-TXN-9)
  - **L3** — UI: file/photo input in the transaction dialog + attachment list
    in transaction detail. NOTE: `components/shell/transaction-dialog.tsx` is a
    protected foundation file — this is a reviewed foundation change.

- [ ] ### M — Laporan COA matrix tanggal×bulan (item 35)
  - **M1** — `GET /family-groups/:id/reports/coa-matrix?coaAccountId=&year=`
    → `{ total, cells: { [month][day]: [{txId, amount, description}] } }`,
    joining transactions via `Category.coaAccountId` (pattern:
    `coa-classify.util.ts`). Unit tests: short months, day 31, empty year.
  - **M2** — New laporan tab `rcoa` ("Ringkasan COA") in `nav.ts` +
    `laporan/page.tsx`: COA-account + year pickers → grid tanggal(1–31) ×
    bulan(Jan–Des), stacked per-transaction amounts, yearly total header,
    cell click → transaction list. (D16, US-RPT-14)

- [ ] ### N — UI/UX revamp: HTML prototype semua halaman (shadcn + ApexCharts) → approval → implementasi (item 36)
  - **N1** — Static-HTML prototype of ALL pages + modals/popups: shadcn look
    (dashboard-blocks patterns) + ApexCharts via CDN, openable in a browser,
    zero app changes. Built with the `frontend-design` + `dataviz` +
    `ui-ux-pro-max` skills (style/palette/font-pairing database for the
    visual decisions). (D18, US-UI-1)
  - **N2** — Owner reviews and approves the prototype. **Nothing in N ships to
    the app before this sign-off.**
  - **N3** — Implementation to follow as its own planned wave after N2;
    swapping `components/charts/*` to ApexCharts is a reviewed foundation
    change and will need its own migration plan.

## Acceptance Criteria

**Family & access**

```
Given a master creating a wife account (relationship istri)
When  the creation succeeds
Then  the wife is a second owner of the SAME family group
And   no new family group exists for her
And   creating a second istri in that group is refused
```

```
Given the wife logs in (after forced password change)
When  she opens any menu, the transaction form, or member management
Then  her menu is identical to the master's
And   the transaction account picker lists every family account
And   she can add a dependant/operational member successfully
```

```
Given a dependant with one assigned account
When  they open the transaction form
Then  the picker contains ONLY their assigned account (deny asserted, not just allow)
```

```
Given a pending permintaan dana and a source account with insufficient funds
When  the owner approves it from /persetujuan
Then  the approval fails with the overdraft message shown verbatim to the user
And   choosing a funded account succeeds and moves the money
```

```
Given a brand-new registration
When  the user first opens rekening/transaksi
Then  zero accounts exist and the empty state renders correctly
```

**PIN (verified on DEV through nginx, not localhost)**

```
Given a logged-in member on a new device
When  they set a PIN, log out, and unlock with that PIN
Then  the unlock succeeds and lands on the dashboard
And   a wrong PIN says "PIN salah" while a routing/server failure says something else
```

**Investments**

```
Given a kripto holding of 0.015 BTC recorded at Rp 1.500.000.000/BTC
When  the portfolio renders with live prices on
Then  the gain/loss percent derives from the CoinGecko IDR price
And   is not -99.99% unless the market actually collapsed
```

```
Given a saham input of 10 lot at Rp 5.000
When  saved and re-opened
Then  the stored quantity is 1.000 lembar and the position value is Rp 5.000.000
And   entering 1.000 lembar directly produces the identical record
```

```
Given a deposito of Rp 100.000.000 at 5%/thn started 2026-01-01
When  viewed on 2026-07-01
Then  its current value shows Rp 102.500.000 (simple interest, pro-rata)
```

**Truth in UI**

```
Given a family with no religion set
When  the Donasi page opens
Then  an inline religion prompt renders, and choosing "islam" reveals the zakat calculator without navigation
```

```
Given the aset page eye toggle is off
When  it is pressed
Then  every amount on the page is blurred and the state survives reload (per user)
```

```
Given a reference item "Bank Jago" added to Bank master data
When  the page is refreshed
Then  the item is still there (persisted server-side, scoped to the family)
```

**Split bill**

```
Given a split-bill share link
When  an unauthenticated recipient opens it
Then  the share page renders without any login redirect
```

```
Given a legacy bill whose payoutAccountId is null
When  the owner edits it from the detail dialog and sets a payout account
Then  participants can confirm without the "atur dulu" error
```

**Liabilities, warisan, pajak, attachments, COA report**

```
Given a liability item on /liabilitas
When  the user opens its actions
Then  Detail, Edit, Hapus, and Bayar all exist and hit the real endpoints
And   Bayar splits principal/interest and debits the chosen source account
```

```
Given an heir row with a name and no relationship
When  the user saves
Then  the form blocks with a field-level message BEFORE any API call
```

```
Given a gross income typed as "100.000.000" (auto-formatted with dots)
When  saved
Then  the record persists and no "must be a numeric string" error can occur
```

```
Given a transaction with an attached photo
When  its detail is opened by another family member with access
Then  the photo renders; a member of another family gets 404, never the file
```

```
Given COA account "Belanja" and year 2026 with two transactions on Jan 1
When  the COA matrix tab renders
Then  the Jan column day-1 cell shows both amounts stacked and the header shows the year total
And   clicking the cell lists exactly those transactions
```

**Honesty checklist**

- No inert interactive elements remain on touched pages: a rendered button
  works or is removed.
- Every error toast in touched flows carries the server's message when one
  exists (`extractApiErrorMessage`), never only a generic string.
- Every manually-priced investment is labelled manual with its date; every
  live price carries source and delay labelling (pattern from EPIC-023 G1).
- [ ] Every new user-visible string exists in both locales
- [ ] `scripts/qa.sh`, `scripts/test.sh`, `scripts/security-check.sh` green per PR
- [ ] Each new test fails against pre-fix code

## Definition of Done

See [`../DEFINITION-OF-DONE.md`](../DEFINITION-OF-DONE.md). Additionally for
this epic:

- Playwright E2E for the changed flows is **run and reported explicitly** —
  `scripts/test.sh` does not run E2E, so a green gate alone is not done
  (standing lesson from the EPIC automation history).
- Group B is only done when verified on the DEV deployment through nginx; the
  defect does not reproduce locally.
- Permission changes (A) are proven by tests that assert a **denial**, not only
  a success (EPIC-023 C's lesson).
- Money math (C3 deposito, D2 fixed depreciation, G1 pay split, M1 matrix) is
  verified against hand-computed golden values, not the implementation's own
  output.
- All migrations are additive and apply cleanly to a DB with existing rows;
  the mock-price purge is idempotent.
- Group N's prototype has explicit owner sign-off recorded in the Automation
  Log before any implementation work starts.

## Test Plan

- **Unit** — lot↔lembar conversion (both directions, idempotent);
  deposito simple interest incl. pro-rata and post-maturity; penyusutan fixed
  mode (floor 0, mode switch); COA matrix cells (short months, day 31, empty
  year, stacked same-day); heir validation; tax bounds (max, dot-stripping);
  max-1-istri constraint.
- **Integration** — createDependantMember with role owner+istri creates no
  family group; group-resolution returns the same group across all three code
  paths for a 2-membership user; attachment endpoints refuse cross-tenant
  access and >5MB/wrong-MIME uploads; reference-item CRUD scoped per family;
  PATCH split-bill payout.
- **E2E (Playwright, headless, run explicitly)** — PIN setup + PIN login on
  DEV; master creates istri → istri logs in (forced password change) → full
  account picker → adds a dependant; approve/reject from /persetujuan with a
  visible real error on overdraft; open /split/<token> logged-out; liabilitas
  detail/edit/pay/delete; upload lampiran and view it in detail; laporan COA
  tab renders the matrix.
- **Deploy smoke** — `scripts/deploy-dev.sh` then the group-B PIN journey and
  one public split link through nginx.
- **Manual QA** — owner walks the 27 verbatim items against DEV and checks
  each one off.

## Agent Routing

Routed from what is actually installed, reusing the protocol EPIC-023 proved
out (adversarial review for money/permission groups, test-first for money
math, graphify blast-radius before shared files).

### Execution order — five waves

**Wave 1 — independent quick fixes (parallel, one worktree each):**
**B**, **E**, **F**, **H**, **I**, **K**. No migrations, no shared-model
changes; every one closes a client-visible bug.

**Wave 2 — the family foundation:** **A** alone. It rewrites member creation
and group resolution that later groups' E2E flows depend on.

**Wave 3 — features on stable ground (parallel):** **C**, **D**, **G**, **J**.

**Wave 4 — storage + reporting:** **L**, **M**. L touches a protected
foundation file (transaction dialog); M wants C's price cleanup merged so
matrix spot-checks are not polluted by mock rows.

**Wave 5 — prototype:** **N1** → owner approval (**N2**) → implementation
planned separately (**N3**).

**Migration ordering hazard.** A3, C2, D2, J1, L2 each add migrations. Author
them **sequentially in wave order, never concurrently** — parallel worktrees
have collided on migration timestamps in this repo before (EPIC-023's recorded
hazard). Within wave 3: C2 → D2 → J1.

### Per-group routing

| Group                | Implement                  | Domain skills to load first                             | Review (beyond the standard gate)                                             |
| -------------------- | -------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **A** family & roles | `code-agent`               | `ecc:nestjs-patterns`, `ecc:prisma-patterns`            | **adversarial**, `ecc:security-reviewer`, `database-reviewer`                 |
| **B** PIN nginx      | `code-agent`               | —                                                       | `ecc:security-reviewer` (auth routing), deploy-smoke evidence mandatory       |
| **C** investasi      | `code-agent` + `tdd-guide` | `ecc:prisma-patterns`, `docs-lookup` (CoinGecko/Yahoo)  | **adversarial**, `database-reviewer`, `ecc:typescript-reviewer`               |
| **D** aset           | `code-agent` + `tdd-guide` | —                                                       | `ecc:react-reviewer`; D2 golden values in PR body                             |
| **E** pajak          | `code-agent`               | —                                                       | `ecc:typescript-reviewer`                                                     |
| **F** split bill     | `code-agent`               | `shadcn`, `frontend-design` (F2)                        | `ecc:react-reviewer`, `ecc:security-reviewer` (F1 public route)               |
| **G** liabilitas UI  | `code-agent`               | `shadcn`                                                | `silent-failure-hunter` (pay flow), `ecc:react-reviewer`                      |
| **H** warisan        | `code-agent`               | —                                                       | standard gate only                                                            |
| **I** donasi         | `code-agent`               | —                                                       | standard gate only                                                            |
| **J** master data    | `code-agent`               | `ecc:database-migrations`, `ecc:prisma-patterns`        | `database-reviewer`                                                           |
| **K** labels         | `code-agent`               | —                                                       | standard gate only (i18n structural typecheck covers it)                      |
| **L** attachments    | `code-agent`               | `ecc:nestjs-patterns`                                   | **adversarial**, `ecc:security-reviewer` (upload: MIME/size/traversal/tenant) |
| **M** COA matrix     | `code-agent` + `tdd-guide` | `ecc:postgres-patterns` (query shape)                   | `database-reviewer` (query perf), `ecc:react-reviewer`                        |
| **N** prototype      | main session               | `frontend-design`, `dataviz`, `shadcn`, `ui-ux-pro-max` | owner approval — the review IS the sign-off                                   |

### Mandatory before touching shared code

`graphify-out/graph.json` exists — query blast radius before editing anything
shared: `components/shell/transaction-dialog.tsx` (A4, L3),
`components/crud/crud-config.ts` (A2, C4), `apps/web/src/lib/nav.ts` (A5, K1,
M2 — protected foundation file), `apps/web/src/lib/auth.ts` (A3, A6 —
protected), the i18n dictionaries (nearly every group). Foundation-file edits
(nav.ts, lib/auth.ts, transaction-dialog.tsx) are explicit reviewed foundation
changes under `WM_CONVENTIONS.md`.

### Adversarial review protocol

Groups **A, C, L** — permissions, money math, and file upload — get a review
pass briefed to **disprove the fix, not approve it** (the EPIC-023 wording,
reused verbatim in shape):

> Assume it is wrong until you prove otherwise. Do not restate what the diff
> does; hunt for what it broke. For each claimed fix, state whether it holds,
> with `file:line` evidence and a concrete failure scenario. Verify each new
> test would **fail** on the pre-change code — say which ones you are
> confident about.

Specific hunts, per group: **A** — a route reachable by a dependant that A's
scoping missed (EPIC-023 C found five such controllers; audit every
controller, not the ones the feature touches); the max-1-istri check under
concurrent requests. **C** — lot/lembar double-conversion (entering lembar
then editing must not re-multiply); mock-price purge deleting real manual
prices. **L** — path traversal via filename, MIME spoofing, cross-tenant
object access, and disk exhaustion (no per-family quota is specified — flag
it, don't silently add one).

### Test-first for money groups

**C3 (deposito), D2 (fixed depreciation), G1's pay verification, M1 (matrix)**
are test-first with hand-computed golden values in the PR body. The reason is
recorded in EPIC-023: a test written after the code asserted an identity that
held by construction and passed with a wrong formula.

### Autonomy

Full autonomy through DEV deploy per group: implement → gates → PR → merge →
`deploy-dev.sh` → verify on the running system → report. Bounded at 3 retries,
then `status: blocked` with reason, logs and recommended action. Standard
gates unchanged: `review-qa-agent`, `security-agent` + `ecc:security-reviewer`,
`test-agent` (`qa.sh` → `test.sh`), `ecc:react-build` on a broken build,
`deploy-agent` DEV only.

Two human gates stand regardless: **N2** (prototype approval) and the DEV
migration for A3's wife-role change (announce before running — it alters a
real family's access).

Per task: `/task-work EPIC-024 <n>`. Whole epic:
`/epic-loop docs/epics/EPIC-024-client-revisions-aug2026.md`.

## Relationship to Other Epics

- **EPIC-023** (on-progress) built the primitives this epic wires up:
  head-created dependants + forced password change (023 D1) are reused by A1;
  device PIN (023 D2) is what B un-breaks in nginx; liability pay endpoints
  (023 E) are what G wires into UI; live-price adapters (023 G1) are what C1
  switches on. **This epic's D1 supersedes EPIC-023's D2/D6 for wives**
  (recorded in Decisions above). Do not start EPIC-023's remaining UI work on
  member management without reading this epic's group A first.
- **EPIC-021** #15/#25 (account taxonomy renames) are finished differently by
  K1's labels — the owner's newest wording wins.

## Done Signal

Each group closes independently through `/task-work`. The epic closes when the
owner has walked all 27 verbatim items against DEV — with a family holding a
master, an istri co-master, and a dependant — and checked every one off, and
the N1 prototype has an approval recorded in the Automation Log.

## Automation Log

- 2026-08-06 — Epic created from `docs/revisi.txt` after a full grilling
  session (all 18 design decisions resolved by owner, recorded above) and a
  3-agent parallel code audit (root causes with file:line, recorded above).
  Status `backlog` — owner flips to `on-progress` to start automation.
- 2026-08-07 — Epic expanded to EPIC-023's completeness standard at the
  owner's request: added Evidence (code-read findings), 27 user stories with
  IDs, per-group sub-tasks (A1–N3) with file paths and decision/story
  traceability, Gherkin acceptance criteria, Definition of Done additions,
  five-wave agent routing with migration-sequencing hazard and adversarial
  review protocol (reusing EPIC-023's proven brief), and the supersession
  note: this epic's wife-as-second-owner decision overrides EPIC-023 D2/D6
  for wives. No code changed.
- 2026-08-11 — **N1 delivered, N2 approved.** Static-HTML prototype complete:
  35 pages under `docs/prototype/pages/` (25 app + 7 public/auth + 3 extra:
  `mastercoa`, `rekonsiliasi`, `panduan`), built on the shell/tokens/ApexCharts
  infra described in `docs/prototype/README.md`, merged to `development` via
  `feat/epic-024-task-n-uiux-revamp-prototype` (commits `e1bfce3`, `2088c81` —
  the latter resolved the 9 UX issues found in the first owner pass on
  2026-08-07: responsive/palette/whitespace/filter modal/master-data
  input/cards/contrast/dropdown/date-picker). **Owner approved N2 without a
  second live walkthrough**, on the basis of the prior review + the polish
  commit. N3 (porting the prototype into the real app) is **not started** —
  epic status remains `backlog`; Groups A–M are untouched. A follow-up
  read-only audit (`EPIC-024-N-backend-gap-report.md`) was commissioned in the
  same session to map every prototype page's depicted features against
  current `apps/web`/`apps/api` state, ahead of a future session starting
  Groups A–M/N3.
- 2026-08-11 /epic-loop EPIC-024 #B "PIN/buka cepat nginx routes + error
  surfacing" → PASS (attempts: 1). B1/B2 landed; B3 (DEV nginx smoke) pending
  epic-wide deploy. PR: https://github.com/andrsrjld/wealthme-web/pull/255
- 2026-08-11 /epic-loop EPIC-024 #E "Pajak numeric-string robustness" → PASS
  (attempts: 2; attempt 1 failed review gate for missing boundary test
  coverage, fixed in attempt 2). PR: https://github.com/andrsrjld/wealthme-web/pull/256
