# EPIC-030: IAM — custom roles, per-member overrides, page access enforced end to end

status: coding
environment: dev
retries: 0

## Goal

`/iam` becomes a conventional IAM screen: the Master decides, per page, who may
**see** or **manage** it — through reusable **custom roles** plus **per-member
overrides** — and decides per role whether its members see **all family data or
only their own**. The decision is enforced in the menu, the route, **and the
API**. A Master's password reset is temporary (member must choose a new one at
next login).

## Evidence (current state)

| Claim                                                                          | Where                                                     |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Nav + role filtering is hardcoded (`ROW_SCOPED_NAV_ALLOWLIST`, `ownerOnly`)    | `apps/web/src/lib/nav.ts:69-282`                          |
| Route guard is UX-only, row-scoped roles only                                  | `apps/web/src/components/auth/row-scoped-route-guard.tsx` |
| API grants are hardcoded per `Role` in CASL                                    | `apps/api/src/casl/casl-ability.factory.ts`               |
| `AbilitiesGuard` fails OPEN on undecorated routes                              | `apps/api/src/common/guards/abilities.guard.ts`           |
| Data scope = `isRowScopedRole(role)` (dependant/operational), ~19 call sites   | `apps/api/src/common/utils/privacy.util.ts`               |
| `Member` has no permission columns; `role` is the only axis                    | `apps/api/prisma/schema.prisma:514-559`                   |
| Guard order: Throttler → BetterAuth → ForcePasswordChange → Tenant → Abilities | `apps/api/src/app.module.ts:128-136`                      |

## Decisions (user-confirmed 2026-09-24)

| #   | Decision                                                                            | Rejected                     |
| --- | ----------------------------------------------------------------------------------- | ---------------------------- |
| D1  | Custom roles (`AccessRole`, per family) **and** per-member overrides                | Roles only / members only    |
| D2  | Per page level: `none` / `view` / `manage`                                          | Single allow/deny checkbox   |
| D3  | Data scope per role: `all` (whole family) / `own` (rows the member owns or created) | Scope fixed by built-in role |
| D4  | Enforced in menu + route + API (403)                                                | UI-only                      |
| D5  | Reset by Master = temporary password (`mustChangePassword`)                         | Final password               |

## Design

- **Page catalog** lives in `@wealthme/contracts` (shared web/API): the configurable pages
  from the nav. Always-open, not configurable: `akun`, `akses-saya`, `notifikasi`
  (personal), `panduan`. **`iam` is Master-only and never grantable** — granting
  IAM would let a member raise their own access.
- **Master (`owner`) is always full access**, cannot be given a custom role.
- **Effective access** = `owner` → everything `manage`, scope `all`; else
  `accessRole.permissions` (or, with no role assigned, the **legacy preset** of
  the member's built-in `role`, which reproduces today's behaviour exactly), then
  member overrides on top. Scope = `accessRole.dataScope` or the legacy one.
  → No member changes behaviour until the Master assigns something.
- **API**: `@PageAccess({ read, write })` on every tenant controller; a global
  `PageAccessGuard` after `TenantGuard` requires `view` on any `read` page for
  GET and `manage` on any `write` page for mutations. Tenant routes without the
  decorator **fail closed** for non-owners; a spec walks every controller so a
  new route cannot ship undecorated. CASL for custom-access members is derived
  from the effective page map.
- **Data scope** flows through `tenantContext.rowScoped` into the existing
  `privacy.util` helpers instead of `isRowScopedRole(role)`.

## Tasks

### A. Temporary reset password

- [x] Reset sets `mustChangePassword: true`; copy says "password sementara"

### B. Model + resolver

- [ ] Page catalog + level/scope schemas in contracts (rebuild `dist`)
- [ ] Prisma: `AccessRole` (name, description, dataScope, permissions JSON), `Member.accessRoleId`, `Member.accessOverrides`; migration
- [ ] `resolveEffectiveAccess()` + legacy presets, unit-tested against today's CASL/nav

### C. API

- [ ] CRUD `family-groups/:id/access-roles`; assign role + overrides to a member; `GET .../me/access`
- [ ] `PageAccessGuard` + `@PageAccess` on every tenant controller; coverage spec
- [ ] Data scope via `tenantContext`; CASL from effective access

### D. Web

- [ ] `useMyAccess()`; sidebar/mobile/route guard driven by effective access
- [ ] `/iam` rebuilt: Roles tab (list/create/edit: page × level matrix + scope), Anggota tab (role assignment, overrides, reset password)
- [ ] UX cleanup (user request 2026-09-24): one clear mental model — "Anggota" first, "Role" second; plain-language labels, no system jargon, no static/decorative matrices that cannot be edited

## Acceptance Criteria

- A member with a role lacking `investasi` gets no menu item, is redirected off `/investasi`, and `GET /family-groups/:id/investments` returns 403.
- `view` on a page allows GET, 403 on POST/PATCH/DELETE; `manage` allows both.
- A role with scope `own` sees only its own accounts/transactions; `all` sees the family's.
- Members with no custom role behave exactly as before this epic.
- Master always has full access; IAM is never grantable.
- A reset password forces a new password at next login.

## Automation Log
