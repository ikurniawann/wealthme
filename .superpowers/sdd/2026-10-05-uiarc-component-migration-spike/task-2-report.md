# Task 2 report — isolated Arc Button compatibility probe

Status: DONE_WITH_CONCERNS

## Scope and implementation

- `apps/web/components.json`: registered the public `@uiarc` namespace without changing the existing registry.
- `apps/web/src/components/arc-probe/`: added an isolated adapter of the documented free Arc Button, its local CSS module and motion tokens, a `ArcButtonProbe` wrapper, and a focused Jest test. No production page or existing UI primitive imports the probe. The adapter uses WealthMe semantic tokens and a local CSS module; Arc's global foundation stylesheet was not imported.
- `results.md`: appended this task's evidence.

The wrapper exports `ArcButtonProbe({ label, disabled?, loading?, onClick? })`. It retains the supplied label as the button's accessible name. Disabled uses the native button attribute. Loading keeps focus, exposes `aria-busy` and `aria-disabled`, prevents activation, and adds a live status reading `Memproses <label>`. Enter and Space use native button activation. The button's press motion is disabled when the free Arc source's reduced-motion hook reports a preference, and the scoped spinner CSS stops under the corresponding media query.

Free source and API evidence: `https://uiarc.dev/components/button/markdown`, `https://uiarc.dev/r/button.json`, and `https://uiarc.dev/r/arc-foundation.json`. The public registry marks Button as free and declares `motion` and `arc-foundation`. No Pro source was used.

## Dependency preflight and repair

At task start, `test -d apps/web/node_modules/motion` reported missing. `pnpm --filter web exec tsc --noEmit` failed on 19 existing `motion/react` imports. Both `apps/web/package.json` and `pnpm-lock.yaml` already declared `motion@^13.4.5`. `pnpm install --filter web --frozen-lockfile` restored the local package link. A second package check reported present, and TypeScript passed. No tracked manifest or lockfile repair was required; therefore there was no dependency change to commit separately. No fake declarations or production mocks were added.

## Verification

- `pnpm --filter web exec jest src/components/arc-probe/arc-button-probe.test.tsx --runInBand`: 1 suite, 6 tests passed. Cases cover label, native disabled behavior, loading state and focus, Enter, Space, and a reduced-motion press check.
- `pnpm --filter web exec eslint src/components/arc-probe apps/web/components.json`: failed because the JSON path is repo-relative while the command runs within `apps/web`. Corrected command with `components.json`: 0 errors, one warning that JSON is ignored by ESLint. The TSX and TS files linted cleanly.
- `pnpm --filter web exec tsc --noEmit`: passed after frozen-lockfile install.
- `pnpm exec prettier --check apps/web/components.json apps/web/src/components/arc-probe`: found formatting differences; formatted these scoped files.
- Static import scan of `arc-probe/`: no imports from pages or existing production `ui`, `wm`, `shell`, or `charts` components.
- `git diff --check`: see final commit verification.

## Concerns

- jsdom does not apply CSS media queries or provide a browser animation timeline. The reduced-motion test is a focused press regression check; Task 3 should confirm the visual motion branch and token appearance in a browser.
- The task brief's lint command has an incorrect JSON path for the filtered package context, and the repository ESLint configuration does not lint JSON. TypeScript, Jest, and TS/TSX lint covered the implementation; `components.json` retains valid JSON syntax.
- Existing unrelated deletions under `.claude/agents` and `.claude/hooks`, plus the untracked PDF, were present before this task and remain outside the commit.

Escalation: none. No subagents were spawned. No deployment or push occurred.
