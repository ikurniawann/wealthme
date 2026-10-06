# OMP–Herdr Pilot Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make OMP the low-cost project hub for WealthMe's bounded pilot loop, with independently-owned workers visible as unfocused Herdr tabs.

**Architecture:** The tracked protocol and check evidence remain host-neutral. OMP loads the project-specific roles, cost guard, and Herdr delegate plugin from `.omp/`; the delegate creates and supervises visible OMP workers through Herdr's explicit tab and agent APIs. A compatibility inventory distinguishes portable skills/MCP from Claude/Codex-only features rather than copying host configuration.

**Tech Stack:** OMP 18.6.1 plugins/configuration, Herdr CLI integration, TypeScript, Node.js, Markdown, existing Bash verification scripts.

**Spec:** `docs/superpowers/specs/2026-10-06-cross-host-pilot-loop-design.md`

**Execution mode:** Adaptive. Implement sequential, dependent tasks natively in
one session to conserve quota. Use a visible OMP-in-Herdr subagent only for a
heavy, read-only investigation, independent compatibility audit, or final
fresh-context review with disjoint ownership. Every subagent uses low effort by
default and must satisfy the visible-worker contract.

## Global Constraints

- Use the configured low-cost OMP model role and `--thinking low` by default.
- Never select Astra or Fable by default; evidence and low-effort routing are required for an exception.
- Create a Herdr tab only for an independent task with disjoint file ownership; use `--no-focus` and never close user tabs.
- Do not import credentials or overwrite global Claude, Codex, Pi, OMP, or Herdr configuration.
- Do not deploy, push, reset, clean, or mutate an approved check file.
- Graft is optional, local-only, `DO_NOT_TRACK=1`, and must never use `--deep` without a separate approval.

## Review Focus

- A dependent task attempts to spawn a worker and must be rejected before a tab is created.
- Herdr is unavailable or returns an invalid tab/pane response and must yield an actionable failure without fallback to a hidden worker.
- A requested elevated model route omits its evidence reason and must be rejected.
- Skill names collide across discovered roots and must appear as a deterministic collision in the compatibility report.
- A host-only plugin requires credentials or an unavailable API and must be recorded as unsupported, not loaded by OMP.

### Task 1: Produce a deterministic OMP compatibility inventory

**Files:**

- Create: `scripts/agentic/omp-compatibility.mjs`
- Create: `docs/agentic/OMP-COMPATIBILITY.md`
- Test: `scripts/agentic/__tests__/omp-compatibility.test.mjs`

**Interfaces:**

- Consumes: `omp skill list --json`, `omp plugin list --json`, tracked `.agents/`, `.claude/`, `.codex/` paths.
- Produces: a stable Markdown table of capability, source, OMP treatment, collision/exclusion reason, and validation state.

- [ ] **Step 1: Write failing inventory tests** for a portable `SKILL.md`, a duplicate skill name, a project MCP candidate, and a Claude-only command fixture.
- [ ] **Step 2: Run** `node --test scripts/agentic/__tests__/omp-compatibility.test.mjs` and confirm the missing inventory script fails.
- [ ] **Step 3: Implement** `scripts/agentic/omp-compatibility.mjs` to consume JSON when available, scan project-controlled metadata only, classify each item, sort stable rows, and write `docs/agentic/OMP-COMPATIBILITY.md`. It must redact values matching credential-shaped configuration and must not invoke installation commands.
- [ ] **Step 4: Run tests** and a real read-only inventory command; confirm the report records the observed `impeccable` skill collision and host-only entries explicitly.
- [ ] **Step 5: Commit** the inventory script, test, and report.

### Task 2: Add the portable protocol and OMP project configuration

**Files:**

