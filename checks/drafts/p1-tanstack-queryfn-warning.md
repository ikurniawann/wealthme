# Task: Fix repeated TanStack Query "No queryFn was passed" console error

Source: `docs/audits/ui-ux-audit.md` finding P1-3.
Root cause (confirmed live): `apps/web/src/hooks/use-my-access.ts:77-86` —
`useBalancesHidden()` calls `useQuery({ queryKey: [...myAccess(id), token], enabled: false })`
with no `queryFn`, intending to only _read_ the cache that the always-mounted sidebar's
`useMyAccess()` fills, never fetch on its own. TanStack Query v5 still validates for a
`queryFn` at observer-creation time even when `enabled: false`, so it logs the warning
on every mount (confirmed live: 6 identical console errors immediately after login on
`/beranda`, key `["familyGroups","seed-fg-demo","access","me",<uid>]`). The fix is
`queryFn: skipToken` (TanStack's documented sentinel for "never fetch, cache-read only"),
not changing `enabled` or adding a real fetcher.

Scope: `apps/web/src/hooks/use-my-access.ts` only. No API changes, no change to
`useMyAccess`'s own fetching query (only `useBalancesHidden`'s cache-read query).

## Acceptance checks

### Check 1 — no queryFn warning on page load

- **Setup:** `playwright-cli` session, authenticated (demo account), fresh load of
  `/beranda`.
- **Action:** read console messages after load.
- **Expected:** zero "No queryFn was passed" errors.
- **Command:**
  ```
  playwright-cli -s=audit console
  ```

### Check 2 — `useBalancesHidden` still reflects the cache correctly (regression guard)

- **Action:** confirm `useBalancesHidden()` still returns `data?.balancesHidden === true`
  once `useMyAccess()` has populated the shared cache entry (same queryKey).
- **Expected:** behavior unchanged — code review confirms `skipToken` only removes the
  eager-fetch validation; it does not disable cache reads via the shared queryKey.
- **Command:** manual review of the diff.

### Check 3 — no new lint/type errors

- **Command:** `pnpm --filter web exec tsc --noEmit` (or project's existing type-check
  gate) scoped to the touched file.

## Out of scope

- `useMyAccess`'s own query (already has a correct `queryFn`).
- Any other backlog task.
