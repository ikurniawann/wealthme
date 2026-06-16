---
description: Drop a raw task/enhancement, turn it into an epic/task group, scope with ECC/Ruflo/Graphify, and start the correct development workflow when ready.
argument-hint: '"task or enhancement brief"'
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# /agentic-start

Start the WealthMe agentic loop from a raw task/enhancement.

Input: **$ARGUMENTS**

Use:

- user workflow: `/home/stealth/.agentic-workflows/claude-codex-docs-workflow.md`
- project workflow: `docs/AGENTIC-WORKFLOW.md`
- detailed loop: `docs/AGENTIC-AGENT-LOOP.md`
- project rules: `CLAUDE.md`, `AGENTS.md`, `WM_CONVENTIONS.md`

## Hard Guardrails

- No production deploy.
- No force push.
- No destructive database command.
- No hardcoded secrets or real `.env` files.
- Do not mutate GitHub/project boards unless the user explicitly asks.
- Runtime memory is not the source of truth; copy durable decisions into docs.

## Algorithm

1. **Agent inventory**
   Build the available-agent map before routing:
   - Project custom agents from `.claude/agents/`:
     `code-agent`, `review-qa-agent`, `security-agent`, `test-agent`,
     `deploy-agent`, `epic-orchestrator`.
   - ECC agents/skills from `CLAUDE.md`: planner, architect, React/TS reviewers,
     security reviewer, build resolver, database reviewer, docs lookup, TDD,
     framework skills.
   - Ruflo/AgentDB capabilities if available: memory search/store, swarm init,
     agent spawn, task orchestration.
   - Graphify if `graphify-out/graph.json` exists or the task asks about
     architecture/file relationships.

   Do not call every agent. Select the smallest useful route for the task.

2. **Intake**
   - Classify the request: bug, enhancement, refactor, security, infra, docs, UI, backend, or cross-cutting.
   - If the request points to initial brief docs (for example `docs/*PROJECT*.md`, `docs/*DATABASE*.md`,
     `docs/*Development*.md`, `docs/*Backend_Plan*.md`) or asks to initialize a product from documents,
     run **Product synthesis** before epic shaping.
   - Classify area: `apps/web`, `apps/api`, `packages/contracts`, database, infra, docs, or mixed.
   - Classify risk: low, medium, high. High means auth, tenant scoping, money movement, DB migration,
     production config, security, or broad cross-module behavior.
   - Classify uncertainty: known change, needs discovery, or unknown/possibly already implemented.
   - Search `docs/epics/`, `docs/product/`, `docs/BACKLOG.md`, and `scripts/backlog.json` for matching work.
   - If `graphify-out/graph.json` exists and the task is architectural or relationship-heavy, use Graphify query before reading broad file sets.
   - If AgentDB/Ruflo memory is available, search prior decisions for the relevant domain/epic.

3. **Product synthesis (only for initial project briefs)**
   When input is a product/project brief or a set of brief docs, generate or refresh these durable artifacts
   before creating implementation epics:
   - `docs/product/PRD.md` — product goal, personas, scope, non-goals, features, success metrics.
   - `docs/product/USER-STORIES.md` — user stories grouped by persona/domain with acceptance criteria.
   - `docs/product/ENGINEERING-TASKS.md` — PR-sized engineering breakdown with dependencies, area, risk, and test notes.

   Routing for this phase:
   - Use ECC `product-capability` to turn product intent into implementation constraints.
   - Use ECC planner/architect for capability sequencing.
   - Use Ruflo/AgentDB if multiple brief docs need parallel evidence extraction or prior decisions exist.
   - Use Graphify only if a graph already exists or the brief references existing code architecture.

   Do not invent product truth. Mark unresolved product decisions as `Open Questions`.

4. **Dynamic agent route**
   Choose one route package:

   | Task shape                          | Route                                                                                                                    |
   | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
   | Simple one-file docs/workflow       | main session + Codex hygiene later; no Ruflo swarm                                                                       |
   | Simple web page/component           | `code-agent` + Context7/Next docs if API-specific + `ecc:react-reviewer` + `ecc:typescript-reviewer` + `review-qa-agent` |
   | API/NestJS endpoint                 | `code-agent` + `nestjs-best-practices` + `ecc:typescript-reviewer` + `security-agent`                                    |
   | Prisma/schema/query                 | `database-migrations`/`prisma-patterns`/`postgres-patterns` + `database-reviewer` + `security-agent`                     |
   | Auth, tenant, role, money/security  | ECC security reviewer + project `security-agent` from the start; add Ruflo exploration if cross-cutting                  |
   | Build failure                       | `ecc:react-build` or build resolver first, then rerun gates                                                              |
   | Unknown or broad cross-area task    | Ruflo hierarchical swarm for read-only scoping + ECC planner/architect before implementation                             |
   | Possible duplicate/existing feature | Graphify query + Ruflo scout before creating files                                                                       |

   Record the selected route in the epic task's `Agent Routing` section.

5. **Evidence map**
   Build a short evidence map:
   - source request
   - matching docs/epic if any
   - existing implementation if any
   - likely files
   - risks
   - test targets
   - selected route and agents

6. **Scope with ECC/Ruflo only when useful**
   - Use ECC planner/architect for task breakdown or architecture.
   - Use Context7/docs-lookup for current framework/library APIs.
   - Use Ruflo swarm for broad multi-area exploration.
   - Do not spawn swarms for simple one-file tasks.
   - Store useful Ruflo/AgentDB findings, then copy durable conclusions into docs.

7. **Epic/task shaping**
   - If a matching epic exists, append or normalize one `###` task group.
   - If no epic exists, create the next `docs/epics/EPIC-XXX-<slug>.md`.
   - For initial project briefs, derive epics from `docs/product/PRD.md`,
     `docs/product/USER-STORIES.md`, and `docs/product/ENGINEERING-TASKS.md`.
   - New epics start as `status: backlog` unless the user explicitly asked to start development now.
   - Task groups must include or imply Evidence, Scope, Acceptance Criteria, Test Plan, Agent Routing, and Done Signal.

8. **Start development when ready**
   If the task is PR-sized and the user asked to start:
   - set the epic to `status: on-progress`
   - execute the `/task-work` algorithm for the selected task group in this same session
   - run review, security, and test gates
   - update `Automation Log`

   If the task is not ready:
   - stop after writing/normalizing the epic
   - report what is missing before development can begin

9. **Handoff**
   - Recommend Claude Code `/task-work EPIC-XXX <n>` for development.
   - Recommend Codex `workflow-hygiene` after development if docs/instructions changed.

## Output

Print:

- intake classification
- selected or created epic path
- product docs generated or reused
- task group number/title
- selected route: custom agents, ECC agents/skills, Ruflo/AgentDB, Graphify, direct repo inspection
- whether development started
- next command to run
