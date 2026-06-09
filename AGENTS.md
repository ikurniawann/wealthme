# Codex Operating Guide

This file is the Codex entrypoint for WealthMe. It intentionally coexists with
`CLAUDE.md` and `.claude/`; do not replace or delete Claude configuration when
updating Codex behavior.

Read `docs/AI_WORKFLOW.md` before making non-trivial changes. It contains the
shared project workflow used by both Claude and Codex.

## Project Stack

Next.js 16 App Router, React 19, TypeScript 5, Tailwind v4, shadcn/Base UI,
Turborepo, and a NestJS API scaffold under `apps/api` when backend work is in
scope.

## Codex-Specific Rules

- Use `AGENTS.md`, `.codex/config.toml`, and `.codex/agents/*.toml` for Codex.
- Leave `CLAUDE.md`, `.claude/settings*.json`, `.claude/hooks`, `.claude/commands`,
  and `.claude/agents` intact for Claude Code.
- Treat `.claude/commands/*` as reference workflows only. In Codex, execute the
  equivalent steps manually or through local scripts.
- Claude-style project agents have Codex role equivalents registered in
  `.codex/config.toml`: `epic-orchestrator`, `code-agent`, `review-qa-agent`,
  `test-agent`, `security-agent`, `deploy-agent`, and `bug-fixer`.
- Treat `.claude/hooks/guardrail.sh` as a security reference. Codex does not run
  Claude hooks automatically, so enforce the same restrictions by instruction.
- Prefer project scripts for validation:
  - `scripts/test.sh`
  - `scripts/qa.sh`
  - `scripts/security-check.sh`
  - `scripts/deploy-dev.sh` for DEV deployment only

## Guardrails

Never force-push, deploy to production, expose secrets, weaken tests to pass,
modify production environment files, or run destructive database commands. Ask
for explicit approval before external write actions such as pushing, opening PRs,
publishing, changing third-party resources, or modifying credentials.

## Repository Boundaries

For WealthMe web pages, follow the existing app conventions:

- Pages live under `apps/web/src/app`.
- Reuse existing components and helpers before adding new abstractions.
- Do not modify forbidden shared surfaces unless the task explicitly requires it:
  `globals.css`, `lib/*`, `components/ui/*`, `components/wm/*`,
  `components/charts/*`, `components/shell/*`, and `layout.tsx`.

## Tooling Preference

Use current docs for library-specific work. Prefer Context7 for framework and
SDK docs, then official docs or repository evidence. Inspect only the files
needed for the task, and use `rg`/`rg --files` for local search.

## Claude Workflow Usage In Codex

Codex does not automatically expose `.claude/commands/*` as slash commands. To
run an equivalent workflow, ask Codex to follow the command file and use the
registered Codex roles. Examples:

```text
Follow .claude/commands/epic-loop.md for docs/epics/EPIC-001-backend-foundation.md.
Use the Codex roles epic-orchestrator, code-agent, review-qa-agent, security-agent,
test-agent, and deploy-agent as appropriate.
```

```text
Follow .claude/commands/task-work.md for EPIC-002 task 3.
Do local validation only; ask before push or PR.
```
