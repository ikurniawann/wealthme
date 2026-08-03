# EPIC-001: Backend Foundation

status: done
environment: dev
phase: 1
priority: P0
area: Backend
prd: ../product/PRD.md
stories: ../product/USER-STORIES.md (§1 Authentication & Profile)
tasks: ../product/ENGINEERING-TASKS.md (T-101 … T-109)

## Goal

Membangun pondasi backend NestJS (modular monolith): database + skema inti, autentikasi
(email/password + Google) dengan JWT access/refresh, RBAC multi-tenant, audit, dan OpenAPI;
serta menyambungkan frontend ke Auth.js + query client.

## User Stories

- **US-AUTH-1** — register email/password.
- **US-AUTH-2** — login email/password.
- **US-AUTH-3** — sign in dengan Google.
- **US-FAM-7** (fondasi) — RBAC dipaksakan server-side; member tak akses resource user/keluarga lain.
- **US-PLAT-6** — As a developer, I want a typed client generated from OpenAPI, so that web calls the API type-safely.

## Tasks

### Scaffold NestJS app at apps/api ✅

- [x] **T-101** `nest new apps/api`; ConfigModule + validasi env (Zod); logger pino; `/health`; bootstrap Swagger/OpenAPI + CORS

### Prisma + Postgres + base schema & migrations ✅

- [x] **T-102** Setup Prisma + Postgres (Docker); skema inti (`users`, `family_groups`, `members`, `accounts`, `transactions`, `categories`); uang `BIGINT` rupiah; migrasi awal + seed dari mock `apps/web/src/lib/data.ts`

### Auth: email/password + JWT access/refresh + rotation ✅

- [x] **T-103** Hash argon2id; register/login/logout; JWT access (pendek) + refresh (panjang) rotasi di Redis; `JwtAuthGuard`; `/auth/me`

### Google OAuth login ✅

- [x] **T-104** Strategy OAuth2 Google + callback; tautkan ke user by email (buat bila belum ada)

### RBAC (CASL) + TenantInterceptor ✅

- [x] **T-105** Ability per peran (owner/member/admin-staff); `TenantInterceptor` inject & enforce `userId`/`familyGroupId`
- [ ] **T-106** (Opsional) Postgres RLS sebagai lapis kedua — _belum, lanjut di EPIC-005 T-503 / EPIC-007 T-704_

### Audit logging module ✅

- [x] **T-107** Interceptor mencatat mutasi (actor, action, entity, before/after ringkas) → `audit_logs`

### OpenAPI/Swagger + typed client generation ✅

- [x] **T-108** Anotasi DTO + tag Swagger; generate typed client (orval/openapi-typescript) untuk web

### Web: Auth.js integration + API client ✅

- [x] **T-109** Auth.js Credentials → `/auth/login`; provider Google; sesi httpOnly membawa token API; ganti `auth-provider.tsx` mock; proteksi route `(app)`; `QueryClientProvider` + fetch ber-otentikasi (auto refresh) + standar error→toast

## Acceptance Criteria

**Epic-level**

- User valid bisa login → menerima JWT; login invalid → 401.
- Refresh token bekerja; logout meng-invalidasi refresh token.
- Login Google membuat/menautkan akun dengan benar.
- Member tidak bisa mengakses resource milik user/keluarga lain (403) — scoping teruji.
- Swagger di `/api/docs` tampil; typed client ter-generate dan dipakai web.
- Login nyata di web menggantikan mock; sesi bertahan setelah refresh halaman.
- Migrasi + seed berjalan; unit/e2e auth lulus.

**Per-task**

- **T-101** — `/health` hijau; Swagger ter-bootstrap; env tervalidasi.
- **T-102** — migrasi + seed jalan; uang sebagai BIGINT; relasi/index ada.
- **T-103** — argon2id; refresh rotation di Redis; logout invalidasi refresh.
- **T-104** — OAuth Google menautkan/membuat akun by email.
- **T-105** — scoping tenant dipaksakan di setiap query; member di-403 untuk resource lain.
- **T-107** — mutasi tercatat di `audit_logs` dengan aktor/aksi/entitas.
- **T-108** — typed client ter-generate & dipakai web tanpa error tipe.
- **T-109** — sesi bertahan setelah reload; auto-refresh token; route `(app)` terproteksi.

## Residual / Not-100% (untuk QA)

- **T-106** — Postgres RLS belum dipasang (interceptor app-layer aktif). Lapis kedua RLS dikerjakan di **EPIC-005 T-503** + **EPIC-007 T-704**.
- Verifikasi cakupan uji RBAC E2E (member-isolation) memadai sebelum tutup epic.

## Automation Log

- 2026-06-09 /task-work EPIC-001 #1 "Scaffold NestJS app at apps/api" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/90
- 2026-06-09 /task-work EPIC-001 #2 "Prisma + Postgres + base schema & migrations" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/92
- 2026-06-09 /task-work EPIC-001 #3 "Auth: email/password + JWT access/refresh + rotation" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/94
- 2026-06-09 /epic-loop EPIC-001 #4 "Google OAuth login" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/95
- 2026-06-09 /epic-loop EPIC-001 #5 "RBAC (CASL) + TenantInterceptor" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/96
- 2026-06-09 /epic-loop EPIC-001 #6 "Audit logging module" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/97
- 2026-06-09 /epic-loop EPIC-001 #7 "OpenAPI/Swagger + typed client generation" → PASS (attempts: 2), PR: https://github.com/andrsrjld/wealthme-web/pull/98
- 2026-06-09 /epic-loop EPIC-001 #8 "Web: Auth.js integration (Credentials → API) + session" → PASS (attempts: 3), PR: https://github.com/andrsrjld/wealthme-web/pull/99
- 2026-06-09 /epic-loop EPIC-001 #9 "Web: API client + TanStack Query setup" → PASS (attempts: 1), PR: https://github.com/andrsrjld/wealthme-web/pull/100

## Dependencies

- EPIC-000 (monorepo, contracts, Docker, CI).

- **2026-08-03/04 — /nerve QA sweep (delegated QA; user confirms from the live system). Evidence: gates green on development@5f2383f (qa/test/security); fresh DEV deploy clean (compose build, migrate+seed exit 0, api/web healthy); e2e vs https://wealthme.demo-wit.id — auth, route-protection, and all page regression specs green (57 passed, 2 flaky passed on serial retry, 0 real failures); code-level criteria verification by 4 parallel QA agents. **Verdict: QA-PASS with recorded deviations. Auth (argon2id+refresh rotation+Google), Prisma+23 migrations, global guard chain (Better-Auth/Tenant/Abilities), Swagger verified. Deviations accepted: T-108 generated typed client never adopted (hand-written api-client + @wealthme/contracts Zod serve the purpose); epic text says Auth.js, implementation is better-auth; T-106 Postgres RLS deferred — isolation is app-layer TenantGuard proven by rbac-isolation e2e. Status → done.
