---
name: task-loop
description: Run one bounded check-first implementation loop for a feature or defect.
---

# /task-loop

Use for one feature or defect when the acceptance criteria can be checked by
commands, tests, or a repeatable browser flow.

1. Read `AGENTS.md`, `CLAUDE.md`, `WM_CONVENTIONS.md`, `program.md`, and
   `docs/agentic/AGENTIC-WORKFLOW.md`; read app-level instructions for touched areas.
2. Create a task capsule and draft observable checks in `checks/drafts/`.
3. Stop for human review. Once approved, keep them in `checks/approved/`; implementation
   must not modify approved checks.
4. Start a fresh implementation context. Claude Code may use
   `.claude/agents/feature-builder.md` when its feature-loop prerequisites are satisfied;
   Codex follows the same constraints in the primary session because that Claude agent is
   not available to it.
5. Run approved checks, fix only failures, and allow at most two repair rounds.
6. Append evidence to `results.md`, run the relevant project gates, and report
   changed files, results, and remaining risks.

This command is deliberately finite. It does not create epics, status loops,
or unattended work.
