# WealthMe — Overview Aplikasi Lengkap

> Dokumen ini memetakan **seluruh flow & fitur WealthMe sesuai kode terbaru** (backend
> NestJS, frontend Next.js, data model Prisma). Disusun dari pembacaan kode aktual, bukan
> rencana. Gunakan ini sebagai peta tunggal untuk memahami aplikasi end-to-end.
>
> Terakhir disinkronkan dengan kode: lihat `git log` cabang aktif. Bila ada konflik antara
> dokumen ini dan kode, **kode yang menang** — perbarui dokumen ini.

---

## 1. Ringkasan Produk

**WealthMe adalah "wealth operating system" untuk individu & keluarga Indonesia.** Berbeda dari
aplikasi pencatat pengeluaran biasa, fokus utamanya bukan transaksi melainkan **kekayaan bersih
(net worth)**:

```
Net Worth = Kas + Investasi + Aset − Liabilitas
```

Sasaran pengguna: pengelola keuangan rumah tangga yang berpikir dalam kerangka pertumbuhan
kekayaan, bukan sekadar pencatatan harian. Aplikasi mendukung **multi-tenant keluarga** (satu user
bisa tergabung di beberapa "Family Group"), peran berjenjang, dan fitur khas Indonesia
(Zakat, PPh 21, SPT, KPR).

Cakupan domain (≈17 area): autentikasi & tenancy keluarga, uang inti
(rekening/transaksi/kategori/anggaran/tujuan), wealth (investasi/aset/liabilitas/asuransi),
perencanaan (warisan/donasi/pajak), pelaporan & analitik, kalkulator finansial, alat kolaborasi
(split bill, rekonsiliasi bank), serta integrasi (OCR struk, open banking, harga pasar, AI advisor).

---

## 2. Arsitektur Tingkat Tinggi

Monorepo **Turborepo** + **pnpm workspace**:

| Path                            | Peran        | Stack                                                                              |
| ------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `apps/api`                      | Backend API  | NestJS 11 · TypeScript 5 · Prisma 6 (PostgreSQL) · Redis · BullMQ                  |
| `apps/web`                      | Frontend     | Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn/Base UI · TanStack Query |
| `packages/*`                    | Kode bersama | kontrak/util lintas app                                                            |
| `deploy/`, `docker-compose.yml` | Stack DEV    | Postgres, Redis, MinIO, api, web (lihat EPIC-011)                                  |

**Layanan pendukung:** PostgreSQL (data), Redis (refresh token + cache), BullMQ (job async:
export, alert), MinIO/S3 (penyimpanan file via storage port), Anthropic Claude (AI advisor,
kategorisasi, OCR).

### Alur sebuah request (frontend → backend)

```
Browser (Next.js page, "use client")
  │  useQuery / useMutation (TanStack Query)
  ▼
apiFetch(path, { token })            ← @/lib/api-client, lampirkan Bearer token
  │  HTTP ke NEXT_PUBLIC_API_URL (default http://localhost:4000)
  ▼
NestJS — rantai guard global (urutan):
  1. ThrottlerGuard      → rate limit (default 100 req / 60 dtk)
  2. BetterAuthGuard     → validasi JWT (kecuali route @Public)
  3. TenantGuard         → resolve familyGroupId → req.tenantContext { userId, familyGroupId, role }
  4. AbilitiesGuard      → CASL ABAC, cek @CheckAbility() per route
  ▼
Controller → Service → Prisma  (query selalu di-scope familyGroupId)
  ▼
AuditInterceptor mencatat action/entity/before/after ke AuditLog
```

`middleware.ts` di Next.js melakukan pengecekan cookie sesi (`better-auth.session_token`)
sebelum mengizinkan akses ke route grup `(app)`; jika tidak ada sesi → redirect ke `/login`.

---

## 3. Autentikasi & Multi-Tenancy

