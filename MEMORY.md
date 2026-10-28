# WealthMe Durable Project Memory

This file stores compact, verified facts that survive a new Claude Code or
Codex session. Task-specific detail belongs in the current task or a checkpoint.

## Current baseline

- Primary branch: `development`.
- Local web URL: `http://localhost:3000`.
- Local API health URL: `http://localhost:4000/health`.
- This laptop intentionally runs without Docker. Local web/API use the shared development PostgreSQL and Redis through SSH to `wit-hq`, exposed locally on ports `15432` and `16379`. If login fails with a database connection error, check the SSH forwards before proposing local containers. Resolve the current remote container IPs when recreating forwards; they can change after redeploy.
- Demo login: `demo@wealthme.id` / `demo1234` (local development only).
- Never commit secrets, `.env` files, or production credentials.

## Working rules

- Read `AGENTS.md`, `CLAUDE.md`, and relevant app conventions before editing.
- Use `/orchestrate` for non-trivial work.
- Keep one primary implementer for sequential work; use sub-agents only for
  independent investigation, review, or verification.
- Preserve a checkpoint before compaction or handoff.

## Checkpoint format

Record: goal, acceptance criteria, proven facts, changed files, failed checks,
rejected paths, and the exact next verification command.
