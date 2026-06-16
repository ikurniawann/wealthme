# WealthMe Agent Instructions

This file is the Codex-facing entry point for the WealthMe repo. Claude Code
still uses `CLAUDE.md` and project slash commands; Codex uses this file to keep
the same operating model without pretending Claude-only commands exist here.

## Load Order

Before changing code or workflow docs, read:

1. `CLAUDE.md` — project operating system, ECC routing, custom agents, gates.
2. `WM_CONVENTIONS.md` — global WealthMe conventions and web convention pointer.
3. `apps/web/AGENTS.md` and `apps/web/WM_CONVENTIONS.md` when touching `apps/web`.
4. `/home/stealth/.agentic-workflows/claude-codex-docs-workflow.md` for the
   user-level Claude Code + Codex docs workflow.

## Tool Responsibilities

| Tool            | Use for                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Claude Code     | Main development sessions, `/task-work`, `/epic-loop`, sub-agents, Ruflo swarm scoping, branch/PR execution       |
| Codex           | Workflow hygiene, docs/runbook cleanup, status normalization, focused reviews, verification, small scoped patches |
| Ruflo / AgentDB | Parallel exploration and reusable memory; copy durable findings into tracked docs                                 |
| Graphify        | Codebase relationship queries and cached architecture graph when `graphify-out/` exists                           |

## Codex Defaults In This Repo

- Start from `docs/` whenever the task references roadmap, epics, backlog, or
  product work.
- Treat `/agentic-start "<task>"` as the Claude Code entrypoint for raw
  task/enhancement drops. In Codex, translate it into concrete docs hygiene,
  epic shaping, or review steps.
- Prefer one `###` epic task group as the unit of work.
- Translate Claude-only commands into concrete actions instead of claiming to
  run them. For example, `/task-work EPIC-009 1` means: locate the epic task,
  inspect scope, implement minimally, run gates, update docs, and summarize.
- Keep workflow changes small and auditable. Do not rewrite `CLAUDE.md` or
  generated ECC/Ruflo content wholesale unless the user asks for a migration.
- Preserve project guardrails: no production deploy, no force push, no
  destructive database commands, no hardcoded secrets, no real `.env` files.

## Verification

For code changes, use the project gates that match the blast radius:

- `bash scripts/qa.sh`
- `bash scripts/test.sh`
- `bash scripts/security-check.sh`
- focused Playwright/E2E specs when UI behavior changes

For workflow-only changes, verify JSON/TOML/Markdown structure where possible
and inspect `git diff` before reporting completion.
