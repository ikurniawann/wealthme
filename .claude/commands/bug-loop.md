---
description: Autonomous bug-fix loop — diagnoses root cause, applies minimal fix, runs full ECC review + security + test gates, loops up to 3 attempts, then commits on success.
argument-hint: "[bug description | error message | file:line | 'auto']"
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Task
---

# /bug-loop

Autonomous bug-fix orchestrator. Maximizes the full ECC agent stack:

```
Triage → Root Cause Analysis → [Fix → Review → Security → Test] × ≤3 → Commit
```

Arguments: **$ARGUMENTS**

- A bug description, error message, or `file:line` hint
- `"auto"` or empty → auto-detect from current build/test errors

---

## Phase 0: Triage

### 0a. Collect signals (run these in parallel)

```bash
git status --short
git diff --stat HEAD
```

Then run the project's error surface check (whichever applies):

- `scripts/test.sh 2>&1 | tail -60` if it exists
- `npx tsc --noEmit 2>&1 | head -40` for TypeScript projects
- `npm run build 2>&1 | tail -40` for Next.js / Vite projects
- `cargo build 2>&1 | tail -40` for Rust projects

If ARGUMENTS contains an explicit error message or file path, use that as the primary signal.

### 0b. Classify bug type

| Signal                              | Type           | Primary fixer                              |
| ----------------------------------- | -------------- | ------------------------------------------ |
| TypeScript / tsc errors             | `BUILD_TS`     | `ecc:build-error-resolver`                 |
| Next.js / React build failure       | `BUILD_REACT`  | `ecc:react-build-resolver`                 |
| Go build failure                    | `BUILD_GO`     | `ecc:go-build-resolver`                    |
| Rust build failure                  | `BUILD_RUST`   | `ecc:rust-build-resolver`                  |
| Dart/Flutter build failure          | `BUILD_DART`   | `ecc:dart-build-resolver`                  |
| Django/Python startup failure       | `BUILD_DJANGO` | `ecc:django-build-resolver`                |
| Java/Gradle/Maven failure           | `BUILD_JAVA`   | `ecc:java-build-resolver`                  |
| Kotlin build failure                | `BUILD_KOTLIN` | `ecc:kotlin-build-resolver`                |
| Runtime logic error, wrong output   | `LOGIC`        | `bug-fixer` agent                          |
| Swallowed error / silent failure    | `SILENT`       | `ecc:silent-failure-hunter` → `bug-fixer`  |
| Test failure (implementation wrong) | `TEST`         | `bug-fixer` agent                          |
| Security vulnerability              | `SECURITY`     | **STOP** — report to user, do not auto-fix |

If ambiguous, classify as `LOGIC`.

---

## Phase 1: Root Cause Analysis

Run these agents **IN PARALLEL** — they are independent reads:

1. **`ecc:silent-failure-hunter`** — swallowed errors, bad fallbacks, missing propagation in touched files
2. **File-type reviewer** (analysis pass only — no fix yet):
   - `.tsx/.jsx` files → `ecc:react-reviewer` ("analyse root cause only, no architectural proposals")
   - `.ts/.tsx` files → `ecc:typescript-reviewer` (same instruction)
   - `apps/api` NestJS files → `nestjs-best-practices` skill
   - `.go` files → `ecc:go-reviewer`
   - `.rs` files → `ecc:rust-reviewer`
   - `.py` files → `ecc:python-reviewer`

Aggregate outputs into a **Root Cause Summary**:

```
BUG_TYPE: <type from 0b>
AFFECTED_FILES: <list with line ranges>
ROOT_CAUSE: <one paragraph — what fails, why, invariant violated>
FIX_HYPOTHESIS: <minimal change that should fix it>
CONFIDENCE: HIGH | MEDIUM | LOW
```

If `CONFIDENCE: LOW` → run `mcp__plugin_ecc_sequential-thinking__sequentialthinking` to reason through the problem before proceeding.

---

## Phase 2: Bounded Fix Loop (attempt 1..3)

### a. Fix

Route to the appropriate agent via Task:

