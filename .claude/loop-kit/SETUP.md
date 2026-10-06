# WealthMe loop-kit setup

The imported Karpathy-style kit supplements WealthMe's existing `program.md`,
`checks/`, and `results.md`; it does not replace them or bootstrap another
project. The committed WealthMe loop remains the default.

| If…                                               | Then…                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| No feature entry exists                           | Add only user-approved feature rules to `.claude/loop-kit/FEATURES.md`.            |
| `checks/drafts/` or `checks/approved/` is missing | Create the missing directory; never overwrite approved checks.                     |
| The project context template says it is unfilled  | Fill `.claude/skills/project-context/SKILL.md` from repository code, not plans.    |
| A check runner is missing                         | Stop and ask before adding a dependency or changing runner configuration.          |
| Existing work is uncommitted or unknown           | Preserve it. Do not reset, clean, stage, commit, or switch branches automatically. |

The loop scripts are invoked from the repository root and read
`checks/drafts/`, `checks/approved/`, and `.claude/loop-kit/FEATURES.md`.
The current root `program.md` and `results.md` remain authoritative for
WealthMe. `results.tsv` and `.scores/` are local loop output and are ignored by
Git. Never copy kit files over root instructions or existing checks.

Claude Code may use `/build`, `/autoloop`, and `/write-checks`; Codex must use
their portable skill instructions sequentially and must not invoke Claude-only
slash commands or the `feature-builder` subagent.
