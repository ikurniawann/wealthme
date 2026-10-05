# WealthMe Agent Instructions

This file is the shared operating entry point for WealthMe. Claude Code and
Codex CLI share the same project contract here; host-specific commands and
hooks are adapted through the portable skills under `.agents/skills/`.

## Load Order

Before changing code or workflow docs, read:

1. `CLAUDE.md` — project operating system, ECC routing, custom agents, gates.
2. `WM_CONVENTIONS.md` — global WealthMe conventions and web convention pointer.
3. `apps/web/AGENTS.md` and `apps/web/WM_CONVENTIONS.md` when touching `apps/web`.
4. `docs/agentic/AGENTIC-WORKFLOW.md` for the tracked Claude Code + Codex
   workflow used by this pilot project.

## Tool Responsibilities

| Tool            | Use for                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Claude Code     | Main development sessions, `/orchestrate`, Claude sub-agents, Ruflo scoping, branch/PR execution                    |
| Codex CLI       | `$orchestrate`, focused implementation/review, verification, workflow hygiene, branch/PR execution                  |
| Ruflo / AgentDB | Parallel exploration and reusable memory; copy durable findings into tracked docs                                 |
| Graphify        | Codebase relationship queries and cached architecture graph when `graphify-out/` exists                           |

## Codex Defaults In This Repo

- Start from `docs/` whenever the task references roadmap, epics, backlog, or
  product work.
- Treat `/orchestrate "<task>"` in Claude Code and `$orchestrate` or `orchestrate:` in Codex CLI as the shared entrypoint for non-trivial work.
- Use `.agents/skills/orchestrate/SKILL.md` as the portable route → execute → verify → escalate protocol; Claude's `.claude/commands/orchestrate.md` remains a host adapter.
- Use a task and acceptance criteria as the unit of work; do not require an
  epic, status field, or epic loop before implementation.
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

## GOAT orchestration and cost discipline

This project uses a shared route → execute → verify → escalate loop across
Claude Code and Codex. The default collaboration mode is deliberately
specialized:

- Claude Code owns substantial implementation, project subagents, Ruflo
  exploration, branch work, and PR preparation.
- Codex owns focused review, verification, workflow hygiene, documentation
  normalization, and small scoped patches.
- Use one primary agent for a sequential task. Spawn parallel agents only for
  independent investigations or reviews whose coordination cost is justified.
- Route simple work to the lightest capable model/effort. Reserve stronger
  reasoning for ambiguity, architecture, security, migrations, and failed
  verification.
- After a failed gate, preserve the evidence, fix the narrow cause, and
  escalate at most twice before reporting a blocker.

### Trim and reuse context

- Search first, then read the smallest relevant file or line range.
- Reuse facts and tool results while files and external state are unchanged.
- Keep a compact checkpoint containing: task, scope, proven facts, rejected
  paths, changed files, failed checks, and next verification.
- Do not repeatedly load generated files, dependencies, full logs, or unrelated
  modules.
- Re-read cached facts after edits, rebases, external writes, or state changes.

### Batch independent work

- Batch independent read-only searches, documentation lookups, and inspections
  when the client supports it.
- Keep dependent, destructive, permission-changing, deployment, and stateful
  operations sequential.
- Batching is an efficiency hint; it never replaces individual verification.

### Cost guardrails

- Stable instructions and project conventions belong in `AGENTS.md` and
  `CLAUDE.md`; volatile task details belong in the current prompt.
- Do not ask multiple agents to rediscover the same context. Pass concise
  evidence capsules between agents.
- Do not use maximum reasoning or a swarm for a trivial task.
- Treat “10× cheaper” as a target for reducing repeated context and wasted
  work, never as a guaranteed provider or API price reduction.

### Usage-aware routing

- Before a long or parallel task, inspect the available 5-hour, weekly, and
  any additional usage buckets when the client exposes them.
- Treat 80% used as a warning threshold and 90% used as a conservation mode.
- In conservation mode, avoid swarms, use the lightest capable model/effort,
  batch read-only work, shorten outputs, and defer non-urgent work until reset.
- Never redeem a usage-reset credit automatically. A human must explicitly
  approve each redemption.
- Report the bucket, percentage used, reset time, and routing decision when
  usage changes the plan.

### Completion contract

Every non-trivial task must finish with the actual files changed, verification
commands and results, remaining risks, and whether escalation occurred. Never
claim success from an unverified draft.

### Memory and compaction

- `MEMORY.md` is durable project memory. Keep it concise and update only verified, reusable facts.
- Before compaction or handoff, write a checkpoint using `docs/agentic/CONTEXT-CHECKPOINT.md`.
- After compaction, reload memory and the active checkpoint first, then read only the files needed for the next verification step.
- Sub-agents return evidence capsules: findings, paths, commands, and uncertainties. Do not pass entire transcripts between agents.

### Check-first task loops

- Use `program.md` and `/task-loop` for repeatable feature or defect work.
- Draft acceptance checks before implementation; approved checks live in
  `checks/approved/` and are read-only during the run.
- Every run is bounded to two repair rounds and records evidence in
  `results.md`.

### Host portability

- Do not invoke Claude-only slash commands, Ruflo routes, or Claude-specific RTK hooks from Codex CLI.
- Use RTK wrappers only when `rtk --help` confirms support for the current host; otherwise run the underlying project command directly.
- Keep hooks and scripts project-relative. Never commit machine-specific paths such as `/Projects/...`, `/home/stealth/...`, or another user's home directory.

### Automatic model routing

Start tasks with `claude-route` when model selection should be automatic. It
uses Sonnet by default and escalates to Opus for auth, security, database,
migration, architecture, production, tenant, payment, or incident work.
