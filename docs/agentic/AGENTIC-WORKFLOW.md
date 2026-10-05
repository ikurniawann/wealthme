# WealthMe Agentic Workflow

This repo uses this tracked workflow as its source of truth. It is designed to
be loaded by both `AGENTS.md` (Codex) and `CLAUDE.md` (Claude Code).

Project-specific default:

```text
task -> context capsule -> smallest route -> Claude/Codex execution -> focused gates -> handoff
```

## GOAT default loop

```text
route -> trim/reuse context -> batch independent reads -> execute -> verify -> escalate only on evidence
```

The loop optimizes for correctness first, then latency and token use. It does
not promise a fixed cost multiplier. Repeated context loading, unnecessary
parallel agents, and avoidable rework are the primary waste sources to remove.

Use the lightest capable route for simple work. Use stronger reasoning for
ambiguous, architectural, security-sensitive, or failed work. Keep durable
instructions here and in the entrypoint files; keep task-specific details in
the current request so the stable prefix remains reusable.

Detailed loop documentation: [`AGENTIC-AGENT-LOOP.md`](AGENTIC-AGENT-LOOP.md).

New project setup checklist:
[`AGENTIC-NEW-PROJECT-SETUP.md`](AGENTIC-NEW-PROJECT-SETUP.md).

For non-trivial tasks, start with the host adapter for the shared orchestrate skill:

```text
Claude Code: /orchestrate "<task or enhancement>"
Codex CLI:  $orchestrate <task or enhancement>
```

## Tool Split

| Tool            | WealthMe role                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Claude Code     | Development sessions, `/orchestrate`, custom agents, Ruflo scoping, branch/PR execution             |
| Codex CLI       | `$orchestrate`, implementation/review, verification, workflow hygiene, branch/PR execution             |
| Ruflo / AgentDB | Read-only exploration, swarm evidence maps, reusable memory                                         |
| ECC             | Planning, reviewers, quality gates, security gates, framework-specific skills                       |

## Task-first work from `docs/`

1. Extract the goal, acceptance criteria, affected area, and expected evidence.
2. Build a compact context capsule before delegating.
3. Use Ruflo, AgentDB, Graphify, or RTK only when they reduce uncertainty or
   repeated work.
4. Implement through the smallest capable host: Claude Code may use custom
   agents/Ruflo, while Codex uses the portable orchestrate skill and a
   sequential primary session when no Codex equivalent exists.
5. Run only the gates required by the blast radius and record the evidence.

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

## Host portability rules

- Keep the route → execute → verify → escalate protocol in
  `.agents/skills/orchestrate/SKILL.md`; host commands are adapters only.
- Convert reusable Claude commands/agents into portable skills; do not require
  Claude-only slash commands, Ruflo, or RTK hooks from Codex.
- Keep hook and script paths relative to the repository; never commit paths
  from a developer's machine.

## Codex Hygiene Pass Checklist

Run this after a Claude Code development pass or before handing work back:

- `AGENTS.md`, `CLAUDE.md`, and app-level instructions agree.
- Epic status uses the canonical vocabulary.
- `docs/epics/README.md` reflects current epic status.
- Runtime state (`.swarm/`, `.claude-flow/`, `graphify-out/`) is ignored.
- Durable Ruflo findings are copied into tracked docs.
- `git diff` is reviewed and unrelated user changes are preserved.
