---
name: build
description: Claude-only checks-first feature loop using the feature-builder agent. Codex can follow the checks-first steps in a primary session but cannot invoke Claude commands or agents.
disable-model-invocation: true
argument-hint: <feature or group>
---

Build `$ARGUMENTS`: a feature from `.claude/loop-kit/FEATURES.md`, a group from its table
or a new user-described feature.

You run the loop; you don't build. Feature code is written by feature-builders.

## 0. Ground ready

Follow `.claude/loop-kit/SETUP.md`. Record new user-approved rules in
`.claude/loop-kit/FEATURES.md`.

## 1. Checks

For each feature without approved checks in `checks/approved/`, draft checks in
`checks/drafts/` by following `.claude/skills/write-checks/SKILL.md`. Never rewrite approved
checks. If all checks are already approved, continue to step 4.

## 2. The one stop: the human approves the checks

The checks decide what "done" means, so the human sees them before anything is built.
Per feature, one line per check, in plain words the app's user would recognise. No code.
Then ask: **"Happy with these? Say yes, or tell me what to change."**

This is the back-and-forth that matters: make sure the checks cover the problems that
usually go wrong with this kind of feature. If they ask for changes (a missing field, an
edge case), update the drafts and show the full list again.

## 3. Lock them in

On a yes, run `node .claude/loop-kit/approve-checks.mjs <feature> ...` from the repository
root. It moves drafts from `checks/drafts/` into `checks/approved/` without replacing
approved checks. Say which ones got locked in.

## 4. Run the loop

1. Keep changes in the working tree. Do not stage or commit automatically.
2. In Claude Code, start the `feature-builder` subagent for each feature, one at a time.
   Codex must follow the same steps in its primary session; the Claude subagent is not
   available there.
3. After each feature, update `.claude/skills/project-context/SKILL.md` with verified
   reusable code context. Do not overwrite user changes.
4. Never run `git reset --hard` or `git clean`. For regressions, stop, inspect the diff,
   and only revert task-owned edits after confirming the exact paths.
5. Don't stop to ask between features except for a genuine blocker or decision.

## 5. Report

Run `bash .claude/loop-kit/stats.sh` from the repository root and report each feature's
score, rounds, regressions, and any usability wiring or remaining failures in plain words.
