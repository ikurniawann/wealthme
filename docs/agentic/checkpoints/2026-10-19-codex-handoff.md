# Handoff — Kas / Dark / Investasi / Aset / Asuransi plan (2026-10-19)

Claude Code ran out of usage mid-plan. Codex continues **sequentially in the
primary session** (no Claude subagents, no slash commands).

## Sources of truth (read in this order)

1. Plan: `docs/superpowers/plans/2026-10-19-kas-dark-investasi.md` — 26 tasks,
   each `### Task N`. Its **Global Constraints** section is binding.
2. Ledger: `.superpowers/sdd/2026-10-19-kas-dark-investasi/progress.md`
   (git-ignored, on disk). Every `Task N: complete` line = done; never redo.
   Every `Ruling:` line = binding decision. `minor (deferred)` lines = fix
   list for the final review. Append your own progress lines there.
3. Extra binding rules: `.superpowers/sdd/2026-10-19-kas-dark-investasi/global-constraints.md`
   (adds the NestJS DI import rule) and `investasi-rulings.md` (R1–R10).
4. Specs (logic authority) + audits: `docs/superpowers/specs/2026-10-19-{investasi,aset,asuransi}.md`
   and `…-audit.md`. Reference images: `docs/design/refs/2026-10-19/`.
5. Per-task reports from Claude subagents:
   `.superpowers/sdd/2026-10-19-kas-dark-investasi/task-{1..8}-report.md`.

## State

- Done & reviewed: Tasks 1–7 (Kas form, reconcile dialog, /dana page, dark
  lift, Investasi schema+migrations, platform accounts/pockets API, ledger
  engine). Plus a controller fix to the /dana "Tambah akun" menu (717e6693).
- **Task 8 (valuation service, b3b5ff87): implemented, review NOT done.**
  Start here: review `git diff 717e6693..b3b5ff87` against the Task 8 brief,
  R8/R10 and `task-8-report.md`; fix any real issue; then append
  `Task 8: complete (...)` to the ledger.
- Next: Tasks 9–15 (Investasi web), 16–20 (Aset), 21–25 (Asuransi),
  26 (all tests + browser verification). Tests are written/run ONLY in
  Task 26 (user instruction); implementation tasks verify with `tsc` + eslint.

## Environment

- Branch `development`, commit directly, **never push**, never
  `git commit -a` / `git add -A` (tree holds unrelated user WIP:
  `.claude/agents` deletions, `deploy/`, `scripts/`, docs, `results.md`,
  `skills-lock.json`). Stage explicit paths; check `git show --stat HEAD`.
- Commit trailer used so far (keep or replace with your own host's):
  `Co-Authored-By: …` / `Claude-Session: …` — see global-constraints.md.
- Dev runs on the host, not containers:
  - API: `cd apps/api && set -a && . <devrun>/api.env && set +a && npx nest start --watch` (port 4100)
  - Web: `cd apps/web && set -a && . <devrun>/web.env && set +a && npx next dev -p 3100 -H 0.0.0.0`
  - env files live in `/tmp/claude-1000/-home-wit-WORK-vibes-wealthme-web/dd2d140b-ea4c-4be6-9b67-737e82a5acfd/scratchpad/devrun/` (`api.env`, `web.env`); if `/tmp` was cleared, rebuild them from `.env.example` + the dev DB container env — never print secrets.
  - nginx reaches them via socat relays `wm-dev-api-relay` / `wm-dev-web-relay`.
  - Known issue: after `cd packages/contracts && npx tsup`, the nest watch
    caches stale declarations (new routes 404, "Found N errors") → restart
    the API process. Check `curl http://127.0.0.1:4100/health` → 200.
- DB: Postgres container `wealthme-web-postgres-3`. Apply new migrations with
  `npx prisma migrate deploy` (env from api.env) **after** a
  `pg_dump -Fc` backup into the devrun folder. Never hand-apply DDL, never
  `migrate reset`.
- Pre-commit hook runs `eslint --fix`: it rewrites Nest constructor-injected
  classes to `import type` and the API dies at boot. Keep them value imports
  with `// eslint-disable-next-line @typescript-eslint/consistent-type-imports`.
- `packages/contracts/dist` is committed: rebuild + commit after editing src.
- Browser check script pattern: `apps/web/.audit-tmp/kw-menu.mjs`
  (Playwright, `--host-resolver-rules` with the IPv4 from
  `getent ahostsv4 wealthme.demo-wit.id`, login demo@wealthme.id / demo1234).

## Known follow-ups already observed (fold into the relevant task)

- /dana at 1440px: filter bar wraps to 2 rows; GoPay row shows a generic
  wallet tile instead of the brand (provider lookup); summary shows Rp 0 on
  load error instead of "—".
- Page background in dark mode (#09090a, protected `globals.css`) may still
  feel too dark — needs a reviewed foundation change if the user asks.

## Reply style

User reads Indonesian, plain and simple ("pakai bahasa sederhana").
