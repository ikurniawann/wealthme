# EPIC-001: Backend Foundation

status: on-progress
environment: dev
phase: 1
priority: P0
area: Backend

## Goal

Membangun pondasi backend NestJS (modular monolith): database + skema inti, autentikasi
(email/password + Google) dengan JWT access/refresh, RBAC multi-tenant, audit, dan OpenAPI;
serta menyambungkan frontend ke Auth.js + query client.

## Tasks

### Scaffold NestJS app at apps/api ✅

- [x] `nest new apps/api` (selaras pnpm workspace)
- [x] ConfigModule + validasi env (Zod), logger pino, endpoint `/health`
- [x] Bootstrap Swagger/OpenAPI + CORS untuk web

### Prisma + Postgres + base schema & migrations ✅

- [x] Setup Prisma + koneksi Postgres (Docker)
- [x] Skema inti: `users`, `family_groups`, `members`, `accounts`, `transactions`, `categories`
- [x] Uang sebagai `BIGINT` rupiah; relasi + index
- [x] Migrasi awal + seed dari mock `apps/web/src/lib/data.ts`

### Auth: email/password + JWT access/refresh + rotation ✅

- [x] Hash password argon2id; endpoint register/login/logout
- [x] JWT access (pendek) + refresh (panjang); rotasi refresh di Redis
- [x] Guard `JwtAuthGuard`; `/auth/me`

### Google OAuth login ✅

- [x] Strategy OAuth2 Google + callback
- [x] Tautkan ke user berdasarkan email; buat bila belum ada

### RBAC (CASL) + TenantInterceptor ✅

- [x] Definisi ability per peran: owner / member / admin-staff
- [x] `TenantInterceptor` inject & enforce `userId` / `familyGroupId` di setiap query
- [ ] (Opsional) Postgres RLS sebagai lapis kedua

### Audit logging module ✅

- [x] Interceptor mencatat mutasi (actor, action, entity, before/after ringkas) → `audit_logs`

### OpenAPI/Swagger + typed client generation

- [ ] Anotasi DTO + tag Swagger lengkap
- [ ] Generate typed client (orval / openapi-typescript) untuk dipakai web

### Web: Auth.js integration (Credentials → API) + session

- [ ] Auth.js Credentials provider memanggil `/auth/login` API
- [ ] Provider Google; sesi httpOnly membawa token API + refresh
- [ ] Ganti `auth-provider.tsx` mock; proteksi route grup `(app)`

### Web: API client + TanStack Query setup

- [ ] `QueryClientProvider` + wrapper fetch ber-otentikasi (auto refresh)
- [ ] Standar error → toast; util query/mutation keys

## Acceptance Criteria

- User valid bisa login → menerima JWT; login invalid → 401.
- Refresh token bekerja; logout meng-invalidasi refresh token.
- Login Google membuat/menautkan akun dengan benar.
- Member tidak bisa mengakses resource milik user/keluarga lain (403) — scoping teruji.
- Swagger di `/api/docs` tampil; typed client ter-generate dan dipakai web.
- Login nyata di web menggantikan mock; sesi bertahan setelah refresh halaman.
- Migrasi + seed berjalan; unit/e2e auth lulus.

## Automation Log

- 2026-06-09 /task-work EPIC-001 #1 "Scaffold NestJS app at apps/api" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/90
- 2026-06-09 /task-work EPIC-001 #2 "Prisma + Postgres + base schema & migrations" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/92
- 2026-06-09 /task-work EPIC-001 #3 "Auth: email/password + JWT access/refresh + rotation" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/94
- 2026-06-09 /epic-loop EPIC-001 #4 "Google OAuth login" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/95
- 2026-06-09 /epic-loop EPIC-001 #5 "RBAC (CASL) + TenantInterceptor" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/96
- 2026-06-09 /epic-loop EPIC-001 #6 "Audit logging module" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/97

## Dependencies

- EPIC-000 (monorepo, contracts, Docker, CI).
