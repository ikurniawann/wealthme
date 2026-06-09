# AI Workflow

This document is the shared operating model for Claude Code and Codex in this
repo. Tool-specific configuration stays separate:

- Claude Code: `CLAUDE.md` and `.claude/`
- Codex: `AGENTS.md` and `.codex/`
- Shared workflow: this file

## Migration Policy

Use copy/adapt, not replace. When moving behavior from Claude to Codex, preserve
the original Claude files and translate only the intent that Codex can support.

Recommended mapping:

| Claude                              | Codex                                                         |
| ----------------------------------- | ------------------------------------------------------------- |
| `CLAUDE.md`                         | `AGENTS.md`                                                   |
| `.claude/settings.json` permissions | guardrails in `AGENTS.md` and `.codex/config.toml`            |
| `.claude/hooks/*`                   | manual guardrails, scripts, or future Codex-compatible checks |
| `.claude/commands/*`                | documented workflows or `scripts/*`                           |
| `.claude/agents/*`                  | `.codex/agents/*.toml` role layers                            |
| shared skills                       | `.agents/skills/<skill>/SKILL.md` when needed                 |

## Agent Parity

The current Codex baseline registers equivalents for the project Claude agents:

| Claude agent                          | Codex role          |
| ------------------------------------- | ------------------- |
| `.claude/agents/epic-orchestrator.md` | `epic-orchestrator` |
| `.claude/agents/code-agent.md`        | `code-agent`        |
| `.claude/agents/review-qa-agent.md`   | `review-qa-agent`   |
| `.claude/agents/test-agent.md`        | `test-agent`        |
| `.claude/agents/security-agent.md`    | `security-agent`    |
| `.claude/agents/deploy-agent.md`      | `deploy-agent`      |
| `.claude/agents/bug-fixer.md`         | `bug-fixer`         |

These roles are registered in `.codex/config.toml`. Codex still does not treat
`.claude/commands/*` as native slash commands, so invoke command workflows by
asking Codex to follow the relevant file and use the registered roles.

## Working Rules

- Keep diffs focused and reversible.
- Read nearby code before editing.
- Prefer existing components, helpers, data shapes, and scripts.
- Validate inputs at system boundaries.
- Never hardcode secrets; use environment variables and examples.
- Do not bypass tests or security checks.
- Do not deploy to production from automation.
- Do not force-push.
- Do not run destructive database commands without explicit human approval.

## Standard Validation

Run the narrowest useful checks for the change, then broaden when shared
behavior, contracts, auth, database, or deployment logic is touched.

Preferred scripts:

```sh
scripts/qa.sh
scripts/test.sh
scripts/security-check.sh
```

For frontend UI work, also verify the page in a browser when practical. For
security-sensitive work, run the security check and review changed boundary code.

## Epic Workflow

Epics live under `docs/epics/` and use this lifecycle:

```text
backlog -> on-progress -> coding -> review -> testing -> deploying-dev -> ready-for-qa -> done
                                                                  -> blocked
```

Process only epics marked `status: on-progress`. Work one task at a time:

1. Plan the task from the epic goal, task text, and acceptance criteria.
2. Implement the smallest complete change.
3. Review the diff for correctness, type safety, security, and WealthMe
   conventions.
4. Run relevant validation.
5. Update the epic status or task checkboxes only when the work is genuinely
   complete.

After three failed attempts on the same task, mark the task or epic blocked with
the failing gate, evidence, and a recommended next action.

## Deployment

DEV deployment may use `scripts/deploy-dev.sh` when requested or required by an
epic workflow. Production deployment, production infrastructure changes,
credential changes, and CI/CD deploy-target changes require explicit human
approval.
