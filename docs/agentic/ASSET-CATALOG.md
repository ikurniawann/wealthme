# Imported agent, skill, and workflow assets

This catalog records reusable assets from six local source folders and how to use them in WealthMe. Imported source application code and machine-specific setup are intentionally excluded. Preserve each skill's local references, scripts, fixtures, and supplied license files when maintaining these folders.

## Start here

- **Claude Code:** project skills live at `.claude/skills/<name>/SKILL.md`; invoke command skills by their slash names when applicable. Project agents live in `.claude/agents/`. Claude commands and subagents are Claude-only mechanisms.
- **Codex CLI:** portable project skills live at `.agents/skills/<name>/SKILL.md`; ask Codex to use the named skill (e.g. `Use the extract-design-system skill`). Codex may read portable instructions and use their local scripts/references, but does not execute Claude slash commands or load Claude subagent definitions. Follow the same acceptance criteria in one sequential Codex session, or use Codex subagents only when actually available and useful.
- **OMP:** start non-trivial work with `orchestrate: <task>` and follow
  `.agents/skills/orchestrate/SKILL.md`. Resolve `skill://<name>` when OMP
  provides that resolver; otherwise read `.agents/skills/<name>/SKILL.md`.
  Claude slash commands and `.claude/agents/` are not OMP capabilities. Use
  only configured tools actually available in the session; run sequentially
  when no subagent tool is available, and follow the configured model/runtime
  rather than inferring provider routing or invoking every model.
- **Shared default:** use `AGENTS.md`, `CLAUDE.md`, this catalog, and
  `docs/agentic/AGENTIC-WORKFLOW.md`. Start non-trivial work with Claude
  `/orchestrate "<task>"`, Codex `$orchestrate <task>`, or OMP
  `orchestrate: <task>`; specialist skills complement rather than replace it.
- A skill copied into both host skill folders is the same guidance; keep both copies in sync when changing shared text. Host-specific adapters remain in their native folders.

## Six source-directory coverage

1. `source-code 2` — the Graft skill and its MIT `LICENSE` in both host skill roots; standalone application excluded.
2. `ClaudeAgents` — generic phase-based workflow and development prompt templates; the YouTube-specific feature specification was excluded.
3. `karpathy-loop` — four skills, `feature-builder`, and loop-kit docs/scripts; adapted to WealthMe paths and made non-destructive.
4. `AL-Design` — all ten source skills (`discover-skills`, `extract-design-system`, `web-design-extractor`, `make-design-md`, `optimize`, `shadcn`, `clone`, `functional-ui`, `gsap`, `marketing-ui`) with their references, scripts, evals, fixtures, images, and GSAP license.
5. `claude-design-skills` — `design-orchestrator` and its four reference files; the source names 26 sibling skills that were not present and are not imported.
6. `headstart` — `SKILL.md`, `references/arxiv-prior-art.md`, and `agents/openai.yaml`; MIT notice in skill frontmatter retained.

## Included workflow and design skills

