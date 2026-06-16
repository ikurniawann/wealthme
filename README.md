# WealthMe — Personal Wealth OS (monorepo)

Monorepo untuk WealthMe: aplikasi manajemen kekayaan personal & keluarga (web + API).

## Struktur

```
apps/
  web/        # Next.js 16 frontend (sudah jadi; lihat apps/web/README.md)
  api/        # NestJS backend (modular monolith — discaffold di Epic 1)
packages/
  contracts/  # Zod schema + tipe DTO bersama (web ⇄ api ⇄ mobile)
  config/     # tsconfig base bersama
docs/         # WealthMe_Backend_Plan.md, WealthMe_Development.md, demo HTML
```

## Prasyarat

- Node.js 20+ (`.nvmrc`)
- pnpm 9 (via corepack: `corepack enable && corepack prepare pnpm@9 --activate`)

## Mulai

```bash
pnpm install
pnpm dev            # jalankan semua app (turbo)
pnpm --filter web dev   # hanya frontend
```

## Build & cek

```bash
pnpm build          # turbo build semua workspace
pnpm lint
```

## Environment variables

Env files are **layered** — each layer handles a different scope:

| File                                                 | Scope       | What it covers                                          |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------- |
| `.env` (from root `.env.example`)                    | Local infra | Docker services: Postgres, Redis, MinIO, MailHog        |
| `apps/web/.env.local` (from `apps/web/.env.example`) | Web app     | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`            |
| `apps/api/.env` (from `apps/api/.env.example`)       | API app     | `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, etc. |

### Quick start

```bash
# 1. Local services (docker-compose)
cp .env.example .env

# 2. Web app (Next.js)
cp apps/web/.env.example apps/web/.env.local

# 3. API app (NestJS — available after Epic 1 scaffold)
cp apps/api/.env.example apps/api/.env
# Then edit apps/api/.env and replace the JWT_SECRET placeholder
```

Required vars per app are listed in each `.env.example` file with `[REQUIRED]`/`[OPTIONAL]` comments.
The web app enforces its required vars via a Zod-validated loader (`apps/web/src/lib/env.ts`) that
fails at build time when a variable is missing.

## Dokumentasi

- Rencana & rekomendasi stack backend: `docs/WealthMe_Backend_Plan.md`
- Roadmap / backlog (GitHub Projects): `docs/BACKLOG.md`
- Workflow Claude Code + Codex + Ruflo: `docs/AGENTIC-WORKFLOW.md`
- Detailed agent loop: `docs/AGENTIC-AGENT-LOOP.md`
- New project setup checklist: `docs/AGENTIC-NEW-PROJECT-SETUP.md`
- Status epic canonical: `docs/epics/README.md`
- Dokumentasi produk & demo asli: `docs/WealthMe_Development.md`, `docs/WealthMe_Demo.html`
