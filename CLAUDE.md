# WealthMe - Autonomous Epic Workflow (Claude Code)

Monorepo: `apps/web` (Next.js 16), `apps/api` (NestJS - scaffolded by epics), `packages/contracts`
(shared Zod/DTO), `packages/config`. See `docs/WealthMe_Backend_Plan.md` and `docs/epics/`.

This repo is set up for **controlled, epic-based autonomous development** with sub-agents + a loop:

```
Epic -> Plan -> Code -> Review & QA -> Security -> Test -> Deploy DEV -> Update Epic -> Continue
```

## How to run

```text
/epic-loop docs/epics/EPIC-001-backend-foundation.md
```

- Run it from the main Claude Code session. `$ARGUMENTS` = the epic file path.
- With no argument, it auto-selects the first epic in `docs/epics/` whose `status: on-progress`.
- The command lives at `.claude/commands/epic-loop.md` (also registered as the `epic-loop` skill).

What it does (full algorithm in the command file):
1. Reads the epic; only proceeds if `status: on-progress`.
2. Splits it into the unchecked `- [ ]` tasks and orders them (dependency / low-risk first).
3. For each task, runs the gates with **max 3 retries**:
   `code-agent` -> `review-qa-agent` -> `security-agent` -> `test-agent`.
   Any FAIL feeds findings back to `code-agent`.
4. On all-pass, marks the task `- [x]` in the epic.
5. When every task passes -> `deploy-agent` runs `scripts/deploy-dev.sh` (**DEV only**) -> sets epic
   `status: ready-for-qa`.
6. If a task is still failing after 3 retries -> sets `status: blocked` and appends a `## Blocker`
   section with the reason and findings.

## Agents (`.claude/agents/`)

| Agent | Role |
|---|---|
| `epic-orchestrator` | Drives the loop: read epic -> tasks -> coordinate agents -> retries -> status. |
| `code-agent` | Implements ONE small task, convention-following, no secrets, no scope creep. |
| `review-qa-agent` | Reviews the diff for correctness/quality. Returns `VERDICT: PASS/FAIL`. |
| `security-agent` | Secrets, vulnerabilities, unsafe code, authn/authz, config risks. `VERDICT: PASS/FAIL`. |
| `test-agent` | Runs `scripts/qa.sh` + `scripts/test.sh`. `VERDICT: PASS/FAIL`. |
| `deploy-agent` | Runs `scripts/deploy-dev.sh` (DEV only). Refuses production. |

> Note: orchestration runs in the **main session** (via `/epic-loop`) because Claude Code sub-agents
> cannot spawn other sub-agents. The main session delegates to the agents above via the Task tool.

## Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `scripts/qa.sh` | Lint / static checks (`turbo run lint`). |
| `scripts/test.sh` | Install, build (type-check), run tests. |
| `scripts/security-check.sh` | Secret scan, committed-env check, destructive-SQL scan, dependency audit. |
| `scripts/deploy-dev.sh` | Build + deploy to **DEV only**; refuses production targets. |

Run any of them directly, e.g. `bash scripts/qa.sh`.

## Epic format

Files live in `docs/epics/EPIC-00X-*.md`. Status lifecycle:
`planned -> on-progress -> ready-for-qa` (or `blocked`). The loop only touches `on-progress`.

```markdown
# EPIC-001: Authentication

status: on-progress
environment: dev

## Goal
Implement login, logout, and refresh token.

## Tasks
- [ ] Create login endpoint
- [ ] Create logout endpoint
- [ ] Add refresh token
- [ ] Add validation
- [ ] Add tests

## Acceptance Criteria
- Valid user can login
- Invalid login returns 401
- Refresh token works
- Logout invalidates token
- All tests pass
```

## Safety rules (guardrails)

Enforced by `.claude/settings.json` (permission deny-list) + `.claude/hooks/guardrail.sh`
(PreToolUse on Bash) + agent/command instructions:

- **No hardcoded secrets** - use env vars / `.env.example`; the security-agent blocks leaks.
- **No destructive database commands** - drops, truncations, and forced migration resets are blocked.
- **No production deployment** - only `scripts/deploy-dev.sh` (DEV); production-target deploys are blocked.
- **No force pushes** - forced git pushes are blocked.
- **No deleting files** unless necessary and explained.
- **No changing CI/CD deploy targets** (`.github/workflows/` deploy steps) without review.

A genuinely-needed, human-reviewed exception can bypass the Bash guardrail hook by prefixing the
command with `WEALTHME_OVERRIDE=1` (use sparingly, only when you understand the risk).