**Autentikasi** memadukan **Better Auth** (tabel `BaSession`, `BaAccount`, `Verification`) dengan
**Passport JWT** (strategi `jwt.strategy.ts` & `jwt-refresh.strategy.ts`):

- Registrasi/login email-password, hashing **argon2id**.
- **Google OAuth 2.0** (`/auth/google` → `/auth/google/callback`).
- **JWT access token** (TTL pendek, mis. 15m) + **refresh token** disimpan di Redis dengan rotasi
  (token lama langsung invalid saat refresh).
- Saat registrasi: otomatis dibuat **Family Group default** + kategori & rekening awal.

**Multi-tenancy** — setiap entitas domain memiliki FK `familyGroupId`. `TenantGuard` mengambil
`familyGroupId` dari parameter route, mencocokkan ke tabel `Member` (komposit `userId +
familyGroupId`), lalu mengisi `req.tenantContext`. Jika user bukan anggota grup → **403**.
Route tingkat-user (auth, GDPR) diizinkan tanpa familyGroupId.

**Peran & izin (CASL ABAC)** — enum `Role { owner, member, admin_staff }`:

| Peran         | Ringkasan kemampuan                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `owner`       | `manage` semua entitas termasuk FamilyGroup & Member                                               |
| `member`      | `manage` mayoritas data finansial; **read** pada account/category/coa; tak bisa kelola FamilyGroup |
| `admin_staff` | Mostly **read-only**; pada Transaction hanya **create/read** (peran input-only/staf)               |

Route publik (tanpa auth): `/health`, `/auth/{register,login,refresh,google*}`, `/calculators/*`,
`/fx/rates`, `/split-bills/share/:token`, `GET /invitations/:token`.

---

## 4. Modul Backend (per domain)

37 folder di `apps/api/src/`. Modul fitur dengan route HTTP-nya (prefix tenant
= `/family-groups/:id`):

### Auth & Keluarga

| Modul           | Route utama                                                                                                                                         | Tanggung jawab                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `auth`          | `POST /auth/register·login·logout·refresh`, `GET /auth/me`, `PATCH /auth/profile`, `POST /auth/change-password`, `GET /auth/google·google/callback` | Registrasi, JWT + rotasi refresh, Google OAuth, argon2       |
| `family-groups` | `GET /family-groups/mine`, `POST /family-groups`, `…/members*`, `…/invitations`, `GET /invitations/:token`, `POST /invitations/:token/accept`       | Manajemen grup keluarga, anggota & peran, undangan via token |

### Uang Inti

| Modul          | Route utama                                                                                                          | Tanggung jawab                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `accounts`     | CRUD `…/accounts`                                                                                                    | Rekening bank/ewallet/cash/investment/property; saldo `BIGINT`; nomor termask & terenkripsi |
| `categories`   | `POST·GET·DELETE …/categories`                                                                                       | Kategori income/expense (default dibuat saat signup)                                        |
| `transactions` | `GET …/transactions[/summary]`, `POST …/transactions`, `POST …/transactions/scan`, `PATCH·DELETE …/transactions/:id` | CRUD transaksi, filter tanggal/kategori/rekening, **scan struk** via AI                     |
| `budgets`      | CRUD `…/budgets`                                                                                                     | Anggaran per kategori per periode; hitung realisasi bulan berjalan vs limit                 |

### Wealth

| Modul         | Route utama                                    | Tanggung jawab                                                                   |
| ------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `investments` | CRUD `…/investments` + `…/investments/summary` | Portofolio (saham/reksa dana/obligasi/emas/kripto); P&L cost basis vs nilai kini |
| `assets`      | CRUD `…/assets` + `…/assets/:id/history`       | Aset fisik (properti/kendaraan/elektronik/perhiasan); riwayat nilai              |
| `liabilities` | CRUD `…/liabilities` + `…/liabilities/summary` | Utang (KPR/CC/pinjaman/kendaraan); sisa saldo, bunga, jatuh tempo                |
| `insurances`  | CRUD `…/insurances` + `…/insurances/summary`   | Polis (jiwa/kesehatan/kendaraan/properti); premi & pertanggungan                 |

