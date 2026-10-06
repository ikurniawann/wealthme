# Cross-host pilot loop design

## Outcome

Make WealthMe the pilot repository for a bounded, check-first workflow whose
primary control plane is OMP (Oh My P) running in Herdr. Claude Code and Codex
remain optional worker runtimes, but a human should not need to move manually
between harnesses to operate the workflow.

## Invariants

- The portable source of truth stays in tracked project files.
- Each task begins with a compact capsule and draft acceptance checks. A human
  approves the checks before implementation; the approved copy is read-only.
- A task has at most two evidence-based repair rounds. It never force-pushes,
  deploys production, resets the repository, deletes unrelated files, or
  alters approved checks to produce a pass.
- Existing `orchestrate`, `/task-loop`, `checks/`, `program.md`, and
  `results.md` remain available and are not silently replaced.
- The pilot may use Graft's local structural graph, but does not make paid
  model calls or send source context to a provider in ordinary operation.

## Cost-aware routing

Use one primary OMP session by default. Dispatch a worker only for a genuinely
independent, disjoint task that removes meaningful uncertainty.

1. Default to OMP's configured cheap model role and `--thinking low`.
2. Do not select Astra or Fable by default.
3. Elevated routing is allowed only for security, tenant/data isolation,
   migrations, architecture ambiguity, or two failed focused repairs. Start at
   low effort and record the reason and actual resolved model in the evidence.
4. When a configured model is unavailable, choose the lowest-cost capable OMP
   equivalent and record the substitution.
5. No swarm is justified merely because work touches several files.

## OMP + Herdr hub

OMP 18.6.1 and Herdr are installed. OMP exposes model roles (`--smol`,
`--slow`, `--plan`), thinking levels, skills, plugins, hooks/extensions, MCP,
and task subagents. Herdr supports `tab create` and `agent start --kind omp`.

The pilot creates project-local OMP assets under `.omp/`:

- `.omp/config.yml`: project model roles and low-effort defaults. It must not
  copy or expose credentials from `~/.omp/agent/`.
- `.omp/agents/`: focused scout, implementer, reviewer, security, and
  verification roles. Each owns a narrow responsibility and returns a compact
  evidence capsule.
- `.omp/plugins/wealthme-herdr-delegate/`: a plugin that creates a new,
  unfocused Herdr tab for a justified independent task, starts OMP in that tab,
  sends the task capsule, waits for its state, and returns its result.
- `.omp/plugins/wealthme-routing/`: a routing guard that applies the cost policy
  and rejects elevated dispatches with no documented reason.
- `.omp/mcp.json`: only portable MCP servers proven to work under OMP, with
  environment-backed credentials.

Herdr's OMP integration is not installed yet. The implementation must install
it only after an OMP plugin dry-run and configuration inspection prove it will
not overwrite a user customization. That integration is needed for reliable
OMP worker lifecycle detection in created tabs.

### Visible-worker contract

For every approved independent dispatch, the OMP delegate creates one Herdr
tab labelled with the role and task slug, uses the current project directory,
and passes `--no-focus`. It sends only the task capsule, owned paths,
acceptance checks, model/effort route, and required return format.

The delegate must not close or focus a user tab, reuse an ambiguous pane, or
start dependent work in parallel. If Herdr is unavailable, it reports a clear
failure; it does not silently substitute hidden subagents.

## Skills and plugins compatibility

“Support all current skills and plugins” requires a compatibility matrix—not a
blind copy across host runtimes:

| Existing capability                                   | OMP treatment                                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Agent Skills-compatible `SKILL.md` files              | Discovered or imported into the project through OMP's skills support.                    |
| Host-neutral scripts/templates                        | Reused by path from OMP skills or plugins.                                               |
| MCP servers, such as Graft or 21st                    | Registered in `.omp/mcp.json` only when the command and credential contract work in OMP. |
| Claude/Codex-only commands, agents, hooks, or plugins | Replaced only by a tested OMP plugin/adapter; otherwise listed as host-only.             |

The rollout produces `docs/agentic/OMP-COMPATIBILITY.md`, which lists every
discovered current skill/plugin, its OMP route, naming collisions, and explicit
exclusions. No credential-bearing host configuration is imported. OMP must not
claim compatibility for a skill that depends on unavailable Claude/Codex APIs.

## Graft integration

Graft is optional and local-only:

- Initialize only after plan approval, beginning with a dry run and no global
  writes.
- Generate only its non-LLM structural graph; `graft/` stays ignored and is not
  committed.
- Set `DO_NOT_TRACK=1`; do not use `graft build --deep`, configure a provider,
  or enable telemetry without separate approval.
- Use it only before cross-module implementation, an ambiguous impact analysis,
  or review. Known small changes continue with direct reads and `rg`.
- Do not overwrite the existing WealthMe guardrail or UI hooks. A hook conflict
  causes a reported skip, not a forced integration.

## Portable pilot protocol

`docs/agentic/PILOT-LOOP.md` will remain the shared procedure and contain task
capsule, draft/approved checks, result, and handoff templates:

1. Classify the task and choose the least-cost route.
2. Create draft checks in `checks/drafts/` and obtain human approval.
3. Create the immutable copy in `checks/approved/`.
4. Implement one bounded task and run the narrowest relevant checks.
5. Run focused review/security/QA gates and repair only proven failures, at
   most twice.
6. Append evidence to `results.md`; write a checkpoint for long-running work.

The protocol adopts Karpathy Loop's locked-check/evidence intent, but never its
automatic `git reset --hard`, `git clean`, unlimited continuation, or autonomous
commit behavior.

## Artifacts

- `docs/agentic/PILOT-LOOP.md`: canonical procedure.
- `.agents/skills/pilot-loop/SKILL.md`: portable skill entry point.
- `.omp/`: OMP project control-plane configuration, roles, plugins, and MCP.
- `docs/agentic/OMP-COMPATIBILITY.md`: verified skills/plugins matrix.
- Existing Claude/Codex adapters: kept as compatibility paths to the canonical
  procedure, not as the primary workflow.

## Acceptance criteria

1. The pilot can be initiated from OMP and follows the canonical protocol.
2. An independent OMP subagent appears in one unfocused Herdr tab with a compact
   capsule; dependent work stays in the parent tab.
3. The cost policy defaults to low effort and excludes Astra/Fable until an
   evidenced exception is recorded.
4. Draft checks become immutable approved checks; repair rounds stop at two.
5. The OMP compatibility report accounts for every current skill/plugin without
   falsely claiming host-specific features work in OMP.
6. Graft is local, opt-in, no-telemetry, and cannot override existing hooks.

## Verification plan

- Validate Markdown, configuration, skill, and plugin structure.
- Inspect every generated OMP role/plugin for model routing, tab safety, and
  allowed ownership boundaries.
- Run OMP discovery with no external state change, then a dry-run OMP worker
  dispatch before authorizing a real task.
- Validate Herdr's OMP integration and run one read-only visible-worker smoke
  task; confirm the parent tab remains unfocused and intact.
- Review `git diff --check` and the compatibility report before handoff.
