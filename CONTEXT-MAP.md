# Context Map

This repo is **multi-context**. Each context below owns its own vocabulary and
its own `CONTEXT.md`; when a term or a decision genuinely spans two contexts,
it belongs in `packages/contracts/CONTEXT.md` instead — that package is the
boundary the web app and the API both agree on.

| Context            | Path                  | Owns                                                               |
| ------------------ | --------------------- | ------------------------------------------------------------------ |
| Web (frontend)     | `apps/web/`           | Next.js App Router pages, user-facing copy (Indonesian), shell/nav |
| API (backend)      | `apps/api/`           | NestJS controllers/services, Prisma schema, CASL authorization     |
| Contracts (shared) | `packages/contracts/` | Zod schemas/DTOs and enums shared verbatim by web and API          |

## Reading order

1. `CONTEXT-MAP.md` (this file) — which context owns the term you're looking for.
2. The relevant `apps/<app>/CONTEXT.md` — glossary + current-state summary for that context.
3. `docs/adr/` — system-wide architecture decisions (numbered, immutable once accepted).
4. `apps/<app>/docs/adr/` — decisions scoped to a single app, when they exist.

See `docs/agents/domain.md` for the full protocol this map is read under.

## Existing contexts

- [`apps/web/CONTEXT.md`](apps/web/CONTEXT.md) — glossary: Master/Co-Master,
  Anggota, Rekening, Akun Utama, Permintaan Dana, Lot/Lembar, Catat Investasi.

Other contexts (`apps/api`, `packages/contracts`) do not yet have a
`CONTEXT.md` — created lazily by `/domain-modeling` when a term or decision in
that context actually needs recording. Their absence is not a gap to flag.