### Perencanaan & Kepatuhan

| Modul         | Route utama                                                  | Tanggung jawab                                                                  |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `goals`       | CRUD `…/goals`                                               | Tujuan finansial; status on_track/needs_boost/achieved/at_risk; auto-debit      |
| `inheritance` | CRUD `…/inheritance`                                         | Aset warisan + ahli waris (share %), visibilitas private/heirs_only/all_members |
| `donations`   | CRUD `…/donations?year=`                                     | Zakat/infaq/sedekah/wakaf; penanda tax-deductible                               |
| `tax`         | `GET·POST(upsert per tahun)·PATCH·DELETE …/tax`              | Catatan pajak per `taxYear`, status SPT, zakat deduction                        |
| `gdpr`        | `GET /users/me/gdpr/export`, `DELETE /users/me/gdpr/account` | Hak akses & hapus data (PDP)                                                    |

### Pelaporan & Analitik

| Modul           | Route utama                                                             | Tanggung jawab                                                 |
| --------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `dashboard`     | `…/dashboard/summary`, `…/dashboard/net-worth`                          | Rollup net worth & ringkasan beranda                           |
| `reports`       | `…/reports/{summary,bank,detail,pnl,balance-sheet,cashflow,sankey}`     | Laporan keuangan, rentang tanggal, diagram Sankey              |
| `exports`       | `POST …/exports`, `GET …/exports/:jobId`                                | Job export PDF/Excel async via BullMQ                          |
| `search`        | `GET …/search?q=`                                                       | Pencarian lintas rekening/kategori/transaksi (throttle 60/mnt) |
| `notifications` | `GET …/notifications[/unread-count]`, `PATCH …/notifications/mark-read` | Alert anggaran & notifikasi, status baca                       |

### Alat & Integrasi

| Modul            | Route utama                                                                                   | Tanggung jawab                                            |
| ---------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `ai-advisor`     | `POST …/ai-advisor/chat` (**SSE streaming**)                                                  | Chat AI dengan konteks finansial pengguna via Anthropic   |
| `categorization` | (service internal)                                                                            | Kategorisasi transaksi otomatis via AI (port/adapter)     |
| `open-banking`   | `POST /open-banking/{consent,token,accounts,transactions}`                                    | Alur consent OAuth & sinkron data bank (port pattern)     |
| `reconciliation` | `…/reconciliation/upload`, `…/reconciliation/:syncId/entries`, `…/auto-match`                 | Unggah mutasi bank, cocokkan manual/otomatis ke transaksi |
| `split-bills`    | CRUD `…/split-bills` + `…/participants/:pid/settle`, `GET /split-bills/share/:token` (publik) | Patungan tagihan, pelunasan peserta, share link           |
| `calculators`    | `POST /calculators/{zakat,pph21,investment,kpr,retirement}` (publik)                          | Kalkulator murni (lihat §9)                               |
| `coa-accounts`   | CRUD `…/coa-accounts`                                                                         | Master Chart of Accounts (double-entry reference)         |
| `fx`             | `GET /fx/rates?base=IDR` (publik)                                                             | Kurs valas via port                                       |
| `health`         | `GET /health` (publik)                                                                        | Liveness check                                            |
| `audit`          | (interceptor internal)                                                                        | Catat audit log setiap aksi                               |

**Setup global (`main.ts` / `app.module.ts`):** Pino logger (redaksi header Authorization/Cookie),
Helmet, `ValidationPipe` (`whitelist + transform`), `AllExceptionsFilter`, CORS untuk `WEB_ORIGIN`
dengan credentials, Swagger di `/api/docs` (non-prod), ThrottlerGuard global, env divalidasi Zod.

---

## 5. Frontend — Halaman & Navigasi

