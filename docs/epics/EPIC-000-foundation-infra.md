# EPIC-000: Foundation & Infra

status: ready-for-qa
environment: dev
phase: 0
priority: P0
area: Infra
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (Appendix — Developer/Platform stories below)
tasks: ../product/ENGINEERING-TASKS.md (T-001 … T-006)

## Goal

Menyiapkan fondasi monorepo, paket bersama, infrastruktur dev lokal, dan CI agar tim FE & BE
bisa berkembang paralel dengan kontrak tipe tunggal dan pipeline yang konsisten.

## User Stories (Developer / Platform)

- **US-PLAT-1** — As a developer, I want a single monorepo with shared contracts, so that web & api never drift on DTOs.
- **US-PLAT-2** — As a developer, I want one-command local infra (Docker), so that I can run postgres/redis/minio/mailhog instantly.
- **US-PLAT-3** — As a developer, I want CI on every PR (lint+build+test), so that broken code can't merge.
- **US-PLAT-4** — As a developer, I want validated env loading + `.env.example`, so that misconfiguration fails fast at boot.
- **US-PLAT-5** — As a developer, I want commit hooks enforcing format/lint/conventional-commits, so that history stays clean.

## Tasks

### Restructure repo into pnpm monorepo (web → apps/web) ✅

- [x] **T-001** Relokasi git root; pindah `web/` → `apps/web/`; tambah `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `.gitignore`, `.nvmrc`; buat `packages/contracts` (Zod) + `packages/config`; verifikasi `pnpm --filter web build` hijau

### Shared packages: @wealthme/contracts + @wealthme/config ✅

- [x] **T-002** `@wealthme/config` (tsconfig/eslint/prettier base) + `@wealthme/contracts` (skema Zod per-domain, build tsup/tsc, ekspor tipe); web & api meng-import `@wealthme/contracts`

### Local dev stack via Docker Compose ✅

- [x] **T-003** `docker-compose.yml`: postgres, redis, minio, mailhog (+ healthcheck & volume); script `db:up`/`db:down`/`db:reset`; `.env.example`

### CI: GitHub Actions (lint + build + test) ✅

- [x] **T-004** Workflow PR + push `development`/`main`; cache pnpm + turbo; `turbo run lint build test`; status check wajib sebelum merge

### Env management ✅

- [x] **T-005** `.env.example` per app (web, api); loader config tervalidasi (Zod) + dokumentasi variabel wajib

### Commit hooks: husky + lint-staged + conventional commits ✅

- [x] **T-006** husky pre-commit → lint-staged; commitlint (Conventional Commits) pada commit-msg

## Acceptance Criteria

**Epic-level**

- `pnpm install && pnpm build` hijau dari root (semua workspace).
- `docker compose up` menyalakan postgres/redis/minio/mailhog dan semua healthy.
- CI berjalan otomatis di setiap PR dan wajib hijau sebelum merge.
- `import { ... } from "@wealthme/contracts"` berfungsi di web maupun api.
- Commit dengan format non-konvensional ditolak oleh hook.

**Per-task**

- **T-001** — `pnpm --filter web build` hijau setelah relokasi; struktur monorepo sesuai target.
- **T-002** — kedua paket ter-build & tipe ter-ekspor; konsumen tidak error.
- **T-003** — keempat layanan healthy; script db berfungsi.
- **T-004** — pipeline turbo-aware berjalan dengan cache; status check terpasang.
- **T-005** — boot gagal cepat bila env wajib hilang.
- **T-006** — commit non-konvensional ditolak; staged file ter-format/lint.

## Residual / Not-100% (untuk QA)

- **T-004** — mengaktifkan _branch protection_ (status check wajib) adalah langkah admin-repo satu kali; lihat `docs/CI.md`. Verifikasi sudah aktif di `development`/`main`.
- Verifikasi `db:reset` idempotent dan seed konsisten lintas mesin tim.

## Automation Log

- 2026-06-10 /epic-loop EPIC-000 — all 6 tasks PASS (qa ✅ security ✅ test: 50/50 ✅); status → ready-for-qa

## Dependencies

- Tidak ada (epic pembuka).
