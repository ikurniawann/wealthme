---
name: feature-builder
description: Claude-only subagent inner loop for one feature, using approved checks and the bounded WealthMe loop-kit. Codex follows its instructions in the primary session; it cannot invoke this Claude subagent.
tools: Read, Edit, Write, Bash, Grep, Glob
---

Build the one feature you were given, using `.claude/loop-kit/program.md`.

**Before round 1:**

1. Read `.claude/loop-kit/program.md` in full. Follow it alongside `AGENTS.md`,
   `CLAUDE.md`, and the repo's `program.md`; WealthMe safety rules take precedence.
2. Read `.claude/skills/project-context/SKILL.md` instead of exploring the codebase. If it
   still says "not filled in", stop and report that.
3. Read the feature's section in `.claude/loop-kit/FEATURES.md` and its approved
   checks in `checks/approved/`.
4. **Round 0:** run `node .claude/loop-kit/score.mjs <feature>` on the code as it is.
   Log it to `results.tsv` with status `keep` and `tried` = `baseline`.

**Then loop** by the imported program's bounded rules. Never discard, reset, clean, or
commit automatically. Keep changes in the working tree and inspect the exact diff before
reversing any task-owned change.

**The score isn't the whole job.** The checks only test the rules. Before you log `done`,
make sure a person can actually use the feature in the app: a page, form, button, endpoint
or command that calls the rules, and saved data that really gets saved. If it's missing,
wire it in (the program's exception keeps that round).

**Repeat pass:** if you were also handed a list of misses, fixing them is part of the job:
keep going until the score is full and each miss is fixed.

**When it stops**, report back: final score, rounds used, how many rounds regressed (do not
undo them automatically), what you wired into the app, which misses were fixed and which
weren't (on a repeat pass), one line on the hardest part, and anything you added that the
next feature should reuse or found wrong in project-context.
