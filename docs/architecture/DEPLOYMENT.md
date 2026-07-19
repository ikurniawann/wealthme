# Deployment Strategy

WealthMe is a monorepo with three deployable concerns. They do **not** share one
pipeline — each goes where it fits best.

| Concern      | What                            | Where it deploys                                | How                                                    |
| ------------ | ------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| **Frontend** | `apps/web` (Next.js 16)         | **Vercel**                                      | Git integration (automatic)                            |
| **Backend**  | `apps/api` (NestJS)             | A container/app host (TBD)                      | CI job → host (`scripts/deploy-dev.sh` for DEV)        |
| **Infra**    | Postgres / Redis / MinIO / Mail | Local: docker-compose · Cloud: managed services | `docker compose` locally; provider dashboards in cloud |

> TL;DR: **the web app does not need a deploy script** — pushing to GitHub already
> triggers Vercel. The repo's `scripts/deploy-dev.sh` + `deploy-agent` are for the
> **backend** (and only ever DEV).

---

## 1. Frontend — `apps/web` via Vercel Git integration

The project is already linked to a Vercel project (`wealthme-web`). With Vercel's
Git integration connected to `github.com/andrsrjld/wealthme-web`, deployments are
**automatic** — no GitHub Action, no script:

| Git event                              | Vercel result                                   | Acts as                 |
| -------------------------------------- | ----------------------------------------------- | ----------------------- |
| Push to **Production Branch** (`main`) | **Production** deployment + production domain   | prod                    |
| Push to `development`                  | Stable **Preview** (alias a staging domain)     | staging / "development" |
| Open PR / push any other branch        | Ephemeral **Preview** URL (commented on the PR) | per-feature dev         |

So "deploy ke development dan production" is just **merge to the right branch** —
Vercel does the rest. This is why a separate web deploy step would be redundant.

### Required Vercel project settings (one-time, in the dashboard)

Because this is a **pnpm monorepo**, set these in **Vercel → Project → Settings**:

- **Root Directory**: `apps/web`
  (Vercel still installs from the repo root so the pnpm workspace + `@wealthme/contracts`
  resolve. With Root Directory set, framework auto-detection finds Next.js.)
- **Production Branch**: `main` (Settings → Git).
- **Install Command**: leave default (Vercel detects pnpm via `packageManager`/`pnpm-lock.yaml`)
  — or pin `pnpm install --frozen-lockfile`.
- **Build Command** / **Output**: leave default (`next build`) — Turborepo `^build`
  ensures `@wealthme/contracts` is built first.
- **Environment Variables**: add the `NEXT_PUBLIC_*` vars from `apps/web/.env.example`
  for **Production** and **Preview** scopes. (`apps/web/src/lib/env.ts` fails the
  build fast if a required one is missing — by design.)

### Optional: skip unaffected builds (monorepo optimization)

To avoid rebuilding the web app when only backend/infra changed, set
**Settings → Git → Ignored Build Step** to:

```bash
npx turbo-ignore web
```

This lets Vercel no-op the build when `apps/web` (and its deps) are untouched.

---

## 2. Backend — `apps/api` (scaffolded in EPIC-001+)

Vercel Git integration covers the **frontend** only. The NestJS API is a long-running,
stateful service and needs a different host. Candidates (decide in EPIC-001):

- **Railway / Render / Fly.io** — simplest container/app hosting + managed Postgres/Redis.
- **A VPS / container host** — `docker compose` on a server, or Kubernetes for scale.
- **Vercel Functions** — only if the API is reshaped into serverless handlers (not the
  default for a NestJS monolith).

**DEV backend deploys** go through `scripts/deploy-dev.sh` (DEV-only by design; it
refuses any production target). Wire the real DEV target into that script's marked
section when the host is chosen. The autonomous `deploy-agent` runs **only** this
script and **never** production.

Production backend deploys are **out of scope for the autonomous loop** — they are a
deliberate, human-run action (separate CI job with environment protection + approvals).

---

## 3. Infra — datastores

- **Local dev**: `pnpm db:up` (docker-compose: Postgres / Redis / MinIO / MailHog).
- **Cloud**: use managed equivalents (e.g. managed Postgres, managed Redis, S3-compatible
  object storage, a transactional email provider). Never point the local docker-compose
  at a cloud/prod database. Connection details come from env vars (see `.env.example`).

---

## CI vs CD — who does what

- **CI** (`.github/workflows/ci.yml`): runs `lint + build + test` on every PR/push.
  It is a **quality gate**, not a deployer — it contains **no deploy steps** (guardrail).
  It complements Vercel; it does not replace it. See [`CI.md`](CI.md).
- **CD frontend**: Vercel Git integration (above).
- **CD backend**: a future, separate workflow/job targeting the chosen host, with
  production gated behind manual approval.

## Summary

```
GitHub push/PR ─┬─► Vercel  (apps/web)         preview = dev/staging, main = prod   [auto]
                └─► CI       (lint/build/test)   required status check before merge   [auto]

apps/api  ─► CI deploy job ─► backend host        DEV via scripts/deploy-dev.sh        [TBD]
infra     ─► docker-compose (local) / managed services (cloud)
```
