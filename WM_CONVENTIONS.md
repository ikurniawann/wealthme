# WealthMe Conventions

This root file exists so both `CLAUDE.md` and `AGENTS.md` have a stable
project-level convention entry point.

## Global Guardrails

- Never hardcode secrets. Use environment variables and `.env.example`.
- Never deploy production from autonomous loops. DEV-only automation uses
  `scripts/deploy-dev.sh`.
- Never force-push or run destructive database commands from an agent loop.
- Keep changes scoped to the task. Avoid unrelated refactors.
- Shared/foundation web files are protected unless the task explicitly requires
  a reviewed foundation change:
  - `apps/web/src/app/globals.css`
  - `apps/web/src/lib/*`
  - `apps/web/src/components/ui/*`
  - `apps/web/src/components/wm/*`
  - `apps/web/src/components/charts/*`
  - `apps/web/src/components/shell/*`
  - `apps/web/src/app/layout.tsx`

## Web Conventions

When touching `apps/web`, read the full web convention file:

`apps/web/WM_CONVENTIONS.md`

Key reminders:

- Next.js 16 App Router pages live under
  `apps/web/src/app/(app)/[page-id]/page.tsx`.
- Interactive app pages start with `"use client";`.
- Page files render inner content only; the route group provides shell, padding,
  sidebar, topbar, and mobile navigation.
- Reuse `@/components/wm`, `@/components/charts`, and `@/lib/format` before
  creating local replacements.
