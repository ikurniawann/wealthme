# ADR-0001: Istri (Wife) Is a Second Owner, Not an Invited Spouse

- Status: Accepted
- Date: 2026-08-11
- Epic: EPIC-024 Group A (Design Decision #1, US-FAM-15/16/17)
- Supersedes: EPIC-023 D2/D6, for wives only

## Context

EPIC-023 modeled a spouse as a co-owner _minus_ member management
(`role: spouse`), arriving by email invite like any other invited member.
The product owner reviewed the deployed app and decided this doesn't match
how the household actually works: a wife is 1:1 with the master — same
menu, same powers, including adding/managing other members — and she should
never depend on an email invite to get there (`docs/revisi.txt` items 1, 4,
18; the client's own words: "istri harusnya ditambahkan master user, bukan
di undang").

Three further problems compounded the "wife's account picker only shows her
own Akun Utama" bug (`docs/epics/EPIC-024-client-revisions-aug2026.md`
Evidence #1):

- She had **two family-group memberships** (her own, auto-created at her
  own registration, plus a second one from accepting the husband's
  invite), and
- **three different code paths** resolved "the active family group" three
  different ways (`desc`, no `orderBy`, `asc`), so which group a given
  screen showed her depended on which endpoint it happened to call.

## Decision

1. **`Member(role: owner, relationship: istri)`** — a wife is a genuine
   second owner of her husband's family group. CASL already grants `owner`
   full `manage` on every subject, so **no CASL change was needed** — this
   is a modeling decision, not a permissions decision.
2. **No family group of her own.** Created directly by the master via
   `FamilyGroupsService#createDependantMember` (the same head-created,
   no-email, forced-password-change flow EPIC-023 built for
   dependant/operational members), which never calls `familyGroup.create`.
3. **Max 1 istri per family group**, enforced INSIDE the creation
   transaction by locking the `FamilyGroup` row (`SELECT ... FOR UPDATE`)
   before re-checking for an existing istri member — closing the
   count-then-insert TOCTOU race a naive check would have under concurrent
   requests. See `FamilyGroupsService#createDependantMember`.
4. **Active-group resolution unified to `createdAt: asc`** (oldest
   membership wins) across `apps/web/src/lib/auth.ts`,
   `apps/api/src/auth/auth.service.ts`, and
   `apps/api/src/family-groups/family-groups.service.ts#findMine` — one
   deterministic rule instead of three disagreeing ones.
5. **The `spouse` role and email-invite flow remain in code**, unchanged,
   for non-wife cases (e.g. a genuinely separate arrangement the owner
   still wants to invite by email). They are simply no longer the wife's
   path — `DEFAULT_ROLE_BY_RELATIONSHIP.istri` moved from `"spouse"` to
   `"owner"` (`packages/contracts/src/members/index.ts`).

## Consequences

- A wife created under this ADR has exactly one membership from day one —
  no group-resolution ambiguity is even possible for her.
- **Known residual gap for a wife who predates this ADR** (self-registered,
  then later invited/added to her husband's group): her own,
  earlier-created group is _older_ than her husband's, so the new
  `createdAt: asc` rule still resolves her active group to her own — now
  correctly labeled `role: owner` after the backfill migration
  (`docs/migrations/epic-024-a3-istri-owner-backfill.sql`), but
  still the _wrong_ group for day-to-day use. Closing this fully requires
  either deleting her empty group or reordering membership timestamps —
  neither is done automatically; this is a deliberate, flagged gap for a
  human to resolve per family, not a silent migration decision. The
  backfill migration itself is written but staged **outside**
  `apps/api/prisma/migrations/` (so `prisma migrate deploy` never picks it
  up automatically) and is **not executed** by this task — a real family's
  `role` change requires an explicit human announcement, plus a manual
  copy into a real migration folder, before running it (per the epic's
  autonomy rules; see the file's own header for the exact steps).
- `AddDependantMemberDialog` (`apps/web/src/app/(app)/akun/page.tsx`) is the
  single UI surface for adding an istri co-master — its role picker
  includes "Istri (Co-Master)", which forces `relationship: istri` in
  lockstep (the API independently re-enforces the pairing regardless of
  what the UI sends).

## Alternatives Considered

- **Keep `role: spouse` but grant it `manage Member`.** Rejected — the
  owner's decision is explicitly 1:1 parity, and reusing `spouse` would
  keep the email-invite dependency the owner asked to remove for wives
  specifically.
- **A shared "household owner" role distinct from both `owner` and
  `spouse`.** Rejected as unnecessary complexity — `owner` already means
  exactly what's needed, and CASL has no other consumer that needs to tell
  a master and a co-master apart.
