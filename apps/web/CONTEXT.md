# apps/web — Context

Next.js 16 App Router frontend. User-facing copy is Indonesian; code
identifiers are English. See `apps/web/WM_CONVENTIONS.md` and `AGENTS.md` for
the port/build conventions this context follows — this file is the
**glossary and current-state summary**, not a duplicate of those.

## Glossary

| Term (Indonesian, as shown to users) | English concept                                                  | Meaning                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Master**                           | Owner (`Member.role = "owner"`)                                  | The head of a family group who created it (or was created as one — see Co-Master below). Full CASL `manage` on every subject in the group.                                                                                                                                                                                                                                 |
| **Co-Master**                        | Second owner, `Member.role = "owner"` + `relationship = "istri"` | A wife added directly by the master (EPIC-024 A1, D1). Identical menu and powers to the master — same `role`, so CASL treats her identically. **Not** a `spouse`-role member (that role/invite flow remains for non-wife cases only). Max 1 co-master per family group, enforced server-side under a `FamilyGroup` row lock (`FamilyGroupsService#createDependantMember`). |
| **Anggota**                          | Member                                                           | Any row in `Member` — the generic term for "someone in this family group," regardless of role.                                                                                                                                                                                                                                                                             |
| **Anak / Operasional**               | Dependant / Operational (`Member.role`)                          | A member with no email of their own, created directly by the master/co-master with a username + initial password (forced password change at first login). Row-scoped: sees only accounts assigned to them (`Account.ownerUserId`).                                                                                                                                         |
| **Rekening**                         | Bank Account                                                     | An `Account` row of `type: "bank"`. Historically every new family got one auto-created ("Akun Utama") — **removed** as of EPIC-024 A6; a family now starts with zero accounts and adds its own.                                                                                                                                                                            |
| **Akun Utama**                       | (legacy) default bank account                                    | The account every registration used to auto-create. No longer created for new registrations (EPIC-024 A6, D5); existing rows are untouched.                                                                                                                                                                                                                                |
| **Permintaan Dana**                  | Allowance/funding request (`AllowanceRequest`)                   | A row-scoped member's request to move money into their account, or a held over-threshold expense awaiting approval. Approved/rejected by an owner/co-master from the dedicated `/persetujuan` page (EPIC-024 A5, D6) — previously a panel buried in account settings.                                                                                                      |
| **Lot / Lembar**                     | Stock quantity units                                             | 1 lot = 100 lembar (IDX convention). Canonical storage is lembar; the investment form accepts either as input (EPIC-024 Group C, not yet implemented as of this task).                                                                                                                                                                                                     |
| **Catat Investasi**                  | "Record investment"                                              | The same create-investment flow used to record an EXISTING holding (buy price, quantity, purchase date) — not a new "buy" transaction type.                                                                                                                                                                                                                                |

## Current state (as of EPIC-024 Group A)

- Family membership: `Member.role` is the **only** axis that grants
  authority; `Member.relationship` is purely descriptive kinship and grants
  nothing on its own — **except** the co-master pairing above, which is the
  one relationship value the API enforces a role constraint against.
- Active-group resolution: unified to **`createdAt: asc`** (oldest
  membership wins) across all three code paths that resolve "the current
  user's active family group" — `apps/web/src/lib/auth.ts` (better-auth
  session hook), `apps/api/src/auth/auth.service.ts` (`getMe` /
  `getProfileDetail` / `updateProfile`), and
  `apps/api/src/family-groups/family-groups.service.ts` (`findMine`). See
  `docs/adr/0001-istri-as-second-owner.md` for why, and its noted residual
  gap for members with a pre-existing self-registered group.
- The `/persetujuan` page is owner/co-master-only (gated by
  `Member.role === "owner"`, both in `lib/nav.ts`'s `ownerOnly` flag and the
  page's own `useMyRole()` check — UI gating only, the API independently
  re-enforces `CheckAbility`).
- Invite-by-email UI is **hidden**, not removed: `FamilyGroupsService`'s
  invitation endpoints (`POST /family-groups/:id/invitations`, accept, etc.)
  are untouched and still reachable directly; only the UI buttons/dialogs
  that reached them (`AddAdminDialog`, the `member` CRUD entity) were
  removed (EPIC-024 A2, D2).
