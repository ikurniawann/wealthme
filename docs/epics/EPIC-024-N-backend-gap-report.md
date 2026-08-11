# EPIC-024 — Task N Backend Gap Report

**Purpose:** Task N (the static-HTML UI/UX prototype) is done — N1 delivered (35
pages), N2 approved by the owner on 2026-08-11 (see the epic's Automation Log).
This report is the read-only follow-up commissioned in the same session: an
independent, page-by-page audit of every prototype page against the real
`apps/web` frontend and `apps/api` backend, so a future session can start
Groups A–M / N3 with an accurate map instead of re-discovering gaps mid-task.

**No application code was changed to produce this report.** Seven parallel
read-only sub-agents each audited a cluster of pages (grouped by EPIC-024
task group) directly against source: the prototype HTML, the matching
`apps/web` page, and the relevant `apps/api` controllers/DTOs/`schema.prisma`.
Every finding below carries `file:line` evidence — none are inferred.

## Executive summary

| Status  | Count | Meaning                                                                                                                 |
| ------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| EXISTS  | 70    | Feature the prototype depicts is already wired end-to-end in the real app + API                                         |
| PARTIAL | 28    | UI or API exists but not both, or the flow is incomplete                                                                |
| MISSING | 115   | No backend support at all — matches the epic's own Evidence for items already known, plus prototype-specific gaps below |

These counts are **not** "115 bugs to fix" — the epic's Groups A–M already
plan to build most of this; MISSING here largely confirms the epic's own
Evidence section was accurate and the prototype consistently drew the
_target_ state, not the current one (as its README says it would).

**What's new here, beyond what the epic already documented:** each audit
agent was asked to flag prototype features that no existing task (A1–N3)
covers — genuine scope creep from the prototyping session, or real gaps the
original code audit didn't have visibility into because the prototype didn't
exist yet. These are the highest-value findings — they need a decision
(fold into an existing task, spin up a new one, or cut from the port) before
N3 starts:

- **Group A (family/roles):** several prototype features have no task and, in
  most cases, no schema support — see `gap-group-A.md` "Ordered by risk"
  section below for the itemized list (this file's own agent flagged it as
  the highest-risk group).
- **Group B (PIN/auth):** head-resets-a-member's-password is _promised in the
  prototype's own copy_ on two pages with **zero backend** — a dependant who
  forgets a temporary password is permanently locked out. Session/device
  revocation on password reset is likewise promised, unimplemented, and
  security-relevant.
- **Group C (investasi):** a manual "Perbarui Harga" refresh button, a
  family-level "last sync" timestamp, a "Perubahan Hari Ini" day-delta card,
  and a 12-month price sparkline are all depicted but unscoped by C1–C4.
- **Group E/F (pajak/split bill):** a tax-year selector (real page hardcodes
  the current year) and a save-confirmation dialog are outside E1's wording;
  a claim-gating check on a payout-less split bill is a real data-integrity
  gap F1–F3 never mentions.
- **Group G (liabilitas):** G1 undersells its own scope — the amortisation
  schedule and payment-split preview the prototype shows need new backend
  work, not just "UI wiring" as the task title claims.
- **Group H (warisan):** `extractApiErrorMessage` (the helper H1 says to use)
  isn't actually a shared utility yet — it's duplicated per-page, and
  `apps/web/src/lib/*` is a protected path.
- **Group J (master data):** J1's schema can't round-trip fields the existing
  CRUD forms already collect (bank code, transaction direction), and nothing
  in J1 rewires the hardcoded option arrays (`crud-config.ts`) that forms
  actually read from — as scoped, J1 would ship a master-data page whose data
  nothing else uses.
- **Group M / misc:** `panduan.html`'s "Hubungi Kami" support-ticket dialog
  and `asuransi.html`'s premium-history chart are prototype-invented features
  with no backend and no task group at all.

## Agent-routing validation (for Groups A–M/N3, before the next session starts)

Cross-checked the epic's existing "Per-group routing" table against the
agents/skills actually installed on this machine right now:

- **All `ecc:*` skills and agents referenced resolve** (`ecc:nestjs-patterns`,
  `ecc:prisma-patterns`, `ecc:security-reviewer`, `ecc:react-reviewer`,
  `ecc:typescript-reviewer`, `ecc:database-migrations`, `ecc:postgres-patterns`,
  `ecc:docs-lookup`, `ecc:tdd-guide`, `ecc:database-reviewer`,
  `ecc:silent-failure-hunter`), as do the custom project agents
  (`code-agent`, `review-qa-agent`, `security-agent`, `test-agent`,
  `deploy-agent`) and the plain skills `shadcn`, `frontend-design`, `dataviz`.
- **One broken reference: Group N's `ui-ux-pro-max` skill does not exist** on
  this machine — it's not in the installed skill list. N is already done, so
  this is moot for N1, but if N3's frontend work wants the same
  style/palette/font-pairing guidance the epic intended, swap it for
  `frontend-design` + `dataviz` (both installed and already listed alongside
  it) rather than referencing a skill that will 404 when a future session
  tries to load it.
- **Minor naming drift, no action needed:** the table writes `tdd-guide`,
  `docs-lookup`, `database-reviewer`, `silent-failure-hunter` without their
  `ecc:` prefix. They resolve fine (unambiguous match), but the epic's own
  Agent Routing table should eventually be updated to the fully-qualified
  names for consistency with how the rest of the table writes
  `ecc:react-reviewer` etc. — flagging, not fixing here, since it's a
  documentation nit rather than a blocker.

---

## Group A — Family & Roles

Audit method: read the 5 prototype pages, located the real route under
`apps/web/src/app/(app)/**/page.tsx`, then traced backing controllers/services/
DTOs in `apps/api/src` and models in `apps/api/prisma/schema.prisma`.
Every classification below cites code that was actually read.

**Route reality check** (`apps/web/src/app/(app)/` listing): only `akun/` exists.
There is **no** `/persetujuan`, `/iam`, or `/akses-saya` route. `/join/[token]`
exists (`apps/web/src/app/join/[token]/page.tsx`) and is public-allowlisted at
`apps/web/src/middleware.ts:11`. Nav is a static list with no role gating —
`apps/web/src/lib/nav.ts` contains zero occurrences of `role`, `persetujuan`,
`iam`, or `akses`.

---

### akun.html

- Feature: Profile hero + "Profil Saya" (nama, email, telepon, pekerjaan, penghasilan) — **EXISTS** — evidence: `apps/api/prisma/schema.prisma:249-256` (`phone`, `birthDate`, `gender`, `jobTitle`, `monthlyIncome`, last two AES-encrypted) + `apps/web/src/app/(app)/akun/page.tsx:3392` (`PATCH /auth/profile`) — full profile CRUD is wired; `jobTitle` covers "Pekerjaan".
- Feature: Group Family card (nama grup, jumlah anggota, peran saya) — **EXISTS** — evidence: `apps/web/src/app/(app)/akun/page.tsx:3370` (`GET /family-groups/mine`) → `apps/api/src/family-groups/family-groups.service.ts:89` returns `memberCount` + `myRole`.
- Feature: "Kekayaan Keluarga" + "Rekening Terhubung" tiles inside the family card — **MISSING (in this page)** — evidence: `apps/web/src/app/(app)/akun/page.tsx:2216-2245` renders only name/memberCount/role; no net-worth or account-count query in `FamilyBody`. The numbers exist on `/beranda`/`/ringkasan` but the akun family card has no such fields.
- Feature: Anggota Keluarga table (avatar, nama, username) — **EXISTS** — evidence: `apps/web/src/app/(app)/akun/page.tsx:3377-3386` (`GET /family-groups/:id/members`) → controller `apps/api/src/family-groups/family-groups.controller.ts:81`.
- Feature: **"Hubungan" column** (Istri / Anak · tanggungan / Supir) — **PARTIAL** — evidence: `apps/api/prisma/schema.prisma:466` (`Member.relationship`) exists and is returned by the members endpoint, but the real member row prints only `role · email` (`akun/page.tsx:2262`). The data is there; the column is not.
- Feature: **"Rekening Ditugaskan" column per member** — **PARTIAL** — evidence: `apps/api/prisma/schema.prisma:511` (`Account.ownerUserId`) + `apps/api/src/accounts/dto/create-account.dto.ts:94` / `update-account.dto.ts:31` + working UI at `apps/web/src/app/(app)/rekening/page.tsx:607-634`. Assignment is fully wired **on the rekening page only**; the akun member table never joins accounts to members.
- Feature: **Per-member Edit action (pencil)** — **PARTIAL** — evidence: API `PATCH /family-groups/:fg/members/:memberId` exists (`family-groups.controller.ts:204`) accepting `role`, `relationship`, `largeTxnThreshold` (`dto/update-member-role.dto.ts:20-50`), but the web member row renders **no edit button** — only a category-limit icon and a threshold icon (`akun/page.tsx:2274-2303`). No generic "Edit Anggota" dialog exists anywhere in the page.
- Feature: **Per-member Hapus action (trash)** — **PARTIAL** — evidence: API `DELETE /family-groups/:fg/members/:memberId` exists (`family-groups.controller.ts:229`, 204 No Content); zero call sites in `apps/web/src` — no delete UI at all.
- Feature: **"Rekening yang ditugaskan" picker inside Tambah Anggota dialog** — **MISSING** — evidence: `CreateDependantMemberDto` (`apps/api/src/family-groups/dto/create-dependant-member.dto.ts`) has only `name`/`username`/`initialPassword`/`role`/`relationship`; `createDependantMember` (`family-groups.service.ts:436-517`) creates user + baAccount + member and never touches `Account`. Account assignment would have to be a second call to the accounts endpoint.
- Feature: **"Istri (Co-Master)" option in Tambah Anggota / istri = second owner** — **MISSING** — evidence: `apps/api/src/family-groups/family-groups.service.ts:440` hard-rejects anything but `dependant`/`operational` with `INVALID_ROLE_FOR_DEPENDANT_CREATION`; `packages/contracts/src/members/index.ts:38` still maps `istri: "spouse"`; web dialog state is typed `useState<"dependant" | "operational">` (`akun/page.tsx:3124`). No max-1-istri constraint anywhere. This is exactly task **A1**.
- Feature: **Single "Tambah Anggota" button (no invite path)** — **PARTIAL/regression vs prototype** — evidence: the real page still shows **three** entry points: `onInviteMember` → invite-link CRUD (`akun/page.tsx:3477-3492`, creates `POST /family-groups/:id/invitations` and copies a `/join/<token>` link), `onAddAdmin` → `AddAdminDialog` (`akun/page.tsx:2992`), and `onAddDependant` → `AddDependantMemberDialog` (`akun/page.tsx:3096`). Task **A2** removes the first two from the UI.
- Feature: "Tidak ada undangan email lagi" notice + link to Persetujuan page — **MISSING** — evidence: no `/persetujuan` route exists; the approvals panel is inlined at `akun/page.tsx:2392`.
- Feature: Ubah Password — **EXISTS** — evidence: `akun/page.tsx:600-623` with real error surfacing (`error.message`).
- Feature: PIN Aplikasi + device list + "Lupakan perangkat" — **EXISTS** — evidence: `apps/api/src/devices/devices.controller.ts` (register/set-PIN/revoke) + `akun/page.tsx:969` (`t.deviceUnlock.toastRevokeFailed`). NOTE: dead in the deployed env per EPIC-024 Group B (nginx allowlist), not a Group A gap.
- Feature: "Notifikasi Login Baru" + "Konfirmasi Transaksi Besar" toggles — **EXISTS** — evidence: `akun/page.tsx:665-702`, persisted as `notificationPrefs.loginAlert` / `.bigTxnConfirm` via `PATCH /auth/profile`.
- Feature: **Autentikasi Dua Faktor (2FA) toggle** — **MISSING** — evidence: `grep -ri "twofactor|2fa"` over `apps/api/src` + `apps/web/src` matches only `apps/web/src/i18n/types.ts` (a label). No schema column, no endpoint, no implementation.
- Feature: Bahasa / Tema / Mata Uang / Agama Keluarga — **EXISTS** — evidence: currency `akun/page.tsx:1289`; religion `akun/page.tsx:1586` backed by `GET/PATCH /family-groups/:id/religion` (`family-groups.controller.ts:110,185`) + `enum FamilyReligion` (`schema.prisma:169`); theme via `components/shell/theme-picker.tsx`.

---

### persetujuan.html

- Feature: **Dedicated `/persetujuan` page** — **MISSING (route)** / **PARTIAL (function)** — evidence: no `apps/web/src/app/(app)/persetujuan/` directory; the whole feature lives inside `akun/page.tsx` as `AllowanceRequestsPanel` (`akun/page.tsx:2718`), rendered only when `isElevated` (`akun/page.tsx:2392`). Task **A5** is a move, not a build-from-zero.
- Feature: Owner/Co-Master-only visibility — **EXISTS** — evidence: server `apps/api/src/allowance-requests/allowance-requests.controller.ts:85-88` (`canSeeAll` = owner | admin_staff | spouse) + `@CheckAbility(manage AllowanceRequest)` on approve/reject (lines 97, 121); client mirror at `akun/page.tsx:2210`.
- Feature: Pending list with pemohon / keperluan / rekening tujuan / jumlah — **EXISTS** — evidence: `AllowanceRequestResponseDto` carries `requesterName`, `targetAccountName`, `amount`, `note`; `apps/web/src/app/(app)/akun/page.tsx:2788` filters `status === "pending"`.
- Feature: Approve with **source-account picker** — **EXISTS** — evidence: `ApproveRequestForm` (`akun/page.tsx:2920-2955`) POSTs `{ fromAccountId }` to `PATCH .../approve`; server executes a real transfer (`allowance-requests.service.ts:138-157` claim-then-transfer).
- Feature: **Server's real error message shown in the dialog** ("Saldo rekening bank … tidak boleh minus") — **MISSING** — evidence: this is the core of the prototype and the code does the opposite: `akun/page.tsx:2951` `catch { toast.error(t.akun.family.allowanceRequestApproveFailed); }`, same at `:2784` (approve-held) and `:2767` (reject). `extractApiErrorMessage` is imported and used elsewhere in the same file (e.g. `:3155`, `:3493`) but never in the approve path. Exactly task **A5**'s second half.
- Feature: Reject dialog with **required "Alasan Penolakan"** — **PARTIAL** — evidence: API accepts it (`apps/api/src/allowance-requests/dto/reject-allowance-request.dto.ts`, `reason?: string`, `@MaxLength(500)`), but the web client sends an empty body: `akun/page.tsx:2760` `body: JSON.stringify({})`. No reason input exists, and no confirm dialog either — reject fires immediately.
- Feature: **Rejection reason persisted / shown to the requester** — **MISSING** — evidence: `model AllowanceRequest` (`schema.prisma:661-689`) has `status`, `decidedAt`, `decidedByUserId` but **no `rejectionReason` column**. The DTO accepts a reason that has nowhere to be stored.
- Feature: **Riwayat tab (history)** — **PARTIAL (UI-only gap — API is complete)** — evidence: `findAll` returns every status (`allowance-requests.service.ts:117-135`, pending sorted first) and `AllowanceRequestResponseDto` already projects `status`, `createdAt`, `decidedAt`, `decidedByUserId` **and `decidedByName`** (`dto/allowance-request-response.dto.ts:53-65`). The only gap is the client: `akun/page.tsx:2788` discards every non-pending row. The Riwayat tab needs no backend work at all.
- Feature: **"Diputuskan oleh <nama> (Master/Co-Master)" column** — **PARTIAL (UI-only)** — evidence: `decidedByName` is served (`allowance-request-response.dto.ts:65`); nothing in `apps/web/src` reads it.
- Feature: Stat tiles (Menunggu / Disetujui bulan ini / Ditolak bulan ini, with rupiah subtotals) — **MISSING** — evidence: no aggregate endpoint; `findAll` returns raw rows only. Computable client-side from the full list, but no server aggregate exists.
- Feature: **"Unduh CSV" on Riwayat** — **MISSING** — evidence: `apps/api/src/exports/` has no allowance-request export; no CSV route on `allowance-requests.controller.ts`.
- Feature: "Pengeluaran tertahan" (held_expense) card variant with over-limit warning — **EXISTS** — evidence: `AllowanceRequestKind` incl. `held_expense` + `Member.largeTxnThreshold` (`schema.prisma:480`); held requests approve without a source account (`akun/page.tsx:2773-2786`).

---

### iam.html

**Headline: this page is almost entirely unbacked, and no EPIC-024 Group A task covers it.**

- Feature: `/iam` route — **MISSING** — evidence: no `apps/web/src/app/(app)/iam/` directory.
- Feature: Fixed role tiers (Master / Co-Master / Anak / Staff) — **EXISTS (as data)** — evidence: `enum Role` (`schema.prisma:19`) = owner|member|admin_staff|spouse|dependant|operational; abilities in `apps/api/src/casl/casl-ability.factory.ts` (260 lines).
- Feature: **"Buat Custom Role" (custom role with permission checkboxes)** — **MISSING** — evidence: roles are a Prisma enum + static CASL factory; there is no `Role`/`Permission` table and no endpoint to define one. This is a schema-level absence, not a UI gap.
- Feature: **Role Permission Matrix table (modul × role)** — **MISSING** — evidence: no endpoint exposes the ability set; `casl-ability.factory.ts` is server-internal with no read API.
- Feature: **"Request Akses" queue (member asks for extra access)** — **MISSING** — evidence: `AllowanceRequest` is the only request model in `schema.prisma`; there is no access-request entity, endpoint, or notification type.
- Feature: **Audit "38 dalam 7 hari" counter / audit log viewer** — **PARTIAL** — evidence: `model AuditLog` exists (`schema.prisma:892-909`) and `apps/api/src/audit/audit.interceptor.ts` writes rows, but `apps/api/src/audit/` contains **no controller** — the log is write-only with no read endpoint.
- Feature: **"Login Terakhir" column** — **MISSING** — evidence: `grep "lastLogin|lastSeen"` over `schema.prisma` → 0 matches. `User` has no last-login timestamp; `BaSession` rows would have to be aggregated.
- Feature: Per-member limit ("Limit transaksi anak/staff") — **EXISTS** — evidence: `Member.largeTxnThreshold` (`schema.prisma:480`) + `PATCH /family-groups/:fg/members/:id` (`update-member-role.dto.ts:44-50`) + working `ThresholdDialog` (`akun/page.tsx:2592`).
- Feature: **Family-wide default limits ("Limit transaksi staff" as a single group setting)** — **MISSING** — evidence: threshold is per-`Member` only; `FamilyGroup` has no default-limit column.
- Feature: Scope rekening per anggota ("Assign rekening") — **PARTIAL** — evidence: `Account.ownerUserId` supports exactly this and is editable from `/rekening` (`rekening/page.tsx:607-634`); there is no member-centric assign screen.
- Feature: "Preview Anak / Staff" (impersonation preview) — **MISSING** — evidence: no impersonation/preview mechanism anywhere in `apps/api/src/auth` or `apps/web/src/lib/auth*.ts`.

---

### akses-saya.html

- Feature: `/akses-saya` route — **MISSING** — evidence: no `apps/web/src/app/(app)/akses-saya/` directory.
- Feature: Row-scoped data visibility for dependant/operational — **EXISTS (server)** — evidence: `apps/api/src/common/utils/privacy.util.ts` `isRowScopedRole` referenced by `schema.prisma:471`; accounts list supports `scope=me|family|all` (`apps/api/src/accounts/dto/list-accounts-query.dto.ts:16`); `rekening/page.tsx:510` filters to `ownerUserId === myUserId`.
- Feature: **Role-restricted sidebar (hide aset/investasi/pajak/warisan/masterdata/IAM for non-master)** — **MISSING** — evidence: `apps/web/src/lib/nav.ts` (250 lines) contains **zero** references to `role`; every user sees the full menu. The prototype rebuilds the nav in JS (`akses-saya.html:248-295`) — there is no equivalent capability in the real shell.
- Feature: "Limit tanpa approval" hero figure — **EXISTS (data)** — evidence: `Member.largeTxnThreshold`; no member-facing surface renders it (the `ThresholdDialog` is owner-only, `akun/page.tsx:2288`).
- Feature: "Ajukan Dana" self-service request — **EXISTS** — evidence: `POST /family-groups/:fg/allowance-requests` with `@CheckAbility(create AllowanceRequest)` (`allowance-requests.controller.ts:48-66`), and the requester-side UI is real but lives on the **rekening** page: `apps/web/src/app/(app)/rekening/page.tsx:382`. The prototype relocates it to a personal page.
- Feature: "Menunggu Approval" own-request list — **MISSING (UI)** — evidence: server supports it (`canSeeAll=false` → `requesterUserId` filter, `allowance-requests.controller.ts:85`), but no page in `apps/web/src` issues a requester-scoped GET — a dependant can submit a request and then never see its status.
- Feature: **"Minta Akses" (request additional access)** — **MISSING** — evidence: same as IAM above; no access-request model or endpoint.
- Feature: **Upload bukti / struk on a transaction** — **MISSING** — evidence: EPIC-024 Evidence section (verified): `StoragePort` exists at `apps/api/src/storage/storage.port.ts` with only a mock binding and no module injecting it; `Transaction` has no attachment field. (This is EPIC-024 Group **I/attachments**, not Group A.)
- Feature: "Catatan Master" on a decided request — **MISSING** — evidence: no `rejectionReason`/decision-note column on `AllowanceRequest` (`schema.prisma:661-689`).
- Feature: Staff-vs-anak preview toggle — **MISSING** — prototype-only affordance, no impersonation backend.

---

### join-token.html

- Feature: Legacy-invite landing page that explains the flow is retired — **MISSING** — evidence: the real `apps/web/src/app/join/[token]/page.tsx` is a **live, working** accept flow: `GET /family-groups/invitations/:token` (line 41) then `POST .../accept` (line 48) then forced re-login (line 56). It does not present any "sudah tidak dipakai" state.
- Feature: Invitation backend kept alive (per D2, backend endpoints untouched) — **EXISTS** — evidence: `apps/api/src/family-groups/family-groups.controller.ts:249` (create), `:267` (lookup by token), `:278` (accept) — all still mounted.
- Feature: Public access to `/join/<token>` without login — **EXISTS** — evidence: `apps/web/src/middleware.ts:11` allowlists `pathname.startsWith("/join/")`.
- Feature: "Cara bergabung sekarang" 3-step instructions + link to forced password change — **MISSING (content)** / backend **EXISTS** — evidence: `User.mustChangePassword` (`schema.prisma:247`) + `ForcePasswordChangeGuard` + the real `apps/web/src/app/ubah-password-wajib/` route exist; only the explanatory join-page copy is absent.

---

### Scope-creep flags

Ordered by risk. Items 1–4 are prototype features with **no** EPIC-024 task and, in
most cases, no schema support — they will silently become "why doesn't this work?"
bug reports if the prototype is treated as the spec.

1. **The whole `iam.html` page is out of scope.** Group A's tasks A1–A7 cover
   istri-as-owner, hiding invites, group resolution, the picker, the Persetujuan
   page, stopping Akun Utama, and docs. Nothing in A1–A7 mentions IAM, custom
   roles, a permission matrix, or an access-request queue. Three of that page's
   features (**custom roles**, **access requests**, **audit-log viewer**) need
   new Prisma models. Recommend: do not build `/iam`; if the client wants it,
   it is its own epic.
2. **`akses-saya.html` is out of scope and depends on a missing capability.**
   Its central promise — a sidebar that hides aset/investasi/pajak/warisan/
   masterdata for non-master roles — requires role-aware nav, which
   `apps/web/src/lib/nav.ts` has no notion of (0 matches for `role`). A4 only
   asks to _verify_ the account picker per role; it does not introduce menu
   gating. This is a real product gap worth raising, but it is not Group A.
3. **Rejection reason is depicted as required and cannot be stored.**
   `persetujuan.html:280` makes "Alasan Penolakan" mandatory ("Wajib diisi") and
   the history table implies the requester sees it. `AllowanceRequest` has no
   `rejectionReason` column (`schema.prisma:661-689`), and the web client
   currently sends `{}`. A5 says nothing about reject at all. Either drop the
   field from the page or add the column + wire the DTO that already accepts it.
4. **Persetujuan stat tiles + "Unduh CSV" are new server work.** Three aggregate
   figures (pending count/sum, approved-this-month count/sum, rejected-this-month
   count/sum) and a CSV export have no endpoint. A5 describes moving an existing
   panel, not adding aggregates. Cheapest honest option: compute the tiles
   client-side from the existing full list and cut the CSV button.
5. **Member edit + delete are depicted, exist in the API, and have no task.**
   `akun.html` gives every member row a pencil and a trash icon with full
   dialogs (edit role/hubungan/rekening/limit; delete confirm). `PATCH` and
   `DELETE /family-groups/:fg/members/:id` both exist and are unused by the web
   app. A1/A2 do not mention them. This is the cheapest high-value item in the
   set — the backend is already done.
6. **"Rekening yang ditugaskan" inside the Tambah Anggota dialog implies a
   composite operation** that `createDependantMember` does not perform
   (`family-groups.service.ts:436-517` never touches `Account`). Implementing it
   as depicted means either extending the DTO/service or a two-call client flow;
   A1 only widens the role check.
7. **2FA toggle in `akun.html` is pure fiction** — one i18n label, no column, no
   endpoint. It sits in a security card next to three toggles that _are_ real,
   which makes it the most likely to be shipped by accident.
8. **`akun.html`'s family card shows "Kekayaan Keluarga" and "Rekening
   Terhubung"** — plausible-looking numbers that the current `FamilyBody` has no
   query for. Minor, but it is net-new data plumbing on a page nobody scoped for it.
9. **`join-token.html` inverts current behavior.** It presents the invite link as
   dead, while `/join/[token]` still fully accepts invitations and D2 explicitly
   says backend invitation endpoints stay. A2 hides the invite _creation_ UI but
   says nothing about the _acceptance_ page. Decide deliberately: leaving `/join`
   live means old links keep working (arguably correct); replacing it with the
   prototype's tombstone breaks any invite already in someone's inbox.

# Group B — PIN / Auth

Audit of 5 prototype auth pages vs. `apps/web` + `apps/api` + `deploy/nginx`.
Every STATUS below was read in code, not inferred. Paths are repo-relative to
`/home/stealth/WORK/vibes/wealthme2`.

**Headline:** the PIN feature is fully built end-to-end and is broken by exactly
two nginx lines; almost everything else the auth prototypes depict is either
already there or is copy/UI polish — except three real backend gaps nobody has
scoped yet (head-resets-member-password, session/device revocation on password
reset, silent reset-email failure).

---

### login.html

- Feature: PIN device-unlock backend (deviceSecret + PIN → real session) — **EXISTS** — evidence: `apps/api/src/devices/devices.controller.ts:108-127`, `apps/api/src/devices/devices.service.ts:180-232` — `@Public() POST /auth/devices/:id/unlock`, argon2-verifies both factors, mints a `BaSession` token; 5/min throttle.
- Feature: PIN unlock reachable **through nginx** — **MISSING** — evidence: `deploy/nginx/default.conf:64` — `location /api/` prefix-strips `/api/device-unlock` to `api:4000/device-unlock`, a path NestJS does not serve (the BFF lives on web at `apps/web/src/app/api/device-unlock/route.ts:44`) → 404. Exactly EPIC-024 item 3. **This is B1.**
- Feature: PIN _setup_ reachable through nginx (register device + set PIN) — **MISSING** — evidence: `deploy/nginx/default.conf:54` — the auth allowlist regex enumerates NestJS auth route names and has no `devices`; the browser calls `${NEXT_PUBLIC_API_URL}/auth/devices` = `https://wealthme.demo-wit.id/api/auth/devices` (`docs/DEPLOYMENT.md:142`, `apps/web/src/hooks/use-devices.ts:47`), which then matches `location /api/auth/` (`deploy/nginx/default.conf:30`) and lands on Better Auth's catch-all on web:3000. Exactly item 10. **This is B1.**
- Feature: distinguish "PIN salah" from a server/route failure — **MISSING** — evidence: `apps/web/src/components/auth/device-unlock-pad.tsx:61-79` — every non-OK response _and_ every thrown network error collapses to one `t.deviceUnlock.toastUnlockFailed`; only `DEVICE_LOCKED` is special-cased. The prototype deliberately renders two visually different failures. **This is B2.**
- Feature: distinguish setup failure causes ("Gagal mengatur buka cepat") — **MISSING** — evidence: `apps/web/src/components/auth/quick-unlock-prompt.tsx:64-66` — bare `catch { toast.error(generic) }` around `registerDevice` + `setDevicePin`; a 404 from nginx is indistinguishable from a validation error. **This is B2.**
- Feature: lockout countdown ("Coba lagi dalam 5m 00s") — **EXISTS** — evidence: `apps/api/src/devices/devices.service.ts:200-207` → `apps/web/src/app/api/device-unlock/route.ts:79-93` → `device-unlock-pad.tsx:67-75` — `code: "DEVICE_LOCKED"` + `remainingMs` survives the BFF hop and is formatted client-side.
- Feature: "Percobaan tersisa: N" attempt counter — **MISSING** — evidence: `apps/api/src/devices/devices.service.ts:216-219` + `:252-268` — a failed unlock throws a bare `UnauthorizedException("Unlock failed")`; `registerFailedAttempt` increments atomically but never returns or exposes the count. Needs a backend response-shape change. _Not in B1–B3._
- Feature: 3×4 numeric keypad + 6 PIN dots — **MISSING** — evidence: `apps/web/src/components/auth/device-unlock-pad.tsx:106-115` — the real pad is a single `<input type="password" maxLength={6}>`, no keypad, no dot indicators. Pure UI; belongs to Task N revamp. _Not in B1–B3._
- Feature: "Perangkat dikenali" badge + "Masuk sebagai X · Chrome di MacBook Pro · terakhir dipakai …" — **MISSING** — evidence: `apps/web/src/components/auth/device-storage.ts:14-17` stores only `{deviceId, deviceSecret}`, and `GET /auth/devices` requires a session (`apps/api/src/devices/devices.controller.ts:71-77`) so no name/label/lastUsedAt is obtainable pre-login. Needs either a public metadata echo on unlock or storing the label locally at registration. _Not in B1–B3._
- Feature: "Gunakan password" fallback (never trapped on the pad) — **EXISTS** — evidence: `apps/web/src/app/login/page.tsx:136`, `device-unlock-pad.tsx:127-132`.
- Feature: Email/Username segmented login — **EXISTS** — evidence: `apps/web/src/app/login/page.tsx:180-211` (toggle) + `:82-107` (`/sign-in/username` via better-auth username plugin).
- Feature: hint "anggota tanggungan/operasional tidak punya email" — **MISSING (copy only)** — evidence: `apps/web/src/app/login/page.tsx:240-263` — the username field has no explanatory hint; the behaviour it describes is correct.
- Feature: Google sign-in — **EXISTS** — evidence: `apps/web/src/app/login/page.tsx:109-114`, `:351-356`.
- Feature: "Lupa password?" link — **EXISTS** — evidence: `apps/web/src/app/login/page.tsx:318-325` (email mode only — correct, username accounts have no reset path; see lupa-password below).
- Feature: "Ingat saya" checkbox — **MISSING (inert control)** — evidence: `apps/web/src/app/login/page.tsx:309-313` — `defaultChecked` with no state, no handler, no effect; session lifetime is a fixed 7 days (`apps/api/src/devices/devices.service.ts:49`, better-auth default). Same class of defect as the item-14 gembok button. _Not in B1–B3._
- Feature: server-side `API_URL` validated — **PARTIAL** — evidence: `apps/web/src/lib/env.ts:19-30` validates only `NEXT_PUBLIC_*`; `apps/web/src/app/api/device-unlock/route.ts:24` silently falls back to `http://localhost:4000`. Currently masked because `docker-compose.yml:213` sets `API_URL: http://api:4000`, so this is latent, not a live cause of item 3. **B2 names this explicitly.**

### lupa-password.html

- Feature: request reset link by email — **PARTIAL** — evidence: `apps/web/src/app/lupa-password/page.tsx:21-24` calls `authClient.requestPasswordReset`, but `apps/web/src/lib/auth.ts:43-47` `sendResetPassword` logs the URL and then `if (!apiKey) return;` — with `SENDGRID_API_KEY` unset **no email is sent and the UI still shows "Email Terkirim!"** (`page.tsx:29,62-84`). Silent failure; the user waits forever.
- Feature: "Email Terkirim" state + "Coba lagi" resend — **EXISTS** — evidence: `apps/web/src/app/lupa-password/page.tsx:62-84`.
- Feature: "Link berlaku 60 menit" — **PARTIAL** — evidence: the SendGrid body claims "berlaku selama 1 jam" (`apps/web/src/lib/auth.ts:63`) but `auth.ts` sets no `resetPasswordTokenExpiresIn` and the UI never states an expiry, so the promise is unverified copy.
- Feature: "username members must ask the head to reset their password" — **MISSING (capability does not exist)** — evidence: `apps/api/src/family-groups/family-groups.controller.ts:204-227` — the only member-mutating PATCH takes `UpdateMemberRoleDto` (role only); there is no reset-password DTO or endpoint in `apps/api/src/family-groups/dto/`. The prototype promises a feature nobody has built. _Not in B1–B3._

### reset-password.html

- Feature: token-based reset — **EXISTS** — evidence: `apps/web/src/app/reset-password/page.tsx:13`, `:52-55` (`authClient.resetPassword({ newPassword, token })`).
- Feature: invalid/expired-token state + "minta link baru" — **EXISTS** — evidence: `apps/web/src/app/reset-password/page.tsx:21-35`.
- Feature: live 5-rule password checklist (≥8 · huruf besar+kecil · angka · simbol · cocok) — **PARTIAL** — evidence: `apps/web/src/app/reset-password/page.tsx:42-49` enforces only length ≥ 8 and match; no complexity rule client- or server-side (`apps/web/src/lib/auth.ts:36-68` sets no `minPasswordLength`/complexity). Same shortfall on register + ubah-password-wajib.
- Feature: "semua sesi di perangkat lain akan keluar, termasuk PIN buka cepat" — **MISSING** — evidence: `apps/web/src/lib/auth.ts:36-68` sets no `revokeSessionsOnPasswordReset`, and nothing anywhere deletes `Device` rows on a password reset or change (`apps/api/src/auth/password-policy.service.ts` has zero device references; grep for `Device` returns none). **A device whose PIN was compromised keeps working after a password reset** — security-relevant, and the prototype states the opposite. _Not in B1–B3._

### ubah-password-wajib.html

- Feature: forced first-login password change — **EXISTS** — evidence: `apps/web/src/app/ubah-password-wajib/page.tsx:42-59` → `POST /auth/set-password` (`apps/api/src/auth/password-policy.controller.ts:56-70`, `@SkipPasswordCheck()`); `mustChangePassword: true` set at dependant creation (`apps/api/src/family-groups/family-groups.service.ts:484`); enforced by `ForcePasswordChangeGuard`.
- Feature: logout escape hatch — **EXISTS** — evidence: `apps/web/src/app/ubah-password-wajib/page.tsx:167-174`.
- Feature: identity card (avatar, nama, username, peran, "dibuat oleh Budi Santoso, 4 Agu 2026") — **MISSING** — evidence: `apps/web/src/app/ubah-password-wajib/page.tsx:82-93` renders only a generic title/subtitle; and the **created-by attribution has no backing field** — `model Member` (`apps/api/prisma/schema.prisma:459-481`) has no `createdBy`, nor does `MemberResponseDto`. Name/username/role are obtainable from the session, the creator is not. _Not in B1–B3._
- Feature: "Langkah ini tidak bisa dilewati — 403 PASSWORD_CHANGE_REQUIRED" notice — **PARTIAL** — evidence: server-side enforcement exists (`ForcePasswordChangeGuard`, see `apps/api/src/common/guards/force-password-change.guard.spec.ts`), but the page never explains _why_ it cannot be dismissed. Copy only.
- Feature: distinct "password saat ini salah" error — **MISSING** — evidence: `apps/web/src/app/ubah-password-wajib/page.tsx:56-58` — `onError: toast.error(t.forcePasswordChange.toastFailed)` swallows the API's 401 "Current password incorrect" (`apps/api/src/auth/password-policy.controller.ts:67`). Same defect class as B2, but **B2 names only `quick-unlock-prompt.tsx` and `device-unlock-pad.tsx`** — this file is not in scope as written.
- Feature: "minta kepala keluarga menyetel ulang password awal" — **MISSING** — same non-existent capability as in lupa-password.html above.

### register.html

- Feature: nama/email/password/konfirmasi + validation + signUp — **EXISTS** — evidence: `apps/web/src/app/register/page.tsx:22-51` (validate), `:59-64` (`authClient.signUp.email`).
- Feature: "Tidak ada rekening yang dibuat otomatis" (D5) — **MISSING** — evidence: `apps/web/src/lib/auth.ts:141-149` **and** `apps/api/src/auth/auth.service.ts:181` both still create `name: "Akun Utama", type: "bank", balance: 0` at registration. Covered by **Task A6**, not Group B — flagged so the two audits do not double-report it.
- Feature: password strength meter (4 segments + label) — **MISSING** — evidence: `apps/web/src/app/register/page.tsx` — no `strength`/`meter` code anywhere in the file (grep: 0 matches); only the ≥8-char check at `:41-45`.
- Feature: Syarat & Ketentuan / Kebijakan Privasi consent checkbox — **MISSING** — evidence: `apps/web/src/app/register/page.tsx` — no `terms`/`Syarat` reference (grep: 0 matches); no consent is collected or recorded. _Not in B1–B3._
- Feature: ID/EN language toggle — **EXISTS** — evidence: `apps/web/src/app/register/page.tsx:123-140` via `useLocale()` (persists app-wide).
- Feature: post-register destination — **PARTIAL** — evidence: `apps/web/src/app/register/page.tsx:78-79` pushes `/beranda`; the prototype's "Tambahkan rekening pertamamu" onboarding only makes sense once A6 lands.

---

### Scope-creep flags

Depicted in the Group-B prototypes but **not covered by B1–B3**:

1. **Head-resets-a-member's-password** — promised in copy on _two_ prototype pages (lupa-password.html:57-58, ubah-password-wajib.html:102-103) and has no endpoint at all (`family-groups.controller.ts:204` is role-only). Needs its own task; without it a dependant who forgets the temporary password is permanently locked out.
2. **Session + device revocation on password reset/change** — reset-password.html:80-86 explicitly promises it; nothing implements it (`auth.ts:36-68`, no `Device` deletion anywhere). Security-relevant, belongs next to B2.
3. **Reset email silently not sent when `SENDGRID_API_KEY` is unset** (`auth.ts:47`) while the UI reports success — a silent failure of the same family as the generic-toast bugs B2 targets, but on a different page.
4. **"Percobaan tersisa: N"** requires a new backend response shape on unlock (`devices.service.ts:216-219`); B2 only covers _classifying_ existing errors.
5. **Pre-login device identity** ("Perangkat dikenali · Chrome di MacBook Pro · terakhir dipakai …") needs either a public device-metadata echo or a locally stored label at registration (`device-storage.ts:14-17` stores neither).
6. **PIN keypad + dot indicators** — pure UI, belongs to Task N's revamp wave, not B.
7. **Inert "Ingat saya" checkbox** (`login/page.tsx:309-313`) — same defect class as item 14's gembok, but not listed in any EPIC-024 item.
8. **Password-complexity rules + strength meter + T&C consent** on register/reset — new product requirements introduced by the prototype, absent from `docs/revisi.txt` and from every task group.
9. **Forced-password-change page error surfacing** (`ubah-password-wajib/page.tsx:56-58`) — B2's wording limits the fix to the two device components; this file needs the same treatment or item 10's class of bug survives on it.

# EPIC-024 Groups C + D — prototype vs real app/API gap audit

Repo: `/home/stealth/WORK/vibes/wealthme2` · read-only audit · all paths relative to repo root.

Legend: **EXISTS** = shipped and working · **PARTIAL** = infrastructure present but the depicted
behavior is not reachable/complete · **MISSING** = no code path at all.

---

## Group C — Investasi

### investasi.html

- Feature: Live prices for saham (Yahoo `.JK`) + kripto (CoinGecko) — **PARTIAL** — evidence: `apps/api/src/investments/investments.module.ts:41-53`, `apps/api/src/investments/routed-market-data.adapter.ts:32-41`, `.env.example:159` — the routed adapter is fully implemented and bound behind `MARKET_DATA_PORT`, but it is only used when `USE_REAL_MARKET_DATA === "true"`; the shipped default is `USE_REAL_MARKET_DATA=false` so production/dev serves `MockMarketDataAdapter` (`investments.module.ts:50`). This is exactly what C1 flips.
- Feature: Price-source honesty labels ("Live · delayed" / "Harga manual · <tanggal>" / source name) — **EXISTS** — evidence: `apps/web/src/app/(app)/investasi/page.tsx:873-925`, `apps/api/prisma/schema.prisma:872-890` — `InvestmentPrice.asOf`/`delayed` plus `PRICE_SOURCE_LABEL_KEYS` (`page.tsx:88-93`) already render source + delay + manual-entry date. Delivered by EPIC-023 G1.
- Feature: Manual price + valuation date for non-live types — **EXISTS** — evidence: `apps/web/src/app/(app)/investasi/page.tsx:427-465`, `apps/api/src/investments/investments.controller.ts:98-110` (`POST :id/price`), `apps/api/src/investments/dto/set-manual-price.dto.ts` — `isManualPriceType()` (`page.tsx:84-86`) gates a dated manual-price field saved as a separate call.
- Feature: "Perbarui Harga" manual refresh button — **MISSING** — evidence: `apps/api/src/investments/investments.controller.ts:43-110` (no refresh endpoint), `apps/api/src/investments/price-refresh.scheduler.ts:6-27` — refresh is only a 60s BullMQ repeat job; there is no user-triggered refresh route and no such button in `investasi/page.tsx`. **Not covered by C1–C4.**
- Feature: Saham Lot ↔ Lembar quantity toggle — **MISSING** — evidence: `apps/web/src/app/(app)/investasi/page.tsx:362-380` — a single generic `quantity` number input (`step="any"`), no unit segmented control, no ×100 conversion, no "N lot = N×100 lembar" hint. Table cells render the raw `quantity` with no lot/lembar dual display (`page.tsx:775`, `840-855`).
- Feature: Kripto "Jumlah Koin" with 8-decimal precision — **PARTIAL** — evidence: `apps/api/prisma/schema.prisma:855` (`Decimal(18, 8)`), `apps/api/src/investments/dto/create-investment.dto.ts:33-35` (`@IsNumberString`), `apps/web/src/app/(app)/investasi/page.tsx:369-380` (`step="any"`) — the storage precision and validation accept 8 decimals, but the form has no crypto-specific label, no `step="0.00000001"`, and no per-type field switching; the same generic field serves every type.
- Feature: Deposito as an investment type (tab + form + accrued-interest valuation) — **MISSING** — evidence: `apps/api/prisma/schema.prisma:83-90` — `enum InvestmentType { saham reksa_dana obligasi emas kripto lainnya }` has **no `deposito`**; `apps/web/src/app/(app)/investasi/page.tsx:75-77` explicitly comments "deposito has no dedicated type yet" and `INTEREST_BEARING_TYPES` is `["obligasi"]` only (`page.tsx:77`). No accrued-interest computation exists — `investments.service.ts:41-49` only derives a flat projected annual yield (`currentValue × interestRatePct / 100`), not a day-count accrual.
- Feature: `interestRatePct` (bunga %/thn) field — **EXISTS** — evidence: `apps/api/prisma/schema.prisma:862`, `apps/api/src/investments/dto/create-investment.dto.ts:53-63`, `apps/web/src/app/(app)/investasi/page.tsx:406-420` — shipped in EPIC-021 #20, but rendered only for `obligasi`.
- Feature: Deposito maturity date (jatuh tempo) / start date — **MISSING** — evidence: `apps/api/prisma/schema.prisma:849-870` — no `maturityDate` column; a repo-wide grep for `maturityDate|purchasedAt|purchaseDate` across `apps/api/src`, `apps/web/src`, `schema.prisma`, `packages/` returns zero hits.
- Feature: "Tanggal Beli" date picker (all types) — **MISSING** — evidence: `apps/api/prisma/schema.prisma:849-870` (no `purchasedAt`), `apps/web/src/app/(app)/investasi/page.tsx:96-107` (`AddInvestmentForm` has no purchase-date member) — the prototype shows it on every row (`investasi.html:121`, `143`, `165`) and calls it mandatory for holding period + tax reporting (`investasi.html:365`). Detail dialog's "Tanggal beli" row (`investasi.html:586-588`) has no backing field.
- Feature: CTA labelled "Catat Investasi" — **PARTIAL** — evidence: `apps/web/src/app/(app)/investasi/page.tsx` uses `t.investasi.*` i18n keys for the add-modal CTA — the modal exists but the copy is the generic add/save label, not the prototype's "Catat Investasi". Cosmetic; C3's last clause.
- Feature: Per-type conditional form sections (saham/kripto/reksa/obligasi/emas/deposito/lainnya) — **MISSING** — evidence: `apps/web/src/app/(app)/investasi/page.tsx:362-465` — the only type-conditional branching is `isManual ? manual-price block : automated note` plus the obligasi-only interest field. The prototype's seven `data-type-group` sections (`investasi.html:384-514`) have no counterpart.
- Feature: Type filter tabs incl. Deposito — **PARTIAL** — evidence: `apps/web/src/app/(app)/investasi/page.tsx:69-71` (`FILTER_TAB_IDS = ["semua", ...INVESTMENT_TYPES]`) — tabs are derived from the Prisma enum, so they exist for the six current types and will pick up `deposito` automatically once C2's migration lands.
- Feature: Holding detail dialog with 12-month sparkline — **PARTIAL** — evidence: `apps/web/src/app/(app)/investasi/page.tsx:855-950` — the real page uses an inline expandable row (latest price, source, delay, interest rate) rather than a modal with a price-history sparkline. `InvestmentPrice` history exists (`schema.prisma:872-890`) but is not charted. **Not covered by C1–C4.**

### quickinput.html

- Feature: Investasi quick-add captures Jumlah × Harga per unit (not a lone "Modal Awal") — **MISSING** — evidence: `apps/web/src/app/(app)/quickinput/page.tsx:224-236` — the mapper hardcodes `quantity: "1"` and sends `costBasisPerUnit: parseRupiah(v.modal ?? v.nilai)`, so every quick-added holding gets qty 1 and a cost basis equal to total capital. This is precisely the bug the prototype annotates at `quickinput.html:235-241`. Confirms C4's evidence line-for-line.
- Feature: Quick-input form has a quantity field at all — **MISSING** — evidence: `apps/web/src/components/crud/crud-config.ts:173-197` — the `investasi` entity's fields are `nama`, `ticker`, `jenis` (select), `modal` (amount), `nilai` (amount). No quantity field exists for the mapper to read.
- Feature: "Nilai Sekarang" from quick-input reaches the API — **MISSING** — evidence: `apps/web/src/app/(app)/quickinput/page.tsx:224-236` vs `crud-config.ts:195` — `nilai` is collected by the form but only ever used as a _fallback_ for `costBasisPerUnit`; it is never sent as a manual price (`POST investments/:id/price` is not called from quickinput). Silently discarded whenever `modal` is filled.
- Feature: Lot hint ("1 lot = 100 lembar → 400 lembar") — **MISSING** — evidence: `apps/web/src/components/crud/crud-config.ts:173-197` — no unit awareness in the generic CRUD config.
- Feature: "Tanggal Beli" in the quick-add dialog (`quickinput.html:222-225`) — **MISSING** — evidence: `crud-config.ts:173-197` (no date field on `investasi`) plus the absent `purchasedAt` column. Note the CRUD field-type union _does_ support `"date"` (used by other entities), so the frontend half is cheap once C2 lands.
- Feature: Kripto option in quick-input type select — **EXISTS** — evidence: `apps/web/src/app/(app)/quickinput/page.tsx:163-169` (`INVESTMENT_TYPE` maps `Crypto → kripto`), `crud-config.ts:192`.

---

## Group D — Aset

### aset.html

- Feature: Privacy eye toggle that blurs all amounts — **MISSING** — evidence: `apps/web/src/app/(app)/aset/page.tsx:932-939` — the button renders a `Lock` icon with `aria-label={t.aset.lockAriaLabel}` and **no `onClick`, no `aria-pressed`, no state**; it is inert. Grep for `privacy|EyeOff|is-private|hideValues|maskValues` across `apps/web/src/components/shell/` and `components/wm/` returns nothing, so there is no app-wide privacy mechanism to reuse either. Matches D1's evidence exactly.
- Feature: Per-user persistence of the privacy state — **MISSING** — evidence: same as above (no state at all). Relevant precedent: `[[feedback_onboarding_flag_scoping]]` — client-only first-run flags in this repo must key by `userId`, which D1's "per-user localStorage" wording already anticipates.
- Feature: Penyusutan/apresiasi as **% per year** — **EXISTS** — evidence: `apps/api/prisma/schema.prisma:796` (`valueChangeRatePct Decimal? @db.Decimal(5,2)`), `apps/api/src/assets/dto/create-asset.dto.ts:42-51`, `apps/api/src/assets/assets.service.ts:58-70` (`computeEstimatedValue`), `apps/web/src/app/(app)/aset/page.tsx:316-332` — signed percent rate, linear projection, floor at 0.
- Feature: Penyusutan as **fixed Rp per year** (mode toggle % / Rp) — **MISSING** — evidence: `apps/api/prisma/schema.prisma:784-816` — the `Asset` model has **no `valueChangeMode` and no `valueChangeAmount`**; `assets.service.ts:64-69` computes only `1 + (ratePct/100) × years`; `apps/web/src/app/(app)/aset/page.tsx:316-332` renders a single percent input with no segmented mode control. The prototype shows both the toggle (`aset.html:319-338`) and a Rp-mode badge on a card (`aset.html:275`, "+Rp 2.500.000 / tahun").
- Feature: Tanggal Perolehan as the projection anchor — **EXISTS** — evidence: `apps/api/prisma/schema.prisma:801` (`acquisitionDate DateTime? @db.Date`), `apps/api/src/assets/assets.service.ts:97-101` (falls back to `createdAt`), `apps/web/src/app/(app)/aset/page.tsx:341-352` — shipped by EPIC-023 D19.
- Feature: "Nilai Tercatat" vs "Proyeksi" side by side + "Gunakan nilai ini" — **EXISTS** — evidence: `apps/web/src/app/(app)/aset/page.tsx:421-424`, `447-450` (`hasProjectionDrift`), `465` (PATCHes `currentValue` to `currentEstimatedValue`), `509`.
- Feature: Kategori Master Data on the asset form — **EXISTS** — evidence: `apps/api/prisma/schema.prisma:806` (`categoryId`), `apps/api/src/assets/dto/create-asset.dto.ts:53-59` — EPIC-021 #16.
- Feature: Asset category tabs (Semua / Cash / Bank / Investasi / Fisik) — **PARTIAL** — evidence: `apps/web/src/app/(app)/aset/page.tsx` renders the combined asset view; the prototype's four-way tab filter over mixed account+investment+physical sections is a layout the real page approximates but does not reproduce section-for-section. Presentation-only; **not covered by D1–D2**.

### Scope-creep flags

1. **"Perbarui Harga" manual refresh button** (`investasi.html:28-31`) — C1 only flips `USE_REAL_MARKET_DATA`; nothing in C1–C4 adds a user-triggered refresh endpoint. Today refresh is a 60s BullMQ cron (`price-refresh.scheduler.ts:6`) with no API route. Either drop the button from the port or add a `POST investments/refresh` task.
2. **"Terakhir sinkron <timestamp>"** in the pricing explainer (`investasi.html:76-77`) — a family-group-level last-sync timestamp. `InvestmentPrice.recordedAt`/`asOf` are per-holding; no aggregate "last sync" is exposed by `GET investments/summary` (`investments.controller.ts:53`). Small but unscoped.
3. **Portfolio "Perubahan Hari Ini"** summary card (`investasi.html:59-66`) — needs a previous-close/24h-ago price per holding. `InvestmentPrice` history exists but no day-delta aggregation is implemented and no C-task mentions it.
4. **Holding detail modal with 12-month price sparkline** (`investasi.html:557-599`, `DETAIL[].spark`) — the real page uses an inline expandable row with no chart. Charting `InvestmentPrice` history is unscoped work.
5. **Obligasi "Harga %" pricing convention** (`investasi.html:235`, `794-796` — price quoted as 103,45% of nominal rather than an absolute per-unit price) — the schema stores an absolute `price Decimal(18,2)` per unit; representing a bond as nominal + percent price is a modelling change no C-task covers.
6. **Emas quantity in grams + per-gram price** (`investasi.html:254-256`) — works today only by convention (`quantity` = grams, `costBasisPerUnit` = per gram); there is no unit metadata on `Investment`, so the UI cannot label it. Adjacent to C3's lot/lembar work but not named by it.
7. **Aset four-way category tab filter** (`aset.html:16-22`) mixing accounts, investments and physical assets on one page — D1/D2 are strictly the eye toggle and the fixed-Rp mode. Treat the tab layout as Group N/UI polish, not D.
8. **Prototype's own "1 lot = 100 lembar" IDX rule** is hard-coded in the mockup; the real system has no place to record the lot size per instrument. C3 says "store canonical lembar, ×100" — fine as a constant, but flag if any non-100-lot instrument is ever expected.

### Migration note

C2 (`Investment.purchasedAt`, `maturityDate`, enum `+ deposito`) and D2 (`Asset.valueChangeMode`,
`valueChangeAmount`) are two independent additive migrations landing in the same epic. Per the
epic's own hazard note (`docs/epics/EPIC-024-client-revisions-aug2026.md:625`), author them against
the latest `development` and run C2 → D2 in that order. Adding a Prisma **enum value** (`deposito`)
is not transactional-safe alongside a value usage in the same migration on PostgreSQL — split the
`ALTER TYPE ... ADD VALUE` into its own migration ahead of any code that references it.

# EPIC-024 Groups E + F — prototype vs. real app/API gap audit

Repo: `/home/stealth/WORK/vibes/wealthme2` · branch `development` · read-only audit.

## Group E — Pajak

### tax.html

- Feature: Dot-thousand live formatting on Bruto input (`780.000.000`) — **EXISTS** — evidence: `apps/web/src/app/(app)/tax/page.tsx:408-421` — `onChange` runs `formatNumber(parseRupiah(e.target.value))`, identical to the prototype's `attachDotFormatting`.
- Feature: Dot-thousand live formatting on Perpuluhan/Zakat input — **EXISTS** — evidence: `apps/web/src/app/(app)/tax/page.tsx:453-466` — same `formatNumber(parseRupiah(...))` pipeline on the `zakat` field.
- Feature: Payload sent as pure numeric strings (no dots) — **PARTIAL** — evidence: `apps/web/src/app/(app)/tax/page.tsx:266-273` — payload is built from the **server-echoed** `pph21Result` via `String(pph21Result.grossIncome)` / `String(Math.round(pph21Result.totalTax))`, **not** from `parseRupiah` digits as E1 requires. Any non-integer or ≥1e21 value from the server serializes as `"7.8e+21"` / `"780000000.5"` and is rejected by the `^\d+$` matcher.
- Feature: Upper-bound guard on the amount (E1's "upper bound guard") — **MISSING** — evidence: `apps/web/src/app/(app)/tax/page.tsx:162-170` — `gross`/`zakat` are unbounded strings; `parseRupiah` (`apps/web/src/lib/format.ts:57-60`) is `parseInt` with no cap, so a 25-digit paste reaches the API as exponent notation.
- Feature: API `@Max`/length cap on `create-tax-record.dto.ts` — **MISSING** — evidence: `apps/api/src/tax/dto/create-tax-record.dto.ts:20-33` — `grossIncome`/`ptkp`/`netTax` carry only `@IsString()` + `@Matches(/^\d+$/)`; no `@MaxLength`, no numeric ceiling. Same gap in `apps/api/src/tax/dto/update-tax-record.dto.ts:22-37`.
- Feature: API `@Max` cap on `pph21.dto.ts` — **MISSING** — evidence: `apps/api/src/calculators/dto/pph21.dto.ts:11-19` — note the file lives at `apps/api/src/calculators/dto/pph21.dto.ts`, **not** under `apps/api/src/tax/dto/` as the epic text implies. `grossIncome` is `@IsNumber() @Min(0)` with no `@Max` and no `@IsInt`, so a float or 1e30 is accepted and echoed straight back into the save payload above.
- Feature: Friendlier validation message than `"grossIncome must be a numeric string"` — **MISSING** — evidence: `apps/api/src/tax/dto/create-tax-record.dto.ts:23` — the literal string the prototype calls out as the bug is still the message verbatim.
- Feature: Surface server errors in the toast — **EXISTS** — evidence: `apps/web/src/app/(app)/tax/page.tsx:93-107, 236, 246` — `extractApiErrorMessage` handles both `message: string` and NestJS's `message: string[]`, wired into both mutations' `onError`.
- Feature: Live PPh 21 recompute (PKP, biaya jabatan, effective rate) — **EXISTS** — evidence: `apps/web/src/app/(app)/tax/page.tsx:180-205` — computed server-side via `POST /calculators/pph21`, debounced (`useDebounce`, 300 ms), rather than duplicated client-side as in the prototype.
- Feature: Progressive-bracket table incl. the 30% (500 jt – 5 M) row — **EXISTS** — evidence: `apps/web/src/app/(app)/tax/page.tsx:50-57` — `BRACKET_ROWS` covers idx 0–4; the historical skipped-row bug (EPIC-022 E4) is already fixed.
- Feature: Riwayat Catatan Pajak list — **EXISTS** — evidence: `apps/web/src/app/(app)/tax/page.tsx:579-580`.
- Feature: "Lapor SPT Tahunan" external link to djponline — **EXISTS** — evidence: `apps/web/src/app/(app)/tax/page.tsx:654`.
- Feature: Tax-year picker (segmented 2026/2025/2024 + `<select>`) — **MISSING** — evidence: `apps/web/src/app/(app)/tax/page.tsx:65, 269` — `CURRENT_YEAR` is a module constant from `new Date().getFullYear()`; every save is hardcoded to the current year and no year selector is rendered. **Not covered by E1.**
- Feature: "Simpan ke Catatan Pajak" confirmation dialog showing the payload — **MISSING** — evidence: `apps/web/src/app/(app)/tax/page.tsx:262-275` — `handleSaveTaxRecord` mutates directly; no `Dialog` exists on the page (`grep Dialog` → no match). **Not covered by E1.**
- Feature: Dokumen Pajak upload card — **MISSING** — evidence: `apps/api/src/tax/dto/create-tax-record.dto.ts:40-43` — only a `documentUrl` string field exists; no upload UI on the page. Prototype itself labels this "segera hadir", so this is aspirational in both.

## Group F — Split Bill

### splitbill.html

- Feature: Create dialog — payout account (`Rekening Tujuan Pembayaran`) select — **EXISTS** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:588-605` + required-field guard at `:316`; API requires it at `apps/api/src/split-bills/dto/create-split-bill.dto.ts:44-47`.
- Feature: Create dialog — payment instructions field — **EXISTS** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:608-627`.
- Feature: Create dialog — Rata/Custom method toggle + per-person + remainder helper — **EXISTS** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:625-652` (toggle) and `:719-768` (remainder banner + "Bagi Rata Sisa", which the prototype does not even have).
- Feature: Create dialog responsive at ≤375 px (F2) — **MISSING** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:654-690` — each participant row is `flex items-center gap-2` with a `flex-1` name input using `FIELD_CLASS` (`:30-31`, which has no `min-w-0`), plus a `w-[100px] shrink-0` amount box and a `size-8 shrink-0` delete button. `grep min-w-0` over the whole file returns **zero matches** — the exact mechanism the prototype's CSS comment identifies (form controls' ~20ch intrinsic min-width refusing to shrink) is unmitigated. Dialog content box is ~295 px at 375 px viewport (`max-w-[min(480px,calc(100%-2rem))] p-6`, `:549`) against ~330 px of min-content.
- Feature: Detail dialog responsive at ≤375 px (F2) — **MISSING** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:836-897` — participant row is `flex items-center gap-3` holding a `size-9` avatar + `flex-1` name block (no `min-w-0`) + status badge + "Tandai Lunas" button + copy-link button, all `shrink-0`. Same overflow shape.
- Feature: Header stat cards breakpointed (F2's "grid-cols-3 header") — **EXISTS** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:399` — already `grid-cols-1 … md:grid-cols-3`. This sub-item of F2 appears already done; the participant rows are the real remaining work.
- Feature: Edit payout account on an existing bill (F3, UI) — **MISSING** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:790-899` — the detail dialog renders title/revoke/total/participants only; no payout select, no instructions field, no "Simpan Rekening Tujuan" button (`payoutAccountId` appears in the file only at `:97, :316, :351, :595` — all create-flow).
- Feature: `PATCH /split-bills/:id` accepting `payoutAccountId` (F3, API) — **MISSING** — evidence: `apps/api/src/split-bills/split-bills.controller.ts` — the only `@Patch` routes are `…/:id/revoke` and `…/:id/participants/:participantId/confirm`. There is no update DTO in `apps/api/src/split-bills/dto/` (only create/confirm/response DTOs). A legacy bill with `payoutAccountId === null` is therefore permanently unconfirmable: `apps/api/src/split-bills/split-bills.service.ts:354-358` throws `BadRequestException` on confirm and offers no repair path.
- Feature: "Rekening tujuan kosong" warning badge on the list card — **MISSING** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:399-527` — list cards show only paid/unpaid progress; nothing surfaces a null payout account before the user hits the confirm-time 400.
- Feature: Per-participant "Salin Link" — **EXISTS** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:360-366` (clipboard write) + `:880-895` (per-row `Link2` button, disabled when revoked).
- Feature: "Salin Semua Link" bulk copy — **MISSING** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:880-895` — only the per-participant button exists. **Not covered by F1–F3.**
- Feature: "Cabut Semua Link" (revoke all) — **EXISTS** — evidence: `apps/web/src/app/(app)/splitbill/page.tsx:797-807` + `apps/api/src/split-bills/split-bills.controller.ts` `…/:id/revoke`, gated behind a real confirm dialog (`:906-918`).
- Feature: Confirm-paid posts real income to the payout account — **EXISTS** — evidence: `apps/api/src/split-bills/split-bills.service.ts:354-363` — resolves the payout account then posts a real Transaction; matches the prototype's "Tandai Lunas & Catat Pemasukan" copy.

### split-public.html

- Feature: Public participant share page at `/split/[shareToken]` — **PARTIAL** — evidence: `apps/web/src/app/split/[shareToken]/page.tsx:65-281` — the page is fully built (per-participant scoping, payout block, claim button, revoked/404/network states) and the API route is genuinely public (`apps/api/src/split-bills/split-bills.controller.ts` `@Public()` + `@Throttle` on `GET /split-bills/participant/:token`), **but** it is unreachable anonymously.
- Feature: `/split` in the Next.js middleware allowlist (F1) — **MISSING** — evidence: `apps/web/src/middleware.ts:7-16` — `isPublicRoute` lists `/login`, `/register`, `/lupa-password`, `/reset-password`, `/join/`, `/api/auth`, `/_next`, `/favicon` and a file-extension regex. `/split/...` matches neither, and the matcher `/((?!api|_next/static|_next/image|favicon.ico).*)` (`:33`) does include it, so an anonymous recipient is redirected to `/login` at `:27`. This is the single blocking defect for the whole public flow.
- Feature: "Saya Sudah Transfer" claim (claim ≠ confirmation) — **EXISTS** — evidence: `apps/web/src/app/split/[shareToken]/page.tsx:83-97` + `apps/api/src/split-bills/split-bills.controller.ts` `PATCH /split-bills/participant/:token/claim` (`@Public()`, throttled 10/min); moves no money, matching the prototype's disclaimer.
- Feature: Payout destination shown to the recipient (name · institution · masked number · instructions) — **EXISTS** — evidence: `apps/web/src/app/split/[shareToken]/page.tsx:196-215`.
- Feature: Distinct "payout configured but unavailable" vs "never configured" copy — **EXISTS** — evidence: `apps/web/src/app/split/[shareToken]/page.tsx:216-232` — better than the prototype, which only models the "never configured" variant.
- Feature: "Salin Nomor" copy-account-number button — **MISSING** — evidence: `apps/web/src/app/split/[shareToken]/page.tsx:196-215` — the account line is plain text; no clipboard affordance. **Not covered by F1–F3.**
- Feature: Claim button disabled when payout is unset (prototype's second variant) — **MISSING** — evidence: `apps/web/src/app/split/[shareToken]/page.tsx:234-249` — the claim button renders for any `status === "pending"` regardless of `participant.payout.configured`, so a recipient can claim "I transferred" against a bill with no destination. **Not covered by F1–F3.**
- Feature: Status timeline (dibuat → link dibagikan → klaim → dikonfirmasi) — **MISSING** — evidence: `apps/web/src/app/split/[shareToken]/page.tsx:250-263` — only a single flat status notice per state; no timeline. **Not covered by F1–F3.**

### Scope-creep flags

- **Tax year selector** (`tax.html:26-33, 79-84`) — real page hardcodes `CURRENT_YEAR` (`tax/page.tsx:65`); saving/viewing a prior year is impossible. Substantial feature, outside E1's wording.
- **Save-confirmation dialog on tax** (`tax.html:298-342`) — no dialog exists on the real page; save is one click. Outside E1.
- **Claim button gating on missing payout** (`split-public.html:225-230`) — a genuine data-integrity issue (claims against a bill with no destination) that F1–F3 never mention; arguably belongs with F3.
- **"Salin Nomor" on the public page and "Salin Semua Link" on the detail dialog** — both convenience affordances the prototype depicts; neither is in F1–F3.
- **Public-page status timeline** (`split-public.html:167-184`) — presentational, cheap to skip, but it is what the prototype shows.
- **"Rekening tujuan kosong" badge on list cards** (`splitbill.html:124`) — the prototype surfaces the broken-payout state _before_ the user tries to confirm; F3 only asks for the repair path, not the signal.
- **`pph21.dto.ts` path in the epic is wrong** — E1 implies `apps/api/src/tax/dto/pph21.dto.ts`; the file is at `apps/api/src/calculators/dto/pph21.dto.ts`. Worth correcting before the task is worked.
- **F2's "breakpoint the grid-cols-3 header" is already done** (`splitbill/page.tsx:399`) — the remaining F2 work is entirely the two dialogs' participant rows.

# EPIC-024 gap audit — Groups G / H / I

Scope: `docs/prototype/pages/{liabilitas,warisan,donation}.html` vs
`apps/web/src/app/(app)/{liabilitas,warisan,donation}/page.tsx` + `apps/api`.
All paths relative to `/home/stealth/WORK/vibes/wealthme2`.

Headline: **the backend for Group G is fully built and completely unused by the
liabilitas page** — the API has PATCH/pay/purchase/DELETE, the page renders a
read-only card with no actions at all.

## Group G — Liabilitas

### liabilitas.html

- Feature: **Per-card "Detail" action (dialog with akad/tenor/autodebet + amortisation schedule)** — **MISSING** — evidence: `apps/web/src/app/(app)/liabilitas/page.tsx:472-561` — `LiabilityCard` renders header + 4 stats + progress bar and returns; no action row, no dialog anywhere in the 714-line file (prototype `liabilitas.html:99-101,313-425`).
- Feature: **Amortisation schedule table (6 next instalments: pokok/bunga/sisa)** — **MISSING (FE + BE)** — evidence: `apps/api/src/liabilities/liabilities.controller.ts:47,58,71,83,98,121,147` — the only routes are `GET /`, `GET /summary`, `POST /`, `PATCH /:id`, `POST /:id/pay`, `POST /:id/purchase`, `DELETE /:id`; there is no schedule/projection endpoint. `splitPayment()` (`apps/api/src/liabilities/amortisation.util.ts:62`) computes ONE payment's split server-side only and is never exported to `packages/contracts`.
- Feature: **Per-card "Edit" action (PATCH)** — **PARTIAL — backend only** — evidence: `apps/api/src/liabilities/liabilities.controller.ts:83-95` (`@Patch(":id")` → `UpdateLiabilityDto`) vs no `PATCH` call anywhere in `apps/web/src` (`grep "liabilities/"` returns only `anggaran/page.tsx:388` and `components/shell/transaction-dialog.tsx:242`). The web page can only CREATE (`liabilitas/page.tsx:170-173`).
- Feature: **Per-card "Hapus" action + confirm dialog** — **PARTIAL — backend only** — evidence: `apps/api/src/liabilities/liabilities.controller.ts:147-158` (`@Delete(":id")`, 204) — no delete UI, no confirm dialog, no `t.liabilitas.*` delete strings in `apps/web/src/i18n/id.ts`.
- Feature: **"Bayar" action with source-account picker** — **PARTIAL — wired on the WRONG page** — evidence: `apps/web/src/app/(app)/anggaran/page.tsx:388` posts `POST .../liabilities/:id/pay` with a source-account select (`anggaran/page.tsx:250`), but the amount is locked to `minimumPayment` (`anggaran/page.tsx:189,400`). No pay entry point exists on liabilitas itself.
- Feature: **Payment-type segmented control (cicilan penuh / minimum / pelunasan sebagian) + editable amount** — **MISSING** — evidence: `apps/web/src/app/(app)/anggaran/page.tsx:390-401` — the pay body is `{sourceAccountId, amount: String(obligation.amountDue)}` with no user-editable amount; prototype `liabilitas.html:526-536`.
- Feature: **Live principal/interest split preview before paying** — **MISSING (no FE path to the math)** — evidence: `apps/api/src/liabilities/dto/liability-response.dto.ts:3-25` — the pay response returns only the mutated liability (no `interest`/`principal` fields), and no preview endpoint exists; the split lives solely in `amortisation.util.ts`. Prototype computes it client-side (`liabilitas.html:589-597`).
- Feature: **"Tanggal Bayar" (back-dated payment)** — **MISSING (BE blocker)** — evidence: `apps/api/src/liabilities/dto/pay-liability.dto.ts:4-16` — `PayLiabilityDto` accepts only `sourceAccountId` + `amount`; no `paidAt`. Prototype `liabilitas.html:549-552`.
- Feature: **Credit-card purchase (raise card debt, no account debit)** — **EXISTS** — evidence: `apps/api/src/liabilities/liabilities.controller.ts:121-145` + `apps/web/src/components/shell/transaction-dialog.tsx:242` — built by EPIC-023 E3, wired through the global transaction dialog (not depicted in this prototype page).
- Feature: **`autoAdvanceDueDate` toggle** — **EXISTS** — evidence: `apps/web/src/app/(app)/liabilitas/page.tsx:394-404` (create modal checkbox) + `apps/api/prisma/schema.prisma` `Liability.autoAdvanceDueDate`. Prototype `liabilitas.html:477-480`.
- Feature: **Overdue late-fee warning notice ("Denda keterlambatan berjalan")** — **MISSING** — evidence: `apps/web/src/app/(app)/liabilitas/page.tsx:89-91` — overdue only flips a `StatusBadge` variant to danger; no penalty amount is modelled anywhere in `Liability` (`apps/api/prisma/schema.prisma` model Liability has no fee/penalty field). Prototype `liabilitas.html:280-283`.

## Group H — Warisan

### warisan.html

- Feature: **Heir `relationship` required before submit** — **MISSING** — evidence: `apps/web/src/app/(app)/warisan/page.tsx:573-580` — `handleSave` filters heirs on `h.name.trim()` only and sends `relationship: h.relationship.trim()`, so an empty relationship is posted verbatim. This is exactly the failure the prototype annotates at `warisan.html:318-322`.
- Feature: **Server rejects the empty relationship (root cause)** — **EXISTS (server side is correct)** — evidence: `apps/api/src/inheritance/dto/create-heir.dto.ts:20-24` — `@IsString() @IsNotEmpty() @MaxLength(100) relationship!: string` → 400 on empty; the FE just never prevents or surfaces it.
- Feature: **Inline field error on the relationship input (`aria-invalid` + "Hubungan wajib diisi")** — **MISSING** — evidence: `apps/web/src/app/(app)/warisan/page.tsx:274-287` — the relationship input has no `required`, no `aria-invalid`, no `aria-required`, and no error slot. Prototype `warisan.html:321-322`.
- Feature: **Form-level error banner blocking save** — **MISSING** — evidence: `apps/web/src/app/(app)/warisan/page.tsx:557-617` — `handleSave` has three guards (session, name, value) and a >100% share guard at `:581-584`; nothing for relationship, and no banner element. Prototype `warisan.html:347-350`.
- Feature: **Surface the server's message instead of a generic toast** — **MISSING** — evidence: `apps/web/src/app/(app)/warisan/page.tsx:471` — `onError: () => toast.error(t.warisan.toastUpdateFailed)` discards the error entirely. `extractApiErrorMessage` exists but only as a page-local copy in `apps/web/src/app/(app)/akun/page.tsx:165` and `apps/web/src/app/(app)/dana/page.tsx:22` — it is **not** a shared helper, so H1 must copy it a third time or promote it (`@/lib/*` is a protected path).
- Feature: **Allocation running total + "x% belum dialokasikan"** — **EXISTS** — evidence: `apps/web/src/app/(app)/warisan/page.tsx:352-366` (bar + suffix) and per-asset at `:141-166`. Prototype `warisan.html:339-345`.
- Feature: **Link heir to a family member (live-fills name/relationship)** — **EXISTS** — evidence: `apps/web/src/app/(app)/warisan/page.tsx:301-338` + `apps/api/src/inheritance/dto/create-heir.dto.ts:37-40` (`memberUserId`). Prototype `warisan.html:279-283`.
- Feature: **Edit / Hapus per inheritance asset + delete-confirm copy** — **EXISTS** — evidence: `apps/web/src/app/(app)/warisan/page.tsx:178` (`<RowActions onEdit onDelete />`) — this is the reusable pattern EPIC-024 G1 tells the liabilitas work to copy.
- Feature: **"Terlihat oleh ahli waris" visibility toggle** — **EXISTS** — evidence: `apps/web/src/app/(app)/warisan/page.tsx:172-177` (`<Switch>` → visibility mutation at `:487-496`).
- Feature: **Heir allocation donut ("Alokasi Ahli Waris" per-heir rupiah rollup)** — **MISSING** — evidence: `apps/web/src/app/(app)/warisan/page.tsx` contains no chart import (only `CloudUpload, Plus, Save, Scroll, X` at `:4`); there is no cross-asset per-heir aggregation. Prototype `warisan.html:167-198,381-386`.
- Feature: **Upload dokumen pendukung** — **EXISTS as the same "coming soon" stub** — evidence: `apps/web/src/app/(app)/warisan/page.tsx:722,873` → `toast(t.warisan.toastUploadUnavailable)`. Matches prototype `warisan.html:210-212`.

## Group I — Donasi

### donation.html

- Feature: **Inline "Pilih agama keluarga" prompt (dropdown + save) when `religion === null`** — **PARTIAL** — evidence: `apps/web/src/app/(app)/donation/page.tsx:418-430` — the null branch renders title + description only ("Pilih agama keluarga di Pengaturan Akun…", `apps/web/src/i18n/id.ts:1824-1826`); there is **no** dropdown, no save, not even a link to `/akun`. The mutation it needs already exists (`apps/web/src/hooks/use-family-religion.ts:59-60` `updateReligion`, owner-gated via `isOwner` at `:56-57`), and the working picker exists at `apps/web/src/app/(app)/akun/page.tsx:1570-1608` — I1 is a lift of that control into this branch.
- Feature: **Calculator appears immediately after choosing (no page reload)** — **PARTIAL** — evidence: `apps/web/src/app/(app)/donation/page.tsx:432,515,553` — the three calculator branches are driven by `religion` from the same react-query cache the mutation invalidates, so the re-render is free once the prompt is inline; nothing to build beyond the prompt itself.
- Feature: **Religion-appropriate calculator (zakat / perpuluhan / none), honest loading + error states** — **EXISTS** — evidence: `apps/web/src/app/(app)/donation/page.tsx:401-416` (loading/error), `:432-511` (islam → zakat), `:515-551` (kristen → perpuluhan, `/calculators/perpuluhan`), `:553-565` (none). Prototype `donation.html:34-82` shows the Christian variant.
- Feature: **`FamilyGroup.religion` field + GET/PATCH endpoint** — **EXISTS** — evidence: `apps/api/prisma/schema.prisma:394-405` (`religion FamilyReligion?`, nullable = "never chosen") + `apps/web/src/hooks/use-family-religion.ts:36-44` (`GET /family-groups/:id/religion`).
- Feature: **Rename menu/title to "Donasi" (both locales)** — **MISSING** — evidence: `apps/web/src/i18n/id.ts:103` and `:152` both read `donation: "Donasi & Zakat"`; `apps/web/src/i18n/en.ts:103,152` read `"Donation & Zakat"`. The prototype's own nav label is plain `"Donasi"` (`docs/prototype/assets/shell.js:117-120`). Two occurrences per locale (sidebar + mobile/secondary nav map) — all four must change together or `dictionary.test.ts` structure parity fails.
- Feature: **Clarify the below-nisab Rp 0 answer on `/kalkulator`** — **PARTIAL** — evidence: `apps/web/src/app/(app)/kalkulator/page.tsx:242-247` already prints "Harta zakatable belum mencapai nisab (Rp X)." (`apps/web/src/i18n/id.ts:959-960`), but the headline still shows `formatRupiah(result.zakat)` = "Rp 0" as the primary number (`kalkulator/page.tsx:228`). The clarification exists; what I1 asks for is making the Rp 0 not read as a bug.
- Feature: **Tax-deductible flag limited to obligatory contributions (zakat + persepuluhan)** — **EXISTS** — evidence: `apps/web/src/app/(app)/donation/page.tsx:79-83,271,734-755` (checkbox disabled + note) mirroring the server check. Prototype `donation.html:224-240`.
- Feature: **Optional source-account picker ("hanya catat, jangan potong saldo")** — **EXISTS** — evidence: `apps/web/src/app/(app)/donation/page.tsx:708-727` + `:357` (`accountId: accountId || undefined`). Prototype `donation.html:213-222`.
- Feature: **Prefill the modal from the calculator ("Catat Perpuluhan")** — **EXISTS** — evidence: `apps/web/src/app/(app)/donation/page.tsx:325-342` (`openModal("zakat" | "perpuluhan")`). Prototype `donation.html:286-292`.
- Feature: **Kuitansi / receipt number on each donation row** — **MISSING** — evidence: `apps/web/src/app/(app)/donation/page.tsx:594-596` renders only the date; no receipt field is read, and `apps/api/src/donations/dto/create-donation.dto.ts` has no receipt field. Prototype `donation.html:96,109,122`.
- Feature: **Tax-summary stat tiles (pengurang pajak / sukarela / kuitansi tersimpan)** — **MISSING** — evidence: `apps/web/src/app/(app)/donation/page.tsx:362` computes only `totalAmount`; no deductible/voluntary split is rendered. Prototype `donation.html:134-159`.

### Scope-creep flags

- **G — amortisation schedule needs a new endpoint.** G1 says "Detail (dialog with info + amortisation summary)", but the prototype's detail dialog shows a 6-row future schedule (`liabilitas.html:353-410`). Nothing server-side projects forward — `splitPayment()` handles one payment. Either scope the dialog to a _current-payment_ split (cheap, reuses the util if exported to `packages/contracts`) or add `GET /liabilities/:id/schedule` (new BE work not in G1).
- **G — "Bayar" needs `PayLiabilityDto.paidAt` and a split preview.** Both the payment-date field and the live pokok/bunga preview require BE changes (`pay-liability.dto.ts:4-16`, and a preview route or a contracts-shared `splitPayment`). G1 reads as pure "UI wiring"; it is not.
- **G — prototype extras outside G1:** type filter tabs (`liabilitas.html:44-50`), a third "Cicilan Bulan Ini" summary tile (`:34-40`), the 6-month payoff-projection chart (`:304-309`), and the late-fee/denda notice (`:280-283`). The real page has 2 tiles, no tabs, no chart (`liabilitas/page.tsx:630-667`). None are in G1's text.
- **H — `extractApiErrorMessage` is not shared.** H1's "surface the server's message via `extractApiErrorMessage`" implies a helper that does not exist in `@/lib`; it is duplicated page-locally in akun and dana. `apps/web/src/lib/*` is a protected path, so either copy it a third time into warisan or get a reviewed foundation change.
- **H — heir allocation donut** (`warisan.html:167-198`) is a whole cross-asset aggregation feature, not in H1.
- **I — "rename menu" is 4 string edits, not 1.** `donation` appears twice per locale in the nav dictionaries (`id.ts:103,152`; `en.ts:103,152`); `dictionary.test.ts` enforces id/en structure parity.
- **I — donation receipt numbers + tax stat tiles** (`donation.html:96,134-159`) would need a `receiptNumber` column on `Donation` and a summary computation; not in I1.

# EPIC-024 Groups J / K / L — prototype vs real app gap audit

Repo: `/home/stealth/WORK/vibes/wealthme2` · branch `development` · audited 2026-08-11

---

## Group J — Master Data

### masterdata.html

- Feature: Kategori CRUD persisted to server (add/edit/delete, icon, tipe, COA account, privat toggle) — **EXISTS** — evidence: `apps/web/src/app/(app)/masterdata/page.tsx:97-107` (GET), `:204-241` (POST/PATCH), `:243-267` (DELETE), COA picker `:111-120` + `:273-281`, icon/tipe/isPrivate fields `apps/web/src/components/crud/crud-config.ts:380-400` — the one master-data entity with a real API; matches the prototype's `dlg-md-kategori` dialog including the COA select (`masterdata.html:485-496`) and privacy switch (`masterdata.html:498-506`).
- Feature: Category delete rejected with a message naming the dependent data — **EXISTS** — evidence: `apps/web/src/app/(app)/masterdata/page.tsx:81-85` + `:258-265` — `extractApiErrorMessage` surfaces the API's 409 naming budgets/allowances, matching prototype copy `masterdata.html:394-395`.
- Feature: Bank reference list, persisted per family, add + delete — **MISSING** — evidence: `apps/web/src/app/(app)/masterdata/page.tsx:44-73` `REFERENCE_GROUPS` is a hardcoded const; `:122` holds it in `useState`; `:137-148` `removeItem` only mutates local React state and `:171-174` returns `toast.info(t.masterdata.toastReferenceReadOnly)` on add — the toast literally reads "Daftar referensi ini bawaan sistem — penambahan belum didukung." (`apps/web/src/i18n/id.ts:1344-1345`). The prototype states the opposite: "Perubahan langsung tersimpan ke server dan berlaku untuk seluruh anggota keluarga" (`masterdata.html:93-94`).
- Feature: E-Wallet reference list (persisted) — **MISSING** — evidence: same, `masterdata/page.tsx:57-60` (`mdewallet`, local only).
- Feature: Jenis Transaksi reference list (persisted) — **MISSING** — evidence: `masterdata/page.tsx:49-52` (`mdtxntype`, local only).
- Feature: Jenis Investasi reference list (persisted) — **MISSING** — evidence: `masterdata/page.tsx:53-56` (`mdinvtype`, local only).
- Feature: Lembaga Donasi reference list (persisted) — **MISSING** — evidence: `masterdata/page.tsx:61-64` (`mdlembaga`, local only).
- Feature: Kategori Aset reference list (persisted) — **MISSING** — evidence: `masterdata/page.tsx:65-68` (`mdasettype`, local only).
- Feature: Jenis Asuransi reference list (persisted) — **MISSING** — evidence: `masterdata/page.tsx:69-72` (`mdinstype`, local only).
- Feature: `ReferenceItem` model / table — **MISSING** — evidence: zero hits for `ReferenceItem|referenceItem` across `apps/**` and `packages/**` (`.ts`/`.tsx`/`.prisma`); no such model in `apps/api/prisma/schema.prisma`.
- Feature: `GET/POST/DELETE /family-groups/:id/reference-items` endpoints — **MISSING** — evidence: no `reference-items` module under `apps/api/src/` (module list: accounts, categories, coa-accounts, … no reference-items).
- Feature: Seed defaults at registration + backfill migration — **MISSING** — evidence: no ReferenceItem anywhere, so nothing to seed; the defaults exist only as the frontend const at `masterdata/page.tsx:44-73`.
- Feature: `bawaan` (isSystem) badge distinguishing seeded vs family-added items — **MISSING** — evidence: `masterdata/page.tsx:395-419` renders every reference item as a plain chip with no badge; prototype tags seeded rows `<span class="badge badge--gray">bawaan</span>` (`masterdata.html:161`, `:201`, `:233`, …).
- Feature: Footer copy claiming reference lists are family-scoped — **MISSING (contradicts)** — evidence: `apps/web/src/i18n/id.ts:1335-1337` still says "Daftar lain (bank, jenis transaksi, dll.) adalah referensi sistem dan dikelola secara lokal", the exact wording `masterdata.html:392-396` replaces.

### mastercoa.html

- Feature: Master COA list + add/edit/delete with group tabs, budgetType (FIXED/VARIABLE/REIMBURSEMENT) — **EXISTS** — evidence: `apps/web/src/app/(app)/mastercoa/page.tsx:171` (GET), `:218-222` (POST), `:247-251` (PATCH), `:266-270` (DELETE), `:30` `CoaBudgetType`, `:122` group tabs; API `apps/api/src/coa-accounts/coa-accounts.controller.ts:33-77`. Fully backed — no Group J work needed here.
- Feature: Category→COA link from masterdata — **EXISTS** — evidence: `masterdata/page.tsx:298-300` (`CardLink` → `/mastercoa`) and the per-chip COA code render `:337-344`, matching `masterdata.html:104` + `:117-119`.

---

## Group K — Labels

- Feature: `nav.items.dana` = "Cash & E-Wallet" — **MISSING** — evidence: `apps/web/src/i18n/id.ts:96` `dana: "Tunai"`, `apps/web/src/i18n/en.ts:96` `dana: "Cash"` — prototype titles the page "Cash & E-Wallet" (`dana.html:6`, `:18`).
- Feature: `shell.pageTitles.dana` = "Cash & E-Wallet" — **MISSING** — evidence: `apps/web/src/i18n/id.ts:140` / `en.ts:140` both still short form (`"Tunai"` / `"Cash"`); consumed by `apps/web/src/components/shell/topbar.tsx:21` and `mobile-bars.tsx:29`.
- Feature: `panduan…dana` title = "Cash & E-Wallet" — **MISSING** — evidence: `apps/web/src/i18n/id.ts:737-738` `dana: { title: "Tunai", … }`, `en.ts:737-738` `title: "Cash"`.
- Feature: `dana.*` page strings use "Cash & E-Wallet" — **PARTIAL** — evidence: `apps/web/src/i18n/id.ts:1495` `totalLabel: "💵 Total Tunai & E-Wallet"` and `en.ts:1495` `"💵 Total Cash & E-Wallet"` already match `dana.html:35`; but section headings `id.ts:1500` `cashSectionTitle: "Tunai"` / `en.ts:1500` `"Cash"` are the intended per-section labels (prototype `dana.html:88`, `:146` also splits "Tunai" / "E-Wallet"), so only the page-level identity strings need the rename.
- Feature: `nav.items.rekening` = "Bank & Account" — **MISSING** — evidence: `apps/web/src/i18n/id.ts:97` `rekening: "Rekening"`, `en.ts:97` `"Bank Accounts"` — prototype titles it "Bank & Account" (`rekening.html:6`, `:18`) and cross-links it by that name from `dana.html:80`.
- Feature: `shell.pageTitles.rekening` = "Bank & Account" — **MISSING** — evidence: `apps/web/src/i18n/id.ts:141` / `en.ts:141`.
- Feature: `search…cards.rekening` = "Bank & Account" — **MISSING** — evidence: `apps/web/src/i18n/id.ts:1048` `rekening: { name: "Rekening", desc: "Tambah rekening bank" }`, `en.ts:1047` `name: "Bank Account"`.
- Feature: `aset.tabs.rekening` = "Bank & Account" — **MISSING** — evidence: `apps/web/src/i18n/id.ts:1192` `rekening: "Rekening"`, `en.ts:1191` `"Bank Accounts"`. (Sibling `aset.tabs.dana` at `id.ts:1191` is already `"Tunai & E-Wallet"` / `en.ts:1190` `"Cash & E-Wallet"` — closest existing match.)
- Feature: `panduan…rekening` title = "Bank & Account" — **MISSING** — evidence: `apps/web/src/i18n/id.ts:733-734` `rekening: { title: "Rekening", … }` / `en.ts:733-734` `title: "Bank Accounts"`.
- Feature: `bank` label consistency between `aset.accountTypeLabels` and `rekening.typeLabels` — **MISSING (inconsistency confirmed)** — evidence: `apps/web/src/i18n/id.ts:1204` `bank: "Bank"` vs `apps/web/src/i18n/id.ts:1685` `bank: "Tabungan"`; same split in EN, `en.ts:1203` `bank: "Bank"` vs `en.ts:1684` `bank: "Savings"`.
- Feature: Route ids `/dana`, `/rekening` unchanged (structural) — **EXISTS (no change needed)** — evidence: `apps/web/src/lib/nav.ts:128-129` `{ id: "dana", href: "/dana" }`, `{ id: "rekening", href: "/rekening" }`; both ids also appear in the two id-union lists at `nav.ts:72-73` and `:201-202`.

---

## Group L — Lampiran

### transaksi.html

- Feature: `StorageDiskService` (real disk implementation of `StoragePort`) — **MISSING** — evidence: `apps/api/src/storage/storage.module.ts:6` binds `{ provide: StoragePort, useClass: StorageMockService }`; `apps/api/src/storage/storage-mock.service.ts:7-21` returns fake `/mock-storage/${key}` paths and `delete()` is a no-op. Only three files exist under `apps/api/src/storage/`.
- Feature: `STORAGE_DIR` env + persistent volume — **MISSING** — evidence: zero hits for `STORAGE_DIR` across the repo (`.ts`, `.yml`, `.env*`).
- Feature: StoragePort actually consumed by any module — **MISSING** — evidence: outside `apps/api/src/storage/` the only reference is `apps/api/src/app.module.ts:114` importing `StorageModule`; no service injects `StoragePort`. The port is dead code today.
- Feature: `TransactionAttachment` model — **MISSING** — evidence: zero case-insensitive hits for `attachment` across `apps/**` and `packages/**` (`.ts`/`.tsx`/`.prisma`).
- Feature: `POST/GET/DELETE /family-groups/:id/transactions/:txId/attachments` — **MISSING** — evidence: same zero-hit grep; `apps/api/src/transactions/` has no attachment controller/route.
- Feature: Multipart upload plumbing to copy from — **EXISTS (pattern only)** — evidence: `apps/api/src/reconciliation/reconciliation.controller.ts:12` `UploadedFile`, `:15` `FileInterceptor`, `:24` `memoryStorage`, `:109-116` — the reusable `FileInterceptor` pattern L2 names is real and available.
- Feature: File/photo input in the transaction dialog — **MISSING** — evidence: `apps/web/src/components/shell/transaction-dialog.tsx` has **no** `type="file"` input anywhere (repo-wide the only file input is `apps/web/src/app/(app)/rekonsiliasi/page.tsx:1391`). The "Scan Struk" button at `transaction-dialog.tsx:445-455` calls `startOcr` (`:309-311`) which is a pure `setTimeout` animation over the hardcoded `OCR_ITEMS` array (`:83-94`) — a simulated camera, not an upload. Nothing is sent to the server.
- Feature: Attachment list in transaction detail — **MISSING** — evidence: `apps/web/src/app/(app)/transaksi/page.tsx:305-329` `TransactionDetailDialog` renders exactly five `DetailRow`s (Kategori, Akun, Tanggal & Waktu, Deskripsi, Dibuat Pada) then the Edit/Hapus buttons at `:330-345` — no "Lampiran" section, no upload affordance. Prototype shows a full attachment block at `transaksi.html:476-524` (header + "+ Tambah Lampiran" + thumbnail card + drag-drop zone).
- Feature: Paperclip attachment-count badge on transaction rows — **MISSING** — evidence: zero hits for `Paperclip|paperclip` in `apps/web/src/app/(app)/transaksi/page.tsx`; prototype puts a count badge on 5 rows (`transaksi.html:193-195`, `:236-238`, `:279`, `:338`, `:381`).

---

### Scope-creep flags

1. **Reference lists are consumed by hardcoded option arrays that J1 never mentions rewiring.** The account/e-wallet forms still read from `crud-config.ts`, not from any master table: bank select `apps/web/src/components/crud/crud-config.ts:85-93` (7 options) and e-wallet select `:138` (`["GoPay","OVO","DANA","LinkAja","ShopeePay"]`). The prototype's own add-account dialog offers 9 banks including Danamon / BTN / Jenius-BTPN (`rekening.html:311-322`) — i.e. a family-editable list. Without a follow-up wiring step, J1 ships a master-data page whose data nothing else reads.
2. **`ReferenceItem { …, label, sortOrder, isSystem }` cannot round-trip the fields the existing CRUD forms already collect.** `mdbank` has a second field "Kode Bank" (`crud-config.ts:353-362`) and `mdtxntype` has an "Arah" select `["Masuk","Keluar","Netral"]` (`crud-config.ts:375-379`). The J1 schema has no attribute/value column, so either those fields get dropped or the model needs a `meta`/`code` column — decide before the migration.
3. **Referential-integrity guard on reference-item delete is depicted but not in J1.** `masterdata.html:394-395`: "Menghapus item yang masih dipakai transaksi akan ditolak dengan pesan yang menyebutkan datanya." J1 only lists `GET/POST/DELETE`. The equivalent guard exists for categories (`masterdata/page.tsx:258-265`) so there is a pattern, but it is unscoped work.
4. **`bawaan` badge rendering is implied by `isSystem` but not stated as a UI deliverable.** Prototype renders it on every seeded chip (`masterdata.html:161`, `:201`, `:233`, `:261`, `:297`, `:331`, `:365`); J1 mentions the column, not the badge.
5. **L3 omits the row-level paperclip count badge** shown on 5 prototype rows (`transaksi.html:193-195` etc.). L3 covers only "input in the dialog + list in detail". The badge needs an attachment count on the transaction list DTO — a `TransactionDto` shape change nobody has scoped.
6. **L3 omits the drag-and-drop upload zone** (`transaksi.html:507-522`) and the file metadata line "248 KB · JPEG" (`transaksi.html:504`), which implies the GET response returns size + mimeType per attachment (L2's model has both, so this is cheap — just unstated in the UI task).
7. **Out-of-J/K/L, seen while reading `transaksi.html`:** the prototype detail dialog shows a **"Dicatat oleh"** (recorded-by) row (`transaksi.html:464-467`) and per-row "oleh <member>" attribution (`transaksi.html:197`, `:216`, `:240`). The real detail dialog has neither (`transaksi/page.tsx:305-324`). Belongs to whichever group owns transaction attribution — flagging so it does not fall between groups.
8. **Not a gap, worth recording:** `mastercoa.html` is fully implemented (list, group tabs, add/edit/delete, FIXED/VARIABLE/REIMBURSEMENT) — `mastercoa/page.tsx:171/218/247/266` against `apps/api/src/coa-accounts/coa-accounts.controller.ts:33-77`. No Group J work is needed on that page; only the masterdata↔mastercoa cross-link matters, and it already exists (`masterdata/page.tsx:298-300`).

# Group M + misc pages — backend/feature gap audit

Repo: /home/stealth/WORK/vibes/wealthme2 · branch `development` · read-only audit

## Group M — Laporan COA

### laporan.html

Prototype **does** depict the full "Ringkasan COA" feature described in the task. Every
sub-feature below is **MISSING** from the real app (both web and API).

- Feature: "Ringkasan COA" report tab — **MISSING** — evidence: prototype `docs/prototype/pages/laporan.html:289-291` (`<button class="tab" data-value="rcoa">Ringkasan COA <span class="badge badge--purple">Baru</span></button>`) vs real `apps/web/src/lib/nav.ts:39-56` — `REPORT_TAB_IDS` has 16 ids (`rsum … rpajak`); there is no `rcoa`, so the tab does not exist in the real report page (`apps/web/src/app/(app)/laporan/page.tsx:3484` renders `REPORT_TABS.map(...)`).
- Feature: COA-account picker + year picker — **MISSING** — evidence: `laporan.html:454-472` (`<select id="f-coa">` with 5 hardcoded COA codes, `<select id="f-coa-tahun">` 2024–2026); no equivalent control anywhere in `apps/web/src/app/(app)/laporan/page.tsx` (3676 lines, zero `coa`-matrix references).
- Feature: 31-row (tanggal) × 12-column (Jan–Des) matrix grid — **MISSING** — evidence: `laporan.html:17-22` (comment: "the COA matrix is a 13-column × 31-row grid"), `.coa-matrix` CSS `laporan.html:22-96`, table markup `laporan.html:499`, row build loop `laporan.html:1181-1204`; no matrix table in the real page.
- Feature: stacked per-transaction amounts inside one day-cell — **MISSING** — evidence: `laporan.html:1193-1196` (each cell maps N values to N `<span class="coa-amt">`), hint text `laporan.html:~477` ("Satu hari bisa punya lebih dari satu transaksi — semuanya ditumpuk di sel yang sama"); nothing comparable in the real app.
- Feature: yearly total + transaction count stat — **MISSING** — evidence: `laporan.html:473-476` (`#coa-total`, `#coa-meta`), computed `laporan.html:1211-1213`; monthly Σ footer row at `laporan.html:1206-1210`.
- Feature: cell click → transaction-list dialog — **MISSING** — evidence: `laporan.html:880-895` (`#dlg-coa-detail`, `#dlg-coa-list`, `#dlg-coa-total`), cells wired via `data-cell="${m}-${d}"` at `laporan.html:1196`; no such dialog in the real page.
- Feature: fullscreen matrix dialog ("Perbesar") — **MISSING** (extra, beyond the task description) — evidence: `laporan.html:898-915` (`#dlg-coa-fullscreen`, `openCoaFullscreen()`), `laporan.html:492-496`.
- Feature: `GET .../reports/coa-matrix?coaAccountId=&year=` API endpoint — **MISSING** — evidence: `apps/api/src/reports/reports.controller.ts` exposes exactly 8 endpoints — `summary` (:67), `bank` (:114), `detail` (:141), `pnl` (:168), `balance-sheet` (:195), `cashflow` (:216), `sankey` (:243), `reconciliation-bridge` (:274). Repo-wide grep for `coa-matrix|coaMatrix|coa_matrix` across `apps/api/src`, `apps/web/src`, `packages` returns **zero** hits — no contract DTO either.
- Note (reuse opportunity, not a gap): the prototype's matrix data is **fully mocked client-side** — `COA_ACCOUNTS` seeded constant at `laporan.html:1068`, deterministic generator `buildMatrix()` at `laporan.html:1132-1158`. The existing `GET /reports/detail` (`reports.controller.ts:141`) is the closest existing surface and could plausibly back the cell-click dialog, but the day×month aggregation itself has no backend at all.

**Group M verdict: MISSING end-to-end** — new API endpoint (+ contracts DTO), new report tab id in `nav.ts` (protected/foundation file), new panel component, and i18n keys are all required.

## Misc pages (not tied to a Group) — scope-creep scan

- **beranda.html**: no new unbacked features — "Perlu Perhatian" alert stack (`beranda.html:175-190`) links to persetujuan/liabilitas/asuransi and is a client-side aggregation of data already served by existing fund-request/liability/insurance endpoints; "Alokasi Kekayaan" is backed (`apps/web/src/app/(app)/beranda/page.tsx:186` reads `summary.allocation`).
- **anggaran.html**: no new unbacked features — "Rincian per Tipe Anggaran" maps to the existing `budgetType` grouping shipped by EPIC-017 Task D (`apps/web/src/app/(app)/anggaran/page.tsx:38-51`); "Kewajiban Bulan Ini" maps to the existing obligations section (`anggaran/page.tsx:154-176`, EPIC-023 E2).
- **asuransi.html**: **minor flag** — the two aggregate charts "Premi 6 Bulan Terakhir" (`asuransi.html:35-37`) and "Uang Pertanggungan per Jenis" (`asuransi.html:41`) have no counterpart in the real page (`apps/web/src/app/(app)/asuransi/page.tsx` renders per-item `coverageAmount`/`premiumAmount` only, :175-190). Coverage-per-type is derivable client-side; a real 6-month _paid-premium_ time series is not — it would need a premium-payment history source.
- **kalkulator.html**: no new unbacked features — all 5 calculator tabs (perpuluhan/pph21/investasi/kpr/pensiun) exist in the real page (`apps/web/src/app/(app)/kalkulator/page.tsx:46-58`, `Pph21ResultDto` imported :21); the dotted-rupiah input polish is already tracked as EPIC-024 #8 (`kalkulator.html:374`).
- **notifikasi.html**: no new unbacked features — "Hari Ini / Minggu Ini / Lebih Lama" grouping is a client-side bucketing of the existing `/family-groups/:id/notifications` feed (`apps/web/src/app/(app)/notifikasi/page.tsx:64-84`); real page currently renders one flat list, so this is presentation-only.
- **panduan.html**: **flag** — prototype adds an FAQ section ("Pertanyaan yang Sering Diajukan") and a "Masih Butuh Bantuan?" card with a **"Hubungi Kami" support-ticket dialog** (topic select, related-page field, promise of an email reply within 1×24h) at `panduan.html:470-490`. The real page renders journeys + features only (`apps/web/src/app/(app)/panduan/page.tsx:290-319`) and there is **no support/contact/ticket controller anywhere in `apps/api/src`**. This is an invented, entirely unbacked feature.
- **ringkasan.html**: no new unbacked features — "Health Score" already exists in the real page (`apps/web/src/app/(app)/ringkasan/page.tsx:434-482`).
- **tujuan.html**: no new unbacked features — the on-track/needs-boost/at-risk stat trio matches the real `statusLabels` (`apps/web/src/app/(app)/tujuan/page.tsx:49-73`); "Progres Keseluruhan" is a client-side aggregate over the existing goals list.
- **ai.html**: no new unbacked features — "Penyedia & Kunci" (`ai.html:367-385`) is backed by `apps/api/src/ai-advisor/ai-key.controller.ts:36-66` (GET/PUT/DELETE); "Ringkasan Konteks" (`ai.html:343-360`: net worth, monthly income/expense, member count) is derivable from existing `/reports/summary` + family-members endpoints; "Data yang Dibaca Advisor" (`ai.html:286+`) is a static disclosure list. Real page currently ships chat + not-configured gate only (`apps/web/src/app/(app)/ai/page.tsx`), so these are UI additions, not backend gaps.
- **rekonsiliasi.html**: no new unbacked features — "Pemetaan Kolom" and "Bank yang Didukung" both exist in the real page (`apps/web/src/app/(app)/rekonsiliasi/page.tsx:700`, `:1075` EPIC-023 G2/D17, `:1431` `supportedBanksTitle`).

### Scope-creep flags (summary)

1. **panduan.html — "Hubungi Kami" support-ticket dialog + FAQ** (`panduan.html:470-490`): invented feature with **zero backend** (no support/contact/ticket controller in `apps/api/src`) and no EPIC-024 task group. Either drop it, make it a `mailto:` link, or shape it as a new task — do not build it silently.
2. **asuransi.html — "Premi 6 Bulan Terakhir" chart** (`asuransi.html:35-37`): needs a premium-payment history series that the current insurance API does not expose. Lower severity than #1 (could be approximated from transactions), but it is not backed today.
3. Everything else in the misc set is presentation-layer redesign over data the API already serves.
