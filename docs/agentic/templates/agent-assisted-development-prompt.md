# Generic agent-assisted development prompt

Copy this prompt into a new task and replace the bracketed fields. Keep the request scoped to the current repository and its instructions.

```text
Help me deliver [goal] for [users/use case] in this repository.

Before planning or editing:
- Read AGENTS.md and follow its required load order. Read relevant app-level instructions before touching that app.
- Inspect the existing stack, patterns, tests, and relevant implementation; do not assume the repository structure or install a new stack.
- Use available skills/agents only when they materially help. Claude-only slash commands/subagents are not available to Codex; do not claim cross-host support.

Scope:
- Required behavior: [observable requirements]
- In scope: [areas/files/workflows]
- Out of scope: [explicit exclusions]
- Constraints: [security, accessibility, performance, design, compatibility]

Workflow:
1. Summarize evidence, scope, acceptance criteria, and risks in a compact task capsule.
2. Plan the smallest implementation that meets acceptance; preserve existing conventions and user-owned changes.
3. Implement end-to-end behavior and update relevant tests/docs.
4. Run the narrowest relevant checks, then inspect the actual diff.
5. Report exact changed files, verification commands and results, unverified behavior, and remaining risks.

Collaboration and handoffs:
- Route only to available, useful specialists. Give each a concrete independent question or deliverable.
- Keep durable decisions in tracked project docs. Never rely on an untracked artifact as the only handoff.
- Do not expand scope, add dependencies, deploy, commit, or perform destructive cleanup without authorization.

The acceptance criteria are:
- [criterion 1]
- [criterion 2]
```
