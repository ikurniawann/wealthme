@AGENTS.md
@WM_CONVENTIONS.md

# Project Operating System

## Stack

**Next.js 16 App Router · React 19 · TypeScript 5 · Tailwind v4 · shadcn (Base UI) · Turborepo**

- Pages: `src/app/(app)/[page-id]/page.tsx` — `"use client"` at top; inner content only
- **Never modify**: `globals.css`, `lib/*`, `components/ui/*`, `components/wm/*`, `components/charts/*`, `components/shell/*`, `layout.tsx`
- Reuse primitives: `@/components/wm`, `@/components/charts`, `@/lib/format`, `@/lib/data`

---

## Repository Intelligence

Always use available RTK and ECC capabilities before scanning the repository.

This repo follows the user-level docs workflow at
`/home/stealth/.agentic-workflows/claude-codex-docs-workflow.md`.

Operating split:

- **Claude Code** is the primary development runner: `/task-work`, `/epic-loop`,
  project sub-agents, Ruflo swarm scoping, branch/PR flow, and DEV-only deploy
  loops.
- **Codex** is the workflow hygiene runner: `AGENTS.md`, `CLAUDE.md`, runbooks,
  status normalization, stale automation cleanup, focused verification, and
  small scoped patches.
- **Ruflo / AgentDB** is the exploration and memory layer. Durable decisions
  must be copied into tracked docs, usually an epic `Automation Log` or
  `docs/AGENTIC-WORKFLOW.md`.

If the user drops a raw task/enhancement without naming a command, default to
the `/agentic-start` workflow before coding: classify, find/create an epic,
build an evidence map, route ECC/Ruflo/Graphify, then start development only
when the task is PR-sized.

Priority order:

1. RTK repository index
2. RTK architecture map
3. RTK memory/context
4. Ruflo / AgentDB memory when available
5. ECC agents
6. ECC skills
7. MCP tools (Context7, GitHub, Playwright, Exa, Memory)
8. Direct repository inspection

Read only the files necessary to complete the task.
Avoid repository-wide scans unless explicitly required.

Goal: Minimize token usage · Reduce context consumption · Improve execution speed

---

## MCP Tool Routing

Use MCP tools proactively — they are faster and cheaper than free-form web searches or manual inspection.

| MCP                     | Tool prefix                              | When to use                                                                                                                              |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Context7**            | `mcp__plugin_ecc_context7__*`            | Library/framework docs **before** implementing anything library-specific (NestJS decorators, Next.js APIs, shadcn props, Prisma methods) |
| **GitHub**              | `mcp__plugin_ecc_github__*`              | Issue queries, PR reviews, file contents from GitHub — prefer over `gh` CLI for read queries                                             |
| **Playwright**          | `mcp__plugin_ecc_playwright__*`          | Browser-based QA, screenshot verification, E2E flows in a real browser                                                                   |
| **Exa**                 | `mcp__plugin_ecc_exa__*`                 | Web research when Context7 + GitHub search are insufficient                                                                              |
| **Memory**              | `mcp__plugin_ecc_memory__*`              | Store cross-session patterns, architectural decisions, team conventions                                                                  |
| **Sequential Thinking** | `mcp__plugin_ecc_sequential-thinking__*` | Complex multi-step architectural reasoning; use before writing a plan                                                                    |
| **Next DevTools**       | `mcp__next-devtools__*`                  | Next.js 16 diagnostics, cache inspection, component tracing                                                                              |

**Research priority for implementation tasks:**

1. Context7 docs → 2. GitHub code search → 3. Exa web → 4. Repository inspection

---

## ECC Components

### Reused ECC Agents (do not duplicate)

**Frontend / Universal**

| Agent                   | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `planner`               | Epic task breakdown and feature planning      |
| `architect`             | System design decisions                       |
| `react-reviewer`        | TSX/React code review (mandatory after edits) |
| `typescript-reviewer`   | TypeScript type safety review                 |
| `code-reviewer`         | General code quality review                   |
| `code-simplifier`       | Simplify/clean up recently modified code      |
| `security-reviewer`     | Security audit before commits                 |
| `tdd-guide`             | Test-first development                        |
| `react-build-resolver`  | Broken Next.js/React builds                   |
| `build-error-resolver`  | TypeScript/compile errors                     |
| `e2e-runner`            | Critical user flow testing                    |
| `refactor-cleaner`      | Dead code cleanup                             |
| `performance-optimizer` | Render and bundle performance                 |
| `loop-operator`         | Loop management and safety                    |
| `a11y-architect`        | WCAG 2.2 accessibility audit                  |
| `docs-lookup`           | Library/API docs via Context7                 |

