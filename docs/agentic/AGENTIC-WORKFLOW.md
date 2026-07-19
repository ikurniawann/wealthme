# WealthMe Agentic Workflow

This repo uses the user-level workflow at:

`/home/stealth/.agentic-workflows/claude-codex-docs-workflow.md`

Project-specific default:

```text
docs task -> Ruflo/ECC scoping -> Claude Code development -> ECC gates -> Codex workflow tidy -> docs log
```

Detailed loop documentation: [`AGENTIC-AGENT-LOOP.md`](AGENTIC-AGENT-LOOP.md).

New project setup checklist:
[`AGENTIC-NEW-PROJECT-SETUP.md`](AGENTIC-NEW-PROJECT-SETUP.md).

For raw tasks/enhancements in Claude Code, start with:

```text
/agentic-start "<task or enhancement>"
```

## Tool Split

| Tool            | WealthMe role                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Claude Code     | Development sessions, `/task-work`, `/epic-loop`, custom agents, Ruflo scoping, branch/PR execution |
| Codex           | Workflow cleanup, instruction sync, status normalization, doc/runbook updates, focused verification |
| Ruflo / AgentDB | Read-only exploration, swarm evidence maps, reusable memory                                         |
| ECC             | Planning, reviewers, quality gates, security gates, framework-specific skills                       |

## Working From `docs/`

1. Pick one `###` task group from `docs/epics/EPIC-XXX-*.md`.
2. Confirm the epic status:
   - `backlog` means do not automate yet.
   - `on-progress` means automation may run.
   - `ready-for-qa` means implementation is complete and human QA is next.
3. Extract the task's goal, sub-steps, acceptance criteria, affected area, and
   expected test evidence.
4. Scope with repository inspection. Use Ruflo swarm only when multiple areas
   or uncertain dependencies make parallel exploration useful.
5. Implement through Claude Code for substantial code changes.
6. Run review, security, and test gates.
7. Use Codex to tidy docs and workflow artifacts after implementation.
8. Copy durable findings from Ruflo/AgentDB into the epic `Automation Log`.

## Epic Status Vocabulary

Use one vocabulary across all docs:

| Status          | Meaning                                      |
| --------------- | -------------------------------------------- |
| `backlog`       | Planned, ignored by automation               |
| `on-progress`   | Ready for automation/execution               |
| `coding`        | Implementation is actively underway          |
| `review`        | Review gate is running                       |
| `testing`       | Test gate is running                         |
| `deploying-dev` | DEV-only deployment is running               |
| `ready-for-qa`  | Automation passed; human QA is next          |
| `blocked`       | Human decision or external state is required |
| `done`          | Completed and ignored by automation          |

Avoid mixing `planned` / `in-progress` with this repo's canonical
`backlog` / `on-progress` terms.

## Task Template

Use this shape for new or messy docs tasks:

```markdown
### Task Heading

- [ ] Implementation sub-step
- [ ] Test or verification sub-step
- [ ] Documentation or handoff sub-step

#### Evidence

- What proves this is needed?

#### Scope

- In:
- Out:

#### Acceptance Criteria

- Observable user/system outcome

#### Test Plan

- Static:
- Unit/integration:
- E2E/manual:

#### Agent Routing

- Scope:
- Implement:
- Review:
- Verify:

#### Done Signal

- What exact log/check/PR/status closes the task?
```

## When To Use Ruflo

Use Ruflo for:

- broad scoping across `apps/web`, `apps/api`, and `packages/*`
- route/API mismatch audits
- finding duplicated or pre-existing implementations
- building an evidence map before implementation

Do not rely on `.swarm/` or `.claude-flow/` as the durable project record.
Those are runtime artifacts and should stay out of git.

## Codex Hygiene Pass Checklist

Run this after a Claude Code development pass or before handing work back:

- `AGENTS.md`, `CLAUDE.md`, and app-level instructions agree.
- Epic status uses the canonical vocabulary.
- `docs/epics/README.md` reflects current epic status.
- Runtime state (`.swarm/`, `.claude-flow/`, `graphify-out/`) is ignored.
- Durable Ruflo findings are copied into tracked docs.
- `git diff` is reviewed and unrelated user changes are preserved.
