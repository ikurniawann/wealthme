<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# WealthMe Web

This app inherits the root Codex guidance from `../../AGENTS.md` and the shared
workflow in `../../docs/AI_WORKFLOW.md`.

## Local Rules

- Keep page work inside `src/app` unless the task explicitly requires shared
  component or library changes.
- Preserve existing WealthMe component conventions.
- Do not modify `globals.css`, `lib/*`, `components/ui/*`, `components/wm/*`,
  `components/charts/*`, `components/shell/*`, or `layout.tsx` unless the task
  explicitly calls for it.
- For Next.js 16 APIs, read the installed docs in `node_modules/next/dist/docs/`
  or current official documentation before changing framework-specific code.