**Backend (NestJS / API)**

| Agent                             | Purpose                                   |
| --------------------------------- | ----------------------------------------- |
| `ecc:nestjs-best-practices` skill | NestJS module/service/controller review   |
| `database-reviewer`               | SQL queries, schema design, Prisma safety |

**Quality & Docs**

| Agent                   | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `silent-failure-hunter` | Swallowed errors, bad fallbacks, missing propagation |
| `pr-test-analyzer`      | Test coverage completeness review for PRs            |
| `doc-updater`           | Update codemaps, README, guides after changes        |
| `comment-analyzer`      | Accuracy and freshness of code comments              |
| `type-design-analyzer`  | Type encapsulation and invariant expression          |

### Reused ECC Commands / Skills

**Planning & Architecture**

| Command           | Use for                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `/ecc:plan`       | Feature planning (wait for confirm before coding)                |
| `/ecc:blueprint`  | Architecture blueprint — concrete files, interfaces, build order |
| `/ecc:api-design` | REST/OpenAPI design before implementation                        |
| `/ecc:prp-plan`   | Plan-Review-Plan cycle for complex tasks                         |
| `/ecc:prp-prd`    | Generate a PRD from a brief                                      |

**Implementation**

| Command                        | Use for                                        |
| ------------------------------ | ---------------------------------------------- |
| `/ecc:prp-implement`           | Implementation with validation loops           |
| `/ecc:orch-add-feature`        | End-to-end feature orchestration               |
| `/ecc:orch-fix-defect`         | Bug fix orchestration                          |
| `/ecc:orch-change-feature`     | Feature modification orchestration             |
| `/ecc:nestjs-patterns`         | NestJS module/service/controller patterns      |
| `/ecc:database-migrations`     | Safe DB migration patterns                     |
| `/ecc:prisma-patterns`         | Prisma ORM query patterns                      |
| `/ecc:postgres-patterns`       | PostgreSQL query/schema patterns               |
| `shadcn` skill                 | Base UI component work                         |
| `frontend-design` skill        | UI/layout polish                               |
| `vercel:nextjs` skill          | Next.js 16 App Router specifics                |
| `vercel:next-cache-components` | Next.js caching strategy                       |
| `vercel:auth` skill            | Authentication patterns (Auth.js / Supabase)   |
| `vercel:vercel-functions`      | Edge/serverless function patterns              |
| `nestjs-best-practices` skill  | NestJS guards, pipes, interceptors, decorators |
| `nestjs-expert` skill          | Deep NestJS architecture (advanced)            |

**Review & Quality**

| Command              | Use for                                     |
| -------------------- | ------------------------------------------- |
| `/ecc:react-review`  | Mandatory post-edit React/TSX review        |
| `/ecc:react-test`    | TDD with React Testing Library              |
| `/ecc:tdd-workflow`  | Full TDD red-green-refactor cycle           |
| `/ecc:code-review`   | General code review (low/medium/high/ultra) |
| `/simplify`          | Simplify recently changed code              |
| `/ecc:quality-gate`  | Pre-merge quality gate                      |
| `/ecc:test-coverage` | Coverage analysis and gap identification    |
| `/ecc:prp-commit`    | Validate before committing                  |
| `/ecc:prp-pr`        | Validate before opening a PR                |

**Build & Deploy**

| Command               | Use for                          |
| --------------------- | -------------------------------- |
| `/ecc:react-build`    | Build failure recovery           |
| `/ecc:loop-start`     | Managed loop scaffolding         |
| `/ecc:santa-loop`     | Dual-review convergence loop     |
| `vercel:deploy` skill | Vercel deployment management     |
| `vercel:env` skill    | Environment variable management  |
| `vercel:status` skill | Deployment status and monitoring |

**Security & Audit**

| Command              | Use for                          |
| -------------------- | -------------------------------- |
| `/ecc:security-scan` | Pre-commit security check        |
| `/security-review`   | Deep OWASP-style security review |

