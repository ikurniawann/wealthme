# WealthMe — Definition of Done

> The single, cross-project bar every task clears before it counts as **done**.
> It _wraps_ the per-story/-task Acceptance Criteria (`product/ACCEPTANCE-CRITERIA.md`):
> acceptance criteria say _what_ must be true; this checklist adds the _process_
> proof — gates, tests, security, docs, deploy. The test/QA gates and the
> epic orchestrator reference this file, so "done" means the same thing
> whether a human or an agent declares it.
>
> Path: declared in `.agentic/config.yml` → `docs.definition_of_done`.

---

## The checklist

A task is **done** only when every box is checked:

- [ ] **Merged** — change is on `development` via a reviewed PR (never force-pushed, never direct to the primary/production branch).
- [ ] **Acceptance Criteria pass** — every criterion for the story/task (`product/ACCEPTANCE-CRITERIA.md` form) is demonstrably true: an automated test asserts it, a gate passes on it, or a reviewer verified it against the running app. No "works well"-style unverifiable claims. Reviewer verification is **interim evidence only**: before the epic advances past `ready-for-qa`, every epic-level criterion must be asserted by an automated test that runs in the test gate (`scripts/test.sh`) — a feature is only as protected as the tripwire it leaves behind.
- [ ] **Gates green** — `scripts/qa.sh`, `scripts/test.sh`, and `scripts/security-check.sh` all PASS on the change. A red gate blocks done.
- [ ] **Tests added/updated** — new or changed behavior is covered by unit / integration / E2E tests as appropriate; coverage does not regress.
- [ ] **Security reviewed** — no secrets committed, no new injection/authz/SSRF surface; tenant scoping honored (`userId` + `familyGroupId`); protected paths untouched (or change explicitly reviewed).
- [ ] **Docs updated** — the owning epic's **Automation Log** records the outcome, and any affected doc (PRD / stories / tasks / codemaps / README) is updated. Memory is a cache; the Automation Log is the durable record.
- [ ] **Deployed to DEV** — change is deployed via `scripts/deploy-dev.sh` and the health check (`http://localhost:4000/health`) passes. **Never production from automation** — production is a human-triggered step.

---

## Who enforces each line

| DoD line            | Enforced by                                                           |
| ------------------- | --------------------------------------------------------------------- |
| Merged              | PR review + branch guardrail (no force-push, no primary-branch write) |
| Acceptance Criteria | review-qa-agent against the epic's criteria                           |
| Gates green         | `scripts/qa.sh` · `scripts/test.sh` · `scripts/security-check.sh`     |
| Tests added         | test gate + coverage check                                            |
| Security reviewed   | security gate + `ecc:security-reviewer` / `security-agent`            |
| Docs updated        | Automation-Log update step in `/task-work` / `/epic-loop`             |
| Deployed to DEV     | `deploy-agent` (`scripts/deploy-dev.sh` + health smoke)               |

---

## How it's used

- **Gates** — the test/QA/security gates treat these lines as their pass condition; any unchecked box keeps the task open.
- **Orchestrator** — `/task-work` / `/epic-loop` read this file to decide when a task may move `→ ready-for-qa` (all boxes) versus `→ blocked` (a box cannot be checked after retries are exhausted).
- **Epics** — when every task in an epic satisfies this checklist, the epic advances to `ready-for-qa` (human QA), then `done`.

> Known baseline caveat: `scripts/test.sh` has a pre-existing red from the Prisma
> `baSession` seed test (`apps/api/prisma/seed.spec.ts`). A task is not blocked by
> failures it demonstrably did not introduce — record the pre-existing failure in
> the Automation Log instead of skipping the gate.
