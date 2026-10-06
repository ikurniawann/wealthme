---
name: write-checks
description: Drafts executable acceptance checks from approved feature rules. Claude can invoke this as /write-checks; Codex follows the same steps by reading this skill, not by invoking a Claude slash command.
disable-model-invocation: true
argument-hint: <feature or group>
---

Write checks for `$ARGUMENTS`, features in `.claude/loop-kit/FEATURES.md` or a user-approved
new scope. These checks define "done"; do not write feature code.
The agent that builds the feature never judges its own code; it builds to these. Don't
write any feature code.

For each feature:

1. Read the feature's `.claude/loop-kit/FEATURES.md` section and the project-context skill.
2. Pick the function(s) it needs, in the place project-context says feature rules go
   (default: one file per feature, e.g. `lib/<feature>.ts` or `<pkg>/<feature>.py`).
   Write their inputs and outputs in a comment at the top of the checks file. The loop
   builds to this.
3. Write one check per rule in the spec, plus the edge cases the rule implies and the
   ways this kind of feature usually goes wrong: rounding and the leftover cent, empty
   input, duplicates, a time that crosses midnight or a month end, invalid input (a
   malformed email, a negative amount), and a change that must undo cleanly when it fails
   halfway. Aim for 6 to 12 checks.
4. Name every check as a plain sentence the app's user would understand:
   `"shares add up to the exact total when it doesn't split evenly"`, not `"rounding test"`.
   The loop and the auto loop read these names in the log.
5. Test plain functions: data in, data out. Pass "now"/"today" in as an argument rather
   than reading the clock, so checks give the same answer every day. Import by relative
   path from the checks folder.
6. Never touch real data. The scorer sets `NODE_ENV=test` and `DB_PATH=":memory:"`; if the
   app has a database, its code must honour that (say so in the comment at the top). No
   check writes real files or calls the network.
7. Save to `checks/drafts/`, using the project's test runner and this naming:
   - JS/TS: `checks/drafts/<feature>.test.ts` (or `.test.js`)
   - Python: `checks/drafts/test_<feature_with_underscores>.py`
     Never modify files under `checks/approved/`.

**When run on its own** (not from `/build` or `/autoloop`): run the setup in
`.claude/loop-kit/SETUP.md` first if the project isn't set up. After writing, show the
checks in plain words, one line each, per feature, and ask **"Happy with these? Say yes,
or tell me what to change."** Revise until approved. Then run
`node .claude/loop-kit/approve-checks.mjs <features>` from the repository root; do not stage
or commit automatically.