Frontend Next.js 16 App Router. Halaman aplikasi ada di `apps/web/src/app/(app)/[page-id]/page.tsx`,
semuanya diawali `"use client"` dan hanya merender konten dalam; shell (sidebar/topbar/mobile nav)
disediakan route group. Navigasi global (`lib/nav.ts`) terbagi **3 seksi**:

### Auth (publik)

`/login`, `/register`, `/lupa-password`, `/reset-password`, dan `/` (redirect ke `/beranda` atau
`/login` sesuai sesi).

### Seksi Utama

| Route         | Arti (EN)     | Isi halaman                                                                        |
| ------------- | ------------- | ---------------------------------------------------------------------------------- |
| `/beranda`    | Dashboard     | Hero net worth, sparkline tren, bar chart cashflow, kartu rekening, tujuan teratas |
| `/ringkasan`  | Summary       | Snapshot/rincian kekayaan                                                          |
| `/transaksi`  | Transactions  | Daftar transaksi, filter tipe, CRUD, tambah cepat                                  |
| `/anggaran`   | Budget        | Anggaran per kategori, progress bar berwarna (aman/warning/bahaya)                 |
| `/laporan`    | Reports       | Hub laporan multi-tab (P&L, neraca, cashflow, Sankey, dll) + export                |
| `/tujuan`     | Goals         | Tujuan finansial, status & progress                                                |
| `/notifikasi` | Notifications | Feed alert/notifikasi                                                              |

### Seksi Keuangan

| Route         | Arti (EN)         | Isi halaman                                                        |
| ------------- | ----------------- | ------------------------------------------------------------------ |
| `/dana`       | Wallets           | Dompet & e-wallet (Dana/GoPay/OVO)                                 |
| `/rekening`   | Bank accounts     | Rekening bank + rekonsiliasi                                       |
| `/investasi`  | Investments       | Portofolio, P&L, harga realtime (socket.io)                        |
| `/aset`       | Assets            | Seluruh aset (finansial + fisik), count-up Rupiah, total net worth |
| `/liabilitas` | Liabilities       | Utang, rasio utang-aset, pelacakan pembayaran                      |
| `/asuransi`   | Insurance         | Polis, premi, pertanggungan                                        |
| `/warisan`    | Inheritance       | Perencanaan waris & ahli waris _(badge New)_                       |
| `/donation`   | Donations & Zakat | Donasi & zakat _(badge New)_                                       |
| `/tax`        | Tax Center        | Pusat pajak, kalkulator PPh21, status SPT _(badge New)_            |

### Seksi Alat

| Route           | Arti (EN)      | Isi halaman                                        |
| --------------- | -------------- | -------------------------------------------------- |
| `/splitbill`    | Split Bill     | Patungan tagihan + share link _(badge New)_        |
| `/rekonsiliasi` | Reconciliation | Sinkron mutasi bank ke transaksi                   |
| `/ai`           | AI Advisor     | Chat penasihat keuangan                            |
| `/kalkulator`   | Calculators    | Kumpulan kalkulator (investasi, KPR, pensiun, dll) |
| `/quickinput`   | Quick Input    | Input transaksi kilat _(badge New)_                |
| `/mastercoa`    | Master COA     | Manajemen Chart of Accounts _(badge New)_          |
| `/masterdata`   | Master Data    | Setup data awal (kategori, tipe akun, anggota)     |
| `/akun`         | Account        | Profil & pengaturan user (akses mobile/topbar)     |

**Mobile nav** menyederhanakan ke 4 item: Beranda, Transaksi, Laporan, Akun.

---

## 6. Lapisan Data Frontend

- **`@/lib/api-client` → `apiFetch<T>(path, { token })`** — wrapper fetch, lampirkan
  `Authorization: Bearer`, lempar `ApiError { status, message }` saat non-2xx.
- **TanStack React Query** + **`@/lib/query-keys`** — key ter-namespace dan **di-scope
  `familyGroupId`**, sehingga cache tidak bocor antar keluarga. `staleTime` umumnya 60 dtk;
  mutasi memicu `invalidateQueries`.
