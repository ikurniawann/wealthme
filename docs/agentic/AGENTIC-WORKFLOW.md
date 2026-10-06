# WealthMe Agentic Workflow

This is the host-neutral source of truth for the WealthMe workflow. `AGENTS.md`
and `CLAUDE.md` point Claude Code, Codex CLI, and OMP to this shared contract.

Project-specific default:

```text
task -> context capsule -> smallest route -> Claude/Codex/OMP execution -> focused gates -> handoff
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

Loop details: [GOAT default loop](#goat-default-loop), [task-first work](#task-first-work-from-docs),
and [host portability rules](#host-portability-rules).

For reusable prompts, see the [phase-based project process](templates/phase-based-project-process.md)
and [agent-assisted development prompt](templates/agent-assisted-development-prompt.md).
Adapt them to the current repository and task.

For non-trivial tasks, start with the host adapter for the shared orchestrate skill:

```text
Claude Code: /orchestrate "<task or enhancement>"
Codex CLI:  $orchestrate <task or enhancement>
OMP:        orchestrate: <task or enhancement>
```

## Tool Split

| Tool            | WealthMe role                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Claude Code     | Development sessions, `/orchestrate`, custom agents, Ruflo scoping, branch/PR execution                 |
| Codex CLI       | `$orchestrate`, implementation/review, verification, workflow hygiene, branch/PR execution              |
| OMP             | `orchestrate: <task>`, portable skills/docs, and only the tools configured and available in its session |
| Ruflo / AgentDB | Read-only exploration, swarm evidence maps, reusable memory                                             |
| ECC             | Planning, reviewers, quality gates, security gates, framework-specific skills                           |

## Task-first work from `docs/`

1. Extract the goal, acceptance criteria, affected area, and expected evidence.
2. Build a compact context capsule before delegating.
3. Use Ruflo, AgentDB, Graphify, or RTK only when they reduce uncertainty or
   repeated work.
4. Implement through the smallest capable host: Claude Code may use custom
   agents/Ruflo; Codex uses the portable orchestrate skill and a sequential
   primary session when no Codex equivalent exists; OMP uses this same
   host-neutral workflow through its available tools.
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
  Claude-only slash commands, Ruflo, or RTK hooks from Codex or OMP.
- OMP may spawn independent agents only through configured subagent tools that
  are actually available in the session. Otherwise the primary agent works
  sequentially; do not imply Claude commands or agents are automatically loaded.
- Keep hook and script paths relative to the repository; never commit paths
  from a developer's machine.

## Discovering and starting imported skills

For the exact source inventory, paths, prerequisites, and host limitations, see
[`ASSET-CATALOG.md`](ASSET-CATALOG.md). Use the smallest applicable skill, not
every installed skill:

- **Claude Code:** start non-trivial work with `/orchestrate "<task>"`. Skills
  are under `.claude/skills/`; call supported skill commands such as
  `/design-orchestrator`, `/headstart`, `/extract-design-system`,
  `/functional-ui`, `/shadcn`, or `/build` by name. Claude custom agents
  (including `.claude/agents/feature-builder.md`) and slash commands are
  available only on Claude Code.
- **Codex CLI:** start with `$orchestrate <task>`. Skills are under
  `.agents/skills/`; ask for the named skill, e.g. “Use `design-orchestrator`
  for this UI request” or “Use `headstart` to compare architecture options.”
  For Claude-only `build`, `autoloop`, or `feature-builder` flows, use the
  portable skill instructions in one Codex session; don't invoke Claude syntax
  or claim Claude-agent delegation. Codex may use included references/scripts
  when prerequisites are met.
- **OMP:** start with `orchestrate: <task>`. Use the portable
  `.agents/skills/orchestrate/SKILL.md`; resolve it through `skill://orchestrate`
  when supported, otherwise read that file. Resolve specialist skills through
  `skill://<name>` when available, or read
  `.agents/skills/<name>/SKILL.md` (for example, `functional-ui` or `headstart`).
  Claude slash commands and `.claude/agents/` definitions do not become OMP
  capabilities automatically. Use configured subagent tools only when present;
  otherwise stay sequential in the primary agent. Follow the configured OMP
  model/runtime: do not infer routing from the logged-in provider or invoke
  every available model.
  Sample prompts:
  ```text
  orchestrate: Use functional-ui to build this screen; inspect the existing
  shell and design spec first, then verify the responsive states.
  orchestrate: Use headstart to compare architecture options for <feature>.
  Retrieve sources only if the configured research tools are available, and
  report limitations.
  ```
- **Design routing:** use `design-orchestrator` to select one lead from the
  skills actually installed here. Its four references include names of 26
  external sibling skills absent from this source; the WealthMe adapter in its
  `SKILL.md` is the actionable route map.
- **Project strategy:** invoke `/headstart` in Claude or ask Codex/OMP to use
  `headstart`. Its arXiv deep dive is opt-in/gated and requires actual HTTP
  retrieval plus isolated agent reads; if those capabilities are unavailable,
  skip that layer and report the limitation.
- **WealthMe loop:** `/task-loop` in Claude (or the steps in `program.md` in
  Codex/OMP) remains the default bounded feature/defect process. The imported
  Karpathy kit is optional. Acceptance checks live in `checks/drafts/` and
  `checks/approved/`. Never let a loop run destructive reset/clean commands or
  commit without explicit authorization.
- **Graft:** the Graft skill is optional and only applies if the executable
  and a generated graph are already available. Check `command -v graft`;
  otherwise use normal project search/read. Its standalone app is not included.
- **Prompt templates:** generic phase and task prompt templates are in
  [`templates/`](templates/). Replace placeholders with user requirements and
  repository facts; don't inherit sample-project requirements.

## Codex Hygiene Pass Checklist

Run this after a Claude Code development pass or before handing work back:

- `AGENTS.md`, `CLAUDE.md`, and app-level instructions agree.
- Epic status uses the canonical vocabulary.
- `docs/epics/README.md` reflects current epic status.
- Runtime state (`.swarm/`, `.claude-flow/`, `graphify-out/`) is ignored.
- Durable Ruflo findings are copied into tracked docs.
- `git diff` is reviewed and unrelated user changes are preserved.
