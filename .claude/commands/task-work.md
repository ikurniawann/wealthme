---
description: Work ONE task from an epic (a single `### task group`) through the ECC-wired gates, then auto branch → push → PR to development. DEV-only, never production.
argument-hint: EPIC-XXX [task-number]
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# /task-work

Implement **one task** from an epic in this main session (you may use the Task tool to delegate).
Arguments: **$ARGUMENTS** → `<EPIC-ID> [task-number]` (e.g. `EPIC-002 3`).

A "task" is one `### <heading>` group under `## Tasks` (it usually maps 1:1 to a GitHub issue whose
title equals the heading). Each group contains several `- [ ]` sub-steps that you complete together.
If `task-number` is omitted, pick the **first group that still has unchecked `- [ ]` sub-steps**.

## Guardrails (hard limits)

- DEV only. NEVER deploy to production. NEVER force-push. NEVER run destructive DB commands.
  No hardcoded secrets. Do not change CI/CD deploy targets. Do not delete files unless the task requires it.
- Do not touch the forbidden paths (`globals.css`, `lib/*`, `components/ui|wm|charts|shell/*`, `layout.tsx`).

## Gate design (who runs in each gate)

Run ECC + custom agents **from this main session** (sub-agents cannot spawn sub-agents) and aggregate
findings into one verdict per gate.

- **Review gate** = `ecc:react-reviewer` (when `.tsx/.jsx` changed) + `ecc:typescript-reviewer`
  (when `.ts/.tsx` changed) + `nestjs-best-practices` skill (when `apps/api` `.ts` files with NestJS patterns changed)
  - `review-qa-agent` (acceptance criteria + WM conventions + tenant scoping).
    **FAIL** on any CRITICAL/HIGH finding or `VERDICT: FAIL`.
- **Security gate** = `ecc:security-reviewer` + `security-agent` (runs `scripts/security-check.sh`).
  **FAIL** on any CRITICAL/HIGH finding, `VERDICT: FAIL`, or non-zero script exit.
- **Test gate** = `test-agent` (`scripts/qa.sh` then `scripts/test.sh`). **FAIL** on non-zero exit.

## Algorithm

1. **Locate the epic** `docs/epics/$EPIC-ID-*.md`. STOP if `status` is `done` or `backlog`.
   Select the target `### task group` per the rule above. If every sub-step is already `- [x]`, STOP
   and report "task already complete" (idempotent — do not re-run).
2. **Extract context**: the epic Goal, the group's sub-steps, and the `## Acceptance Criteria` relevant
   to this task. If the task is ambiguous or cross-cutting, normalize it with `docs/AGENTIC-WORKFLOW.md`
   first (`Evidence`, `Scope`, `Acceptance Criteria`, `Test Plan`, `Agent Routing`, `Done Signal`).
3. **Branch**: `git fetch origin` then `git switch -c feat/<epic-slug>-task-<n>-<heading-slug> origin/development`
   (slug = lowercased heading, non-alphanumerics → `-`). If the branch already exists, switch to it.
4. **Bounded loop (attempt 1..3)**:
   a. `Task(subagent_type: "code-agent")` with the task, its sub-steps, acceptance criteria, relevant
   paths, and (if retry) the prior findings.
   b. **Review gate** → run the Review-gate agents (ECC reviewers only for the file types that changed),
   aggregate to PASS/FAIL.
   c. **Security gate** → run `ecc:security-reviewer` + `security-agent`, aggregate to PASS/FAIL.
   d. **Test gate** → `Task(subagent_type: "test-agent")`. If it FAILs on a TypeScript/compile/build
   error, route the fix to `Task(subagent_type: "ecc:react-build")`, then re-run the gates.
   e. If all gates PASS → break. Else collect findings, `attempt += 1`, continue (back to code-agent /
   ecc:react-build). After attempt 3 still failing → go to step 7 (blocked).
5. **On success — commit, push, PR**:
   - Mark every sub-step of the group `- [x]` (Edit) and add ` ✅` to the group heading (repo convention).
   - Append one line to a `## Automation Log` section (create it before `## Dependencies` if missing):
     `- <date> /task-work <EPIC-ID> #<n> "<heading>" → PASS (attempts: <k>), PR: <url>`.
   - Commit (conventional, e.g. `feat: <heading>`).
   - **Link the GitHub issue** (issue titles equal the task headings — see `scripts/backlog.json` for the
     roadmap, but it does NOT store issue numbers, so resolve the number from GitHub by title):
     `gh issue list --state all --search "<heading> in:title" --json number,title,state` (runs against the
     current repo — `andrsrjld/wealthme-web`). Match the title **exactly, case-insensitively**; if several
     match, prefer the `OPEN` one. Capture `<issue>`. If nothing matches, note "no issue matched" in the
     summary and proceed without a closing ref.
   - `git push -u origin <branch>` (non-force).
   - `gh pr create --base development --head <branch> --title "<conventional title>"`. Put `Closes #<issue>`
     on its **own line near the top of the PR body** (GitHub only auto-links a card to the PR from a closing
     ref in the PR body/commits — not from arbitrary prose). The body also lists the task, what changed, and
     the acceptance criteria. Capture the PR URL.
   - **Verify the link**: `gh pr view <pr> --json closingIssuesReferences` should list `<issue>`. If it is
     empty (e.g. the ref was missed), patch it with `gh pr edit <pr> --body-file <file>` adding `Closes #<issue>`.
6. Print a summary: task, attempts, each gate verdict, branch, PR URL.
7. **On block after 3 attempts**: do NOT push. Append a `## Automation Log` line marking the task
   `→ BLOCKED` with the failing gate + findings. Leave the epic `status` unchanged (single task).
   Report the blocker and stop.

## Notes

- One task = one focused, reviewable change. Never weaken or skip tests to make them pass.
- The orchestrator (you) flips checkboxes and runs git/PR — `code-agent` never commits or pushes.
- For broad discovery, use Ruflo/AgentDB as a read-only scoping layer, then copy durable findings into
  the epic `Automation Log`; `.swarm/` and `.claude-flow/` are runtime state, not project docs.
- After development, Codex may be used as a hygiene pass for instruction sync, stale status cleanup,
  and runbook updates.
