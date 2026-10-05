# Task 1 report — WealthMe Arc UI shared component map

Status: DONE

## Scope and outcome

Created `docs/architecture/uiarc-component-map.md` and appended one evidence
entry to `results.md`. The map covers every production file in
`apps/web/src/components/ui/`, `wm/`, `shell/`, and `charts/`, including the
nested `ui/ai-chat-card-utils/use-typewriter.ts` hook (66 files; tests
excluded), with public exports, Arc candidate, catalog tier, one required
decision (`adopt`, `adapt`, `retain`, `replace-with-free`, or `prohibited`), a
reason/risk, representative consumers, and a focused verification owner.
No source/product code was changed.

Arc evidence came from the public machine-readable `catalog.json`, `llms.txt`,
and per-candidate Markdown references. The catalog snapshot was generated
2026-10-04 and reports 234 items, 127 free. All required minimum candidates
were verified as free. No Pro entitlement was evidenced, so Pro-only items are
prohibited and no Pro source was accessed or copied. A single Scroll area
Markdown request failed; the catalog metadata says free and dependency-free,
and the map notes this evidence limitation. Arc's documented shared foundation
and possible global token collisions are recorded as a migration risk. Per the
approved spec, `apps/web/DESIGN.md` was non-blocking and was not changed.

## Verification

- Component/file and import scans: task-specified `rg` commands. Initial scan
  found 82 files including colocated tests and 241 references across 120 TS/TSX
  files; the map scope contains 66 non-test source files.
- Completeness checker: `production_files=66 mapped_files=66 table_rows=92
missing=0 extra=0 incomplete_or_invalid=0 bento_exports=25/25`.
- `git diff --check`: PASS (exit 0; no output).
- No application tests were run because this task changes inventory
  documentation only and the task brief requires the completeness check.

## Changed files and delivery

- `docs/architecture/uiarc-component-map.md`
- `results.md` (append-only evidence)
- `.superpowers/sdd/2026-10-05-uiarc-component-migration-spike/task-1-report.md`

Commit: `649b5bd026f003ad57786d72dd404f5bc55b1977` (`docs: map WealthMe components to Arc UI`).

## Concerns / follow-up

- Arc's global foundation CSS can collide with WealthMe tokens/styles; keep the
  scoped compatibility spike ahead of any global import.
- Arc catalog availability alone does not establish parity for WealthMe's
  Base UI composition, financial precision/formatting, locale, authorization,
  mobile shell, chart labels, or reduced-motion contracts. The map assigns
  focused verification ownership for subsequent implementation.
- Existing worktree deletions under `.claude/agents` and `.claude/hooks`, and
  untracked `Revisi WealthMe-1.pdf`, predated this task and were excluded from
  its commit.

Escalation: none. No subagents were spawned.

## Round 1 repair report — 2026-10-05

Addressed all four review findings:

1. Split all 25 named exports from `wm/bento.tsx` into individual mapping rows,
   each with its own candidate, decision, risk, consumers, and verification
   owner.
2. Added separate `prohibited` rows for the Pro-only dock candidate and
   `retain` rows for WealthMe navigation in `sidebar-sections.tsx` and
   `sidebar.tsx`.
3. Added `ui/ai-chat-card-utils/use-typewriter.ts`, including `useTypewriter`,
   `UseTypewriterOptions`, `UseTypewriterResult`, and `TypewriterPhase`.
4. Updated the original results entry to record `git diff --check` as passed.

Commands and output:

- Focused Python completeness check recursively enumerating non-test files in
  `ui/`, `wm/`, `shell/`, and `charts/`; validating all eight row fields,
  decision vocabulary, exact file coverage, nested hook inclusion, and
  distinct rows for each Bento export:
  `production_files=66 mapped_files=66 table_rows=92 missing=0 extra=0 incomplete_or_invalid=0 bento_exports=25/25`.
- `git diff --check` — PASS (exit 0; no output).
- No product code changed; no application tests were required for this
  documentation-only correction.
