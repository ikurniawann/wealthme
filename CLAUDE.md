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

Priority order:

1. RTK repository index
2. RTK architecture map
3. RTK memory/context
4. ECC agents
5. ECC skills
6. Direct repository inspection

Read only the files necessary to complete the task.
Avoid repository-wide scans unless explicitly required.

Goal: Minimize token usage · Reduce context consumption · Improve execution speed

---

## ECC Components

### Reused ECC Agents (do not duplicate)

| Agent | Purpose |
|-------|---------|
| `planner` | Epic task breakdown and feature planning |
| `react-reviewer` | TSX/React code review (mandatory after edits) |
| `typescript-reviewer` | TypeScript type safety review |
| `code-reviewer` | General code quality review |
| `security-reviewer` | Security audit before commits |
| `tdd-guide` | Test-first development |
| `react-build-resolver` | Broken Next.js/React builds |
| `build-error-resolver` | TypeScript/compile errors |
| `e2e-runner` | Critical user flow testing |
| `refactor-cleaner` | Dead code cleanup |
| `performance-optimizer` | Render and bundle performance |
| `loop-operator` | Loop management and safety |
| `architect` | System design decisions |

### Reused ECC Commands / Skills

| Command | Use for |
|---------|---------|
| `/ecc:plan` | Feature planning (wait for confirm before coding) |
| `/ecc:react-review` | Mandatory post-edit React/TSX review |
| `/ecc:react-test` | TDD with React Testing Library |
| `/ecc:react-build` | Build failure recovery |
| `/ecc:security-scan` | Pre-commit security check |
| `/ecc:orch-add-feature` | End-to-end feature orchestration |
| `/ecc:orch-fix-defect` | Bug fix orchestration |
| `/ecc:loop-start` | Managed loop scaffolding |
| `/ecc:santa-loop` | Dual-review convergence |
| `/ecc:prp-implement` | Implementation with validation loops |
| `shadcn` skill | Base UI component work |
| `frontend-design` skill | UI/layout polish |
| `vercel:nextjs` skill | Next.js 16 App Router specifics |

### Custom Project Agents (created for this repo)

| Agent | File | Purpose |
|-------|------|---------|
| `epic-orchestrator` | `.claude/agents/epic-orchestrator.md` | Reads docs/epics/, drives the task loop |
| `code-agent` | `.claude/agents/code-agent.md` | Implements tasks (WM-conventions-aware) |
| `review-qa-agent` | `.claude/agents/review-qa-agent.md` | Wraps react-reviewer + acceptance criteria check |
| `test-agent` | `.claude/agents/test-agent.md` | Runs scripts/test.sh + scripts/qa.sh |
| `deploy-agent` | `.claude/agents/deploy-agent.md` | DEV-only deploy via scripts/deploy-dev.sh |
| `security-agent` | `.claude/agents/security-agent.md` | Wraps security-reviewer + scripts/security-check.sh |

### Custom Commands

| Command | File | Purpose |
|---------|------|---------|
| `/epic-loop` | `.claude/commands/epic-loop.md` | Entry point for epic automation |

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

1. Create `docs/epics/EPIC-XXX.md` following the format below
2. Set `status: on-progress`
3. Run `/epic-loop docs/epics/EPIC-XXX.md`

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

| Status | Meaning |
|--------|---------|
| `backlog` | Ignored by automation |
| `on-progress` | Will be processed |
| `coding` | Currently implementing |
| `review` | Currently reviewing |
| `testing` | Currently testing |
| `deploying-dev` | Deploying to DEV |
| `ready-for-qa` | All tasks passed — human QA required |
| `blocked` | Failed after max retries — human action required |
| `done` | Completed — ignored by automation |

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

| Script | Purpose |
|--------|---------|
| `scripts/test.sh` | Lint + TypeScript + Build |
| `scripts/qa.sh` | Formatting, bugs, unsafe patterns |
| `scripts/security-check.sh` | Secrets, auth risks, destructive commands |
| `scripts/deploy-dev.sh` | DEV-only deployment (refuses production) |

---

## Task → ECC Routing

| Task | Use |
|------|-----|
| Plan a feature | `/ecc:plan`, `planner` agent |
| Port/build a WealthMe page | `code-agent` + `shadcn` skill |
| Review React/TSX | `/ecc:react-review` (MANDATORY after edits) |
| Fix failing build | `/ecc:react-build` |
| Write tests first | `/ecc:react-test`, `tdd-guide` agent |
| Accessibility | `ecc:accessibility`, `a11y-architect` agent |
| Next.js 16 specifics | `vercel:nextjs`, `vercel:next-cache-components` |
| shadcn / Base UI | `shadcn` skill — use `render={<el/>}`, NOT `asChild` |
| Library/API docs | `docs-lookup` agent (Context7) |
| Performance | `performance-optimizer` agent |
| Dead code cleanup | `/ecc:refactor-clean` |
| Full feature end-to-end | `/ecc:orch-add-feature` |

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
