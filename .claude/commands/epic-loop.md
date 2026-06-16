---
description: Autonomous epic loop — plan, code, review & QA, security, test, deploy DEV, update epic, with bounded retries. DEV-only, never production.
argument-hint: docs/epics/EPIC-XXX.md
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# /epic-loop

Act as the **epic-orchestrator** in this main session (you may use the Task tool to delegate to the
sub-agents). Target epic: **$ARGUMENTS**

If `$ARGUMENTS` is empty, scan `docs/epics/EPIC-*.md` and pick the first with `status: on-progress`.

## Guardrails (hard limits)

- Process the epic ONLY if its frontmatter `status: on-progress`. Otherwise STOP and report.
- Deploy to **DEV only**. NEVER deploy to production. NEVER force-push. NEVER run destructive
  database commands. Do not delete files unless necessary and explained. Do not change CI/CD deploy
  targets without explicit user review. No hardcoded secrets in any change.

## Gate design (who runs in each gate)

The ECC reviewer agents do the generic React/TS/security review; the custom agents cover the
WealthMe-specific slice. Run them **from this main session** (sub-agents cannot spawn sub-agents)
and aggregate their findings into one verdict per gate.

- **Review gate** = `ecc:react-reviewer` (when `.tsx/.jsx` changed) + `ecc:typescript-reviewer`
  (when `.ts/.tsx` changed) + `nestjs-best-practices` skill (when `apps/api` `.ts` files with NestJS patterns changed)
  - `review-qa-agent` (acceptance criteria + WM conventions + tenant scoping).
    **FAIL** if any reviewer reports a CRITICAL/HIGH finding or returns `VERDICT: FAIL`.
- **Security gate** = `ecc:security-reviewer` + `security-agent` (runs `scripts/security-check.sh`).
  **FAIL** if any CRITICAL/HIGH finding, a `VERDICT: FAIL`, or the script exits non-zero.
- **Test gate** = `test-agent` (`scripts/qa.sh` then `scripts/test.sh`). **FAIL** if a script exits non-zero.

## Algorithm

1. **Read** the epic. Extract the epic slug (e.g. `EPIC-001`), Goal, acceptance criteria, and the
   unchecked `### task group` headings under `## Tasks`. Build an ordered plan
   (lowest-risk / dependency-first). Print the plan. If a task group is ambiguous, normalize it with
   `docs/AGENTIC-WORKFLOW.md` before implementation.
2. **For each task group** (sequentially):
   - Derive `<heading-slug>` = lowercased heading, non-alphanumerics → `-`.
   - **Branch**: `git fetch origin` then
     `git switch -c feat/<epic-slug>-task-<n>-<heading-slug> origin/development`
     (if the branch already exists, switch to it).
   - attempt = 1
   - While attempt <= 3:
     1. **Implement** -> Task(subagent_type: "code-agent") with the task group's sub-steps,
        acceptance criteria, relevant paths, and (if retry) the prior findings.
     2. **Review gate** -> run the Review-gate agents (ECC reviewers only for the file types that
        changed) and aggregate into a single PASS/FAIL.
     3. **Security gate** -> run `ecc:security-reviewer` and `security-agent`; aggregate into PASS/FAIL.
     4. **Test gate** -> Task(subagent_type: "test-agent"); parse `VERDICT:`.
        If it FAILs on a TypeScript/compile/build error, route the fix to
        Task(subagent_type: "ecc:react-build") instead of code-agent, then re-run the gates.
     5. If all gates PASS → break.
        Else: collect the FAIL findings, attempt += 1, continue (back to code-agent / ecc:react-build).
   - If still failing after attempt 3: record the task as a blocker (see step 5) and stop the loop.
   - **On success — commit, push, PR**:
     - Mark every sub-step of the group `- [x]` and add ` ✅` to the group heading (Edit).
     - Append one line to a `## Automation Log` section (create it before `## Dependencies` if missing):
       `- <date> /epic-loop <EPIC-ID> #<n> "<heading>" → PASS (attempts: <k>), PR: <url>`.
     - Commit (conventional, e.g. `feat: <heading>`).
     - **Link the GitHub issue** (issue titles equal the task group headings):
       `gh issue list --state all --search "<heading> in:title" --json number,title,state`
       Match the title **exactly, case-insensitively**; prefer the `OPEN` one if several match.
       Capture `<issue>`. If nothing matches, note "no issue matched" and proceed without a closing ref.
     - `git push -u origin <branch>` (non-force).
     - `gh pr create --base development --head <branch> --title "<conventional title>"`.
       Put `Closes #<issue>` on its **own line near the top** of the PR body (GitHub only auto-links
       the card from a closing ref in the body — not from arbitrary prose). The body also lists the
       task, what changed, and the acceptance criteria. Capture the PR URL.
     - **Verify the link**: `gh pr view <pr> --json closingIssuesReferences` should list `<issue>`.
       If empty, patch with `gh pr edit <pr> --body-file <file>` adding `Closes #<issue>`.
3. **After all tasks pass**:
   - Task(subagent_type: "deploy-agent") -> runs scripts/deploy-dev.sh (DEV only); parse VERDICT.
   - If deploy PASS: set the epic `status:` to `ready-for-qa` (Edit the frontmatter line).
4. **If any task blocked after 3 retries**:
   - Set the epic `status:` to `blocked` (Edit).
   - Append a `## Blocker` section: failing task, attempts made, and review/security/test findings.
5. Print a final summary: tasks completed, retries used, PRs created, deploy result, final status, blockers.

## Notes

- Keep each code change small and reviewable: one task = one focused change.
- Never weaken or skip tests to make them pass.
- The repo scripts (scripts/test.sh, scripts/qa.sh, scripts/security-check.sh, scripts/deploy-dev.sh)
  are used by the test/security/deploy agents.
- ECC agents (`ecc:react-reviewer`, `ecc:typescript-reviewer`, `ecc:security-reviewer`,
  `ecc:react-build`) are invoked from this main session as part of the gates above — never from inside
  a custom sub-agent (sub-agents cannot spawn sub-agents).
- Ruflo/AgentDB may be used for read-only exploration before coding; copy durable findings into tracked
  docs. Do not rely on `.swarm/` or `.claude-flow/` as the only record.
- Codex can run a post-development workflow hygiene pass after the epic loop to sync instructions,
  status vocabulary, and runbooks.
