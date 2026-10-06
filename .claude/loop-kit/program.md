# program.md

The loop's instructions. Modeled on Karpathy's `program.md` from autoresearch.
The feature-builder reads this before every feature. The human writes the fixed rules.
The auto loop (`/autoloop`) rewrites the "How to work" section after every feature.

## Fixed rules (nobody but the human edits these)

**The goal:** get the feature's score to full, with the feature usable in the app. The
score comes from `node .claude/loop-kit/score.mjs <feature>`, which scores the approved
checks for that feature in `checks/approved/` and prints `score: X/Y`.

**What you CAN change:** anything in the app. Code, data, pages, endpoints.

**What you CANNOT change:**

- `checks/approved/`, `.claude/loop-kit/score.mjs`, `.claude/loop-kit/approve-checks.mjs`,
  `.scores/`, and the test runner's config are locked. Never edit or bypass them.
  Approved checks define the acceptance bar.
- `program.md` and `.claude/`. That's the auto loop's and the human's job.
- No new dependencies unless the feature spec asks for one.

**One round:**

1. Pick one idea for moving the score up. One idea per round, so the log says what worked.
2. Make the change.
3. Run `node .claude/loop-kit/score.mjs <feature>`.
4. Compare results with the prior baseline. Keep useful changes in the working tree.
   If a round regresses, stop and inspect the exact diff; never run `git reset --hard`,
   `git clean`, or discard the user's work. Revert only task-owned edits and only after
   confirming they are safe to remove.
   Once the score is full, a round that closes a real usability gap (wiring the feature
   into the app, or fixing a miss) may be kept too.
5. Log the round (below). Do not commit or stage changes automatically; the user controls
   commits and approvals.

**Stop when:** the score is full, the feature is usable in the app, and every miss you
were handed is fixed (log status `done`). Or after **10 rounds** (log status `capped`, and
write one line on what's still failing).

**Breaking an earlier feature scores 0.** The scorer also runs every earlier feature's checks.

**Never stop to ask.** The human may be asleep.

## Logging

Append one row per round to `results.tsv` (tab-separated). Create it with the header if
missing. It is ignored by git; never delete or rewrite prior rows.

```
feature	round	score	status	tried	still_failing
```

- `status`: `keep`, `regressed`, `reverted` (only after confirming a task-owned edit),
  `crash` (checks did not run), `done`, or `capped`.
- `tried`: the idea in a few words. Say the approach, not "fixed bug".
- `still_failing`: failing check names separated by semicolons.

Use the log to identify ineffective approaches. A regression is evidence, not permission
to discard the patch or any user work.

## How to work (the auto loop rewrites this section)

- Read `.claude/loop-kit/FEATURES.md` and approved check names before writing code.
- Keep each feature's rules in their own file, as plain functions the checks can call.
- Simpler is better. If two versions score the same, keep the shorter one.