- **Sesi** — `useSession()` (`@/lib/auth-compat`) mengembalikan `{ accessToken, familyGroupId,
userId, user }`. Query dijalankan hanya bila `familyGroupId` & `accessToken` ada (`enabled`).
- **Realtime** — `socket.io-client` untuk harga investasi & notifikasi → invalidasi query terkait.
- **Format** — `@/lib/format` (locale `id-ID`): `formatRupiah`, `formatRupiahCompact`
  ("Rp 25,85 jt"/"Rp 1,25 M"), `parseRupiah`, `formatAmountInput`.

**Design system** (jangan diduplikasi; reuse):

- `@/components/wm` — `SectionCard`, `HeroCard`, `SummaryCard`, `MoneyStat`, `ProgressBar`,
  `StatusBadge`, `IconChip`, `CountUpRupiah`, `Rise`.
- `@/components/charts` — `Sparkline`, `Donut` + `DonutLegend`, `BarChart`.
- `@/components/shell` — `AppShell`, `SidebarNav`, `Topbar`, `MobileNav`, `SearchDialog` (Cmd+K),
  `TransactionDialog` (tambah cepat), `ThemeToggle`/`ThemePicker` (5 preset warna).
- `@/components/ui` — primitif Base UI (button, dialog, table, dll). Gunakan `render={<el/>}`
  **bukan** `asChild`.

> File pondasi dilindungi (jangan modifikasi tanpa task khusus): `globals.css`, `lib/*`,
> `components/{ui,wm,charts,shell}`, `layout.tsx`. Lihat `WM_CONVENTIONS.md`.

---

## 7. Model Data (Prisma)

**29 model, 20 enum** di `apps/api/prisma/schema.prisma`. Hampir semua entitas domain di-scope
`familyGroupId`. Dikelompokkan per domain:

| Domain             | Model                                            | Catatan kunci                                                               |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------- |
| Auth & user        | `User`, `BaSession`, `BaAccount`, `Verification` | argon2, Better Auth + OAuth                                                 |
| Keluarga & tenancy | `FamilyGroup`, `Member`, `Invitation`            | `Member(userId, familyGroupId) → Role`                                      |
| Uang inti          | `Account`, `Category`, `Transaction`, `Budget`   | saldo & amount `BIGINT` (Rupiah, tanpa minor unit)                          |
| Tujuan             | `Goal`                                           | enum `GoalStatus`                                                           |
| Investasi          | `Investment`, `InvestmentPrice`                  | qty & cost basis `Decimal`; riwayat harga                                   |
| Aset               | `Asset`, `AssetHistory`                          | snapshot nilai untuk tren                                                   |
| Liabilitas         | `Liability`                                      | sisa saldo, bunga, jatuh tempo                                              |
| Asuransi           | `Insurance`                                      | enum status & periode premi                                                 |
| Split bill         | `SplitBill`, `SplitParticipant`                  | `shareToken` unik, status pelunasan                                         |
| Rekonsiliasi       | `BankSync`, `BankSyncEntry`                      | `ReconStatus` matched/unmatched/suggested                                   |
| Warisan            | `InheritanceAsset`, `InheritanceHeir`            | share % per ahli waris, visibilitas                                         |
| Donasi & pajak     | `Donation`, `TaxRecord`                          | zakat/infaq/wakaf; `TaxRecord(familyGroupId, taxYear)` unik                 |
| COA                | `CoaAccount`                                     | `(familyGroupId, code)` unik; `CoaDirection`, `CoaBudgetType`, `parentCode` |
| Lintas-cutting     | `Notification`, `AuditLog`                       | audit: before/after JSON, IP, user-agent                                    |

