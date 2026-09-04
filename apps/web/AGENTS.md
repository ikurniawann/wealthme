<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# WealthMe Web Rules

Before editing `apps/web`, read `apps/web/WM_CONVENTIONS.md`.

Hard defaults:

- App pages live in `src/app/(app)/[page-id]/page.tsx`.
- Interactive pages start with `"use client";`.
- Render inner page content only; the `(app)` route group owns shell, sidebar,
  topbar, mobile navigation, and outer padding.
- Reuse `@/components/wm`, `@/components/charts`, and `@/lib/format` before
  creating page-local replacements.
- Base UI shadcn triggers use `render={<el/>}`, not `asChild`.
