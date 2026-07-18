# EPIC-015: Product Integrity & Trust Pass

status: ready-for-qa
environment: dev
retries: 0
verified: 2026-07-13
phase: 4
priority: P0
area: Backend + Frontend
source: `/nerve` project-state audit 2026-07-13

## Goal

Make active WealthMe flows truthful and durable: user actions persist to the
correct financial records, pages do not present demo data as live data, and
new-user onboarding reaches usable actions without a stale tenant session.

## Tasks

- [x] ### A — Replace misleading UI state with live or explicit unavailable state
  - Resolve a new user's family group from `/auth/me` when the session was
    created before their membership row was visible.
  - Treat API `204 No Content` as a successful mutation so list queries refresh.
  - Remove seeded-looking placeholder values from Tax, Donation, and
    Reconciliation views; show empty/unavailable states instead.
  - Clamp the summary savings-rate gauge and safely render decimal investment values.
- [x] ### B — Preserve financial integrity for automated and linked flows
  - Add opt-in auto-advance fields plus a daily BillingCycle worker for liability
    due dates and insurance renewals.
  - Link an optional donation source account to a real expense transaction and
    update account balance atomically on create, update, and delete.
  - Cover linked-donation updates and quarterly billing-boundary advancement with
    unit tests.
- [x] ### C — Make first-use actions actionable
  - Extend the walkthrough to open the relevant add modal from the guided CTA.
  - Add tour hooks for accounts, assets, investments, liabilities, insurance,
    and budgets; ensure CRUD forms await their real submit handlers.
- [x] ### D — Regression, security, and DEV stack verification
  - [x] Run monorepo lint, build, test, and security gates.
  - [x] Run browser E2E against an available DEV stack; promote or remove
        temporary QA artifacts before commit.

## Acceptance Criteria

- Changing or deleting a donation linked to an account leaves account balance,
  transaction record, and donation record consistent.
- A renewal that lands exactly at the current worker time advances into a future
  cycle, never remaining due now.
- Empty production data is distinguishable from demo data; failed-session UI
  explains that it is not ready instead of silently no-oping.
- All static gates pass with no high or critical dependency advisories.

## Test Plan

- Unit: `donations.service.spec.ts` verifies linked donation update atomicity;
  `billing-cycle.processor.spec.ts` verifies quarterly date advancement.
- Static: `pnpm turbo run lint`, `pnpm turbo run build`, and `pnpm turbo run test`.
- Browser: run the retained critical-flow E2E specifications once PostgreSQL,
  Redis, API, and web DEV services are available.

## Automation Log

- 2026-07-13 — `/nerve` normalized the untracked cross-cutting work into this
  epic. Lint passed; initial build passed after allowing the normal Next.js font
  fetch. Added RED→GREEN regression coverage for linked donation updates and
  billing boundary dates. Dependency overrides upgraded `ws` to 8.21.0 and
  `multer` to 2.2.0; security scan reports no high/critical advisories. Final
  gates: lint PASS; production build PASS; API tests PASS (14 suites, 90 tests);
  security PASS. Browser E2E is deferred to human QA: Docker daemon is absent,
  PostgreSQL `127.0.0.1:5432` does not respond, and Redis CLI is unavailable.
  Status → `ready-for-qa`.
- 2026-07-13 — `/agentic-start` re-verified against a live DEV stack (docker
  compose web/api/postgres/redis/minio/mailhog all up). Re-ran `scripts/qa.sh`,
  `scripts/test.sh` (14 suites, 90 tests), `scripts/security-check.sh` — all
  PASS, matching the prior static-gate run with no regressions. Promoted the
  four ad-hoc `tmp-*.spec.ts` verification scripts into permanent specs under
  `apps/web/tests/e2e/pages/` (`epic-015-204-delete-refresh`,
  `epic-015-new-user-session`, `epic-015-investasi-edit-liability`); dropped
  the screenshot-only `tmp-layout-check.spec.ts` (no assertions). Ran all three
  against the live stack: 2 passed immediately, 1 failed on a test-authoring
  bug (assumed a plain sibling "Hapus" button on `/rekening`, but delete is
  behind the account card's kebab dropdown menu) — fixed the locator, re-ran,
  all PASS. Task D fully closed.
  Separately audited the rest of the app for the same class of issue
  (dummy data / non-functional UI) beyond this epic's original three pages —
  see the Automation Log entry below once the audit agent reports back.
- **2026-07-18 — /nerve "PR #171 merged".** PR #171 (bundled EPIC-015 trust-pass fixes with
  EPIC-012/014) merged to `development` at `0747a1e`. Merge blocker resolved. Still `ready-for-qa`
  pending human QA sign-off (per `CLAUDE.md` "What Remains Manual") before promotion to `done` + archive.
