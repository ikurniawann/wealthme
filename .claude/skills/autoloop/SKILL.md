---
name: autoloop
description: Claude-only coach workflow for running the bounded Karpathy-style feature loop one feature at a time, recording evidence, and improving generic work habits. Codex can follow the steps sequentially; Claude subagent spawning is unavailable there.
disable-model-invocation: true
argument-hint: <feature or group>
---

Target: `$ARGUMENTS`. A feature from `.claude/loop-kit/FEATURES.md`, a group from its table
(taken left to right), or a description of new features.

You are the coach, not a builder. A plain `/build` is one pass: each builder runs the loop
with the same instructions, and nothing learned carries forward. Here the loop itself gets
better as it goes. Feature-builders write the app code; after each one you study how the
run went, improve the instructions the next builder starts from, and loop again on any
feature that fell short. That improvement is the whole point. Never write app code yourself.

You ask the human one thing only: the sign-off in phase B.

---

### Phase A: get the ground ready

Follow `.claude/loop-kit/SETUP.md`. Record only user-approved feature rules in
`.claude/loop-kit/FEATURES.md`.

### Phase B: agree on what "done" means

1. Any feature without approved checks in `checks/approved/` gets drafts in
   `checks/drafts/`: follow `.claude/skills/write-checks/SKILL.md`. Approved checks are
   immutable. Nothing to draft → go to step 3.
2. Sign-off. Per feature, list each check in plain language and ask the human to approve
   it before implementation. Revise if requested.
3. On approval, run `node .claude/loop-kit/approve-checks.mjs <feature> ...` from the
   repository root. This moves drafts into `checks/approved/` without replacing checks.
   Do not stage or commit automatically.

### Phase C: the coaching cycle (per feature, in order)

```
run one loop → review → rewrite instructions → missed something?
                                                 ├─ yes → loop again on this feature
                                                 └─ no  → improvement carries to the next feature
```

1. **Run one loop.** Start the **feature-builder** agent, passing the feature name (plus,
   on a repeat pass, the list of misses from step 2), and wait. No questions to the human
   between features.
2. **Review.** Read this feature's `results.tsv` rows and the builder's report, alongside
   earlier rows and `coach-notes.md`, and check the builder's claims in the code. Two
   questions:
   - _Did it miss something the score can't see?_ Approved checks still failing; rules in
     `.claude/loop-kit/FEATURES.md` not actually followed; built rules not wired into the
     app; or an older code path still doing the same job the old way.
   - _Could the loop work better?_ Repeated failing checks, ineffective repair attempts,
     gaps recurring across features, or rounds lost to crashes.
3. **Rewrite the instructions.** Edit only what the ownership table says is yours: habits
   in `.claude/loop-kit/program.md` → "How to work", facts in project-context.
4. **Record.** Append to `coach-notes.md` after each pass: date, feature, pass, score,
   rounds/regressions, misses, evidence from `results.tsv`, and what changed in response.
   If no improvement was earned, record "no change".
5. **Save.** Keep notes in the working tree. Never commit or stage automatically; inspect
   the diff and preserve unrelated user work. Never use `git reset --hard` or `git clean`.
6. **Branch.**
   - **Missed something → loop again.** Back to step 1 on the same feature with a fresh
     builder, handing it the concrete misses. It starts from the rewritten instructions.
     Repeat until nothing is missed. Stop if a pass fixes none of the misses it was given
     (the coaching isn't moving it); note what's left and go on.
   - **Nothing missed → carry forward.** The rewritten instructions are the loop's
     improvement; the next feature (or the next `/autoloop` or `/build`) starts from them.

### Phase D: wrap up

Run `bash .claude/loop-kit/stats.sh` from the repository root. Tell the human each feature's
final score, passes, rounds and regressions; summarize misses and coaching notes without
reverting edits automatically.

---

### Ownership

| File                                                               | Owner       | Rule                                                           |
| ------------------------------------------------------------------ | ----------- | -------------------------------------------------------------- |
| `.claude/loop-kit/program.md` → "How to work"                      | coach       | General habits, never feature answers.                         |
| `.claude/loop-kit/program.md` → fixed rules and logging            | human       | Never edited by the coach.                                     |
| `.claude/skills/project-context/SKILL.md`                          | coach       | Verified project context and reusable code.                    |
| `.claude/loop-kit/FEATURES.md`                                     | human/coach | User-approved specs; never loosen approved scope.              |
| `CLAUDE.md`                                                        | human       | Short, stable project rules.                                   |
| `results.tsv`                                                      | builders    | Append-only local run log.                                     |
| `coach-notes.md`                                                   | coach       | Append observations and evidence; keep it in the working tree. |
| `checks/approved/`, scorer scripts, `.scores/`, test-runner config | locked      | Never modify or route around approved checks.                  |

**Habits in "How to work".** Teach methods, not answers. "For money, work in whole cents
and hand out leftover cents last" is a habit; "in split-bill, give the leftover cent to
person 1" is an answer, which is overfitting: the next feature is different, and handing
out answers is the coach cheating rather than teaching. Examples of habits a real run
learned:

- "Wire the rules into the app in the same round that makes the checks pass (a control to
  use them, a place they show, data that actually gets saved)."
- "Before wiring, find every place the app already does the same job, and make each one
  follow the new rules, not only the new file."

A pattern must show up twice (two features, or two wasted rounds) before it becomes a
habit; a single sighting stays in `coach-notes.md` as an observation. Drop any habit the
log shows isn't helping. Ten lines that matter beat thirty.

**Project context.** Keeps builders from re-exploring. After each feature, confirm in the
code what the builder added that later builders should reuse (file, data field, page,
helper, convention), write it in, and correct anything stale (moved routes, renamed
files). Real code only, no plans.