**Docs & Maintenance**

| Command                | Use for                                           |
| ---------------------- | ------------------------------------------------- |
| `/ecc:update-docs`     | Update README and guides after changes            |
| `/ecc:update-codemaps` | Update `docs/CODEMAPS/*` after structural changes |
| `/ecc:refactor-clean`  | Dead code cleanup                                 |
| `/ecc:prune`           | Remove dead/unused code                           |
| `/ecc:checkpoint`      | Save progress checkpoint mid-task                 |

### Custom Project Agents (created for this repo)

| Agent               | File                                  | Purpose                                                                                                                                 |
| ------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `epic-orchestrator` | `.claude/agents/epic-orchestrator.md` | Reads docs/epics/, drives the task loop                                                                                                 |
| `code-agent`        | `.claude/agents/code-agent.md`        | Implements tasks (WM-conventions-aware)                                                                                                 |
| `review-qa-agent`   | `.claude/agents/review-qa-agent.md`   | Project-specific QA: acceptance criteria + WM conventions + tenant scoping (complements `ecc:react-reviewer`/`ecc:typescript-reviewer`) |
| `test-agent`        | `.claude/agents/test-agent.md`        | Runs scripts/test.sh + scripts/qa.sh                                                                                                    |
| `deploy-agent`      | `.claude/agents/deploy-agent.md`      | DEV-only deploy via scripts/deploy-dev.sh                                                                                               |
| `security-agent`    | `.claude/agents/security-agent.md`    | Runs scripts/security-check.sh + tenant-scoping (complements `ecc:security-reviewer`)                                                   |

> **How the gates use ECC.** The orchestrator/commands run from the main session and invoke the ECC
> reviewers directly (sub-agents cannot spawn sub-agents). Generic React/TS/security quality is done by
> `ecc:react-reviewer`, `ecc:typescript-reviewer`, `ecc:security-reviewer`, and build fixes by
> `ecc:react-build`; the custom agents above cover only the project-specific slice. Neither side is
> redundant. (Earlier docs said the custom agents "wrap" the ECC reviewers — they do not; the orchestrator does.)

> **Agent routing rule.** `/agentic-start` should choose the smallest useful route from custom WealthMe
> agents, ECC agents/skills, Ruflo/AgentDB, and Graphify. Use ECC for generic expertise and gates, Ruflo
> for broad discovery/memory, Graphify for architecture/file-relationship queries, and custom agents only
> for WealthMe-specific behavior. Do not call every installed agent just because it exists.

### Custom Commands

| Command          | File                                | Purpose                                                                                     |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `/agentic-start` | `.claude/commands/agentic-start.md` | Drop raw task/enhancement → evidence map → epic/task shaping → optional development start   |
| `/epic-loop`     | `.claude/commands/epic-loop.md`     | Run a full epic end-to-end (all tasks) with ECC-wired gates, DEV deploy                     |
| `/task-work`     | `.claude/commands/task-work.md`     | Work ONE task (`### group`) from an epic → ECC gates → auto branch/push/PR to `development` |
| `/epic-new`      | `.claude/commands/epic-new.md`      | `/ecc:plan` → write a local `docs/epics/EPIC-XXX` file only (push/sync to GitHub manually)  |

---

## Agent Reuse Policy

Before creating a new agent:

1. Check available ECC agents
2. Check available RTK agents
3. Reuse existing agents whenever possible

Only create project-specific agents when no equivalent exists.

---

## Epic Loop

### How to run

```
/epic-loop docs/epics/EPIC-001.md
```

### How to add a new epic

1. Generate it with `/epic-new "<feature>"` (runs `/ecc:plan`, writes `docs/epics/EPIC-XXX-*.md`
   locally only) — or hand-write a file following the format below.
2. Review/edit the file; push & sync to GitHub manually (optionally via `scripts/setup-github-project.sh`).
3. To run it: set `status: on-progress` and `/epic-loop docs/epics/EPIC-XXX.md`,
   or work a single task with `/task-work EPIC-XXX <n>`.

For messy or cross-cutting tasks, normalize the task first using
`docs/AGENTIC-WORKFLOW.md` (`Evidence`, `Scope`, `Acceptance Criteria`,
`Test Plan`, `Agent Routing`, `Done Signal`) before starting implementation.

