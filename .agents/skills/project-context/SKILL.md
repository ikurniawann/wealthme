---
name: project-context
description: WealthMe repository facts to load before a feature loop so sessions reuse verified stack, route, data, and safety context.
---

# WealthMe project context

Keep this page factual and update it only after confirming facts in tracked code. Load the repo instructions first; app changes also require `apps/web/AGENTS.md` and the full `apps/web/WM_CONVENTIONS.md`.

## What it is

WealthMe is a personal finance application with Indonesian-language user-facing content. The web app uses Next.js 16 App Router, React 19, TypeScript 5, Tailwind v4, shadcn with Base UI, and Turborepo/pnpm. The root package pins pnpm 9.15.0 and requires Node >=20. The web app uses Jest, Playwright, TanStack Query, and API contracts from `packages/contracts`.

## Pages and entry points

- Web app pages are under `apps/web/src/app/(app)/<route>/page.tsx`; interactive pages begin with `"use client"`.
- The `(app)` route group supplies the sidebar, topbar, mobile navigation, and outer page padding. Pages render inner content only.
- The API is in `apps/api`; shared DTO/contracts are in `packages/contracts/src`.
- Existing pages include `beranda`, `transaksi`, `rekening`, `dana`, `anggaran`, `investasi`, `aset`, `liabilitas`, `tujuan`, `asuransi`, `tax`, `laporan`, `warisan`, `splitbill`, `rekonsiliasi`, `akun`, and `iam`. Check current directories before adding a route.

## Data

- Web pages obtain application data through the backend API and TanStack Query; do not reintroduce removed mock-data modules or hardcoded finance values.
- Shared API data types/contracts are in `packages/contracts/src`; confirm existing shapes before changing request/response behavior.
- Do not connect checks or prototypes to real accounts, credentials, or production data. Follow `.env.example` and use test-safe fixtures for tests.

## Reusable UI and formatters

- Prefer `@/components/wm`, `@/components/charts`, and `@/lib/format`; confirm their current exports before use.
- The web app's shared shadcn primitives are Base UI. Use `render`, not Radix-only `asChild`, and inspect the local component API.
- Money inputs and values use established helpers in `@/lib/format` such as `formatRupiah`, `parseRupiah`, and `formatAmountInput`; preserve Indonesian locale conventions.

## Where changes go

- Route-specific UI belongs in the relevant page directory and page-local components. Keep changes local unless an explicitly approved shared-foundation change is required.
- API work belongs in `apps/api`; shared API shapes belong in `packages/contracts` when appropriate.
- Tests live with existing Jest conventions (`*.test.ts` / `*.test.tsx`) and project tests run through pnpm workspace scripts; read `package.json` scripts before selecting a gate.
- Design references and prototypes are in `docs/design/`. Imported design skills and their dependencies are indexed in `docs/agentic/ASSET-CATALOG.md`.

## Conventions and don'ts

- Follow `AGENTS.md`, `CLAUDE.md`, root `WM_CONVENTIONS.md`, and relevant app-level rules in load order.
- `apps/web/WM_CONVENTIONS.md` protects shared foundation files including `globals.css`, `lib/*`, `components/ui/*`, `components/wm/*`, `components/charts/*`, `components/shell/*`, and `layout.tsx`; do not edit them unless the task explicitly authorizes a reviewed foundation change.
- Never hardcode secrets, use real `.env` files, deploy production, force-push, or run destructive database commands.
- Do not install dependencies, rewrite approved checks, or commit automatically. Preserve user-owned changes.
