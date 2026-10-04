---
name: orchestrate
description: Route a task through the smallest useful set of agents and tools, with context trimming, batching, verification, and bounded escalation.
---

# /orchestrate

Use this as the default entrypoint for non-trivial WealthMe work. Do not use
the retired epic-loop workflow.

## Protocol

1. Classify the request as answer, investigate, implement, review, or external
   action. Define the smallest observable done condition.
2. Build a context capsule: goal, acceptance criteria, relevant paths,
   conventions, known facts, risks, and next verification.
3. Inspect with RTK when available. Use `rtk --help` and the relevant RTK
   command only when it provides a real reduction in output; otherwise use
   targeted `rg`, file reads, GitHub, Context7, or project tools.
4. Route the smallest capable path:
   - one clear file/task: main session or `code-agent`;
   - independent unknowns: parallel read-only scouts;
   - UI changes: UI specialist plus focused browser verification;
   - auth, tenant, money, security, or deploy: security gate from the start;
   - broad architecture: planner/architect before implementation.
5. Batch independent read-only work. Keep edits, deployments, permission
   changes, and dependent checks sequential.
6. Execute the smallest change. Reuse context already established; do not
   make every agent reread the repository.
7. Verify with the narrowest relevant test, QA, build, security check, or
   browser check. Report actual evidence.
8. If verification fails, pass only the failure capsule to the implementer,
   retry once, then escalate model/effort or specialist coverage. Stop after
   two escalations and report the blocker.

## Cost rules

- Never spawn a swarm for a simple sequential task.
- Never run unrelated reviewers or deployment agents.
- Keep stable project instructions in `AGENTS.md`/`CLAUDE.md` and volatile task
  details in the current request for a reusable prompt prefix.
- Summarize large tool output into evidence capsules before handing it off.
- “10x cheaper” means less repeated context and rework; it is not a guaranteed
  provider price reduction.

## Usage-aware routing

Before long or parallel work, inspect available 5-hour, weekly, and additional
usage buckets. At 80% used, warn; at 90% used, enter conservation mode:
lightest capable model/effort, no unnecessary swarm, compact outputs, and defer
non-urgent work until reset. Never redeem a reset credit without explicit human
approval.

## Output

Return: route chosen, files changed, verification evidence, escalations used,
and remaining risks.

## Context checkpoint

For work that spans compaction or handoff, write a concise checkpoint using `docs/agentic/CONTEXT-CHECKPOINT.md`. Reload `MEMORY.md` and that checkpoint before continuing; do not replay the full conversation or reread unrelated generated files.
