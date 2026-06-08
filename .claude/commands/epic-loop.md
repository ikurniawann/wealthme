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
  (when `.ts/.tsx` changed) + `review-qa-agent` (acceptance criteria + WM conventions + tenant scoping).
  **FAIL** if any reviewer reports a CRITICAL/HIGH finding or returns `VERDICT: FAIL`.
- **Security gate** = `ecc:security-reviewer` + `security-agent` (runs `scripts/security-check.sh`).
  **FAIL** if any CRITICAL/HIGH finding, a `VERDICT: FAIL`, or the script exits non-zero.
- **Test gate** = `test-agent` (`scripts/qa.sh` then `scripts/test.sh`). **FAIL** if a script exits non-zero.

## Algorithm
1. **Read** the epic. Extract Goal, acceptance criteria, and the unchecked tasks (`- [ ]`).
   Build an ordered plan (lowest-risk / dependency-first). Print the plan.
2. **For each task** (sequentially):
   - attempt = 1
   - While attempt <= 3:
     1. **Implement** -> Task(subagent_type: "code-agent") with the task, acceptance criteria,
        relevant paths, and (if retry) the prior findings.
     2. **Review gate** -> run the Review-gate agents above (ECC reviewers only for the file types that
        changed) and aggregate into a single PASS/FAIL.
     3. **Security gate** -> run `ecc:security-reviewer` and `security-agent`; aggregate into PASS/FAIL.
     4. **Test gate** -> Task(subagent_type: "test-agent"); parse `VERDICT:`.
        If it FAILs on a TypeScript/compile/build error, route the fix to
        Task(subagent_type: "ecc:react-build") instead of code-agent, then re-run the gates.
     5. If all gates PASS: mark the task `- [x]` in the epic (Edit), log it, break.
        Else: collect the FAIL findings, attempt += 1, continue (back to code-agent / ecc:react-build).
   - If still failing after attempt 3: record the task as a blocker and stop the loop.
3. **If all tasks passed**:
   - Task(subagent_type: "deploy-agent") -> runs scripts/deploy-dev.sh (DEV only); parse VERDICT.
   - If deploy PASS: set the epic `status:` to `ready-for-qa` (Edit the frontmatter line).
4. **If any task blocked after 3 retries**:
   - Set the epic `status:` to `blocked` (Edit).
   - Append a `## Blocker` section: failing task, attempts made, and review/security/test findings.
5. Print a final summary: tasks completed, retries used, deploy result, final status, blockers.

## Notes
- Keep each code change small and reviewable: one task = one focused change.
- Never weaken or skip tests to make them pass.
- The repo scripts (scripts/test.sh, scripts/qa.sh, scripts/security-check.sh, scripts/deploy-dev.sh)
  are used by the test/security/deploy agents.
- ECC agents (`ecc:react-reviewer`, `ecc:typescript-reviewer`, `ecc:security-reviewer`,
  `ecc:react-build`) are invoked from this main session as part of the gates above — never from inside
  a custom sub-agent (sub-agents cannot spawn sub-agents).