**Enum penting:** `Role`, `AccountType`, `CategoryKind`, `TransactionType`, `BudgetPeriod`,
`GoalStatus`, `AssetType`, `InvestmentType`, `LiabilityType`, `InsuranceType`/`InsuranceStatus`/
`PremiumPeriod`, `SplitStatus`/`ParticipantStatus`, `InheritanceVisibility`, `DonationType`,
`SptStatus`, `ReconStatus`, `CoaDirection`, `CoaBudgetType`.

> **Aturan uang:** semua nominal Rupiah disimpan `BIGINT` (tanpa sen) untuk menghindari error
> float; kuantitas investasi & share pakai `Decimal`.

---

## 8. Alur End-to-End (skenario naratif)

**a) Login → Dashboard net worth.** User login (`/login`) → Better Auth set cookie sesi →
`middleware.ts` mengizinkan `(app)` → `/beranda` memanggil `dashboard/summary` & `net-worth` →
backend mengagregasi accounts + assets + investments − liabilities → kartu hero & sparkline tampil.

**b) Tambah transaksi + kategorisasi AI.** User klik tambah cepat (`TransactionDialog`) atau
`POST …/transactions/scan` dengan foto struk → modul `categorization`/AI mengekstrak & menyarankan
kategori → transaksi tersimpan → query `transactions` & `dashboard` di-invalidasi → saldo & net
worth ter-update.

**c) Anggaran → alert.** User set `Budget` per kategori. Service anggaran menjumlahkan transaksi
`expense` bulan berjalan vs `limitAmount`. Saat ambang terlampaui, `Notification` dibuat (job
BullMQ) → muncul di `/notifikasi` + badge unread di topbar.

**d) AI Advisor (SSE).** `/ai` membuka `POST …/ai-advisor/chat` → backend menyusun konteks
(income/expense bulanan, aset, liabilitas, top kategori) → streaming token-by-token via SSE
(`data: {"token": …}` … `data: {"done": true}`). Math deterministik (zakat/PPh) **tidak**
didelegasikan ke LLM.

---

## 9. Fitur Khas Indonesia & Islamic Finance

- **Kalkulator** (publik, `POST /calculators/*`): `zakat` (Zakat Maal 2.5% + nisab),
  `pph21` (PPh 21 progresif sesuai UU HPP), `investment` (bunga majemuk), `kpr` (cicilan KPR),
  `retirement` (dana pensiun). Perhitungan murni & deterministik.
- **Donasi & Zakat** (`/donation`): jenis `zakat_maal`, `zakat_fitrah`, `infaq`, `sedekah`,
  `wakaf`, `lainnya`; penanda tax-deductible untuk pengurang pajak.
- **Tax Center** (`/tax`): catatan pajak per tahun, status SPT (`belum_lapor`/`sudah_lapor`/
  `terlambat`), pengurang zakat, persiapan dokumen e-Filing.
- **Master COA** (`/mastercoa`): Chart of Accounts (kelompok Income, Expense, Wealth Allocation,
  AR, AP, Tax) untuk referensi pembukuan; arah `INCOME/EXPENSE/TRANSFER`, tipe anggaran
  `FIXED/VARIABLE/REIMBURSEMENT`.

---

## 10. Status Pengembangan (Epics)

Status diambil dari frontmatter `docs/epics/EPIC-*.md` (kondisi terbaru):

