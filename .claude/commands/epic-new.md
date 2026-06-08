---
description: Plan a new feature with /ecc:plan and write a local docs/epics/EPIC-XXX file only. Does NOT touch GitHub — you review and push manually.
argument-hint: "<feature description>"
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# /epic-new

Turn a feature idea into a new local epic file. Feature: **$ARGUMENTS**

This command writes **local files only**. It must NOT create branches, commit, push, or call `gh` /
GitHub. The user reviews the epic and pushes/syncs to GitHub themselves.

## Steps
1. **Plan** the feature: run the `/ecc:plan` skill (or `planner` agent) on `$ARGUMENTS`. Use the
   resulting plan to derive the Goal, the task breakdown, and acceptance criteria. Read a couple of
   neighbouring files in `docs/epics/` first so the new epic matches house style.
2. **Pick the next id**: scan `docs/epics/EPIC-*.md`, take the highest `EPIC-NNN`, add 1 →
   `EPIC-<NNN+1>`. Build a kebab slug from the feature title.
3. **Write** `docs/epics/EPIC-<NNN+1>-<slug>.md` following the exact repo format:
   ```
   # EPIC-<NNN+1>: <Title>

   status: backlog
   environment: dev
   phase: <n>
   priority: <P0|P1|P2>
   area: <Frontend|Backend|Infra>

   ## Goal
   <short narrative>

   ## Tasks

   ### <Task group 1 — phrase it like a GitHub issue title>
   - [ ] <sub-step>
   - [ ] <sub-step>

   ### <Task group 2>
   - [ ] <sub-step>

   ## Acceptance Criteria
   - <criterion>

   ## Dependencies
   - <other epics, or "Tidak ada">
   ```
   Each `### group` should be a self-contained, PR-sized unit (it will map to one GitHub issue and one
   `/task-work` run). Start with `status: backlog` so automation ignores it until the user is ready.
4. **Report and stop**. Print the new file path and these manual next steps (do NOT run them):
   - Review/edit the epic file.
   - Optionally add the tasks to `scripts/backlog.json` and run `bash scripts/setup-github-project.sh`
     to create the milestone + issues on GitHub.
   - Commit and push the epic file when satisfied.
   - To start work: set `status: on-progress` and run `/epic-loop`, or run `/task-work EPIC-<NNN+1> 1`.

## Guardrails
- No GitHub mutations, no git commits/pushes, no `gh` calls. Files under `docs/epics/` only.
