# WealthMe Task Loop

This is a bounded verification loop for one feature or defect. It is not an
epic loop and it never runs indefinitely.

## Contract

1. Define one observable task and acceptance criteria.
2. Write checks before implementation in `checks/`.
3. Review and approve the checks. Approved checks are read-only during the run.
4. Start a fresh implementation context with `MEMORY.md` and the task capsule.
5. Implement the smallest change, run the checks, and record the result.
6. Keep a change only when the checks improve or remain green without regressions.
7. Stop after two repair rounds and report the evidence and blocker.

## Safety

- Never edit `checks/approved/` during implementation.
- Never modify production data, secrets, or unrelated modules.
- Human review is required before merging changes.