| Skill                   | Paths (Claude / Codex)                                                     | Purpose / notes                                                                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autoloop`              | `.claude/skills/autoloop`, `.agents/skills/autoloop`                       | Claude slash workflow coach that learns from bounded feature-loop evidence. Codex can follow its review/coaching method sequentially; Claude agent spawning is not portable.                                                                        |
| `build`                 | `.claude/skills/build`, `.agents/skills/build`                             | Claude slash workflow for checks-first implementation using `feature-builder`; Codex equivalent is a single-session checks-first workflow, not `/build`.                                                                                            |
| `write-checks`          | `.claude/skills/write-checks`, `.agents/skills/write-checks`               | Draft acceptance tests before implementation and obtain human approval. In WealthMe put drafts under `checks/drafts/` and approved checks under `checks/approved/`.                                                                                 |
| `project-context`       | `.claude/skills/project-context`, `.agents/skills/project-context`         | Reusable project-context template. Fill it from checked-in code before using the Karpathy-style builder.                                                                                                                                            |
| `feature-builder`       | `.claude/agents/feature-builder.md`                                        | Claude subagent for a single feature loop. Codex cannot spawn this Claude agent; follow its bounded steps in the primary Codex session instead.                                                                                                     |
| `discover-skills`       | `.claude/skills/discover-skills`, `.agents/skills/discover-skills`         | Scans for discoverable skills and includes Claude-specific helper scripts; use the skill guidance on Codex, but its Claude CLI integration is Claude-only.                                                                                          |
| `extract-design-system` | both host skill folders                                                    | Extract a design system from reference material; includes workflow/output references.                                                                                                                                                               |
| `web-design-extractor`  | both host skill folders                                                    | Browser/reference-based web design extraction; includes extraction, font, and output-template references.                                                                                                                                           |
| `make-design-md`        | both host skill folders                                                    | Extract an existing implemented system into `docs/design/design.md`; it reads real components/styles/tokens, not a reference site.                                                                                                                  |
| `optimize`              | both host skill folders                                                    | Motion/performance optimization; includes measurement scripts, evals, and fixtures. Run only when their documented local prerequisites are satisfied.                                                                                               |
| `shadcn`                | both host skill folders                                                    | shadcn component/registry guidance; includes references, rules, evals, agent metadata and image assets. Treat Claude/MCP integration as host-specific; WealthMe uses shadcn with Base UI, so confirm compatibility rather than assuming Radix.      |
| `clone`                 | both host skill folders                                                    | Reconstruct UI from provided references/screenshots; includes screenshot fixture path.                                                                                                                                                              |
| `functional-ui`         | both host skill folders                                                    | Functional UI implementation guidance; includes its gallery script.                                                                                                                                                                                 |
| `gsap`                  | both host skill folders                                                    | GSAP motion guidance and eight references. The supplied MIT `LICENSE` is preserved at both skill roots.                                                                                                                                             |
| `marketing-ui`          | both host skill folders                                                    | Marketing-page workflow; Higgsfield MCP and SingleFile CLI are external optional dependencies, not bundled.                                                                                                                                         |
| `graft`                 | `.claude/skills/graft`, `.agents/skills/graft`                             | Optional Graft CLI guidance. The source MIT `LICENSE` is retained at both skill roots. The executable is not installed here; use only if CLI/index are available, otherwise normal search/read. Standalone app excluded.                            |
| `design-orchestrator`   | `.claude/skills/design-orchestrator`, `.agents/skills/design-orchestrator` | UI task router with four source references. Adapter routes only to installed WealthMe skills. Original examples name 26 sibling skills that were not present in the source and are not imported.                                                    |
| `headstart`             | `.claude/skills/headstart`, `.agents/skills/headstart`                     | Read-only project strategy/research skill. Source declares MIT and that notice is retained in frontmatter. `agents/openai.yaml` is Codex metadata, not a Claude mechanism. arXiv path is gated, requires actual retrieval and isolated agent calls. |

## Nested payload inventory

Paths below are relative to the named skill directory; each portable payload is
present under both `.claude/skills/` and `.agents/skills/` unless called out.
All skills also have their entrypoint `SKILL.md`.

- `discover-skills/`: `.gitignore`, `scripts/{bootstrap.sh,scan.sh}`,
  `patch/{claude_cli.py,llm_utils.py}`.
- `extract-design-system/`: `references/{workflow.md,outputs.md}`.
- `web-design-extractor/`: `references/{extraction-guide.md,fonts-guide.md,output-template.md}`.
- `optimize/`: `scripts/{compare.mjs,measure.mjs,webkit-memory.mjs}`,
  `references/{measurement.md,motion.md}`, `evals/{evals.json,trigger-queries.json}`,
  and fixtures under `evals/fixtures/{gsap-scroll,hero-reveal,scroll-sequence}/`
  (`index.html` in each; scroll-sequence also has `.gitignore` and `make-frames.mjs`).
- `shadcn/`: `registry.md`, `cli.md`, `customization.md`, `mcp.md`,
  `rules/{base-vs-radix.md,composition.md,forms.md,icons.md,styling.md}`,
  `agents/openai.yml`, `evals/evals.json`, and `assets/{shadcn-small.png,shadcn.png}`.
- `clone/`: `screenshots/.gitkeep`; `functional-ui/`: `scripts/gallery.py`.
- `gsap/`: MIT `LICENSE` and eight references:
  `references/{gsap-core.md,gsap-frameworks.md,gsap-performance.md,gsap-plugins.md,gsap-react.md,gsap-scrolltrigger.md,gsap-timeline.md,gsap-utils.md}`.
- `design-orchestrator/`: `references/{conflicts.md,plans.md,routing-table.md,skill-purposes.md}`.
- `headstart/`: `references/arxiv-prior-art.md`, `agents/openai.yaml`.
- `graft/`: source MIT `LICENSE`; the executable/index are not bundled.

The four `karpathy-loop` skills have no nested payloads. Its Claude-only
`.claude/agents/feature-builder.md` and `.claude/loop-kit/{SETUP.md,FEATURES.md,program.md,stats.sh,score.mjs,approve-checks.mjs}`
are listed separately because they are not portable-skill payloads. The two
generic ClaudeAgents replacements are `docs/agentic/templates/{phase-based-project-process.md,agent-assisted-development-prompt.md}`.

All AL-Design skills are included, including `shadcn`; the existing `ui-styling`,
`impeccable`, and `ui-ux-pro-max` skills overlap with some recommendations but do not replace
the imported assets. The `.agents/skills/design/` and `design-system/` folders contain
reference material/scripts, not a discoverable `SKILL.md`. Imported scripts, references,
evals, fixtures, images, and supplied license files remain beside their `SKILL.md`.

Adapt source defaults to WealthMe before acting: follow `AGENTS.md`/`CLAUDE.md` instead of
assuming a lowercase `claude.md`; use `docs/design/` for design artifacts unless a task
specifies another tracked location; preserve the existing Base UI shadcn setup and protected
web foundations. The `discover-skills` scanner bootstrap downloads/builds third-party code
and may remove its own generated `vendor/skillspector` and virtualenv folders; ask before
running it. Its optional LLM pass calls Claude CLI and is Claude-only; Codex can use static
scan mode if the scanner has been explicitly set up.

## Karpathy-style feature-loop assets

The four Karpathy skills are present in both `.claude/skills/` and `.agents/skills/`.
Loop-kit setup, feature specs, scoring, approval, and statistics assets live only in
`.claude/loop-kit/`; the Claude-only feature-builder agent lives in `.claude/agents/`.
Claude `/build`, `/autoloop`, and `/write-checks` are available through their skill
entrypoints. Codex can use the skills as procedural guidance in a primary session, but
must not claim to invoke Claude commands or agents.

Claude's existing `.claude/settings.json` was merged, not replaced, with deny rules for
`checks/approved/`, the imported scorer/approver, `.scores/`, and the settings file itself.
Draft checks remain writable. These are Claude Code permissions; Codex does not inherit
`.claude/settings.json`, so it must follow the same check-protection rules in its skill and
task instructions.

WealthMe's active check layout is `checks/drafts/` plus `checks/approved/`; existing `program.md` and `results.md` remain the repo's primary bounded task loop. The imported kit is supplemental. **Never execute an automatic `git reset --hard`, `git clean`, or implicit commit from a loop.** Keep changes in the working tree, inspect the exact diff, and only reverse task-owned edits after confirming them. User changes must be preserved. `/task-loop` remains the project-default bounded loop; the imported feature-builder reference now resolves to `.claude/agents/feature-builder.md`.

Use that imported feature-loop only for repeatable work with enough context,
objectively scorable checks, and a way for the agent to run and inspect the
result. For one-off work, use the normal bounded task loop.

## Generic source prompt templates

`docs/agentic/templates/` contains genericized replacements for the two ClaudeAgents files. The original process file hard-coded a YouTube application and its no-web-search constraint, so those product requirements were intentionally not imported. Use the templates as prompts, not as new project policy.

## Excluded source-code 2 content

The source-code 2 folder is the standalone Graft application. Only its `.claude/skills/graft/SKILL.md` guidance is included, with the CLI requirement stated above. The standalone app, `src/`, `test/`, `dist/`, assets, generated bundles, package metadata, environment files, and helper binaries are excluded. No source `.env` or secrets were copied. The skill itself assumes the `graft` executable and a generated project graph; those are external prerequisites and are not included here.