| BUG_TYPE                    | Agent                                              |
| --------------------------- | -------------------------------------------------- |
| `BUILD_TS`                  | `Task(subagent_type: "ecc:build-error-resolver")`  |
| `BUILD_REACT`               | `Task(subagent_type: "ecc:react-build-resolver")`  |
| `BUILD_GO`                  | `Task(subagent_type: "ecc:go-build-resolver")`     |
| `BUILD_RUST`                | `Task(subagent_type: "ecc:rust-build-resolver")`   |
| `BUILD_DART`                | `Task(subagent_type: "ecc:dart-build-resolver")`   |
| `BUILD_DJANGO`              | `Task(subagent_type: "ecc:django-build-resolver")` |
| `BUILD_JAVA`                | `Task(subagent_type: "ecc:java-build-resolver")`   |
| `BUILD_KOTLIN`              | `Task(subagent_type: "ecc:kotlin-build-resolver")` |
| `LOGIC` / `TEST` / `SILENT` | `Task(subagent_type: "bug-fixer")`                 |

Always pass the fixer:

- Root Cause Summary (from Phase 1)
- Prior gate findings if attempt ≥ 2 — every CRITICAL/HIGH finding with file + line
- Relevant file paths

### b. Review Gate (parallel — based on changed file types)

Run **in parallel** for the file types that changed:

| Changed files                   | Agent                         |
| ------------------------------- | ----------------------------- |
| `.tsx/.jsx`                     | `ecc:react-reviewer`          |
| `.ts/.tsx`                      | `ecc:typescript-reviewer`     |
| `apps/api` with NestJS patterns | `nestjs-best-practices` skill |
| `.go`                           | `ecc:go-reviewer`             |
| `.rs`                           | `ecc:rust-reviewer`           |
| `.py`                           | `ecc:python-reviewer`         |
| `.dart`                         | `ecc:flutter-reviewer`        |
| `.java`                         | `ecc:java-reviewer`           |
| Always                          | `ecc:code-reviewer`           |

**FAIL** on any `CRITICAL` or `HIGH` finding, or `VERDICT: FAIL`.

### c. Security Gate

Run `ecc:security-reviewer` on changed files.

- **CRITICAL** → STOP; report to user; do NOT commit. Security must be human-reviewed.
- **HIGH** → treat as FAIL; return to fix with the finding attached.
- **MEDIUM / LOW** → log as warning; continue.

### d. Test Gate

Run `Task(subagent_type: "test-agent")` → executes `scripts/qa.sh` then `scripts/test.sh`.

If those scripts don't exist, fall back to the project-appropriate runner:

- `npx tsc --noEmit` (TypeScript check)
- `npm test`, `cargo test`, `go test ./...`, `pytest`, etc.

**Build/compile failure in test gate** → route to `ecc:react-build-resolver` or `ecc:build-error-resolver`, then re-run gates (does not increment attempt counter — it's a fixup pass).

### e. Regression test (recommended for LOGIC / TEST / SILENT bugs)

If no existing test covered the broken path, ask `Task(subagent_type: "ecc:tdd-guide")` to write a minimal regression test. Include it in the commit if written.

### f. Loop control

```
all gates PASS  → proceed to Phase 3
any gate FAILS  → collect ALL findings → attempt += 1 → return to Phase 2a
attempt > 3     → proceed to Phase 4 (blocked)
```

---

## Phase 3: Commit (on success)

Commit with:

```
fix: <one-line description of what was fixed>

Root cause: <one sentence>
Fixed by: <agent(s) that applied the fix>
Validated by: <ECC agents that passed>
Attempts: <n>
```

Print a final summary table:

| Phase           | Agent(s)                                     | Verdict                |
| --------------- | -------------------------------------------- | ---------------------- |
| Root Cause      | ecc:silent-failure-hunter + reviewer         | Finding: ...           |
| Fix (attempt N) | bug-fixer / build-resolver                   | Applied: files changed |
| Review Gate     | ecc:react-reviewer + ecc:code-reviewer + ... | PASS                   |
| Security Gate   | ecc:security-reviewer                        | PASS                   |
| Test Gate       | test-agent                                   | PASS                   |

---

## Phase 4: Blocked (after 3 failed attempts)

Do **NOT** commit. Print:

```
## BLOCKED after 3 attempts

BUG_TYPE: <type>
LAST_GATE_FAILED: <gate name>

### Unresolved findings:
<list every CRITICAL/HIGH finding that recurred across attempts>

### Recommended action:
<human-readable suggestion>
```

---

## Hard limits (never override)

- Never commit if Security Gate has a CRITICAL finding.
- Never weaken or skip tests to make them pass.
- Never hardcode secrets or credentials.
- Never deploy, push, or force-push.
- Never modify: `globals.css`, `lib/*`, `components/ui/*`, `components/wm/*`, `components/charts/*`, `components/shell/*`, `layout.tsx`.
- If the fix requires architectural changes → report to user and stop.