### Epic file format

```markdown
# EPIC-XXX: Title

status: on-progress
environment: dev
retries: 0

## Goal

Describe the goal.

## Tasks

- [ ] Task 1
- [ ] Task 2

## Acceptance Criteria

- Criteria 1
- Criteria 2

## Automation Log

Append automation results here.
```

### Epic Status Lifecycle

```
backlog → on-progress → coding → review → testing → deploying-dev → ready-for-qa → done
                                                                   ↘ blocked (on failure)
```

| Status          | Meaning                                          |
| --------------- | ------------------------------------------------ |
| `backlog`       | Ignored by automation                            |
| `on-progress`   | Will be processed                                |
| `coding`        | Currently implementing                           |
| `review`        | Currently reviewing                              |
| `testing`       | Currently testing                                |
| `deploying-dev` | Deploying to DEV                                 |
| `ready-for-qa`  | All tasks passed — human QA required             |
| `blocked`       | Failed after max retries — human action required |
| `done`          | Completed — ignored by automation                |

---

## Epic Workflow

Process only epics with `status: on-progress`.

```
Epic → Plan → Code → Review → Security Review → Test → Deploy DEV → Update Epic → Continue Loop
```

---

## Task Loop

For each task:

1. Plan
2. Implement
3. Review
4. Security Review
5. Test

If review fails → return to implementation.
If security fails → return to implementation.
If tests fail → return to implementation.

**Maximum retries: 3**

After 3 failures: `status: blocked`

Record: reason · logs · recommended action

---

## Deployment Rules

**Allowed:** DEV deployment only (`scripts/deploy-dev.sh`)

**Forbidden:**

- Production deployment
- Production infrastructure changes
- Force push
- Secret exposure
- Destructive database operations
- Modifying `.env.production`
- Changing CI/CD deploy targets without review

**Production always requires human approval.**

---

## Security Rules

Never:

- Commit secrets
- Print credentials
- Disable security checks
- Bypass tests
- Modify production environment files
- Run `DROP TABLE`, `TRUNCATE`, or `DELETE` without WHERE
- Run `rm -rf` on important directories

Run security review before deployment.

---

## Scripts

| Script                      | Purpose                                   |
| --------------------------- | ----------------------------------------- |
| `scripts/test.sh`           | Lint + TypeScript + Build                 |
| `scripts/qa.sh`             | Formatting, bugs, unsafe patterns         |
| `scripts/security-check.sh` | Secrets, auth risks, destructive commands |
| `scripts/deploy-dev.sh`     | DEV-only deployment (refuses production)  |

---

## Task → ECC Routing

**Epic & Planning**

| Task                        | Use                                                                     |
| --------------------------- | ----------------------------------------------------------------------- |
| Drop raw task/enhancement   | `/agentic-start "<task>"`                                               |
| Plan a feature              | `/ecc:plan`, `planner` agent                                            |
| Design architecture         | `/ecc:blueprint`, `architect` agent, `/ecc:api-design`                  |
| Generate a new epic (local) | `/epic-new "<feature>"` (writes `docs/epics/`, push manually)           |
| Work ONE epic task → PR     | `/task-work EPIC-XXX <n>` (ECC gates → branch/push/PR to `development`) |
| Run a whole epic            | `/epic-loop docs/epics/EPIC-XXX.md` (set `status: on-progress` first)   |

**Frontend (Next.js / React)**

| Task                       | Use                                                    |
| -------------------------- | ------------------------------------------------------ |
| Port/build a WealthMe page | `code-agent` + `shadcn` skill                          |
| Review React/TSX           | `/ecc:react-review` (MANDATORY after edits)            |
| Fix failing build          | `/ecc:react-build`                                     |
| Write tests first          | `/ecc:react-test`, `tdd-guide` agent                   |
| Accessibility              | `/ecc:accessibility`, `a11y-architect` agent           |
| Next.js 16 specifics       | `vercel:nextjs`, `vercel:next-cache-components`        |
| shadcn / Base UI           | `shadcn` skill — use `render={<el/>}`, NOT `asChild`   |
| Performance                | `performance-optimizer` agent                          |
| Auth (frontend)            | `vercel:auth` skill                                    |
| Caching strategy           | `vercel:next-cache-components`, `vercel:runtime-cache` |

