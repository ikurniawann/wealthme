---
name: orchestrate
description: Route non-trivial WealthMe work through a small, verified route-execute-verify-escalate loop. Use when the user says orchestrate or asks for a bounded multi-step implementation, audit, review, or verification task.
---

# Portable orchestrate workflow

Use this host-neutral contract through available Claude Code, Codex CLI, or OMP
entrypoints. Treat the task and acceptance criteria as the unit of work; do not
require an epic or status loop before implementation.

## Protocol

1. Classify the request as answer, investigate, implement, review, or external action. Define the smallest observable done condition.
2. Build a compact context capsule: goal, acceptance criteria, relevant paths, conventions, proven facts, risks, and next verification.
3. Load the repo operating instructions in AGENTS.md, then the referenced CLAUDE.md, conventions, and workflow docs when the task requires them.
4. Inspect with RTK only when the installed RTK version supports the current host and materially reduces output. Otherwise use targeted rg, file reads, Git, GitHub, browser tools, and project scripts. Never invoke a host-specific RTK hook from the wrong host.
5. Route the smallest capable path:
   - one clear file/task: the primary session;
   - independent unknowns: parallel read-only scouts only when coordination
     cost is justified and the current host exposes suitable agent tools;
     otherwise continue in the primary session;
   - UI changes: focused browser verification;
   - auth, tenant, money, security, migration, architecture, production, or deploy: the relevant security/architecture gate from the start.
6. Batch independent read-only work. Keep edits, deployments, permission changes, and dependent checks sequential.
7. Execute the smallest change. Reuse established context and do not make every agent reread the repository.
8. Verify with the narrowest relevant test, QA, build, security check, or browser check. For UI behavior, include the required desktop/mobile live check.
9. If verification fails, preserve the failure capsule, fix the narrow cause, retry once, then escalate at most twice. Stop and report the blocker after the bounded repair budget.
10. Update the relevant tracked evidence (results.md, checkpoint, or review notes) with files, commands, results, risks, and escalation status. Commit and push only after the task's verification is complete and the user requested repository delivery.

## Codex host notes

- Invoke in Codex with `$orchestrate`; Claude Code may continue using
  `/orchestrate`. OMP uses `orchestrate:` as described below.
- Prefer one primary Codex session for sequential work. Use available Codex subagents only for independent investigations or reviews.
- Use project-relative hook and script paths. Never assume another machine's absolute home or project path.
- If a Claude-only command, agent, or Ruflo route has no Codex equivalent, preserve the acceptance criteria and use the smallest sequential Codex path instead; report the substitution.

## OMP host notes

- Invoke with `orchestrate: <task>`. Use the portable project skills through
  OMP's `skill://<name>` resolver when available; otherwise read
  `.agents/skills/<name>/SKILL.md` directly.
- Claude slash commands and `.claude/agents/` definitions are not OMP
  capabilities. Spawn independent agents only through configured subagent tools
  actually available in the session; otherwise work sequentially in the primary
  agent.
- Follow the configured OMP model/runtime. Do not infer provider routing from
  login status or indiscriminately call all available models.

## Output

Return the route chosen, files changed, verification evidence, escalations used, and remaining risks.

## Context checkpoint

For work spanning compaction or handoff, write a concise checkpoint using docs/agentic/CONTEXT-CHECKPOINT.md; reload MEMORY.md and the active checkpoint before continuing.
