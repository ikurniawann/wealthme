# WealthMe — Rekomendasi Stack & Rencana Backend

## Context

Frontend WealthMe sudah jadi (Next.js 16 di `web/`, 21 halaman, semua data masih mock di
`web/src/lib/data.ts` + auth mock di `web/src/components/providers/auth-provider.tsx`).
Dokumen ini merekomendasikan stack backend agar **semua kebutuhan tercukupi**: 17 domain data,
multi-tenant _family finance_ + RBAC (owner/member/admin-staf), dan integrasi (OCR, open
banking, harga pasar, LLM, FX, notifikasi, penyimpanan dokumen).

Keputusan yang sudah dikunci:

- **Repository:** **Monorepo** (satu repo) — bukan repo terpisah.
- **Topologi:** modular monolith → microservices (mulai monolith modular, pisah saat skala butuh).
- **Hosting:** self-host (Docker/VPS/K8s) — penting untuk residensi data ID (UU PDP / potensi OJK).
- **Integrasi v1:** adapter + mock dulu, ganti provider nyata bertahap.
- **Auth:** Auth.js (web) + RBAC custom — implementasi & full control sendiri.

## Repository strategy (monorepo)

Satu repo. Microservices nanti tetap hidup di repo yang sama (Turborepo/Nx multi-app), jadi
"modular monolith → microservices" **tidak** berarti pisah repo. Struktur target:

```
wealthme/
├─ apps/
│  ├─ web/        # Next.js — DIPINDAH dari folder `web/` yang sudah ada sekarang
│  └─ api/        # NestJS (modular monolith)
├─ packages/
│  ├─ contracts/  # Zod + tipe DTO, di-import langsung oleh web & api (1 sumber kebenaran)
│  └─ config/     # tsconfig / eslint / prettier bersama
├─ pnpm-workspace.yaml
└─ turbo.json
```

Langkah migrasi awal (Fase 1): inisialisasi pnpm workspace + Turborepo di root, pindahkan
`web/` → `apps/web/` (sesuaikan path/alias), lalu `nest new apps/api`. Akses tim diatur via
CODEOWNERS bila perlu pemisahan. Mudah di-extract ke repo sendiri belakangan karena boundary
& kontrak sudah berupa package.

---

## Rekomendasi Stack (ringkas)

| Layer          | Pilihan                                                                                                              | Alasan                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Bahasa         | **TypeScript** (Node.js LTS 20/22) end-to-end                                                                        | Satu bahasa FE+BE+mobile, share tipe                                                                                       |
| Monorepo       | **pnpm workspaces + Turborepo** (alt: Nx jika butuh boundary ketat)                                                  | `apps/web`, `apps/api`, `packages/contracts` (Zod/DTO), `packages/config`                                                  |
| Framework BE   | **NestJS** (modular monolith)                                                                                        | Modul berbatas jelas → mudah diekstrak ke microservice; DI, guards, queues bawaan                                          |
| API style      | **REST + OpenAPI** (`@nestjs/swagger`), kontrak via **Zod** (`nestjs-zod`)                                           | Skema Zod dipakai ulang FE & mobile; client typed di-generate (orval / openapi-typescript)                                 |
| Database       | **PostgreSQL** + **Prisma ORM**                                                                                      | Relasional kuat utk keuangan + JSONB fleksibel; Prisma sesuai dev doc, migrasi & type-safe                                 |
| Uang           | Kolom **BIGINT (rupiah penuh, tanpa sen)** atau `Decimal`                                                            | Hindari float; IDR praktis tanpa minor unit                                                                                |
| Cache / queue  | **Redis** + **BullMQ**                                                                                               | Cache harga/FX/search, refresh-token store, background jobs (cron harga, OCR, rekonsiliasi, notifikasi, report)            |
| Realtime       | **WebSocket** (Nest Gateway / Socket.IO) atau SSE                                                                    | Push update harga investasi & notifikasi                                                                                   |
| Auth (API)     | **Passport (NestJS) + JWT** (access + refresh, rotasi di Redis), hash **argon2id**                                   | API otoritatif utk web **dan** mobile                                                                                      |
| Auth (Web)     | **Auth.js (NextAuth)** sbg session/cookie + OAuth UX, delegasi verifikasi ke API                                     | Sesuai pilihan user; httpOnly cookie aman                                                                                  |
| Otorisasi      | **CASL** (ability per-tenant) + scoping kolom `userId`/`familyGroupId` + Postgres RLS (defense-in-depth)             | RBAC owner/member/admin-staf fine-grained                                                                                  |
| Object storage | **MinIO** (S3-compatible, self-host)                                                                                 | Dokumen warisan/pajak + gambar struk; API S3 → mudah pindah cloud                                                          |
| Search         | **Postgres FTS (pg_trgm)** v1 → **Meilisearch** bila perlu                                                           | Cukup utk search index sekarang                                                                                            |
| AI / LLM       | **Claude (Anthropic)** via Vercel **AI SDK** di balik `AiAdvisorPort`                                                | Advisor chat = `claude-sonnet-4-6` (streaming); kategorisasi/insight murah = `claude-haiku-4-5`. Provider-agnostic gateway |
| Email/notif    | **Nodemailer/SMTP** (dev: MailHog) → SendGrid/SES nanti, di balik `NotificationPort`                                 | Adapter, mock dulu                                                                                                         |
| Observability  | pino (log), OpenTelemetry → Prometheus/Grafana, **Sentry**                                                           | Wajib utk produk uang                                                                                                      |
| Ops            | **Docker Compose** (dev) → **Kubernetes / Docker Swarm** (prod), **GitHub Actions** CI/CD, **Vault/Doppler** secrets | Self-host sesuai pilihan                                                                                                   |

