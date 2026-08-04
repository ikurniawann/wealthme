# Domain docs

How the engineering skills should consume this repo's domain documentation when
exploring the codebase.

This repo is **multi-context**: `apps/web` (Next.js frontend) and `apps/api`
(NestJS + Prisma backend) are genuinely different domains with their own
vocabularies, and they already carry separate convention files.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root, when it exists — it points at one
  `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — system-wide architecture decisions. Read the ones touching
  the area you are about to work in.
- **Per-context ADRs** — `apps/<app>/docs/adr/` for decisions scoped to a single
  app.

If any of these do not exist, **proceed silently**. Do not flag their absence and
do not suggest creating them upfront. The `/domain-modeling` skill creates them
lazily, when a term or a decision actually gets resolved.

## Intended file structure

```
/
├── CONTEXT-MAP.md                  ← points at each context
├── docs/adr/                       ← system-wide decisions
├── apps/
│   ├── web/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/               ← frontend-scoped decisions
│   └── api/
│       ├── CONTEXT.md
│       └── docs/adr/               ← backend-scoped decisions
└── packages/
    └── contracts/CONTEXT.md        ← the shared vocabulary between them
```

`packages/contracts` deserves its own context: it is the boundary both apps agree
on, so a term defined there is binding on the web and the API alike.

## Documents that already carry domain rules

These predate this file and remain authoritative for their areas — read them
before assuming a convention:

| Document                       | Covers                                   |
| ------------------------------ | ---------------------------------------- |
| `CLAUDE.md`                    | operating model, routing, gates          |
| `WM_CONVENTIONS.md`            | project-wide guardrails, protected paths |
| `apps/web/WM_CONVENTIONS.md`   | web conventions — pages, primitives, UI  |
| `apps/web/AGENTS.md`           | web hard defaults                        |
| `docs/agents/issue-tracker.md` | where work is tracked                    |
| `docs/DEFINITION-OF-DONE.md`   | the bar every task clears                |

## Use the glossary's vocabulary

When your output names a domain concept — an epic title, a refactor proposal, a
test name, a user story — use the term as the relevant `CONTEXT.md` defines it.
Do not drift to synonyms the glossary avoids.

This repo's domain language is **Indonesian for anything user-facing** (rekening,
anggaran, liabilitas, warisan, kekayaan bersih) and English in code. Keep that
split: an English variable name for an Indonesian concept is fine; an
English-only string reaching a user is not.

If the concept you need is not in the glossary yet, that is a signal — either you
are inventing language the project does not use (reconsider), or there is a real
gap worth recording for `/domain-modeling`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than
silently overriding it:

> _Contradicts ADR-0007 (COA drives report classification) — but worth reopening
> because…_

The same applies to decisions recorded in an epic's `Decisions Taken` section.
Those were signed off by the product owner; a change of direction is a
conversation, not an implementation detail.
