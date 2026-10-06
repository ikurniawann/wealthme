# WealthMe Agent Instructions

This file is the shared operating contract for Claude Code, Codex CLI, and OMP.
Host adapters may add capabilities, while reusable project routing and
acceptance criteria live in portable skills under `.agents/skills/` and tracked
workflow docs.

## Load Order

Before changing code or workflow docs, read:

1. `CLAUDE.md` — project operating system, ECC routing, custom agents, gates.
2. `WM_CONVENTIONS.md` — global WealthMe conventions and web convention pointer.
3. `apps/web/AGENTS.md` and `apps/web/WM_CONVENTIONS.md` when touching `apps/web`.
4. `docs/agentic/AGENTIC-WORKFLOW.md` for the tracked, host-neutral workflow
   shared by Claude Code, Codex CLI, and OMP.

## Tool Responsibilities

| Tool            | Use for                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Claude Code     | Main development sessions, `/orchestrate`, Claude sub-agents, Ruflo scoping, branch/PR execution                 |
| Codex CLI       | `$orchestrate`, focused implementation/review, verification, workflow hygiene, branch/PR execution               |
| OMP             | `orchestrate: <task>` entrypoint; shared workflow and portable project skills through available tools/resolution |
| Ruflo / AgentDB | Parallel exploration and reusable memory; copy durable findings into tracked docs                                |
| Graphify        | Codebase relationship queries and cached architecture graph when `graphify-out/` exists                          |

## Codex Defaults In This Repo

- Start from `docs/` whenever the task references roadmap, epics, backlog, or
  product work.
- Treat `/orchestrate "<task>"` in Claude Code, `$orchestrate <task>` in
  Codex CLI, and `orchestrate: <task>` in OMP as the shared entrypoint for
  non-trivial work.
- Use `.agents/skills/orchestrate/SKILL.md` as the portable route → execute →
  verify → escalate protocol; Claude's `.claude/commands/orchestrate.md`
  remains a Claude-specific host adapter.
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
Claude Code, Codex CLI, and OMP. The default collaboration mode is deliberately
specialized:

- Claude Code owns substantial implementation, project subagents, Ruflo
  exploration, branch work, and PR preparation.
- Codex owns focused review, verification, workflow hygiene, documentation
  normalization, and small scoped patches.
- OMP uses this same host-neutral contract and its configured tools; use a
  primary session unless independent subagents are actually available.
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

- Do not invoke Claude-only slash commands, Ruflo routes, or Claude-specific
  RTK hooks from Codex CLI or OMP; use equivalents only when supported by that host.
- OMP may use independent agents only through configured subagent tools that
  are actually available in the current session; otherwise continue sequentially.

### Claude Code model routing

Use `claude-route` only in Claude Code when its model-routing policy applies.
OMP follows the model/runtime configured for its session; do not infer the
provider from login status or claim automatic provider-based routing.

### Skills and source workflow templates

- Start non-trivial work through a host-appropriate entrypoint: Claude Code
  `/orchestrate "<task>"`, Codex `$orchestrate <task>`, or OMP
  `orchestrate: <task>`. Read `docs/agentic/ASSET-CATALOG.md` for available
  skills, prerequisites, and host limits.
- Use `.agents/skills/orchestrate/SKILL.md` as the shared route → execute →
  verify → escalate protocol. OMP can load `skill://orchestrate` when that
  resolver is available; otherwise read the portable file directly.
- Claude Code loads project skills from `.claude/skills/` and custom agents
  from `.claude/agents/`; Codex and OMP use portable skills in `.agents/skills/`.
  OMP may resolve `skill://<name>` when supported; otherwise read
  `.agents/skills/<name>/SKILL.md`.
- Claude slash commands and custom subagents are Claude-only. They do not
  become OMP capabilities by being listed in repository files. In OMP, spawn
  independent agents only through actually available configured subagent tools;
  if none are available, keep the work sequential in the primary agent.
- Use `/task-loop` (Claude) or the equivalent `program.md` workflow (Codex/OMP)
  as the WealthMe-default bounded loop. Imported `/build`, `/autoloop`, and
  `/write-checks` skills are supplemental; never use destructive git cleanup
  or commit automatically.
- Source prompt templates live under `docs/agentic/templates/`. They are
  generic examples, not product requirements.
