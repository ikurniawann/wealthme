# EPIC-000: Foundation & Infra

status: ready-for-qa
environment: dev
phase: 0
priority: P0
area: Infra

## Goal

Menyiapkan fondasi monorepo, paket bersama, infrastruktur dev lokal, dan CI agar tim FE & BE
bisa berkembang paralel dengan kontrak tipe tunggal dan pipeline yang konsisten.

## Tasks

### Restructure repo into pnpm monorepo (web → apps/web) ✅

- [x] Relokasi git root ke root repo; pindah `web/` → `apps/web/`
- [x] Tambah `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `.gitignore`, `.nvmrc`
- [x] Buat `packages/contracts` (Zod) + `packages/config` (tsconfig base)
- [x] Placeholder `apps/api`; dokumen ke `docs/`
- [x] Verifikasi `pnpm --filter web build` hijau; commit + push `chore/monorepo`

### Shared packages: @wealthme/contracts + @wealthme/config ✅

- [x] `@wealthme/config`: tsconfig base, eslint base, prettier config bersama
- [x] `@wealthme/contracts`: struktur folder per-domain untuk skema Zod + tipe DTO
- [x] Pipeline build paket (tsup/tsc) + ekspor tipe
- [x] Pastikan `apps/web` & (nanti) `apps/api` meng-import `@wealthme/contracts`

### Local dev stack via Docker Compose ✅

- [x] `docker-compose.yml`: postgres, redis, minio, mailhog (+ healthcheck & volume)
- [x] Script `db:up` / `db:down` / `db:reset` di root package.json
- [x] `.env.example` untuk koneksi layanan lokal

### CI: GitHub Actions (lint + build + test) ✅

- [x] Workflow PR + push `development`/`main`
- [x] Cache pnpm + turbo; jalankan `turbo run lint build test`
- [x] Jadikan status check wajib sebelum merge <!-- workflow + docs/CI.md ready; enabling branch protection is a one-time repo-admin step (see docs/CI.md), not auto-applied -->

### Env management ✅

- [x] `.env.example` per app (web, api)
- [x] Loader config tervalidasi (Zod) + dokumentasi variabel wajib

### Commit hooks: husky + lint-staged + conventional commits ✅

- [x] husky pre-commit → lint-staged (format + lint file staged)
- [x] commitlint (Conventional Commits) pada commit-msg

## Acceptance Criteria

- `pnpm install && pnpm build` hijau dari root (semua workspace).
- `docker compose up` menyalakan postgres/redis/minio/mailhog dan semua healthy.
- CI berjalan otomatis di setiap PR dan wajib hijau sebelum merge.
- `import { ... } from "@wealthme/contracts"` berfungsi di web maupun api.
- Commit dengan format non-konvensional ditolak oleh hook.

## Dependencies

- Tidak ada (epic pembuka).
