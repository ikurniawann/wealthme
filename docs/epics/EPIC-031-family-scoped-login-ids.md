# EPIC-031: Family-scoped login IDs (`nama@kodekeluarga`) + optional email for Master-created members

status: review
environment: dev
retries: 0

## Goal

Two families must be able to both have a member called `budi`. Members a
Master creates sign in as `<username>@<kode keluarga>` (e.g. `budi@arsandi`);
the username only has to be unique inside the family. A Master-created
member may also have a real email, so they can sign in by email and use
"Lupa Password" too.

## Decisions (user-confirmed 2026-09-24: option 2 + email case)

| #   | Decision                                                                                                                                                                                                                 | Rejected                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| F1  | `FamilyGroup.handle` ("kode keluarga"): unique, 3–24 `[a-z0-9-]`, no dot (a login ID can never look like an email). Master can rename it; every Master-created `x@old` login is rewritten to `x@new` in one transaction  | Global usernames + suggestions                         |
| F2  | Store the full login ID in `User.username`, so better-auth's own `/sign-in/username` works unchanged                                                                                                                     | Custom sign-in endpoint with (handle, username) lookup |
| F3  | Legacy plain usernames (before EPIC-031) keep working, untouched                                                                                                                                                         | Forced migration of existing logins                    |
| F4  | "Created by this family's Master" is explicit: `User.managedByFamilyGroupId` (backfilled from the synthetic-email logins). Master reset-password is allowed for those, with or without an email, and only by that family | Inferring from the synthetic email                     |
| F5  | Self-service username writes (`/sign-up/email`, `/update-user`) may not contain `@`, so nobody can squat another family's namespace                                                                                      | —                                                      |
| F6  | Login: `nama@kode` works in the Username tab and is auto-detected in the Email tab                                                                                                                                       | Separate "family code" input                           |

## Tasks

- [x] Contracts: `FAMILY_HANDLE_PATTERN`, `LOGIN_USERNAME_PATTERN`, `buildFamilyLoginId`, `isFamilyLoginId`, `slugifyHandleBase`
- [x] Migration `20260924150000_epic031_family_login_handle` (additive + backfill of handles and managedBy)
- [x] API: login ID on member creation, optional email (409 `EMAIL_TAKEN`), `GET/PATCH family-groups/:id/login-handle`, reset-password gated on managedBy
- [x] better-auth: username plugin accepts `x@kode` (max 55); before-hook blocks `@` in self-set usernames
- [x] Web: login page, add-member dialog (`@kode` suffix + optional email), roster shows username and email, "Kode keluarga" card with rename

## Acceptance Criteria

- Families A and B can each create `budi`; they sign in as `budi@a` / `budi@b`.
- A member created with an email can sign in with that email or `budi@kode`, and use Lupa Password.
- Renaming the kode keluarga keeps every Master-created member able to sign in with the new code.
- Existing plain-username members sign in exactly as before.

## Automation Log

### 2026-09-24 — implemented (Claude Code), stacked on EPIC-030 / PR #328
