# Task 3 report — Arc Button browser compatibility

Status: DONE_WITH_CONCERNS

The real `ArcButtonProbe` was verified through the isolated `/legal/arc-probe` harness. The focused Chromium Playwright run passed 4/4 checks: desktop keyboard and state behavior, 390×844 touch geometry, reduced motion, and `/login` CSS isolation. Exact commands, measurements, and sampled token values are recorded in `results.md`.

The existing localhost:3000 DEV stack was a compiled build and returned 404 for the newly created harness route. A temporary Next dev server on localhost:3199 served current source for the browser run and was stopped afterward. Unauthenticated `/beranda` on 3000 redirected to `/login` (307); no unrelated authenticated page was evaluated.

Concerns: the dev server logged a React hydration attribute warning on the probe, which was not investigated under the user's stop instruction. The diagnostic harness is publicly reachable under `/legal/` when included in a future build and needs an explicit lifecycle decision before release. Button is a Batch 1 candidate, subject to resolving those concerns. This probe has no portal, so it supplies no portal compatibility evidence. No production primitive or page was migrated, and `DESIGN.md` was unchanged.

One preliminary browser run failed because Playwright treated the loading button's `aria-disabled` state as disabled for a normal click. The final test uses a dispatched click to verify the loading callback guard and passed. Scoped ESLint and TypeScript checks exited 0. No subagents, deployment, or push occurred.