> Catatan auth: karena API berdiri sendiri (web + mobile), **sumber kebenaran auth ada di NestJS**
> (Passport + JWT). Web memakai **Auth.js** sebagai lapisan sesi/cookie tipis yang `authorize`-nya
> memanggil endpoint API (Credentials) dan menangani OAuth Google; mobile pakai endpoint API
> langsung. Ini memenuhi "Auth.js + RBAC custom" tanpa mengunci mobile.

---

## Arsitektur Modul (NestJS modular monolith)

Setiap modul punya boundary sendiri (controller/service/repo/DTO) → siap diekstrak jadi service.

**Domain modules:** `auth`, `users`, `family` (tenancy + RBAC + admin-staf), `accounts`
(bank/e-wallet), `transactions`, `categories`, `budgets`, `goals`, `investments`
(+`investment-prices`), `assets`, `liabilities`, `insurance`, `inheritance` (+`heirs`),
`donations` (zakat), `tax` (PPh + dokumen), `split-bills` (+participants), `notifications`,
`reports` (agregasi PNL/Balance Sheet/Cashflow/Sankey — pakai CQRS read-model bila perlu).

**Integration modules (port + adapter, mock-first):**
`ocr` (`OcrPort`), `banking` (`BankSyncPort` + parser rek. koran PDF/Excel), `market-data`
(`MarketDataPort`), `fx` (`FxPort` — kurs BI), `ai` (`AiAdvisorPort`), `storage` (`StoragePort`
→ MinIO), `notifications` channel (`NotificationPort`). Tiap port punya impl `Mock*` (v1) +
`*Real` (bertahap), dipilih via config/env. Pekerjaan berat lewat **BullMQ** (queue: `ocr`,
`reconciliation`, `prices`, `reports`, `notifications`).

**Lintas-cutting:** `RbacGuard` (CASL) + `TenantInterceptor` (inject & enforce
`userId`/`familyGroupId` ke setiap query), `AuditModule` (catat aksi admin-staf — penting
kepatuhan), rate-limit (`@nestjs/throttler`), validasi Zod global.

---

## Data layer & multi-tenancy

- Skema Prisma: tiap entitas domain dengan FK `userId` dan opsional `familyGroupId`. Tabel
  tambahan sesuai dev doc: `investment_prices`, `heirs`, `donations`, `tax_records`,
  `split_bills`/`split_participants`, `notifications`, `audit_logs`, `refresh_tokens`,
  `bank_connections` (consent).
- **Tenancy:** shared-DB, scoping di app-layer (TenantInterceptor) + **Postgres RLS** sbg lapis
  kedua. Aturan privasi: member tak lihat saldo pribadi member lain, hanya saldo bersama;
  admin-staf hanya input (can-input) + kategori dibatasi.
- **Enkripsi:** at-rest (disk/TDE) + kolom sensitif (nomor rekening, dok) via app-level AES-GCM /
  pgcrypto. PII minimal, audit trail, retensi sesuai PDP.

---

## Kontrak FE↔BE & perubahan wiring frontend (tanpa ubah UI)

- `packages/contracts`: skema Zod + tipe DTO → dipakai API (validasi) **dan** FE (typed client).
- Web: ganti `web/src/lib/data.ts` (mock) dengan **TanStack Query** + client typed hasil generate
  dari OpenAPI; ganti `auth-provider.tsx` mock dengan Auth.js session yang membawa JWT API.
  Komponen UI & token desain **tidak berubah** — hanya sumber data.

---

## Roadmap bertahap (selaras dev doc §9)

1. **Fondasi:** monorepo (pindah `web/`→`apps/web/`), Docker Compose (api+postgres+redis+minio+
   mailhog), Prisma skema inti (users/family/accounts/transactions/categories), Auth
   (Passport+JWT) + Auth.js web, RBAC CASL, audit. Wiring dashboard + transaksi ke API nyata.
2. **Transaksi & kategorisasi:** import statement (parser), kategorisasi (mock→Haiku), budget, goals.
3. **Investasi & aset:** `MarketDataPort` + cron BullMQ refresh harga + WebSocket; assets/liabilities/insurance.
4. **Laporan & export:** read-model agregasi (PNL/Balance Sheet/Cashflow/Sankey), export PDF/Excel.
5. **Family finance:** multi-tenant penuh + RLS + undangan member + admin-staf + split-bill share link.
6. **AI & integrasi nyata:** `AiAdvisorPort`→Claude (AI SDK, streaming) untuk advisor + insight;
   zakat/PPh tetap dihitung deterministik di service; OCR (Vision/Textract) & open-banking
   (Brick/Ayoconnect) ganti dari mock; FX kurs BI; notifikasi email/push.

Modul keuangan deterministik (Zakat 2,5%+nisab, PPh21 progresif UU HPP, kalkulator) **diport apa
adanya ke service BE** (bukan ke LLM) — logika sudah ada di halaman FE sebagai referensi.

---

## Verifikasi (saat implementasi)

- `docker compose up` menyalakan api+postgres+redis+minio; `prisma migrate dev` + seed (pakai data
  dari `web/src/lib/data.ts` sbg fixture).
- Swagger di `/api/docs` tampil; kontrak Zod ⇄ OpenAPI sinkron; client typed ter-generate.
- E2E (Jest/supertest): auth (login/refresh/OAuth), RBAC (member tak bisa lihat saldo member lain,
  admin hanya input), CRUD per domain, kalkulator zakat & PPh cocok dgn output FE, job harga jalan.
- FE smoke: login nyata → dashboard tampil data dari API; tambah transaksi tersimpan; dark mode &
  responsif tetap jalan (UI tak berubah).
- Cek kepatuhan: data di region ID, enkripsi kolom sensitif aktif, audit log terisi.