| #   | Epic                        | Fokus                                                 | Status       |
| --- | --------------------------- | ----------------------------------------------------- | ------------ |
| 000 | Foundation & Infra          | Monorepo, Docker, CI/CD                               | ready-for-qa |
| 001 | Backend Foundation          | Auth, Prisma, RBAC, OpenAPI                           | ready-for-qa |
| 002 | Core Money Tracking         | Accounts, transaksi, anggaran, tujuan (**MVP**)       | ready-for-qa |
| 003 | Wealth                      | Investasi, aset, liabilitas, asuransi + live pricing  | ready-for-qa |
| 004 | Reports & Calculators       | Laporan, Zakat, PPh 21, export PDF/Excel              | ready-for-qa |
| 005 | Family & Tools              | Multi-tenant, warisan, donasi, tax center, split bill | ready-for-qa |
| 006 | Integrations & AI           | OCR, open banking, market data, AI advisor            | ready-for-qa |
| 007 | Hardening & Launch          | Enkripsi, PDP/OJK, observability, i18n, a11y          | ready-for-qa |
| 008 | Bug-fix 500 API Errors      | Perbaikan data load & error handling                  | ready-for-qa |
| 009 | Missing Pages MVP           | Pengisian halaman frontend                            | ready-for-qa |
| 010 | Frontend shadcn Theming     | Polish design system                                  | ready-for-qa |
| 011 | Dockerized DEV Stack + Seed | Docker Compose + data demo                            | ready-for-qa |
| 012 | Master COA                  | Master Chart of Accounts                              | ready-for-qa |
| 013 | Design-System Enhancement   | Komponen & layer theming                              | **done**     |

Praktis: seluruh fitur inti sudah terimplementasi & menunggu QA manusia (`ready-for-qa`); EPIC-013
sudah `done`. Tidak ada epic berstatus `backlog`/`blocked` saat dokumen ini ditulis.

---

## 11. Data Demo / Seed

`apps/api/prisma/seed.ts` menyiapkan satu keluarga demo untuk eksplorasi lokal:

- **Login demo:** `demo@wealthme.id` / `demo1234` (peran `owner`, family "Keluarga Demo").
- **Rekening:** 3 bank (BCA, Mandiri, BNI), 2 e-wallet (GoPay, OVO), 1 kas.
- **Kategori:** 5 income + 8 expense default.
- **Transaksi:** ~54 transaksi tersebar 6 bulan (gaji bulanan + pengeluaran + transfer).
- **Anggaran:** 8 anggaran bulanan; **Tujuan:** 4 (Dana Darurat, Liburan Jepang, DP Rumah, Pensiun).
- **Liabilitas:** KPR BTN, CC BCA, kredit mobil. **Aset:** rumah, mobil, MacBook, emas (+riwayat).
- **Investasi:** BBCA, TLKM (saham), Manulife (reksa dana). **Asuransi:** Prudential, BPJS, Astra.
- **Warisan, donasi, pajak, split bill, bank sync** turut diisi contoh.

Jalankan stack DEV via Docker Compose (lihat `docs/DEPLOYMENT.md` & EPIC-011) lalu migrate + seed.

---

## 12. Glosarium ID ↔ EN

| Indonesia          | English             |
| ------------------ | ------------------- |
| Beranda            | Dashboard / Home    |
| Ringkasan          | Summary             |
| Transaksi          | Transactions        |
| Anggaran           | Budget              |
| Laporan            | Reports             |
| Tujuan (Keuangan)  | (Financial) Goals   |
| Notifikasi         | Notifications       |
| Dana               | Wallets / e-wallets |
| Rekening           | Bank accounts       |
| Investasi          | Investments         |
| Aset               | Assets              |
| Liabilitas         | Liabilities         |
| Asuransi           | Insurance           |
| Warisan            | Inheritance         |
| Donasi & Zakat     | Donations & Zakat   |
| Pajak / Tax Center | Tax                 |
| Split Bill         | Bill splitting      |
| Rekonsiliasi       | Reconciliation      |
| Kalkulator         | Calculators         |
| Master COA         | Chart of Accounts   |
| Master Data        | Setup master data   |
| Akun               | Account settings    |

---

### Referensi cepat

- Konvensi: `WM_CONVENTIONS.md`, `apps/web/WM_CONVENTIONS.md`
- Operasi/agentic: `CLAUDE.md`, `AGENTS.md`, `docs/AGENTIC-WORKFLOW.md`
- Deploy: `docs/DEPLOYMENT.md`, `docker-compose.yml`
- Skema data: `apps/api/prisma/schema.prisma`, seed `apps/api/prisma/seed.ts`
- Epic & status: `docs/epics/README.md`
