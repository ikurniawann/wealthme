# WealthMe — Definition of Done

> The cross-project bar every task clears before anyone calls it done. Epics and
> stories supply their own acceptance criteria; this file defines the floor that
> applies regardless of what was built.
>
> Companion documents: [`product/ACCEPTANCE-CRITERIA.md`](product/ACCEPTANCE-CRITERIA.md)
> (how to write criteria) · [`product/USER-STORIES.md`](product/USER-STORIES.md)
> (who wanted it) · [`epics/`](epics/) (the live state of work).

---

## 1. It does what was asked

- Every acceptance criterion for the story or task group passes, checked against
  the criterion as written — not against a convenient reading of it.
- Scope delivered matches scope agreed. Anything left out is stated explicitly,
  with the reason, at the moment of reporting — not discovered later.
- Where a decision was recorded in the epic, the implementation follows it. If
  the decision turns out to be wrong, it is raised and re-decided, not quietly
  reinterpreted.

## 2. It is true

This project has repeatedly shipped screens that stated things that were not
true: a balance sheet that could never fail to balance, a confirmation toggle
that confirmed nothing, an upload that reported success while importing zero
rows. The bar exists because of that history.

- **No control implies a capability it does not have.** A field the API discards,
  a button that only changes a status, a dropdown that can never populate — either
  it works or it is removed.
- **No figure hides its basis.** Manual values carry their entry date. Automated
  values carry their source and delay. Estimates are labelled as estimates and do
  not silently feed authoritative totals.
- **No check is unfalsifiable.** If a screen claims to have verified something,
  there must exist input data that makes that claim fail — and a test that proves
  it.
- **A failed fetch looks different from an empty result**, and a server's error
  message reaches the user instead of being flattened into "coba lagi".

## 3. It is proven, not asserted

- New tests **fail against the pre-change code** for the right reason. A test
  that passes both before and after has proven nothing; say so rather than
  counting it.
- Money paths are verified against hand-computed figures, not against the
  implementation's own output. A test asserting `f(x) === f(x)` is a tautology.
- Where behaviour was verified in a running system, the report states what was
  actually executed and what remains unproven. "It should work" is not
  verification.

## 4. Gates are green

```
bash scripts/qa.sh              # lint + formatting
bash scripts/test.sh            # type-check + build + tests
bash scripts/security-check.sh  # secrets, advisories, destructive patterns
```

- Type-check clean across `apps/api` and `apps/web`.
- Tests run with `--runInBand`; parallel workers segfault on the shared host.
- CI green on the pull request before merge.

## 5. It is safe

- Tenant scoping enforced on every new read **and** every new mutation. A filter
  applied to a list but not to update/delete is not done.
- Permission changes are proven by a test that asserts a **denial**, not only a
  success.
- No secrets committed. Third-party credentials encrypted at rest.
- Migrations are additive and reversible. No `DROP TABLE`, no `TRUNCATE`, no
  `DELETE` without a `WHERE`. Destructive data corrections are stated in the PR
  body before they run.
- Protected foundation paths (`globals.css`, `lib/*`, `components/ui/*`,
  `components/wm/*`, `components/charts/*`, `components/shell/*`, `layout.tsx`)
  are touched only when the task requires it, and the reason is written down.

## 6. It is usable by the people it is for

- Every new user-visible string exists in **both** locales, and the Indonesian
  reads as Indonesian rather than translated English.
- Any dialog that grows with user-added rows can be completed end-to-end at
  390×844 without losing its submit button.
- Actions a role cannot perform are not offered to that role.

## 7. It is written down

- The epic's **Automation Log** records what was decided, what was found, and
  what was left undone. Memory is a cache; the log is the record.
- Findings discovered along the way — including ones nobody asked about — are
  logged rather than silently fixed or silently ignored.
- Documentation affected by the change is updated in the same pull request.

## 8. It is deployed where it belongs

- DEV only, via `scripts/deploy-dev.sh`. Production always requires a human.
- After deploying, the change is verified on the running system, and the
  verification is reported with actual output — not described.

---

## The short version

Ordinary work, finished properly: it does what was asked, it does not lie about
what it did, someone can prove it, and the next person can find out why.
