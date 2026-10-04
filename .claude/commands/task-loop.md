---
name: task-loop
description: Run one bounded check-first implementation loop for a feature or defect.
---

# /task-loop

Use for one feature or defect when the acceptance criteria can be checked by
commands, tests, or a repeatable browser flow.

1. Read `AGENTS.md`, `CLAUDE.md`, `MEMORY.md`, and `program.md`.
2. Create a task capsule and draft checks in `checks/drafts/`.
3. Stop for review of the checks. Once approved, copy them to
   `checks/approved/`; implementation must not modify approved checks.
4. Use a fresh feature-builder context with only the capsule, memory, approved
   checks, and relevant source files.
5. Run the approved checks, fix only failures, and allow at most two repair
   rounds.
6. Append evidence to `results.md`, run the relevant project gates, and report
   changed files, results, and remaining risks.

This command is deliberately finite. It does not create epics, status loops,
or unattended work.
