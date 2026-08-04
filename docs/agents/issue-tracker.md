# Issue tracker: epic documents

Work for this repo is tracked as **epic files under `docs/epics/`**, not GitHub
Issues. Skills that say "publish to the issue tracker" or "fetch the relevant
ticket" mean these files.

GitHub Issues exist (#1–79) but are historical: they covered phases 1–7 and are
all closed. Do not create new ones — nobody reads that surface. GitHub is used
for **pull requests** to `development`, and for nothing else in this workflow.

## Where things live

| Artefact           | Path                                                   |
| ------------------ | ------------------------------------------------------ |
| Epics              | `docs/epics/EPIC-XXX-<slug>.md`                        |
| Epic registry      | `docs/epics/README.md` — one row per epic, with status |
| User stories       | `docs/product/USER-STORIES.md` — `US-{DOMAIN}-{n}`     |
| Criteria standard  | `docs/product/ACCEPTANCE-CRITERIA.md`                  |
| Definition of Done | `docs/DEFINITION-OF-DONE.md`                           |
| Backlog seeds      | `docs/BACKLOG.md` + `scripts/backlog.json`             |

## Canonicity

When two documents disagree, trust them in this order:

1. **The epic file and the `docs/epics/README.md` registry** — canonical. They
   are the live state of work: status, tasks, and the Automation Log.
2. **PRD · user stories · acceptance criteria · engineering tasks** — intent.
   They say what should be built; epics record what is being built.
3. **`BACKLOG.md` / `backlog.json`** — seeds only. An item is real once it
   becomes an epic or a task group.

So: backlog seeds become epics; **the epic wins**.

## Unit of work

One `### task group` inside an epic. That is what `/task-work EPIC-XXX <n>`
operates on, and what becomes one branch and one pull request.

## Epic file shape

```markdown
# EPIC-XXX: Title

status: on-progress
environment: dev
retries: 0

## Goal

## Evidence ← what was read in the code, with file:line

## Tasks ← `### group` headings, each a unit of work

## Acceptance Criteria ← Given/When/Then per ACCEPTANCE-CRITERIA.md

## Automation Log ← append-only record of what happened
```

`EPIC-022` and `EPIC-023` are the current reference examples; they also carry
`Decisions Taken`, `Test Plan`, `Agent Routing`, and `Done Signal` sections,
which are worth copying for anything non-trivial.

## Status lifecycle

```
backlog → on-progress → coding → review → testing → deploying-dev → ready-for-qa → done
                                                                  ↘ blocked
```

`backlog`, `done`, and `blocked` are skipped by automation. Only epics at
`on-progress` (or a mid-flight phase) are picked up.

## When a skill says "publish to the issue tracker"

Create or update an epic file under `docs/epics/`, and add its row to
`docs/epics/README.md`. For anything user-facing, add the matching story to
`docs/product/USER-STORIES.md` with a fresh `US-{DOMAIN}-{n}` — check the
highest existing number for that domain first, IDs are not reused.

## When a skill says "fetch the relevant ticket"

Read the epic file and its **Automation Log**. The log carries prior decisions,
what was already tried, and what was deliberately left undone — read it before
proposing anything, or you will re-litigate a settled decision.

## Durability rule

Memory stores and agent scratch space are caches. Every durable decision —
including ones taken in conversation — is copied into the epic's **Automation
Log** in the same change that acts on it. If the cache is wiped, the decision
still exists in version control.

## Recording findings

When work surfaces a defect nobody asked about, record it in the epic with the
evidence (`file:line`, the observed value, the expected value) rather than
fixing it silently or dropping it. Several of the most expensive defects in this
repo were found that way, and would have been lost if they had not been written
down at the moment of discovery.

Do **not** record a cause you have not reproduced. A guess written into an epic
becomes a requirement. Log the symptom and mark it as awaiting reproduction.