- Create: `docs/agentic/PILOT-LOOP.md`
- Create: `.agents/skills/pilot-loop/SKILL.md`
- Create: `.omp/config.yml`
- Create: `.omp/agents/scout.md`
- Create: `.omp/agents/implementer.md`
- Create: `.omp/agents/reviewer.md`
- Create: `.omp/agents/security.md`
- Create: `.omp/agents/verifier.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `docs/agentic/AGENTIC-WORKFLOW.md`
- Test: `scripts/agentic/__tests__/pilot-loop-assets.test.mjs`

**Interfaces:**

- Consumes: the approved specification, current check directories, and project guardrails.
- Produces: `$pilot-loop`/OMP-readable task guidance and role capsules whose output includes files, commands, evidence, risks, and escalation count.

- [ ] **Step 1: Write failing asset tests** that assert the protocol stages, two-round limit, immutable approved checks rule, OMP low-effort default, Astra/Fable exception rule, and no-production guardrails.
- [ ] **Step 2: Run** `node --test scripts/agentic/__tests__/pilot-loop-assets.test.mjs` and confirm missing assets fail.
- [ ] **Step 3: Implement** the canonical protocol, one concise portable skill pointer, OMP config, and role files. Each role must name its allowed responsibility, inputs, output capsule, and prohibition on unowned writes. Keep `AGENTS.md`/`CLAUDE.md` as short pointers only.
- [ ] **Step 4: Run** the asset test, `omp skill list --json`, and `git diff --check`. Confirm OMP discovers the project skill(s) without requiring a copied user skill tree.
- [ ] **Step 5: Commit** the protocol, OMP configuration/roles, tests, and documentation pointers.

### Task 3: Implement the low-cost routing guard plugin

**Files:**

- Create: `.omp/plugins/wealthme-routing/package.json`
- Create: `.omp/plugins/wealthme-routing/src/index.ts`
- Create: `.omp/plugins/wealthme-routing/src/policy.ts`
- Test: `.omp/plugins/wealthme-routing/src/policy.test.ts`

**Interfaces:**

- Consumes: `{ taskRisk, requestedModel, requestedThinking, reason, repairRound }`.
- Produces: `{ allowed, modelRole, thinking: "low", recordedReason? }` or a specific denial reason.

- [ ] **Step 1: Write failing policy tests** for standard routing, Astra/Fable without a reason, high-effort requests, a permitted high-risk route at low effort, and a third repair round.
- [ ] **Step 2: Run the plugin's focused test command** and confirm the missing policy fails.
- [ ] **Step 3: Implement** pure policy functions in `policy.ts`, then the OMP plugin entry point that exposes the policy to dispatch commands/tool calls. The plugin must use OMP's actual public plugin API discovered during Task 2; it must not run shell commands or read credentials.
- [ ] **Step 4: Run focused tests and OMP plugin validation/dry-run**; verify a default dispatch resolves to the cheap role plus low thinking and invalid escalation returns its reason.
- [ ] **Step 5: Commit** the plugin and its focused tests.

### Task 4: Implement the Herdr visible-worker delegate plugin

**Files:**

- Create: `.omp/plugins/wealthme-herdr-delegate/package.json`
- Create: `.omp/plugins/wealthme-herdr-delegate/src/herdr.ts`
- Create: `.omp/plugins/wealthme-herdr-delegate/src/validate.ts`
- Create: `.omp/plugins/wealthme-herdr-delegate/src/index.ts`
- Test: `.omp/plugins/wealthme-herdr-delegate/src/validate.test.ts`
- Test: `.omp/plugins/wealthme-herdr-delegate/src/herdr.test.ts`

**Interfaces:**

- Consumes: `{ role, taskSlug, capsule, ownedPaths, checksPath, independent, route }`.
- Produces: `{ tabId, paneId, agentName, status, resultPath? }` or a structured failure.

- [ ] **Step 1: Write failing validation tests** for invalid names, missing capsule/checks/owned paths, `independent: false`, duplicate ownership, and elevated routes denied by Task 3's policy.
- [ ] **Step 2: Write failing Herdr client tests** with a mocked process runner covering `tab create --no-focus`, JSON ID parsing, `agent start --kind omp`, prompt/wait sequencing, a Herdr error response, and no command that closes/focuses a tab.
- [ ] **Step 3: Implement** pure input validation and a small Herdr command adapter. The adapter must use current workspace/cwd environment values, parse returned JSON rather than deriving IDs, preserve parent focus, and start OMP with the resolved `--model` and `--thinking low` route.
- [ ] **Step 4: Implement** the OMP plugin command/tool that calls the adapter only after routing and ownership validation. It returns the compact child evidence; it never uses a hidden local subagent fallback.
- [ ] **Step 5: Run focused tests** and inspect emitted command arguments. Confirm every visible-worker invariant in the specification.
- [ ] **Step 6: Commit** the delegate plugin and tests.

### Task 5: Wire OMP/Herdr safely and smoke-test one read-only worker

**Files:**

- Modify: `.gitignore`
- Create: `.omp/mcp.json` only if the compatibility inventory proves a server works without credentials
- Modify: `docs/agentic/OMP-COMPATIBILITY.md`
- Modify: `results.md`

**Interfaces:**

- Consumes: completed project OMP plugins and current Herdr integration status.
- Produces: an installed OMP Herdr lifecycle adapter, local-only OMP project wiring, and verified smoke evidence.

- [ ] **Step 1: Capture preflight evidence** with `herdr integration status`, `herdr config check`, OMP plugin dry-run/doctor, and `git status --short`. Stop if installation would overwrite a user customization.
- [ ] **Step 2: Install the Herdr OMP integration** using `herdr integration install omp`, then rerun status and record the exact changed user-level file. This is the only planned non-project write and occurs after the user-approved spec/plan.
- [ ] **Step 3: Add ignore rules** for OMP runtime/session artifacts only; do not ignore tracked `.omp/` project configuration/plugins.
- [ ] **Step 4: Run a read-only smoke task** through the delegate (for example, inventory a named documentation path). Assert one new unfocused Herdr tab, correct OMP agent detection, no parent-tab focus change, a returned evidence capsule, and no repository edits from the child.
- [ ] **Step 5: Update** the compatibility report and append `results.md` with commands, output summary, any substitution, and remaining host-only items.
- [ ] **Step 6: Commit** project-local wiring and evidence. Do not commit the user-level Herdr integration file.

### Task 6: Add Graft only after the OMP path is proven

**Files:**

- Modify: `.gitignore`
- Modify: `.omp/mcp.json` if OMP supports the local server in the verified configuration
- Modify: `docs/agentic/OMP-COMPATIBILITY.md`
- Modify: `results.md`

**Interfaces:**

- Consumes: a working OMP hub and Graft CLI availability.
- Produces: optional local structural graph use with no telemetry or provider configuration.

- [ ] **Step 1: Run** `DO_NOT_TRACK=1 graft init --dry-run --no-global` and capture the proposed file changes. Stop if it would replace an existing WealthMe hook/statusline or require a paid provider.
- [ ] **Step 2: Configure only the compatible project-local pieces** identified by the dry run, keep `graft/` ignored, and do not run `graft build --deep`.
- [ ] **Step 3: Run** `DO_NOT_TRACK=1 graft build`, `DO_NOT_TRACK=1 graft check`, and one read-only query against a known cross-module concern.
- [ ] **Step 4: Update** compatibility/evidence documents with command output and any skipped integration conflict.
- [ ] **Step 5: Commit** tracked wiring and evidence only.

### Task 7: Run final verification and handoff

**Files:**

- Modify: `results.md`
- Create or modify: `docs/agentic/checkpoints/omp-herdr-pilot.md`

**Interfaces:**

- Consumes: all prior task artifacts and verification evidence.
- Produces: final pass/fail report plus a compact continuation checkpoint.

- [ ] **Step 1: Run** all focused Node/plugin tests, `git diff --check`, `bash scripts/security-check.sh`, and the narrowest relevant project QA checks.
- [ ] **Step 2: Re-run** the OMP read-only visible-worker smoke path and verify parent focus/tab safety one last time.
- [ ] **Step 3: Inspect** the compatibility report for missing current skills/plugins and ensure all exclusions name an actionable host limitation.
- [ ] **Step 4: Append** the real command results and risks to `results.md`; record task, files, verification, and next step in the checkpoint.
- [ ] **Step 5: Commit** the final verified project changes if the user requests a commit; otherwise leave the reviewed working tree intact.

## Plan self-review

- Spec coverage: Tasks 1–7 cover OMP hub, visible Herdr workers, skills/plugins accounting, routing cost controls, check-first flow, Graft, and verification.
- Interface consistency: Task 3 returns a route consumed by Task 4; Task 4 returns visible-worker evidence recorded by Tasks 5 and 7.
- Edge coverage: Review Focus items map to Task 1 collision coverage, Task 3 escalation/round coverage, and Task 4 safety/error coverage.
- Scope: Global user-level mutation is limited to the explicitly required Herdr OMP integration after preflight; all other assets are project-local.
