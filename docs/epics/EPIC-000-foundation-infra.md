# EPIC-000: Foundation & Infra

status: in-progress
environment: dev
phase: 0
priority: P0
area: Infra

## Goal
Menyiapkan fondasi monorepo, paket bersama, infrastruktur dev lokal, dan CI agar tim FE & BE
bisa berkembang paralel dengan kontrak tipe tunggal dan pipeline yang konsisten.

## Tasks

### Restructure repo into pnpm monorepo (web → apps/web)  ✅
- [x] Relokasi git root ke root repo; pindah `web/` → `apps/web/`
- [x] Tambah `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `.gitignore`, `.nvmrc`
- [x] Buat `packages/contracts` (Zod) + `packages/config` (tsconfig base)
- [x] Placeholder `apps/api`; dokumen ke `docs/`
- [x] Verifikasi `pnpm --filter web build` hijau; commit + push `chore/monorepo`

### Shared packages: @wealthme/contracts + @wealthme/config
- [ ] `@wealthme/config`: tsconfig base, eslint base, prettier config bersama
- [ ] `@wealthme/contracts`: struktur folder per-domain untuk skema Zod + tipe DTO
- [ ] Pipeline build paket (tsup/tsc) + ekspor tipe
- [ ] Pastikan `apps/web` & (nanti) `apps/api` meng-import `@wealthme/contracts`

### Local dev stack via Docker Compose
- [ ] `docker-compose.yml`: postgres, redis, minio, mailhog (+ healthcheck & volume)
- [ ] Script `db:up` / `db:down` / `db:reset` di root package.json
- [ ] `.env.example` untuk koneksi layanan lokal

### CI: GitHub Actions (lint + build + test)
- [ ] Workflow PR + push `development`/`main`
- [ ] Cache pnpm + turbo; jalankan `turbo run lint build test`
- [ ] Jadikan status check wajib sebelum merge

### Env management
- [ ] `.env.example` per app (web, api)
- [ ] Loader config tervalidasi (Zod) + dokumentasi variabel wajib

### Commit hooks: husky + lint-staged + conventional commits
- [ ] husky pre-commit → lint-staged (format + lint file staged)
- [ ] commitlint (Conventional Commits) pada commit-msg

## Acceptance Criteria
- `pnpm install && pnpm build` hijau dari root (semua workspace).
- `docker compose up` menyalakan postgres/redis/minio/mailhog dan semua healthy.
- CI berjalan otomatis di setiap PR dan wajib hijau sebelum merge.
- `import { ... } from "@wealthme/contracts"` berfungsi di web maupun api.
- Commit dengan format non-konvensional ditolak oleh hook.

## Dependencies
- Tidak ada (epic pembuka).