**Backend (NestJS / API — `apps/api`)**

| Task                               | Use                                               |
| ---------------------------------- | ------------------------------------------------- |
| NestJS module/service/controller   | `nestjs-expert` skill + `/ecc:nestjs-patterns`    |
| NestJS guards, pipes, interceptors | `nestjs-best-practices` skill                     |
| REST API design                    | `/ecc:api-design` (before implementing)           |
| OpenAPI/Swagger annotations        | `nestjs-expert` skill + `ecc:docs-lookup`         |
| Backend auth/JWT                   | `nestjs-best-practices` + `ecc:security-reviewer` |
| NestJS build errors                | `ecc:build-error-resolver`                        |

**Database**

| Task                   | Use                                                    |
| ---------------------- | ------------------------------------------------------ |
| Database migration     | `/ecc:database-migrations` + `database-reviewer` agent |
| Prisma schema/query    | `/ecc:prisma-patterns` + `database-reviewer` agent     |
| PostgreSQL query/index | `/ecc:postgres-patterns` + `database-reviewer` agent   |
| Schema design review   | `database-reviewer` agent                              |

**Quality & Testing**

| Task                        | Use                                            |
| --------------------------- | ---------------------------------------------- |
| Test-driven development     | `/ecc:tdd-workflow`, `tdd-guide` agent         |
| Check test coverage gaps    | `/ecc:test-coverage`, `pr-test-analyzer` agent |
| Find swallowed errors       | `silent-failure-hunter` agent                  |
| Type design review          | `type-design-analyzer` agent                   |
| Comment quality             | `comment-analyzer` agent                       |
| Pre-merge quality gate      | `/ecc:quality-gate`                            |
| Simplify code after feature | `/simplify` or `code-simplifier` agent         |
| Dead code cleanup           | `/ecc:refactor-clean`, `/ecc:prune`            |

**Security**

| Task                | Use                                           |
| ------------------- | --------------------------------------------- |
| Pre-commit security | `/ecc:security-scan`                          |
| Deep OWASP review   | `/security-review`, `security-reviewer` agent |

**Research & Docs**

| Task                 | Use                                     |
| -------------------- | --------------------------------------- |
| Library/API docs     | `docs-lookup` agent (Context7 MCP)      |
| Web research         | `deep-research` skill or Exa MCP        |
| Complex reasoning    | Sequential Thinking MCP                 |
| Update README/guides | `/ecc:update-docs`, `doc-updater` agent |
| Update codemaps      | `/ecc:update-codemaps`                  |

**Deploy & Infra**

| Task                    | Use                                                        |
| ----------------------- | ---------------------------------------------------------- |
| DEV deployment          | `deploy-agent` (via `/epic-loop`) or `vercel:deploy` skill |
| Deployment status       | `vercel:status` skill                                      |
| Environment variables   | `vercel:env` skill                                         |
| Full feature end-to-end | `/ecc:orch-add-feature`                                    |

---

## Token Optimization

Always:

- Use RTK repository knowledge first
- Use ECC agents first
- Read only required files
- Avoid unnecessary scans
- Reuse previous context when available

Goal: Maximum efficiency with minimum token consumption.

---

## What Remains Manual

- Production deployment (always requires human trigger)
- Epic creation and prioritization
- QA sign-off on `ready-for-qa` epics
- Security audit for CRITICAL findings
- Infrastructure and database schema changes

---

## Agent skills

Configuration the Matt Pocock engineering skills read. Edit these files directly;
re-running the setup skill is only needed to switch trackers or start over.

### Issue tracker

Work is tracked as epic files under `docs/epics/`, **not** GitHub Issues —
issues #1–79 are historical and closed. The unit of work is one `### task group`
inside an epic. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Domain docs

Multi-context: `CONTEXT-MAP.md` at the root points at one `CONTEXT.md` per
context (`apps/web`, `apps/api`, `packages/contracts`), with system-wide ADRs in
`docs/adr/` and app-scoped ADRs alongside each context. Files are created lazily
by `/domain-modeling` — their absence is not a problem to flag. See
[`docs/agents/domain.md`](docs/agents/domain.md).

> No triage labels are configured: the `triage` skill is not installed in this
> project. Add `docs/agents/triage-labels.md` if that changes.
