# EPIC-001: Backend Foundation (Phase 1)

status: on-progress
environment: dev
retries: 0

## Goal

Scaffold the NestJS API, wire authentication and authorization, set up the database,
and connect the Next.js frontend to real sessions. This phase unlocks all subsequent
API integrations — nothing in Phase 2+ can start until this is complete.

GitHub Milestone: Phase 1 (issues #7–#15)

## Tasks

### Backend
- [ ] #7 Scaffold NestJS app at apps/api (pino logger, /health, ConfigModule, Swagger bootstrap)
- [ ] #8 Prisma + Postgres base schema + migrations (users, family_groups, members, accounts, transactions, categories — money as BIGINT rupiah) + seed from mock data
- [ ] #9 Auth: email/password (argon2) + JWT access/refresh + rotation (Redis) — Passport strategies; login/refresh/logout/register
- [ ] #10 Google OAuth login — OAuth2 strategy; link to existing user by email
- [ ] #11 RBAC (CASL) + TenantInterceptor (userId/familyGroupId scoping) — abilities per role owner/member/admin-staff; enforce tenant scope on every query
- [ ] #12 Audit logging module — record who-did-what (esp. admin/staff inputs) for compliance
- [ ] #13 OpenAPI/Swagger + typed client generation pipeline — auto-gen typed client from OpenAPI spec; consume in web

### Frontend
- [ ] #14 Web: Auth.js integration (Credentials → API) + session — replace mock auth-provider; httpOnly session carrying API JWT; Google button
- [ ] #15 Web: API client + TanStack Query setup — QueryClient/Provider; typed fetch wrapper; error/toast handling

## Acceptance Criteria

- `GET /health` returns 200 on running NestJS instance
- User can register and login with email/password → receives JWT
- User can login with Google OAuth
- JWT refresh rotation works; revoked tokens are rejected
- All API routes enforce tenant scoping (no cross-user data leakage)
- Audit log records create/update/delete events with userId and timestamp
- OpenAPI spec auto-generates typed client consumed by apps/web
- Login page (`/login`) authenticates against real API (not mock localStorage)
- TanStack Query provider wraps the app; all API calls use typed hooks
- `npm run build` passes for both apps/web and apps/api
- No hardcoded secrets; all credentials from environment variables

## Automation Log

<!-- Automation appends results here after each run -->
